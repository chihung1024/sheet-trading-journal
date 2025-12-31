import pandas as pd
import yfinance as yf
import json
import numpy as np
from datetime import datetime, timedelta

# --- 設定 ---
# 你的 Google Sheet CSV 網址
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2Km74qaJt42zPpsQk2GCu2Bl9ATPNH9bllT6QyXxYps9i-r2RZcF10KKTTVAgm7PffGVe0zRDthLH/pub?gid=0&single=true&output=csv'

def get_historical_prices(tickers, start_date):
    """一次下載所有股票的歷史數據"""
    print(f"下載歷史數據中... 起始日: {start_date}")
    try:
        # yfinance 下載
        data = yf.download(tickers, start=start_date, progress=False)
        
        # 處理資料結構：只取 'Close' 收盤價
        if 'Close' in data.columns:
            data = data['Close']
        else:
            print("警告：無法找到收盤價數據，可能下載失敗。")
            return pd.DataFrame()
            
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
    # 下載歷史股價
    price_history = get_historical_prices(tickers, start_date)
    
    # --- 修正的部分開始 ---
    # 檢查是否為 Series (單維度數據)，如果是才轉 DataFrame
    if isinstance(price_history, pd.Series):
        price_history = price_history.to_frame(name=tickers[0])
    # --- 修正的部分結束 ---

    # 2. 開始一天一天算資產 (Time Travel)
    if price_history.empty:
        print("沒有下載到股價數據，無法計算曲線。")
        all_dates = []
    else:
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
        # 將 Timestamp 正規化為當天午夜，以確保比對正確
        today_ts = pd.Timestamp(today).normalize()
        
        # 檢查這一天有沒有交易 (包含同一天多筆)
        # 這裡需要模糊比對或確保日期格式完全一致，簡單起見我們用字串比對
        today_str = today.strftime('%Y-%m-%d')
        
        # 簡易篩選：直接從原始 df 找
        todays_trades = df[df['Date'].dt.strftime('%Y-%m-%d') == today_str]
        
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
                # 賣出時不減少投入本金(簡單計算)，或者你可以選擇按比例減少

        # B. 計算當天市值
        daily_total_value = 0
        for symbol, qty in current_holdings.items():
            if qty > 0.001: # 忽略微小誤差
                try:
                    # 從 price_history 找股價
                    # 如果是單一股票 DataFrame，欄位名可能是 symbol 也可能是 'Close'
                    if len(tickers) == 1 and symbol not in price_history.columns:
                         # 嘗試直接取第一欄
                         price = price_history.iloc[price_history.index == today].iloc[0, 0]
                    else:
                        price = price_history.loc[today][symbol]
                    
                    if pd.isna(price): # 如果是 NaN (例如停牌)，往前找最近的一天
                        # 這裡簡單處理：若當天沒價錢就跳過或用 0 (會造成曲線缺口)，完整做法需 fillna
                        pass
                    else:
                        daily_total_value += price * qty
                except Exception as e:
                    pass
        
        # 存下這天的紀錄
        history_data.append({
            "date": today.strftime('%Y-%m-%d'),
            "value": round(daily_total_value, 2),
            "invested": round(cash_invested, 2)
        })

    # 3. 準備當前持倉數據 (給表格用)
    holdings_list = []
    
    total_market_value = 0
    total_cost = 0

    # 重新計算一次精確的成本 (簡單平均法)
    cost_basis = {} 
    
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
            if cost_basis[sym]['qty'] > 0:
                avg = cost_basis[sym]['cost'] / cost_basis[sym]['qty']
                cost_basis[sym]['cost'] -= (avg * qty)
            cost_basis[sym]['qty'] -= qty

    # 取得最新股價 (最後一筆)
    if not price_history.empty:
        latest_prices = price_history.iloc[-1]
    else:
        latest_prices = None

    for sym, data in cost_basis.items():
        if data['qty'] > 0.001:
            curr_price = 0
            try:
                if latest_prices is not None:
                    if len(tickers) == 1 and sym not in price_history.columns:
                        curr_price = float(latest_prices.iloc[0])
                    else:
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
        "history": history_data
    }

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
    print("更新完成！歷史數據已生成。")

if __name__ == "__main__":
    update_portfolio()
