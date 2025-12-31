import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta
from collections import deque

# --- 設定 ---
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'
BENCHMARK_SYMBOL = 'SPY' # 比較基準 (可改 QQQ)

def get_market_data(tickers, start_date):
    """下載股價與拆股資訊 (包含基準指數)"""
    all_tickers = list(set(tickers + [BENCHMARK_SYMBOL]))
    print(f"下載市場數據... (含 {BENCHMARK_SYMBOL})")
    
    try:
        # yfinance 的多股票下載結構比較複雜，為了穩定性，我們還是單獨處理
        result = {}
        for t in all_tickers:
            try:
                # auto_adjust=True 取得復權價 (計算績效用)
                ticker_obj = yf.Ticker(t)
                hist = ticker_obj.history(start=start_date, auto_adjust=True)
                
                # 確保時區統一
                hist.index = pd.to_datetime(hist.index).tz_localize(None)
                
                result[t] = {
                    'close': hist['Close'], 
                    'splits': hist['Stock Splits']
                }
            except Exception as e:
                print(f"無法下載 {t}: {e}")
        return result
    except Exception as e:
        print(f"下載失敗: {e}")
        return {}

def safe_float(val):
    try:
        if pd.isna(val) or val == '': return 0.0
        return float(val)
    except: return 0.0

def get_split_adjustment(tx_date, split_data):
    """計算拆股調整係數"""
    multiplier = 1.0
    if split_data is None or split_data.empty: return multiplier
    
    tx_date = pd.Timestamp(tx_date).tz_localize(None)
    # split_data index 已在下載時轉為 naive
    relevant_splits = split_data[split_data.index > tx_date]
    
    for split_ratio in relevant_splits:
        if split_ratio > 0: multiplier *= split_ratio
    return multiplier

