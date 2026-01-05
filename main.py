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

# Worker API URL (請確認此網址與您的 Cloudflare Worker 一致)
WORKER_BASE_URL = 'https://journal-backend.chired.workers.dev'
WORKER_API_URL_RECORDS = f'{WORKER_BASE_URL}/api/records'
WORKER_API_URL_PORTFOLIO = f'{WORKER_BASE_URL}/api/portfolio'

# 讀取環境變數 (GitHub Secrets)
API_KEY = os.environ.get("API_KEY", "")

# API Headers
API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

# 基礎設定
BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'USDTWD=X'

# ==========================================
# 2. 市場數據下載模組
# ==========================================
def get_market_data(tickers, start_date):
    """
    下載股價、匯率、配息與拆股資訊
    """
    print(f"正在下載市場數據，起始日期: {start_date}...")
    
    # 1. 下載匯率 (USD -> TWD)
    fx_rates = pd.Series(dtype=float)
    try:
        fx = yf.Ticker(EXCHANGE_SYMBOL)
        fx_hist = fx.history(start=start_date)
        if not fx_hist.empty:
            # 移除時區資訊，避免與交易日期格式衝突
            fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None)
            fx_rates = fx_hist['Close']
            print(f"匯率下載成功，最新匯率: {fx_rates.iloc[-1]:.2f}")
        else:
            print("警告: 匯率數據為空，將使用預設值")
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    # 2. 下載個股數據 (含 Benchmark SPY)
    result = {}
    # 確保列表包含 SPY 且不重複
    all_tickers = list(set(tickers + ['SPY']))
    
    for t in all_tickers:
        if not t: continue
        try:
            ticker_obj = yf.Ticker(t)
            # auto_adjust=True: 修正收盤價 (Adjusted Close)
            # actions=True: 包含 Dividends (股息) 與 Stock Splits (拆股)
            hist = ticker_obj.history(start=start_date, auto_adjust=True, actions=True)
            
            if not hist.empty:
                hist.index = pd.to_datetime(hist.index).tz_localize(None)
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
    print("=== 開始執行投資組合計算 ===")

    # --- A. 從 Worker API 獲取交易紀錄 ---
    print(f"正在連線至 API: {WORKER_API_URL_RECORDS}")
    try:
        resp = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
        
        if resp.status_code != 200:
            print(f"API 連線失敗 [Status: {resp.status_code}]: {resp.text}")
            return

        api_json = resp.json()
        if not api_json.get('success'):
            print(f"API 回傳錯誤: {api_json.get('error')}")
            return
            
        records = api_json.get('data', [])
        print(f"成功取得 {len(records)} 筆交易紀錄")
        
    except Exception as e:
        print(f"API 連線發生例外狀況: {e}")
        return

    if not records:
        print("無交易紀錄，程式結束")
        return

    # --- B. 資料前處理 ---
    df = pd.DataFrame(records)
    
    # 映射欄位名稱 (DB欄位 -> 程式內部邏輯欄位)
    # DB: txn_date, symbol, txn_type, qty, price, fee, tax, tag
    df.rename(columns={
        'txn_date': 'Date', 
        'symbol': 'Symbol', 
        'txn_type': 'Type', 
        'qty': 'Qty', 
        'price': 'Price', 
        'fee': 'Commission', 
        'tax': 'Tax', 
        'tag': 'Tag'
    }, inplace=True)
    
    # 型別轉換
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) # 交易稅
    
    # 依日期排序 (FIFO 計算的關鍵)
    df = df.sort_values('Date')

    # --- C. 準備市場數據 ---
    start_date = df['Date'].min()
    # 稍微多抓幾天緩衝
    fetch_start_date = start_date - timedelta(days=5)
    
    market_data, fx_rates = get_market_data(df['Symbol'].unique().tolist(), fetch_start_date)
    
    # 匯率防呆
    if fx_rates.empty:
        print("嚴重警告: 無法取得匯率，全域使用 32.0")
        fx_rates = pd.Series([32.0], index=[pd.Timestamp.now()])

    # 建立回測日期範圍 (從第一筆交易直到今天)
    end_date = datetime.now()
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')

    # --- D. 初始化狀態變數 ---
    # 持倉狀態: {symbol: {'qty': 0, 'cost_basis': 0, 'tag': ''}}
    holdings = {} 
    
    # FIFO 佇列: {symbol: deque([ {'qty':..., 'price':..., 'cost_total':..., 'date':...} ])}
    fifo_queues = {} 
    
    # 資金狀態
    invested_capital = 0.0      # 總投入本金 (TWD)
    total_realized_pnl_twd = 0.0 # 累積已實現損益 (TWD)
    
    # 歷史趨勢紀錄
    history_data = []
    
    # Benchmark (SPY) 狀態
    benchmark_units = 0.0
    benchmark_invested = 0.0

    print("開始逐日回測計算...")

    # --- E. 逐日回測迴圈 (Day-by-Day Loop) ---
    for d in date_range:
        current_date = d.date()
        
        # 1. 取得當日匯率 (若假日無數據，取最近一日)
        try:
            fx = fx_rates.asof(d)
            if pd.isna(fx): fx = 32.0
        except: fx = 32.0

        # ==========================================
        # [核心] 處理拆股 (Stock Splits)
        # ==========================================
        # 在處理當日交易前，先檢查當日是否有拆股事件，調整現有持倉
        for sym, h_data in holdings.items():
            if h_data['qty'] > 0 and sym in market_data:
                actions = market_data[sym]
                
                # 檢查 yfinance 的 'Stock Splits' 欄位
                if d in actions.index and 'Stock Splits' in actions.columns:
                    split_ratio = actions.loc[d]['Stock Splits']
                    
                    # split_ratio 例如 2.0 代表 1股拆成2股 (2-for-1)
                    if split_ratio > 0 and split_ratio != 1:
                        print(f"[{current_date}] 偵測到 {sym} 拆股，比例: {split_ratio}")
                        
                        # 1. 調整總持倉股數 (總成本不變，單位成本下降)
                        h_data['qty'] *= split_ratio
                        
                        # 2. 調整 FIFO 佇列中的每一批次
                        if sym in fifo_queues:
                            for batch in fifo_queues[sym]:
                                batch['qty'] *= split_ratio
                                batch['price'] /= split_ratio # 買入單價相應降低
                                # batch['cost_total'] 維持不變

        # ==========================================
        # 處理當日交易 (Transactions)
        # ==========================================
        daily_txns = df[df['Date'].dt.date == current_date]
        
        for _, row in daily_txns.iterrows():
            sym = row['Symbol']
            qty = row['Qty']
            price = row['Price']
            comm = row['Commission'] # 手續費
            tax = row['Tax']         # 交易稅
            txn_type = row['Type']
            tag = row['Tag']
            
            # 初始化持倉結構
            if sym not in holdings:
                holdings[sym] = {'qty': 0.0, 'cost_basis': 0.0, 'tag': tag}
                fifo_queues[sym] = deque()
            
            # 更新最新標籤
            if tag: holdings[sym]['tag'] = tag

            # --- 買入 (BUY) ---
            if txn_type == 'BUY':
                # 買入成本 = (股數 * 單價) + 手續費 + 交易稅
                cost = (qty * price) + comm + tax 
                
                # 更新持倉
                holdings[sym]['qty'] += qty
                holdings[sym]['cost_basis'] += cost
                
                # 加入 FIFO 佇列
                fifo_queues[sym].append({
                    'qty': qty, 
                    'price': price, 
                    'cost_total': cost, 
                    'date': d
                })
                
                # 增加總投入本金 (TWD)
                invested_capital += (cost * fx)
                
                # Benchmark (虛擬買入 SPY)
                if 'SPY' in market_data:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        if not pd.isna(spy_price) and spy_price > 0:
                            # 用相同的資金買入 SPY
                            b_qty = (cost / spy_price) 
                            benchmark_units += b_qty
                            benchmark_invested += cost
                    except: pass

            # --- 賣出 (SELL) ---
            elif txn_type == 'SELL':
                # 賣出淨入 = (股數 * 單價) - 手續費 - 交易稅
                proceeds = (qty * price) - comm - tax
                
                holdings[sym]['qty'] -= qty
                
                # FIFO 計算已實現損益 (Realized P&L)
                remaining_qty_to_sell = qty
                cost_of_sold_shares = 0.0
                
                while remaining_qty_to_sell > 0 and fifo_queues[sym]:
                    batch = fifo_queues[sym][0] # 看最早的一批
                    
                    if batch['qty'] > remaining_qty_to_sell:
                        # 此批次股數 > 賣出股數 (部分賣出)
                        fraction = remaining_qty_to_sell / batch['qty']
                        batch_cost_portion = batch['cost_total'] * fraction
                        
                        cost_of_sold_shares += batch_cost_portion
                        
                        # 更新該批次剩餘狀態
                        batch['qty'] -= remaining_qty_to_sell
                        batch['cost_total'] -= batch_cost_portion
                        remaining_qty_to_sell = 0
                    else:
                        # 此批次股數 <= 賣出股數 (整批賣掉)
                        cost_of_sold_shares += batch['cost_total']
                        remaining_qty_to_sell -= batch['qty']
                        fifo_queues[sym].popleft() # 移除此批次
                
                # 更新持倉總成本
                holdings[sym]['cost_basis'] -= cost_of_sold_shares
                
                # 計算損益
                realized_pnl_native = proceeds - cost_of_sold_shares
                total_realized_pnl_twd += (realized_pnl_native * fx)
                
                # 賣出視為本金撤出 (減少投入資本)
                invested_capital -= (cost_of_sold_shares * fx)
                
                # Benchmark (虛擬賣出 SPY)
                if 'SPY' in market_data and benchmark_units > 0:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        # 賣出相同價值的 SPY
                        b_val_sold = proceeds
                        b_qty_sold = b_val_sold / spy_price
                        benchmark_units -= b_qty_sold
                        # 減少 Benchmark 成本 (近似)
                        benchmark_invested -= cost_of_sold_shares 
                    except: pass

            # --- 股息 (DIV) ---
            elif txn_type == 'DIV':
                # 股息淨額 = 金額 - 稅
                # 注意：這裡 Price 欄位通常填入股息總金額
                net_div = price - tax
                total_realized_pnl_twd += (net_div * fx)
                # 股息不影響投入本金，直接算入獲利

        # ==========================================
        # 每日結算 (Valuation)
        # ==========================================
        total_market_value_twd = 0.0
        current_cost_basis_twd = 0.0
        
        for sym, h_data in holdings.items():
            qty = h_data['qty']
            
            # 累加當前持倉的成本 (用於計算未實現損益)
            current_cost_basis_twd += (h_data['cost_basis'] * fx)
            
            if qty > 0.0001: # 忽略浮點數誤差
                curr_price = 0.0
                if sym in market_data:
                    try:
                        # 取得當日收盤價
                        curr_price = market_data[sym]['Close'].asof(d)
                        # 若當日無報價(假日)，取最近一天
                        if pd.isna(curr_price): 
                            curr_price = market_data[sym]['Close'].asof(datetime.now())
                    except: pass
                
                # 計算市值
                val_twd = qty * curr_price * fx
                total_market_value_twd += val_twd

        # ==========================================
        # 計算績效 (TWR / ROI)
        # ==========================================
        # 總獲利 = (期末市值 - 持倉成本) + 已實現損益
        unrealized_pnl = total_market_value_twd - current_cost_basis_twd
        total_profit = unrealized_pnl + total_realized_pnl_twd
        
        twr_pct = 0.0
        # 簡單回報率 = 總獲利 / 當前持倉成本 (作為分母的近似值)
        # 註：這是一個簡化的 ROI 計算，若要嚴謹 TWR 需處理每日現金流
        if current_cost_basis_twd > 0:
            twr_pct = (total_profit / current_cost_basis_twd) * 100
        elif total_market_value_twd == 0 and total_realized_pnl_twd != 0 and invested_capital > 0:
             # 已清倉但有歷史獲利
             twr_pct = (total_realized_pnl_twd / invested_capital) * 100

        # Benchmark 績效
        bench_val_twd = 0.0
        bench_twr = 0.0
        if 'SPY' in market_data:
            try:
                spy_p = market_data['SPY']['Close'].asof(d)
                if pd.isna(spy_p): spy_p = 0
                bench_val_twd = benchmark_units * spy_p * fx
            except: pass
            
        if benchmark_invested > 0:
            bench_profit = bench_val_twd - benchmark_invested
            bench_twr = (bench_profit / benchmark_invested) * 100

        # 寫入歷史紀錄
        history_data.append({
            "date": d.strftime("%Y-%m-%d"),
            "total_value": round(total_market_value_twd, 0),
            "invested": round(invested_capital, 0),
            "twr": round(twr_pct, 2),
            "benchmark_twr": round(bench_twr, 2)
        })

    # --- F. 產生最終輸出 (Final Output) ---
    print("回測完成，正在整理最終數據...")
    
    final_holdings = []
    # 取得最新匯率
    current_fx = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
    
    for sym, h_data in holdings.items():
        qty = h_data['qty']
        # 只顯示還有持倉的股票
        if qty > 0.001:
            curr_p = 0
            if sym in market_data:
                try: 
                    curr_p = market_data[sym]['Close'].iloc[-1]
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
    
    # 依市值排序
    final_holdings.sort(key=lambda x: x['market_value_twd'], reverse=True)
    
    # 計算當前摘要 (Summary)
    # 注意：Summary 應反映「最新狀態」，而非歷史迴圈的最後一天 (雖然通常相同)
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

    # --- G. 上傳至 Cloudflare D1 ---
    print(f"計算完成，正在上傳至 Cloudflare D1 ({WORKER_API_URL_PORTFOLIO})...")
    
    try:
        response = requests.post(
            WORKER_API_URL_PORTFOLIO, 
            json=final_output, 
            headers=API_HEADERS
        )
        
        if response.status_code == 200:
            print(f"上傳成功! Worker 回應: {response.text}")
        else:
            print(f"上傳失敗 [{response.status_code}]: {response.text}")
            
    except Exception as e:
        print(f"上傳過程發生錯誤: {e}")

if __name__ == "__main__":
    update_portfolio()
