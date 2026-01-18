import requests
import json
from ..config import WORKER_API_URL_RECORDS, WORKER_API_URL_PORTFOLIO, API_HEADERS
from ..models import PortfolioSnapshot

class CloudflareClient:
    def fetch_records(self) -> list:
        """從 Worker API 獲取交易紀錄"""
        print(f"正在連線至 API: {WORKER_API_URL_RECORDS}")
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
        print(f"計算完成，正在上傳至 Cloudflare D1 ({WORKER_API_URL_PORTFOLIO})...")
        
        # 將 Pydantic 模型轉為 Dict
        payload = snapshot.model_dump()
        
        try:
            response = requests.post(
                WORKER_API_URL_PORTFOLIO, 
                json=payload, 
                headers=API_HEADERS
            )
            
            if response.status_code == 200:
                print(f"上傳成功! Worker 回應: {response.text}")
            else:
                print(f"上傳失敗 [{response.status_code}]: {response.text}")
                
        except Exception as e:
            print(f"上傳過程發生錯誤: {e}")
