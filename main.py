import pandas as pd
import yfinance as yf
import json
import numpy as np
import requests
import os
from datetime import datetime, timedelta
from collections import deque
import time

# ==========================================
# 1. 設定區域 (Configuration)
# ==========================================

WORKER_BASE_URL = 'https://journal-backend.chired.workers.dev'
WORKER_API_URL_RECORDS = f'{WORKER_BASE_URL}/api/records'
WORKER_API_URL_PORTFOLIO = f'{WORKER_BASE_URL}/api/portfolio'

# 讀取環境變數
API_KEY = os.environ.get("API_KEY", "")

API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'USDTWD=X'

# ==========================================
# 2. 市場數據下載模組 (修復版)
# ==========================================
def get_market_data(tickers, start_date):
    """
    關鍵修復：
    1. normalize(): 強制將時間設為 00:00:00，解決 asof 錯位問題
    2. ffill(): 匯率與股價進行填補，避免假日 NaN
    """
    print(f"正在下載市場數據，起始日期: {start_date}...")
    
    # 1. 下載匯率
    fx_rates = pd.Series(dtype=float)
    try:
        fx = yf.Ticker(EXCHANGE_SYMBOL)
        fx_hist = fx.history(start=start_date - timedelta(days=7))
        
        if not fx_hist.empty:
            # [Fix 1] 移除時區並歸零時間
            fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None).normalize()
            # [Fix 2] 重新採樣並填補空值 (解決假日匯率缺失)
            fx_rates = fx_hist['Close'].asfreq('D').ffill()
            print(f"匯率下載成功，最新匯率: {fx_rates.iloc[-1]:.2f}")
        else:
            print("警告: 匯率數據為空")
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    # 匯率防呆 (若完全下載失敗，建立一個假序列)
    if fx_rates.empty:
        print("嚴重警告: 無法取得匯率，使用預設值 32.0")
        dates = pd.date_range(start=start_date, end=datetime.now(), freq='D')
        fx_rates = pd.Series(32.0, index=dates)

    # 2. 下載個股數據
    result = {}
    all_tickers = list(set([t for t in tickers if t] + ['SPY']))
    
    for t in all_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            # auto_adjust=False 取得原始價格，actions=True 包含拆股
            hist = ticker_obj.history(start=start_date, auto_adjust=False, actions=True)
            
            if not hist.empty:
                # [Fix 1] 強制時間歸零，確保與 split action 對齊
                hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                result[t] = hist
                print(f"[{t}] 數據下載成功 ({len(hist)} 筆)")
            else:
                print(f"[{t}] 警告: 無法取得歷史數據")
                
        except Exception as e:
            print(f"[{t}] 下載發生錯誤: {e}")
            
    return result, fx_rates

