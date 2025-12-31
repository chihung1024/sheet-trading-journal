import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta

# --- 設定 ---
# 你的 Google Sheet CSV 網址 (請確認這裡是你正確的網址)
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'

def get_historical_prices(tickers, start_date):
    """一次下載所有股票的歷史數據"""
    print(f"下載歷史數據中... 起始日: {start_date}")
    try:
        data = yf.download(tickers, start=start_date, progress=False)['Close']
        return data
    except Exception as e:
        print(f"下載失敗: {e}")
        return pd.DataFrame()

def update_portfolio():
    print("讀取交易紀錄...")
    try:
        df = pd.read_csv(SHEET_URL)
        df.columns = df.columns.str.strip()
        # 確保日期格式正確
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date') # 按日期排序
    except Exception as e:
        print(f"Google Sheet 讀取失敗: {e}")
        return

    # 1. 準備回測資料
    tickers = df['Symbol'].unique().tolist()
    if not tickers:
        print("沒有股票代碼")
        return

    # 找出最早的交易日期
    start_date = df['Date'].min().strftime('%Y-%m-%d')
    # 下載歷史股價 (包含到今天)
    price_history = get_historical_prices(tickers, start_date)
    
    # 如果只有一支股票，yfinance 格式會不同，需要調整
    if len(tickers) == 1:
        price_history = price_history.to_frame(name=tickers[0])

    # 2. 開始一天一天算資產 (Time Travel)
    # 建立一個時間範圍：從第一筆交易到今天
    all_dates = price_history.index
    history_data = [] # 用來存每天的總資產
    
    current_holdings = {t: 0 for t in tickers} # 目前手上的股數
    cash_invested = 0 # 總投入本金

    # 為了加速，將交易紀錄轉為字典方便查詢
    trades_dict = {}
    for date, group in df.groupby('Date'):
        trades_dict[pd.Timestamp(date)] = group

    print("計算歷史資產曲線...")
    for today in all_dates:
        # A. 處理當天的交易
        if today in trades_dict:
            todays_trades = trades_dict[today]
            for _, row in todays_trades.iterrows():
                symbol = row['Symbol']
                qty = float(row['Qty'])
                price = float(row['Price'])
                action = row['Type'].strip().lower()
                
                if action == 'buy':
                    current_holdings[symbol] += qty
                    cash_invested += (price * qty)
                elif action == 'sell':
                    current_holdings[symbol] -= qty
                    # 賣出時，簡單處理：本金按比例減少 (這只是估算)
                    # 這裡不做複雜的已實現損益 FIFO 計算，避免過於複雜
                    if current_holdings[symbol] >= 0:
                        pass 

        # B. 計算當天市值
        daily_total_value = 0
        for symbol, qty in current_holdings.items():
            if qty > 0.001: # 忽略微小誤差
                # 取得當天股價
                try:
                    # 使用 loc 查找，如果當天沒開盤(假日)，會用前一日收盤價 (ffill)
                    price = price_history.loc[today][symbol]
                    if pd.isna(price): # 如果是 NaN，往前找
                        price = price_history[symbol][:today].iloc[-1]
                    
                    daily_total_value += price * qty
                except:
                    pass
        
        # 存下這天的紀錄
        history_data.append({
            "date": today.strftime('%Y-%m-%d'),
            "value": round(daily_total_value, 2),
            "invested": round(cash_invested, 2)
        })

    # 3. 準備當前持倉數據 (給表格用)
    latest_prices = price_history.iloc[-1]
    holdings_list = []
    
    total_market_value = 0
    total_cost = 0

    # 重新計算一次精確的成本 (簡單平均法)
    # 為了表格顯示，我們再跑一次總計
    cost_basis = {} # {symbol: {qty: 10, total_cost: 500}}
    
    for index, row in df.iterrows():
        sym = row['Symbol']
        qty = float(row['Qty'])
        price = float(row['Price'])
        action = row['Type'].strip().lower()
        
        if sym not in cost_basis: cost_basis[sym] = {'qty': 0, 'cost': 0}
        
        if action == 'buy':
            cost_basis[sym]['qty'] += qty
            cost_basis[sym]['cost'] += (price * qty)
        elif action == 'sell':
            # 賣出時減少成本
            if cost_basis[sym]['qty'] > 0:
                avg = cost_basis[sym]['cost'] / cost_basis[sym]['qty']
                cost_basis[sym]['cost'] -= (avg * qty)
            cost_basis[sym]['qty'] -= qty

    for sym, data in cost_basis.items():
        if data['qty'] > 0.001:
            curr_price = 0
            try:
                curr_price = float(latest_prices[sym])
            except:
                pass
            
            mkt_val = curr_price * data['qty']
            total_market_value += mkt_val
            total_cost += data['cost']
            
            holdings_list.append({
                "symbol": sym,
                "qty": round(data['qty'], 2),
                "avg_price": round(data['cost'] / data['qty'], 2),
                "current_price": round(curr_price, 2),
                "market_value": round(mkt_val, 2),
                "pnl": round(mkt_val - data['cost'], 2),
                "pnl_percent": round(((mkt_val - data['cost']) / data['cost'] * 100), 2) if data['cost'] > 0 else 0
            })

    # 4. 輸出 JSON
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "total_value": round(total_market_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_market_value - total_cost, 2),
        "holdings": holdings_list,
        "history": history_data # 新增：歷史曲線數據
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成！歷史數據已生成。")

if __name__ == "__main__":
    update_portfolio()
