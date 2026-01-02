from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import pandas as pd
import yfinance as yf
import requests
import uvicorn
from datetime import datetime
from collections import deque
from typing import List, Optional

# --- 設定區域 ---
# 這是您的 Cloudflare Worker 網址，用來撈取原始交易紀錄
WORKER_API_URL = 'https://journal-backend.chired.workers.dev/api/records'
# 如果 Worker 有設密鑰，請在此設定 headers={'Authorization': '...'}
API_HEADERS = {} 

app = FastAPI()

# 定義請求格式
class CalcRequest(BaseModel):
    user_id: str  # 告訴運算引擎現在要算誰的資料
    token: str    # 透傳使用者的 Token 回去 Worker 撈資料

# --- 核心運算邏輯 (從 main.py 改寫) ---
# 快取匯率與股價，避免每次都重新下載 (簡單實作)
market_cache = {}

def get_market_data_cached(tickers):
    # 簡單快取機制：如果這批股票 1 小時內抓過就不重抓 (可依需求優化)
    # 這裡先每次都抓最新，確保即時性
    result = {}
    
    # 下載匯率
    fx_rates = pd.Series(dtype=float)
    try:
        fx = yf.Ticker('USDTWD=X')
        # 只抓最近 5 年以加快速度
        fx_hist = fx.history(period="5y") 
        fx_hist.index = pd.to_datetime(fx_hist.index).tz_localize(None)
        fx_rates = fx_hist['Close']
    except Exception as e:
        print(f"匯率下載失敗: {e}")

    # 下載股價
    all_tickers = list(set(tickers + ['SPY']))
    if not all_tickers: return {}, fx_rates

    try:
        # yfinance 支援一次下載多檔，速度更快
        data = yf.download(all_tickers, period="5y", group_by='ticker', actions=True, progress=False)
        
        for t in all_tickers:
            # 處理單一 ticker 或多 ticker 的資料結構差異
            if len(all_tickers) == 1:
                df = data
            else:
                df = data[t]
            
            # 處理索引時區
            df.index = pd.to_datetime(df.index).tz_localize(None)
            
            # 判斷幣別
            currency = 'TWD' if (t.endswith('.TW') or t.endswith('.TWO')) else 'USD'
            
            result[t] = {
                'close': df['Close'],
                # yfinance download 格式有時不同，這裡做簡單容錯
                'splits': df['Stock Splits'] if 'Stock Splits' in df.columns else pd.Series(dtype=float),
                'dividends': df['Dividends'] if 'Dividends' in df.columns else pd.Series(dtype=float),
                'currency': currency
            }
    except Exception as e:
        print(f"批次下載失敗: {e}")

    return result, fx_rates

def safe_float(val):
    try: return float(val)
    except: return 0.0

