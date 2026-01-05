import pandas as pd
import yfinance as yf
import json
import numpy as np
import requests
import os
from datetime import datetime, timedelta
from collections import deque

# --- 設定區域 ---
# 指向您的 Worker API
WORKER_API_URL_RECORDS = 'https://journal-backend.chired.workers.dev/api/records'
WORKER_API_URL_PORTFOLIO = 'https://journal-backend.chired.workers.dev/api/portfolio'

# 讀取環境變數
API_KEY = os.environ.get("API_KEY", "")

# 設定 Header
API_HEADERS = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

BASE_CURRENCY = 'TWD'
EXCHANGE_SYMBOL = 'USDTWD=X'
TAX_RATE_US = 0.30

# ---------------------------------------------------------
# 1. 市場數據下載 (含除權息與匯率)
# ---------------------------------------------------------
def get_market_data(tickers, start_date):
    print(f"下載市場數據...")
    fx_rates = pd.Series(dtype=float)
    
    # 下載匯率
    try:
        fx = yf.Ticker(EXCHANGE_SYMBOL)
        fx_hist = fx.history(start=start_date)
        if not fx_hist.empty:
            fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None)
            fx_rates = fx_hist['Close']
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    # 下載股價與股息
    result = {}
    # 確保 SPY (Benchmark) 也有被下載
    all_tickers = list(set(tickers + ['SPY']))
    
    for t in all_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            # auto_adjust=True 會還原除權息價格，適合計算淨值
            # actions=True 會包含 Dividends 與 Splits
            hist = ticker_obj.history(start=start_date, auto_adjust=True, actions=True)
            
            if not hist.empty:
                hist.index = pd.to_datetime(hist.index).tz_localize(None)
                result[t] = hist
        except Exception as e:
            print(f"標的 {t} 下載失敗: {e}")
            
    return result, fx_rates