# ==========================================
# 3. 核心計算邏輯
# ==========================================
def update_portfolio():
    print("=== 開始執行投資組合計算 (Fix Split & Cost) ===")

    # --- A. 獲取交易紀錄 ---
    try:
        resp = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
        if resp.status_code != 200: return
        api_json = resp.json()
        if not api_json.get('success'): return
        records = api_json.get('data', [])
    except Exception as e:
        print(f"API Error: {e}")
        return

    if not records: return

    # --- B. 資料前處理 ---
    df = pd.DataFrame(records)
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) 
    df = df.sort_values('Date')

    # --- C. 準備數據 ---
    start_date = df['Date'].min()
    fetch_start_date = start_date - timedelta(days=10) # 多抓幾天
    market_data, fx_rates = get_market_data(df['Symbol'].unique().tolist(), fetch_start_date)
    
    # 建立回測日期 (normalize 確保是 00:00:00)
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')

    # --- D. 狀態變數 ---
    holdings = {} 
    fifo_queues = {} 
    invested_capital = 0.0
    total_realized_pnl_twd = 0.0
    history_data = []
    
    benchmark_units = 0.0
    benchmark_invested = 0.0

    print("開始逐日回測計算...")

    # --- E. 逐日回測 ---
    for d in date_range:
        current_date = d.date()
        
        # 取得匯率 (使用 asof 配合 ffill 的數據非常安全)
        try:
            fx = fx_rates.asof(d)
            if pd.isna(fx): fx = 32.0
        except: fx = 32.0

        # ------------------------------------------
        # 1. 優先處理拆股 (Fix: 確保時間對齊)
        # ------------------------------------------
        for sym, h_data in holdings.items():
            if h_data['qty'] > 0 and sym in market_data:
                actions = market_data[sym]
                # 因為 actions.index 和 d 都已經 normalized，可以直接比對
                if d in actions.index and 'Stock Splits' in actions.columns:
                    split_ratio = actions.loc[d]['Stock Splits']
                    
                    if split_ratio > 0 and split_ratio != 1:
                        print(f"[{current_date}] {sym} 拆股 x{split_ratio}")
                        
                        # 調整持倉
                        h_data['qty'] *= split_ratio
                        # 注意：Cost Basis (總成本) 不變
                        
                        # 調整 FIFO
                        if sym in fifo_queues:
                            for batch in fifo_queues[sym]:
                                batch['qty'] *= split_ratio
                                batch['price'] /= split_ratio

        # ------------------------------------------
        # 2. 處理交易
        # ------------------------------------------
        daily_txns = df[df['Date'].dt.date == current_date]
        
        for _, row in daily_txns.iterrows():
            sym = row['Symbol']
            qty = row['Qty']
            price = row['Price']
            comm = row['Commission']
            tax = row['Tax']
            txn_type = row['Type']
            tag = row['Tag']
            
            if sym not in holdings:
                holdings[sym] = {'qty': 0.0, 'cost_basis': 0.0, 'tag': tag}
                fifo_queues[sym] = deque()
            
            if tag: holdings[sym]['tag'] = tag

            if txn_type == 'BUY':
                cost = (qty * price) + comm + tax 
                holdings[sym]['qty'] += qty
                holdings[sym]['cost_basis'] += cost # 累積 USD 成本
                
                fifo_queues[sym].append({
                    'qty': qty, 'price': price, 'cost_total': cost, 'date': d
                })
                invested_capital += (cost * fx)
                
                # Benchmark SPY
                if 'SPY' in market_data:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        if not pd.isna(spy_price) and spy_price > 0:
                            b_qty = cost / spy_price 
                            benchmark_units += b_qty
                            benchmark_invested += cost
                    except: pass

            elif txn_type == 'SELL':
                proceeds = (qty * price) - comm - tax
                holdings[sym]['qty'] -= qty
                
                remaining = qty
                cost_sold = 0.0
                
                while remaining > 0 and fifo_queues[sym]:
                    batch = fifo_queues[sym][0]
                    if batch['qty'] > remaining:
                        frac = remaining / batch['qty']
                        part_cost = batch['cost_total'] * frac
                        cost_sold += part_cost
                        batch['qty'] -= remaining
                        batch['cost_total'] -= part_cost
                        remaining = 0
                    else:
                        cost_sold += batch['cost_total']
                        remaining -= batch['qty']
                        fifo_queues[sym].popleft()
                
                holdings[sym]['cost_basis'] -= cost_sold
                
                realized_pnl_native = proceeds - cost_sold
                total_realized_pnl_twd += (realized_pnl_native * fx)
                invested_capital -= (cost_sold * fx)
                
                # Benchmark Sell
                if 'SPY' in market_data and benchmark_units > 0:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        b_val_sold = proceeds
                        b_qty_sold = b_val_sold / spy_price
                        benchmark_units -= b_qty_sold
                        benchmark_invested -= cost_sold 
                    except: pass

            elif txn_type == 'DIV':
                net_div = price - tax
                total_realized_pnl_twd += (net_div * fx)

        # ------------------------------------------
        # 3. 每日結算 (Fix: 使用 asof 確保抓到正確價格)
        # ------------------------------------------
        total_market_value_twd = 0.0
        current_cost_basis_twd = 0.0
        
        for sym, h_data in holdings.items():
            qty = h_data['qty']
            # 計算當前持倉的歷史成本 (USD basis * 今日匯率)
            # 註: 若要嚴格台幣本位需改用 Phase 4 代碼，此為修復 Phase 1 邏輯
            current_cost_basis_twd += (h_data['cost_basis'] * fx)
            
            if qty > 0.0001:
                curr_price = 0.0
                if sym in market_data:
                    try:
                        # asof 會自動抓取 d (00:00) 或之前的最後價格
                        # 因為 normalize 過，拆股日的 d 會準確對應拆股後的低價
                        curr_price = market_data[sym]['Close'].asof(d)
                        if pd.isna(curr_price): curr_price = 0
                    except: pass
                
                val_twd = qty * curr_price * fx
                total_market_value_twd += val_twd

        # 績效計算
        unrealized_pnl = total_market_value_twd - current_cost_basis_twd
        total_profit = unrealized_pnl + total_realized_pnl_twd
        
        twr_pct = 0.0
        if current_cost_basis_twd > 0:
            twr_pct = (total_profit / current_cost_basis_twd) * 100
        elif total_market_value_twd == 0 and total_realized_pnl_twd != 0 and invested_capital > 0:
             twr_pct = (total_realized_pnl_twd / invested_capital) * 100

        # Benchmark
        bench_val_twd = 0.0
        bench_twr = 0.0
        if 'SPY' in market_data:
            try:
                spy_p = market_data['SPY']['Close'].asof(d)
                if not pd.isna(spy_p):
                    bench_val_twd = benchmark_units * spy_p * fx
            except: pass
        if benchmark_invested > 0:
            bench_profit = bench_val_twd - benchmark_invested
            bench_twr = (bench_profit / benchmark_invested) * 100

        history_data.append({
            "date": d.strftime("%Y-%m-%d"),
            "total_value": round(total_market_value_twd, 0),
            "invested": round(invested_capital, 0),
            "twr": round(twr_pct, 2),
            "benchmark_twr": round(bench_twr, 2)
        })

    # --- F. 最終輸出 ---
    print("回測完成，整理數據中...")
    
    final_holdings = []
    current_fx = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
    
    for sym, h_data in holdings.items():
        qty = h_data['qty']
        if qty > 0.001:
            curr_p = 0
            if sym in market_data:
                try: curr_p = market_data[sym]['Close'].iloc[-1]
                except: pass
            
            mkt_val_twd = qty * curr_p * current_fx
            cost_twd = h_data['cost_basis'] * current_fx
            pnl_twd = mkt_val_twd - cost_twd
            pnl_pct = (pnl_twd / cost_twd * 100) if cost_twd > 0 else 0
            
            final_holdings.append({
                "symbol": sym,
                "tag": h_data['tag'],
                "currency": "USD",
                "qty": round(qty, 2),
                "market_value_twd": round(mkt_val_twd, 0),
                "pnl_twd": round(pnl_twd, 0),
                "pnl_percent": round(pnl_pct, 2),
                "current_price_origin": round(curr_p, 2)
            })
    
    final_holdings.sort(key=lambda x: x['market_value_twd'], reverse=True)
    
    curr_total_val = sum(h['market_value_twd'] for h in final_holdings)
    curr_invested = sum((holdings[h['symbol']]['cost_basis'] * current_fx) for h in final_holdings)
    curr_unrealized = curr_total_val - curr_invested
    
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "base_currency": BASE_CURRENCY,
        "exchange_rate": round(current_fx, 2),
        "summary": {
            "total_value": round(curr_total_val, 0),
            "invested_capital": round(curr_invested, 0),
            "total_pnl": round(curr_unrealized + total_realized_pnl_twd, 0),
            "twr": history_data[-1]['twr'] if history_data else 0,
            "realized_pnl": round(total_realized_pnl_twd, 0),
            "benchmark_twr": history_data[-1]['benchmark_twr'] if history_data else 0
        },
        "holdings": final_holdings,
        "history": history_data
    }

    # --- G. 上傳 ---
    try:
        response = requests.post(WORKER_API_URL_PORTFOLIO, json=final_output, headers=API_HEADERS)
        if response.status_code == 200:
            print("上傳成功")
        else:
            print(f"上傳失敗: {response.text}")
    except Exception as e:
        print(f"上傳錯誤: {e}")

if __name__ == "__main__":
    update_portfolio()
