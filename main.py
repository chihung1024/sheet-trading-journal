import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta
from collections import deque

# --- 設定 ---
# 你的 Google Sheet CSV 網址
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'

def get_market_data(tickers, start_date):
    """
    下載股價與拆股資訊
    yfinance 預設 auto_adjust=True (復權價)，這是我們需要的
    """
    print(f"下載市場數據... 起始日: {start_date}")
    try:
        # 轉換 tickers 列表為字串
        ticker_str = " ".join(tickers)
        
        # 下載包含 'actions' (股息與拆股)
        # 即使只有一支股票，用 Ticker 也比較保險能抓到 splits
        if len(tickers) == 1:
            t = yf.Ticker(tickers[0])
            hist = t.history(start=start_date, auto_adjust=True)
            return {tickers[0]: {'close': hist['Close'], 'splits': hist['Stock Splits']}}
        else:
            # 多支股票：yfinance download 返回格式較複雜，建議分別抓取以確保資料結構一致
            result = {}
            for t in tickers:
                try:
                    ticker_obj = yf.Ticker(t)
                    df = ticker_obj.history(start=start_date, auto_adjust=True)
                    result[t] = {'close': df['Close'], 'splits': df['Stock Splits']}
                except Exception as e:
                    print(f"無法下載 {t}: {e}")
            return result
    except Exception as e:
        print(f"下載失敗: {e}")
        return {}

def safe_float(val):
    try:
        if pd.isna(val) or val == '':
            return 0.0
        return float(val)
    except:
        return 0.0

def get_split_adjustment(symbol, tx_date, split_data):
    """
    計算拆股調整係數 (Multiplier)
    邏輯：如果交易日之後發生了拆股，這筆交易的股數要變多，價格要變少
    """
    multiplier = 1.0
    if split_data is None or split_data.empty:
        return multiplier
        
    # 確保 tx_date 為 timestamp 且無時區
    tx_date = pd.Timestamp(tx_date).tz_localize(None)
    
    # 確保 split_data index 為 timestamp 且無時區
    split_data.index = pd.to_datetime(split_data.index).tz_localize(None)
    
    # 找出所有發生在交易日「之後」的拆股
    relevant_splits = split_data[split_data.index > tx_date]
    
    for split_ratio in relevant_splits:
        if split_ratio > 0:
            multiplier *= split_ratio
            
    return multiplier