@app.post("/calculate")
async def calculate_portfolio(req: CalcRequest):
    print(f"收到運算請求: User={req.user_id}")
    
    # 1. 向 Cloudflare Worker 撈取該用戶的原始交易紀錄
    try:
        headers = API_HEADERS.copy()
        # 把前端傳來的 Token 轉發給 Worker，證明身分
        headers['Authorization'] = f"Bearer {req.token}" 
        
        # 注意：這裡呼叫的是 Worker 的 GET API
        resp = requests.get(WORKER_API_URL, headers=headers)
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"無法從 Worker 取得資料: {resp.text}")
            
        api_data = resp.json()
        if not api_data.get('success'):
            return {"status": "empty", "message": "無資料或未授權"}
            
        records = api_data.get('data', [])
        if not records:
            return {"status": "empty", "message": "此用戶無交易紀錄"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"連線錯誤: {str(e)}")

    # 2. 開始運算 (邏輯同 main.py)
    df = pd.DataFrame(records)
    
    # 欄位映射：Worker 回傳的 JSON -> Pandas 欄位
    # Worker: user_id, txn_date, symbol, txn_type, qty, price, fee, tag...
    df = df.rename(columns={
        'txn_date': 'Date',
        'symbol': 'Symbol',
        'txn_type': 'Type',
        'qty': 'Qty',
        'price': 'Price',
        'fee': 'Comm',
        'tag': 'Tag',
        'note': 'Note'
    })
    
    # 轉換數值
    df['Date'] = pd.to_datetime(df['Date']).dt.normalize()
    for col in ['Qty', 'Price', 'Comm']:
        df[col] = df[col].apply(safe_float)
    
    df = df.sort_values('Date')
    tickers = df['Symbol'].unique().tolist()
    
    # 下載行情
    market_data, fx_rates = get_market_data_cached(tickers)
    
    # 初始化變數
    holdings = {t: 0.0 for t in tickers}
    fifo_queue = {t: deque() for t in tickers}
    realized_pnl_twd = 0.0
    net_invested_twd = 0.0
    
    start_dt = df['Date'].min()
    end_dt = pd.Timestamp.now().normalize()
    all_dates = pd.date_range(start=start_dt, end=end_dt)
    
    # 建立日期索引的交易表，加速迴圈
    tx_map = df.groupby('Date')

    # 逐日重播 (Replay)
    for current_date in all_dates:
        # 這裡為了效能，我們簡化 TWR 計算，只算最後結果
        # 如果需要畫歷史曲線，邏輯同 main.py
        
        # 1. 處理當日交易
        if current_date in tx_map.groups:
            day_txs = tx_map.get_group(current_date)
            daily_rate = fx_rates.asof(current_date) if not pd.isna(fx_rates.asof(current_date)) else 32.0
            
            for _, tx in day_txs.iterrows():
                sym = tx['Symbol']
                action = tx['Type']
                qty = tx['Qty']
                price = tx['Price']
                comm = tx['Comm']
                
                # 簡單匯率判斷
                is_tw = sym.endswith('.TW')
                rate = 1.0 if is_tw else daily_rate
                
                cost_twd = (price * qty * rate) + comm
                proceeds_twd = (price * qty * rate) - comm
                
                if action == 'BUY':
                    holdings[sym] += qty
                    net_invested_twd += cost_twd
                    fifo_queue[sym].append({'qty': qty, 'cost_unit': cost_twd/qty if qty>0 else 0})
                    
                elif action == 'SELL':
                    holdings[sym] -= qty
                    net_invested_twd -= proceeds_twd # 取回資金
                    
                    # FIFO 實現損益
                    qty_to_sell = qty
                    tx_pnl = 0
                    while qty_to_sell > 0.00001 and fifo_queue[sym]:
                        batch = fifo_queue[sym][0]
                        sold_qty = min(qty_to_sell, batch['qty'])
                        
                        cost_part = batch['cost_unit'] * sold_qty
                        rev_part = (proceeds_twd / qty) * sold_qty # 依比例
                        
                        tx_pnl += (rev_part - cost_part)
                        
                        batch['qty'] -= sold_qty
                        qty_to_sell -= sold_qty
                        if batch['qty'] < 0.00001: fifo_queue[sym].popleft()
                    
                    realized_pnl_twd += tx_pnl

    # 3. 計算最終持倉市值
    final_holdings = []
    current_rate = fx_rates.iloc[-1] if not fx_rates.empty else 32.0
    total_market_value = 0
    
    for sym, qty in holdings.items():
        if qty > 0.001:
            price = 0
            curr = 'USD'
            if sym in market_data:
                price = market_data[sym]['close'].iloc[-1]
                curr = market_data[sym]['currency']
            
            rate = 1.0 if curr == 'TWD' else current_rate
            mkt_val = price * qty * rate
            total_market_value += mkt_val
            
            final_holdings.append({
                "symbol": sym,
                "qty": round(qty, 2),
                "price": round(price, 2),
                "market_value_twd": round(mkt_val, 0),
                "currency": curr
            })

    # 4. 回傳結果
    return {
        "success": True,
        "summary": {
            "total_value": round(total_market_value, 0),
            "invested_cost": round(net_invested_twd, 0), # 這是淨投入(含已賣出取回)，如需「現有持倉成本」需另算
            "realized_pnl": round(realized_pnl_twd, 0),
            "unrealized_pnl": round(total_market_value - (net_invested_twd + realized_pnl_twd), 0) # 估算值
        },
        "holdings": final_holdings,
        "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

if __name__ == "__main__":
    # 本機測試啟動
    uvicorn.run(app, host="0.0.0.0", port=8000)
