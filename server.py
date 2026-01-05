# server.py
import os
import uvicorn
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

# 引用您原本的邏輯
from journal_engine.config import config
from journal_engine.clients.api_client import ApiClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.calculator import PortfolioCalculator

app = FastAPI()

class CalcRequest(BaseModel):
    force_update: bool = False

def run_calculation_job(user_token: str):
    """
    這是核心邏輯：接收使用者的 Token，暫時借用這個身分去執行計算
    """
    print("啟動計算任務...")
    
    # 關鍵：將全域設定中的 Token 換成這位使用者的 Token
    # 這樣 ApiClient 發出的請求就會帶上這位使用者的身分
    config.USER_TOKEN = user_token
    
    # 初始化客戶端
    api_client = ApiClient()
    market_client = MarketDataClient() # 市場數據可以共用快取
    
    try:
        # 1. 下載該使用者的交易紀錄
        print(f"正在為使用者 (Token前5碼: {user_token[:5]}...) 取得紀錄")
        records = api_client.fetch_records()
        
        if not records:
            print("查無交易紀錄，結束計算")
            return

        # 2. 準備市場數據 (這部分所有使用者共用，沒差)
        tickers = list(set(r['symbol'] for r in records))
        market_data, fx_rates = market_client.download_data(tickers, records[0]['Date']) # 需注意日期邏輯
        
        # 3. 執行計算
        calculator = PortfolioCalculator(records, market_client)
        # 修正: 傳入 market_client 實例，因為 calculator 需要用它查價
        
        # 這裡需要稍微修改 Calculator 類別，確保它能接受 market_client
        # 原本您的代碼: calculator = PortfolioCalculator(records, market_data) 
        # 但 Calculator 內部是用 self.market.get_price，所以要確認傳入的是 Client 還是 Data
        # 假設 Calculator 預期的是 Client:
        portfolio_snapshot = calculator.run() 
        
        # 4. 上傳結果 (會寫入該使用者的資料庫)
        api_client.upload_portfolio(portfolio_snapshot)
        print("計算完成並上傳成功")
        
    except Exception as e:
        print(f"計算失敗: {str(e)}")
        import traceback
        traceback.print_exc()

@app.post("/calculate")
async def handle_calculate(
    req: CalcRequest, 
    background_tasks: BackgroundTasks,
    authorization: str = Header(None)
):
    """
    前端網頁呼叫這個接口，並在 Header 帶上 Authorization: Bearer <token>
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="請先登入")
    
    token = authorization.replace("Bearer ", "")
    
    # 使用 BackgroundTasks 讓伺服器立刻回覆「收到」，然後在背景慢慢算
    # 這樣前端就不會轉圈圈轉到超時
    background_tasks.add_task(run_calculation_job, token)
    
    return {"status": "accepted", "message": "計算已在背景開始，請稍後重新整理網頁"}

@app.get("/")
def health_check():
    # 這是給 UptimeRobot 戳的，確保伺服器不睡覺
    return {"status": "alive"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
