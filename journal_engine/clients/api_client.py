import requests
import json
from ..config import WORKER_API_URL_RECORDS, WORKER_API_URL_PORTFOLIO, API_HEADERS, TARGET_USER_EMAIL
from ..models import PortfolioSnapshot

class CloudflareClient:
    def fetch_records(self) -> list:
        """從 Worker API 獲取交易紀錄"""
        # 這裡的 API_HEADERS 已經包含了 X-TARGET-USER
        # Worker 端 handleGetRecords 會優先讀取 X-TARGET-USER 來過濾資料
        print(f"正在獲取使用者 [{TARGET_USER_EMAIL}] 的交易紀錄...")
        print(f"連線至 API: {WORKER_API_URL_RECORDS}")
        
        try:
            resp = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
            
            if resp.status_code != 200:
                print(f"API 連線失敗 [Status: {resp.status_code}]: {resp.text}")
                return []

            api_json = resp.json()
            if not api_json.get('success'):
                print(f"API 回傳錯誤: {api_json.get('error')}")
                return []
                
            records = api_json.get('data', [])
            print(f"成功取得 {len(records)} 筆交易紀錄")
            return records
            
        except Exception as e:
            print(f"API 連線發生例外狀況: {e}")
            return []

    def upload_portfolio(self, snapshot: PortfolioSnapshot):
        """上傳計算結果至 Cloudflare D1"""
        if not TARGET_USER_EMAIL:
            print("❌ 錯誤: 未設定 TARGET_USER_EMAIL，無法執行上傳。")
            return

        print(f"計算完成，正在上傳使用者 [{TARGET_USER_EMAIL}] 的快照至 Cloudflare D1...")
        
        # 將模型轉為 Dict
        payload = snapshot.model_dump()
        
        try:
            # 傳送請求，Header 已包含 X-TARGET-USER
            response = requests.post(
                WORKER_API_URL_PORTFOLIO, 
                json=payload, 
                headers=API_HEADERS
            )
            
            if response.status_code == 200:
                print(f"上傳成功! 帳號: {TARGET_USER_EMAIL}")
            else:
                print(f"上傳失敗 [{response.status_code}]: {response.text}")
                
        except Exception as e:
            print(f"上傳過程發生錯誤: {e}")
