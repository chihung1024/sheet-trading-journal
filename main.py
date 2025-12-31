import pandas as pd
import yfinance as yf
import json
import os
from datetime import datetime

# --- 設定 ---
# 請將你剛剛複製的 Google Sheet CSV 網址填在這裡
SHEET_URL = '你的_GOOGLE_SHEET_CSV_網址_貼在這裡'

def update_portfolio():
    print("正在讀取 Google Sheet...")
    try:
        df = pd.read_csv(SHEET_URL)
    except Exception as e:
        print("讀取失敗，請確認 Google Sheet 已發布為 CSV。")
        return

    # 整理資料
    portfolio = []
    tickers = df['Symbol'].unique().tolist()
    
    print(f"正在抓取股價: {tickers}")
    if tickers:
        # 一次抓取所有股價
        current_data = yf.download(tickers, period="1d")['Close'].iloc[-1]
    
    total_market_value = 0
    holdings = {}

    # 計算持倉邏輯
    for index, row in df.iterrows():
        symbol = row['Symbol']
        qty = float(row['Qty'])
        if row['Type'].lower() == 'sell':
            qty = -qty
        
        if symbol not in holdings:
            holdings[symbol] = {'qty': 0, 'cost': 0}
        
        holdings[symbol]['qty'] += qty
        # 這裡簡化計算，成本只累加買入金額
        if row['Type'].lower() == 'buy':
             holdings[symbol]['cost'] += (float(row['Price']) * float(row['Qty']))

    # 生成前端需要的 JSON
    output_list = []
    for symbol, data in holdings.items():
        if data['qty'] > 0:
            # 取得現價
            try:
                # yfinance 回傳格式如果是單一股票會是 float，多股票是 Series
                if len(tickers) == 1:
                    price = float(current_data)
                else:
                    price = float(current_data[symbol])
            except:
                price = 0
            
            market_val = price * data['qty']
            total_market_value += market_val
            
            output_list.append({
                "symbol": symbol,
                "qty": round(data['qty'], 2),
                "avg_price": round(data['cost'] / data['qty'], 2), # 簡易平均成本
                "current_price": round(price, 2),
                "market_value": round(market_val, 2),
                "pnl": round(market_val - data['cost'], 2)
            })

    final_data = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "total_value": round(total_market_value, 2),
        "holdings": output_list
    }

    # 存檔
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    print("更新完成！")

if __name__ == "__main__":
    update_portfolio()
