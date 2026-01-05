import pandas as pd
import yfinance as yf
import json
import numpy as np
import requests
import os
from datetime import datetime
from collections import deque

# --- 設定區域 ---
# 指向您的 Worker API
WORKER_API_URL_RECORDS = 'https://journal-backend.chired.workers.dev/api/records'
WORKER_API_URL_PORTFOLIO = 'https://journal-backend.chired.workers.dev/api/portfolio' # 新增

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

# ... (get_market_data 函式保持不變，請保留原有的) ...
def get_market_data(tickers, start_date):
    # (此處程式碼與之前相同，省略以節省篇幅)
    print(f"下載市場數據...")
    fx_rates = pd.Series(dtype=float)
    try:
        fx = yf.Ticker(EXCHANGE_SYMBOL)
        fx_hist = fx.history(start=start_date)
        fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None)
        fx_rates = fx_hist['Close']
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    result = {}
    all_tickers = list(set(tickers + ['SPY']))
    for t in all_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            hist = ticker_obj.history(start=start_date, auto_adjust=True) # 簡化寫法，請用您原本的完整邏輯
            if not hist.empty:
                hist.index = pd.to_datetime(hist.index).tz_localize(None)
                result[t] = hist
        except: pass
    return result, fx_rates

def update_portfolio():
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
        print("無交易紀錄")
        return

    # 1. 整理交易紀錄
    df = pd.DataFrame(records)
    # 欄位映射
    df.rename(columns={
        'txn_date': 'Date', 'symbol': 'Symbol', 'txn_type': 'Type', 
        'qty': 'Qty', 'price': 'Price', 'fee': 'Commission', 
        'tax': 'Tax', 'tag': 'Tag'
    }, inplace=True)
    
    df['Date'] = pd.to_datetime(df['Date'])
    df['Qty'] = pd.to_numeric(df['Qty'])
    df['Price'] = pd.to_numeric(df['Price'])
    df['Commission'] = pd.to_numeric(df['Commission'].fillna(0))
    df = df.sort_values('Date')

    # 2. 下載市場數據
    start_date = df['Date'].min()
    market_data, fx_rates = get_market_data(df['Symbol'].unique().tolist(), start_date)

    # 3. 初始化計算變數 (與之前邏輯相同，略作簡化描述，請保留您原本完整的計算迴圈)
    # ... (此處保留您原本的計算邏輯: holdings, fifo_queues, history_data 等等) ...
    # 為了確保程式碼能跑，這裡假設計算過程已完成，並產生了 final_output
    
    # 假設計算完畢...
    # (請確保您將原本 main.py 中間那一大段計算邏輯完整保留)
    
    # ... 計算結束 ...

    # 4. 建構最終 Output (這部分最重要)
    # 這裡必須確保所有變數都存在
    # 範例結構：
    final_output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "base_currency": BASE_CURRENCY,
        "exchange_rate": round(fx_rates.iloc[-1], 2) if not fx_rates.empty else 32.0,
        "summary": {
            # 請填入實際計算結果
            "total_value": 0, "invested_capital": 0, "total_pnl": 0, "twr": 0, "realized_pnl": 0
        },
        "holdings": [], # 填入實際 holdings 列表
        "history": []   # 填入實際 history 列表
    }
    
    # 注意：這裡我需要您把原本 main.py 的後半段 `final_output = ...` 那裡複製過來
    # 唯一要改的是最後面：

    print("計算完成，正在上傳至 Cloudflare D1...")
    
    # --- [修改點] 上傳至 Worker ---
    try:
        # 將 datetime 物件轉為字串，避免 JSON 序列化錯誤
        # 通常您的 final_output 已經處理好了，如果還有 datetime 物件，要先轉 str
        
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

    # 為了相容性，我們還是可以在本地存一份，雖然網頁不再讀它
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_portfolio()
