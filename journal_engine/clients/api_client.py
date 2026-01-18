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

    def upload_portfolio(self, snapshot: PortfolioSnapshot, target_user_id: str = None):
        """
        上傳計算結果至 Cloudflare D1
        :param snapshot: 計算結果物件
        :param target_user_id: (選填) 指定這份資料屬於哪個 Email，若不填則預設為 system
        """
        user_label = target_user_id if target_user_id else 'System'
        print(f"計算完成，正在上傳使用者 [{user_label}] 的投資組合至 Cloudflare D1 ({WORKER_API_URL_PORTFOLIO})...")
        
        snapshot_data = snapshot.model_dump()
        
        # [修改] 建構包含 target_user_id 的 Payload
        # 這是為了配合 Worker 端新增的代理人機制，將資料包裝在 data 欄位中
        payload = {
            "target_user_id": target_user_id,
            "data": snapshot_data
        }
        
        try:
            response = requests.post(
                WORKER_API_URL_PORTFOLIO, 
                json=payload, 
                headers=API_HEADERS
            )
            
            if response.status_code == 200:
                print(f"[{user_label}] 上傳成功! Worker 回應: {response.text}")
            else:
                print(f"[{user_label}] 上傳失敗 [{response.status_code}]: {response.text}")
                
        except Exception as e:
            print(f"[{user_label}] 上傳過程發生錯誤: {e}")