def update_portfolio():
    print("讀取並處理交易紀錄...")
    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
        df = df.sort_values('Date')
        
        # 補零
        for col in ['Comm', 'Tax', 'Qty', 'Price']:
            if col not in df.columns: df[col] = 0
            df[col] = df[col].fillna(0)
            
    except Exception as e:
        print(f"Google Sheet 讀取失敗: {e}")
        return

    # 排除 CASH (若有)
    df = df[df['Symbol'].str.upper() != 'CASH'].copy()
    tickers = df['Symbol'].unique().tolist()
    
    if not tickers:
        print("無有效股票代碼")
        return

    # 1. 獲取市場數據 (含拆股)
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    market_data = get_market_data(tickers, start_date)

    # --- 核心引擎 (FIFO + Split Adjustment) ---
    
    # 時間軸生成
    start_dt = df['Date'].min()
    # [修正點] 使用 pd.Timestamp.now() 來支援 normalize()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    # 狀態
    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers} 
    
    net_invested = 0.0
    total_realized_pnl = 0.0
    
    closed_positions = []
    history_data = []
    
    transactions_map = {}
    for date, group in df.groupby('Date'):
        transactions_map[date] = group.to_dict('records')

    print("開始回測計算...")

    for current_date in all_dates:
        
        # A. 處理當日交易
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                
                raw_qty = safe_float(tx['Qty'])
                raw_price = safe_float(tx['Price'])
                comm = safe_float(tx['Comm'])
                tax = safe_float(tx['Tax'])
                
                # --- 自動計算拆股係數 ---
                split_ratio = 1.0
                if symbol in market_data:
                    split_ratio = get_split_adjustment(symbol, current_date, market_data[symbol]['splits'])
                
                # 將「原始紀錄」轉換為「當前復權標準」
                adj_qty = raw_qty * split_ratio
                adj_price = raw_price / split_ratio if split_ratio > 0 else raw_price
                
                if action == 'BUY':
                    # 總成本 = (原始價 * 原始量) + 手續費
                    total_cost = (raw_price * raw_qty) + comm
                    net_invested += total_cost
                    holdings[symbol] += adj_qty
                    
                    # 單位成本 (含稅費)
                    adj_unit_cost = total_cost / adj_qty if adj_qty > 0 else 0
                    
                    fifo_queue[symbol].append({
                        'qty': adj_qty,
                        'unit_cost': adj_unit_cost,
                        'raw_date': current_date
                    })
                    
                elif action == 'SELL':
                    # 淨收入 = (原始價 * 原始量) - 手續費 - 稅
                    proceeds = (raw_price * raw_qty) - comm - tax
                    net_invested -= proceeds
                    holdings[symbol] -= adj_qty
                    
                    # FIFO 結算
                    qty_to_sell = adj_qty
                    while qty_to_sell > 0.000001 and fifo_queue[symbol]:
                        batch = fifo_queue[symbol][0]
                        sell_amount = min(qty_to_sell, batch['qty'])
                        
                        # 成本部分
                        cost_portion = batch['unit_cost'] * sell_amount
                        # 收入部分 (按比例)
                        revenue_portion = (proceeds / adj_qty) * sell_amount
                        
                        pnl = revenue_portion - cost_portion
                        total_realized_pnl += pnl
                        
                        closed_positions.append({
                            'symbol': symbol,
                            'open_date': batch['raw_date'].strftime('%Y-%m-%d'),
                            'close_date': current_date.strftime('%Y-%m-%d'),
                            # 顯示調整後的股數比較符合現在股價
                            'qty': round(sell_amount, 2), 
                            'buy_price': round(batch['unit_cost'], 2),
                            'sell_price': round(revenue_portion/sell_amount, 2) if sell_amount > 0 else 0,
                            'pnl': round(pnl, 2),
                            'pnl_percent': round((pnl/cost_portion)*100, 2) if cost_portion!=0 else 0,
                            'type': 'TRADE'
                        })
                        
                        batch['qty'] -= sell_amount
                        qty_to_sell -= sell_amount
                        
                        if batch['qty'] < 0.000001:
                            fifo_queue[symbol].popleft()
                            
                elif action == 'DIVIDEND':
                    income = raw_qty - tax
                    net_invested -= income
                    total_realized_pnl += income
                    
                    closed_positions.append({
                        'symbol': symbol,
                        'open_date': current_date.strftime('%Y-%m-%d'),
                        'close_date': current_date.strftime('%Y-%m-%d'),
                        'qty': 0, 'buy_price': 0, 'sell_price': 0,
                        'pnl': round(income, 2),
                        'pnl_percent': 0,
                        'type': 'DIVIDEND'
                    })

        # B. 計算當日市值
        day_market_value = 0.0
        
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                if sym in market_data:
                    closes = market_data[sym]['close']
                    # 將索引時區移除以匹配
                    closes.index = pd.to_datetime(closes.index).tz_localize(None)
                    
                    try:
                        if current_date in closes.index:
                            price = closes.loc[current_date]
                        else:
                            # 假日往前找
                            # 確保 Series 有排序
                            closes = closes.sort_index()
                            # 截取到當日為止的數據
                            past_data = closes[closes.index <= current_date]
                            if not past_data.empty:
                                price = past_data.iloc[-1]
                    except: pass
                
                day_market_value += price * qty
        
        history_data.append({
            "date": current_date.strftime('%Y-%m-%d'),
            "total_value": round(day_market_value, 2),
            "invested": round(net_invested, 2)
        })

    # --- 最終整理 ---
    final_holdings = []
    
    for sym, qty in holdings.items():
        if qty > 0.001:
            curr_price = 0
            if sym in market_data:
                try:
                    curr_price = float(market_data[sym]['close'].iloc[-1])
                except: pass
            
            # 平均成本
            batches = fifo_queue[sym]
            total_cost = sum(b['qty'] * b['unit_cost'] for b in batches)
            avg_cost = total_cost / qty if qty > 0 else 0
            
            if curr_price == 0: curr_price = avg_cost
            
            mkt_val = curr_price * qty
            
            final_holdings.append({
                "symbol": sym,
                "qty": round(qty, 2),
                "avg_price": round(avg_cost, 2),
                "current_price": round(curr_price, 2),
                "market_value": round(mkt_val, 2),
                "pnl": round(mkt_val - total_cost, 2),
                "pnl_percent": round(((mkt_val - total_cost)/total_cost)*100, 2) if total_cost!=0 else 0
            })

    curr_stats = history_data[-1] if history_data else {'total_value':0, 'invested':0}
    
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "summary": {
            "total_value": curr_stats['total_value'],
            "invested_capital": curr_stats['invested'],
            "total_pnl": round(curr_stats['total_value'] - curr_stats['invested'], 2),
            "pnl_percent": round(((curr_stats['total_value'] - curr_stats['invested']) / curr_stats['invested'] * 100), 2) if curr_stats['invested']!=0 else 0,
            "realized_pnl": round(total_realized_pnl, 2)
        },
        "holdings": final_holdings,
        "closed_positions": sorted(closed_positions, key=lambda x: x['close_date'], reverse=True),
        "history": history_data
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成 (Auto-Split Adjustment Enabled)")

if __name__ == "__main__":
    update_portfolio()