# ---------------------------------------------------------
# 2. 核心計算邏輯
# ---------------------------------------------------------
def update_portfolio():
    # --- A. 從 Worker API 獲取交易紀錄 ---
    print("正在從 API 獲取交易紀錄...")
    try:
        resp = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
        api_json = resp.json()
        if not api_json.get('success'):
            print(f"API Error: {api_json.get('error')}")
            return
        records = api_json.get('data', [])
    except Exception as e:
        print(f"連線失敗: {e}")
        return

    if not records:
        print("無交易紀錄，略過計算")
        return

    # --- B. 資料前處理 ---
    df = pd.DataFrame(records)
    # 映射欄位名稱以符合後續邏輯
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
        'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df['Tax'] = pd.to_numeric(df['Tax'].fillna(0)) # 確保有 Tax 欄位
    df = df.sort_values('Date')

    # --- C. 準備市場數據 ---
    start_date = df['Date'].min()
    market_data, fx_rates = get_market_data(df['Symbol'].unique().tolist(), start_date)
    
    if fx_rates.empty:
        print("無法取得匯率，使用預設值 32.0")
        fx_rates = pd.Series([32.0], index=[pd.Timestamp.now()])

    # 建立日期範圍 (從第一筆交易到今天)
    end_date = datetime.now()
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')

    # 初始化變數
    holdings = {} # {symbol: {'qty': 0, 'cost_basis': 0, 'tag': ''}}
    fifo_queues = {} # {symbol: deque([(qty, price, date), ...])}
    
    cash = 0.0 
    invested_capital = 0.0 
    
    # 歷史紀錄列表
    history_data = []
    
    # 已實現損益 (累積)
    total_realized_pnl_twd = 0.0

    # Benchmark 追蹤
    benchmark_units = 0.0
    benchmark_invested = 0.0

    # -----------------------------------------------------
    # D. 每日回測迴圈
    # -----------------------------------------------------
    for d in date_range:
        current_date = d.date()
        
        # 1. 取得當日匯率 (若無則沿用前一日)
        try:
            fx = fx_rates.asof(d)
            if pd.isna(fx): fx = 32.0
        except: fx = 32.0

        # 2. 處理當日發生的交易
        daily_txns = df[df['Date'].dt.date == current_date]
        
        for _, row in daily_txns.iterrows():
            sym = row['Symbol']
            qty = row['Qty']
            price = row['Price']
            comm = row['Commission']
            tax = row.get('Tax', 0)
            txn_type = row['Type']
            tag = row['Tag']
            
            if sym not in holdings:
                holdings[sym] = {'qty': 0.0, 'cost_basis': 0.0, 'tag': tag}
                fifo_queues[sym] = deque()

            # 更新 Tag
            if tag: holdings[sym]['tag'] = tag

            # 交易類型邏輯
            if txn_type == 'BUY':
                cost = (qty * price) + comm + tax # 買入成本含稅費
                holdings[sym]['qty'] += qty
                holdings[sym]['cost_basis'] += cost
                fifo_queues[sym].append({'qty': qty, 'price': price, 'cost_total': cost, 'date': d})
                
                # 金流：視為追加投入資本 (簡單起見，不追蹤現金餘額，只看投入本金)
                invested_capital += (cost * fx)

                # Benchmark 同步買入 (虛擬 SPY)
                if 'SPY' in market_data:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        if not pd.isna(spy_price) and spy_price > 0:
                            b_qty = (cost / spy_price) # 用同樣的錢買 SPY
                            benchmark_units += b_qty
                            benchmark_invested += cost
                    except: pass

            elif txn_type == 'SELL':
                proceeds = (qty * price) - comm - tax
                holdings[sym]['qty'] -= qty
                
                # FIFO 計算已實現損益
                remaining_qty = qty
                cost_of_sold = 0.0
                
                while remaining_qty > 0 and fifo_queues[sym]:
                    batch = fifo_queues[sym][0]
                    if batch['qty'] > remaining_qty:
                        # 此批次夠扣
                        fraction = remaining_qty / batch['qty']
                        batch_cost = batch['cost_total'] * fraction
                        cost_of_sold += batch_cost
                        
                        # 更新批次剩餘
                        batch['qty'] -= remaining_qty
                        batch['cost_total'] -= batch_cost
                        remaining_qty = 0
                    else:
                        # 此批次不夠扣，全扣並移除
                        cost_of_sold += batch['cost_total']
                        remaining_qty -= batch['qty']
                        fifo_queues[sym].popleft()
                
                # 更新總成本與已實現損益
                holdings[sym]['cost_basis'] -= cost_of_sold
                realized_pnl_native = proceeds - cost_of_sold
                total_realized_pnl_twd += (realized_pnl_native * fx)
                
                # 賣出時，投入資本減少 (把本金拿回來)
                # 這裡使用簡單邏輯：賣出金額視為資本撤回
                invested_capital -= (cost_of_sold * fx)
                
                # Benchmark 同步賣出
                if 'SPY' in market_data and benchmark_units > 0:
                    try:
                        spy_price = market_data['SPY']['Close'].asof(d)
                        # 賣出比例
                        # 這裡邏輯較複雜，簡化為：賣出同樣價值的 SPY
                        b_val_sold = proceeds
                        b_qty_sold = b_val_sold / spy_price
                        benchmark_units -= b_qty_sold
                        benchmark_invested -= (cost_of_sold) # 近似值
                    except: pass

            elif txn_type == 'DIV': # 股息
                # 股息視為獲利，不減少投入資本，也不增加持倉
                # 稅後股息
                net_div = price - tax
                total_realized_pnl_twd += (net_div * fx)
                
                # Benchmark 假設股息再投入 (這裡為了簡化，暫不計算Benchmark股息再投入，僅計算價格波動)

        # 3. 自動處理配息與除權 (根據 Market Data)
        # 這裡檢查 holdings 中的每個股票，看今天是否有 Dividends 紀錄
        for sym, h_data in holdings.items():
            if h_data['qty'] > 0 and sym in market_data:
                hist = market_data[sym]
                try:
                    # 檢查當日是否有 Dividends
                    if d in hist.index and 'Dividends' in hist.columns:
                        div_amt = hist.loc[d]['Dividends']
                        if div_amt > 0:
                            # 自動計算股息 (假設已包含在自動下載的數據中)
                            # 如果手動已輸入 DIV 交易，這裡可能會重複，
                            # 所以通常策略是：如果使用者手動記了 DIV，就不跑這裡。
                            # 為了簡單，這裡先略過自動配息計算，以使用者手動輸入為主。
                            pass
                except: pass

        # 4. 計算當日市值
        total_market_value_twd = 0.0
        
        for sym, h_data in holdings.items():
            qty = h_data['qty']
            if qty > 0.000001: # 忽略極小誤差
                curr_price = 0.0
                if sym in market_data:
                    try:
                        curr_price = market_data[sym]['Close'].asof(d)
                        if pd.isna(curr_price): # 若假日沒開盤，找最近一日
                             curr_price = market_data[sym]['Close'].asof(datetime.now())
                    except: pass
                
                # 如果找不到價格，用最後一次交易價 (這裡簡化處理)
                if pd.isna(curr_price) or curr_price == 0:
                    curr_price = 0 # 或用成本價估算
                
                val_native = qty * curr_price
                val_twd = val_native * fx
                total_market_value_twd += val_twd

        # 5. 計算 Benchmark 市值
        bench_val_twd = 0.0
        if 'SPY' in market_data:
            try:
                spy_p = market_data['SPY']['Close'].asof(d)
                if pd.isna(spy_p): spy_p = 0
                bench_val_twd = benchmark_units * spy_p * fx
            except: pass

        # 6. 計算 TWR (Time-Weighted Return) - 簡化版
        # TWR = (期末市值 / (期初市值 + 現金流)) - 1
        # 這裡使用 累計損益 / 投入資本 的簡單概念做近似值 (MWR/TWR 混合)
        # 嚴謹 TWR 需要每日分段。這裡用 (總現值 + 已實現) / 總投入
        
        twr_pct = 0.0
        if invested_capital > 0:
            # 總資產 = 持倉市值 + 已提現(已實現損益 + 本金撤回...這有點複雜)
            # 簡單公式：(未實現損益 + 已實現損益) / 總投入成本
            unrealized_pnl = total_market_value_twd - invested_capital # 這裡 invested_capital 需調整
            # 更正：市值 - 剩餘成本 = 未實現
            
            # 計算剩餘持倉的總成本
            current_cost_basis_twd = 0
            for sym, h_data in holdings.items():
                current_cost_basis_twd += (h_data['cost_basis'] * fx)
                
            unrealized_pnl = total_market_value_twd - current_cost_basis_twd
            total_profit = unrealized_pnl + total_realized_pnl_twd
            
            # 分母用「平均投入資本」或「當前投入資本」
            # 這裡用 當前持倉成本 + 已實現部分的成本 (太複雜)
            # 改用簡單績效： 總損益 / (總市值 - 總損益) -> 錯誤
            
            # 使用 Modified Dietz 或簡單 ROI: Profit / Max Invested
            # 這裡暫用：總損益 / 當前持倉成本 (若清倉則...)
            if current_cost_basis_twd > 0:
                twr_pct = (total_profit / current_cost_basis_twd) * 100
            else:
                twr_pct = 0 # 已清倉

        # Benchmark TWR (簡化)
        bench_twr = 0.0
        if benchmark_invested > 0:
             bench_profit = bench_val_twd - benchmark_invested
             bench_twr = (bench_profit / benchmark_invested) * 100

        # 紀錄歷史
        history_data.append({
            "date": d.strftime("%Y-%m-%d"),
            "total_value": round(total_market_value_twd, 0),
            "invested": round(invested_capital, 0), # 這裡顯示當前滯留本金
            "twr": round(twr_pct, 2),
            "benchmark_twr": round(bench_twr, 2)
        })

    # -----------------------------------------------------
    # E. 產生最終輸出 (Final Output)
    # -----------------------------------------------------
    
    # 整理最新持倉
    final_holdings = []
    current_fx = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
    
    for sym, h_data in holdings.items():
        qty = h_data['qty']
        if qty > 0.001:
            curr_p = 0
            if sym in market_data:
                try:
                    curr_p = market_data[sym]['Close'].iloc[-1]
                except: pass
            
            mkt_val = qty * curr_p
            mkt_val_twd = mkt_val * current_fx
            cost_twd = h_data['cost_basis'] * current_fx # 估算
            pnl_twd = mkt_val_twd - cost_twd
            pnl_pct = (pnl_twd / cost_twd * 100) if cost_twd > 0 else 0
            
            final_holdings.append({
                "symbol": sym,
                "tag": h_data['tag'],
                "currency": "USD", # 假設美股
                "qty": round(qty, 2),
                "market_value_twd": round(mkt_val_twd, 0),
                "pnl_twd": round(pnl_twd, 0),
                "pnl_percent": round(pnl_pct, 2),
                "current_price_origin": round(curr_p, 2)
            })
            
    # 排序持倉 (市值大到小)
    final_holdings.sort(key=lambda x: x['market_value_twd'], reverse=True)

    # 摘要
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

    # --- F. 上傳至 Cloudflare D1 ---
    print("計算完成，正在上傳至 Cloudflare D1...")
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
