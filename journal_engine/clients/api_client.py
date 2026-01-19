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
        :param snapshot: 計算好的快照物件 (Pydantic Model)
        :param target_user_id: (選填) 指定這份資料屬於哪個使用者 Email，供管理員代理上傳使用
        """
        print(f"計算完成，正在上傳 {target_user_id if target_user_id else 'System'} 的投資組合至 Cloudflare D1...")
        
        # [關鍵修改]：包裝 payload，加入 target_user_id 以支援多使用者資料隔離
        # 如果有 target_user_id，則採用代理上傳格式；否則維持原樣
        payload = {
            "target_user_id": target_user_id,
            "data": snapshot.model_dump()
        }
        
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