def update_portfolio():
    print("讀取交易紀錄...")
    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
        df = df.sort_values('Date')
        for col in ['Comm', 'Tax', 'Qty', 'Price']:
            if col not in df.columns: df[col] = 0
            df[col] = df[col].fillna(0)
    except Exception as e:
        print(f"Google Sheet 讀取失敗: {e}")
        return

    df = df[df['Symbol'].str.upper() != 'CASH'].copy()
    tickers = df['Symbol'].unique().tolist()
    if not tickers: return

    # 1. 市場數據
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    market_data = get_market_data(tickers, start_date)

    # 2. 時間軸
    start_dt = df['Date'].min()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    # 3. 初始化狀態
    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers}
    
    net_invested = 0.0
    total_realized_pnl = 0.0
    
    closed_positions = []
    history_data = []
    
    transactions_map = {}
    for date, group in df.groupby('Date'):
        transactions_map[date] = group.to_dict('records')

    # TWR 計算相關變數
    prev_total_value = 0.0 # 昨日總資產
    twr_cumulative = 1.0   # 累積 TWR 因子
    benchmark_cumulative = 1.0 # 累積大盤因子
    
    # 抓取基準的初始價格 (用於計算大盤曲線)
    benchmark_start_price = 0
    if BENCHMARK_SYMBOL in market_data and not market_data[BENCHMARK_SYMBOL]['close'].empty:
        # 找到最接近 start_dt 的股價
        closes = market_data[BENCHMARK_SYMBOL]['close']
        try:
            benchmark_start_price = closes.asof(start_dt)
            if pd.isna(benchmark_start_price): benchmark_start_price = closes.iloc[0]
        except: pass

    print("開始計算 TWR 與資產曲線...")

    for current_date in all_dates:
        daily_cash_flow = 0.0 # 當日淨現金流 (入金-出金)
        
        # A. 處理交易
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                
                raw_qty = safe_float(tx['Qty'])
                raw_price = safe_float(tx['Price'])
                comm = safe_float(tx['Comm'])
                tax = safe_float(tx['Tax'])
                
                # 自動拆股調整
                split_ratio = 1.0
                if symbol in market_data:
                    split_ratio = get_split_adjustment(current_date, market_data[symbol]['splits'])
                
                adj_qty = raw_qty * split_ratio
                # 價格不需要除以 split_ratio，因為我們下面是用 raw_price * raw_qty 計算總金額
                # 總金額是不變的，只有股數變多，單價變低
                
                if action == 'BUY':
                    cost = (raw_price * raw_qty) + comm
                    net_invested += cost
                    daily_cash_flow += cost # 買入視為資金流入股市
                    
                    holdings[symbol] += adj_qty
                    adj_unit_cost = cost / adj_qty if adj_qty > 0 else 0
                    fifo_queue[symbol].append({'qty': adj_qty, 'unit_cost': adj_unit_cost, 'raw_date': current_date})
                    
                elif action == 'SELL':
                    proceeds = (raw_price * raw_qty) - comm - tax
                    net_invested -= proceeds
                    daily_cash_flow -= proceeds # 賣出視為資金流出股市
                    
                    holdings[symbol] -= adj_qty
                    
                    # FIFO P&L
                    qty_to_sell = adj_qty
                    while qty_to_sell > 0.000001 and fifo_queue[symbol]:
                        batch = fifo_queue[symbol][0]
                        sell_amt = min(qty_to_sell, batch['qty'])
                        
                        cost_part = batch['unit_cost'] * sell_amt
                        rev_part = (proceeds / adj_qty) * sell_amt
                        pnl = rev_part - cost_part
                        total_realized_pnl += pnl
                        
                        closed_positions.append({
                            'symbol': symbol,
                            'open_date': batch['raw_date'].strftime('%Y-%m-%d'),
                            'close_date': current_date.strftime('%Y-%m-%d'),
                            'qty': round(sell_amt, 2),
                            'buy_price': round(batch['unit_cost'], 2),
                            'sell_price': round(rev_part/sell_amt, 2) if sell_amt>0 else 0,
                            'pnl': round(pnl, 2),
                            'pnl_percent': round((pnl/cost_part)*100, 2) if cost_part!=0 else 0,
                            'type': 'TRADE'
                        })
                        
                        batch['qty'] -= sell_amt
                        qty_to_sell -= sell_amt
                        if batch['qty'] < 0.000001: fifo_queue[symbol].popleft()
                
                elif action == 'DIVIDEND':
                    income = raw_qty - tax
                    net_invested -= income
                    daily_cash_flow -= income # 股息視為流出 (回收)
                    total_realized_pnl += income
                    
                    closed_positions.append({
                        'symbol': symbol, 'open_date': current_date.strftime('%Y-%m-%d'),
                        'close_date': current_date.strftime('%Y-%m-%d'),
                        'qty': 0, 'buy_price': 0, 'sell_price': 0,
                        'pnl': round(income, 2), 'pnl_percent': 0, 'type': 'DIVIDEND'
                    })

        # B. 計算今日市值
        current_market_value = 0.0
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                if sym in market_data:
                    closes = market_data[sym]['close']
                    try:
                        if current_date in closes.index: price = closes.loc[current_date]
                        else: price = closes.asof(current_date)
                        if pd.isna(price): price = 0
                    except: pass
                current_market_value += price * qty

        # C. 計算 TWR (Time-Weighted Return)
        # 邏輯：(今日市值 - 淨現金流) / 昨日市值 - 1
        # 若昨日市值為 0 (剛開始)，則報酬率為 0
        if prev_total_value > 0:
            # 這裡採用「期末現金流」假設 (Simple Dietz 近似)
            # 真正的 TWR 應將現金流權重化，但日頻率下差異極小
            # 當日報酬 = (今日結束市值 - 今日淨投入) / 昨日結束市值 - 1
            # daily_cash_flow > 0 代表今日額外投入了錢
            
            # HPR = (End Value - Cash Flow) / Start Value - 1
            daily_return = (current_market_value - daily_cash_flow) / prev_total_value - 1
        else:
            daily_return = 0.0

        twr_cumulative *= (1 + daily_return)
        
        # D. 計算 Benchmark TWR (SPY)
        benchmark_twr = 0.0
        if benchmark_start_price > 0 and BENCHMARK_SYMBOL in market_data:
            closes = market_data[BENCHMARK_SYMBOL]['close']
            try:
                curr_bench = closes.asof(current_date)
                if not pd.isna(curr_bench):
                    # 直接算累積漲幅
                    benchmark_twr = (curr_bench / benchmark_start_price) - 1
            except: pass

        history_data.append({
            "date": current_date.strftime('%Y-%m-%d'),
            "total_value": round(current_market_value, 2),
            "invested": round(net_invested, 2),
            "twr": round((twr_cumulative - 1) * 100, 2),
            "benchmark_twr": round(benchmark_twr * 100, 2)
        })
        
        prev_total_value = current_market_value

    # --- 整理輸出 ---
    final_holdings = []
    latest_prices = {t: (market_data[t]['close'].iloc[-1] if not market_data[t]['close'].empty else 0) for t in tickers}

    for sym, qty in holdings.items():
        if qty > 0.001:
            curr_p = latest_prices.get(sym, 0)
            # 成本
            batches = fifo_queue[sym]
            total_cost = sum(b['qty'] * b['unit_cost'] for b in batches)
            avg_cost = total_cost / qty if qty > 0 else 0
            if curr_p == 0: curr_p = avg_cost
            
            mkt_val = curr_p * qty
            pnl = mkt_val - total_cost
            
            final_holdings.append({
                "symbol": sym, "qty": round(qty, 2),
                "avg_price": round(avg_cost, 2), "current_price": round(curr_p, 2),
                "market_value": round(mkt_val, 2), "pnl": round(pnl, 2),
                "pnl_percent": round((pnl/total_cost)*100, 2) if total_cost!=0 else 0
            })

    curr_stats = history_data[-1] if history_data else {}
    
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "summary": {
            "total_value": curr_stats.get('total_value', 0),
            "invested_capital": curr_stats.get('invested', 0),
            "total_pnl": round(curr_stats.get('total_value', 0) - curr_stats.get('invested', 0), 2),
            "twr": curr_stats.get('twr', 0),
            "realized_pnl": round(total_realized_pnl, 2)
        },
        "holdings": final_holdings,
        "closed_positions": sorted(closed_positions, key=lambda x: x['close_date'], reverse=True),
        "history": history_data
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成 (含 TWR 與 SPY 比較)")

if __name__ == "__main__":
    update_portfolio()
