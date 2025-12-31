import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta
from collections import deque

# --- 設定 ---
# 你的 Google Sheet CSV 網址
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'

def get_historical_prices(tickers, start_date):
    """下載歷史股價"""
    print(f"下載歷史數據中... 起始日: {start_date}")
    try:
        # 抓取資料
        data = yf.download(tickers, start=start_date, progress=False)
        
        # 處理資料結構
        if 'Close' in data.columns:
            close_data = data['Close']
            # 確保索引格式乾淨 (移除時區)
            close_data.index = pd.to_datetime(close_data.index).normalize().tz_localize(None)
            return close_data
        return pd.DataFrame()
    except Exception as e:
        print(f"下載失敗: {e}")
        return pd.DataFrame()

def update_portfolio():
    print("讀取交易紀錄...")
    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
        df = df.sort_values('Date')
    except Exception as e:
        print(f"Google Sheet 讀取失敗: {e}")
        return

    # 過濾掉非股票的列 (以防萬一還有人留著 CASH)
    df = df[df['Symbol'].str.upper() != 'CASH'].copy()
    
    tickers = df['Symbol'].unique().tolist()
    if not tickers:
        print("沒有股票交易紀錄")
        return

    # 1. 下載歷史股價
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    price_history = get_historical_prices(tickers, start_date)
    
    # 修正單支股票 Series 問題
    if isinstance(price_history, pd.Series):
        price_history = price_history.to_frame(name=tickers[0])

    # --- 核心引擎：無現金模式 (Net Flow) ---
    
    # 時間軸
    start_dt = df['Date'].min()
    end_dt = datetime.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)

    # 狀態變數
    net_invested = 0.0  # 淨投入本金 (買入+ 賣出-)
    holdings = {t: 0.0 for t in tickers} # 股數庫存
    
    # 交易映射表
    transactions_map = {}
    for date, group in df.groupby('Date'):
        transactions_map[date] = group.to_dict('records')

    # FIFO 用於計算已實現損益
    fifo_queue = {t: [] for t in tickers}
    closed_positions = []

    history_data = []

    print("開始計算資產曲線...")

    for current_date in all_dates:
        # A. 處理當日交易
        if current_date in transactions_map:
            for tx in transactions_map[current_date]:
                symbol = tx['Symbol']
                action = tx['Type'].strip().upper()
                qty = float(tx['Qty'])
                price = float(tx['Price'])
                amount = price * qty

                if action == 'BUY':
                    net_invested += amount # 買入 = 投入資金
                    holdings[symbol] += qty
                    # FIFO 入隊
                    fifo_queue[symbol].append({'qty': qty, 'price': price, 'date': current_date})

                elif action == 'SELL':
                    net_invested -= amount # 賣出 = 收回資金 (本金+獲利一起收回)
                    holdings[symbol] -= qty
                    
                    # FIFO 結算損益 (同之前邏輯)
                    qty_to_sell = qty
                    while qty_to_sell > 0 and fifo_queue[symbol]:
                        batch = fifo_queue[symbol][0]
                        if batch['qty'] > qty_to_sell:
                            pnl = (price - batch['price']) * qty_to_sell
                            closed_positions.append({
                                'symbol': symbol,
                                'open_date': batch['date'].strftime('%Y-%m-%d'),
                                'close_date': current_date.strftime('%Y-%m-%d'),
                                'qty': round(qty_to_sell, 2),
                                'buy_price': batch['price'],
                                'sell_price': price,
                                'pnl': round(pnl, 2),
                                'pnl_percent': round((price-batch['price'])/batch['price']*100, 2)
                            })
                            batch['qty'] -= qty_to_sell
                            qty_to_sell = 0
                        else:
                            pnl = (price - batch['price']) * batch['qty']
                            closed_positions.append({
                                'symbol': symbol,
                                'open_date': batch['date'].strftime('%Y-%m-%d'),
                                'close_date': current_date.strftime('%Y-%m-%d'),
                                'qty': batch['qty'],
                                'buy_price': batch['price'],
                                'sell_price': price,
                                'pnl': round(pnl, 2),
                                'pnl_percent': round((price-batch['price'])/batch['price']*100, 2)
                            })
                            qty_to_sell -= batch['qty']
                            fifo_queue[symbol].pop(0)

        # B. 計算當日持倉市值
        market_value = 0.0
        
        for sym, qty in holdings.items():
            if qty > 0.001:
                price = 0
                # 找股價 (包含補值邏輯)
                if not price_history.empty and sym in price_history.columns:
                    try:
                        if current_date in price_history.index:
                            price = price_history.loc[current_date, sym]
                        else:
                            # 假日往前找
                            price = price_history[sym][:current_date].iloc[-1]
                    except: pass
                
                # 若找不到歷史股價，暫用最後一次買入價估算(避免曲線歸零)，或直接忽略
                market_value += price * qty
        
        # 紀錄歷史
        # value: 資產現值 (股票市值)
        # invested: 淨投入本金 (買入總額 - 賣出總額)
        history_data.append({
            "date": current_date.strftime('%Y-%m-%d'),
            "total_value": round(market_value, 2),
            "invested": round(net_invested, 2)
        })

    # --- 整理輸出 ---
    final_holdings = []
    latest_prices = price_history.iloc[-1] if not price_history.empty else None

    # 計算剩餘持倉明細
    for sym, qty in holdings.items():
        if qty > 0.001:
            # 計算平均成本 (從剩餘 FIFO 佇列)
            batches = fifo_queue[sym]
            cost_basis = sum(b['qty'] * b['price'] for b in batches)
            avg_price = cost_basis / qty
            
            # 現價
            curr_price = 0
            try:
                if latest_prices is not None and sym in latest_prices:
                    curr_price = float(latest_prices[sym])
            except: pass
            if curr_price == 0: curr_price = avg_price

            mkt_val = curr_price * qty
            
            final_holdings.append({
                "symbol": sym,
                "qty": round(qty, 2),
                "avg_price": round(avg_price, 2),
                "current_price": round(curr_price, 2),
                "market_value": round(mkt_val, 2),
                "pnl": round(mkt_val - cost_basis, 2),
                "pnl_percent": round(((mkt_val - cost_basis)/cost_basis*100), 2)
            })

    # 摘要
    curr_value = history_data[-1]['total_value'] if history_data else 0
    curr_invested = history_data[-1]['invested']
    total_pnl = curr_value - curr_invested
    realized_pnl_sum = sum(cp['pnl'] for cp in closed_positions)

    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "summary": {
            "total_value": round(curr_value, 2),
            "invested_capital": round(curr_invested, 2),
            "total_pnl": round(total_pnl, 2),
            "pnl_percent": round((total_pnl / curr_invested * 100), 2) if curr_invested != 0 else 0,
            "realized_pnl": round(realized_pnl_sum, 2)
        },
        "holdings": final_holdings,
        "closed_positions": sorted(closed_positions, key=lambda x: x['close_date'], reverse=True),
        "history": history_data
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成！無現金模式計算完畢。")

if __name__ == "__main__":
    update_portfolio()
