import requests
import logging
from journal_engine.config import (
    WORKER_API_URL_RECORDS, 
    WORKER_API_URL_PORTFOLIO, 
    API_HEADERS
)

class CloudflareClient:
    def __init__(self):
        self.logger = logging.getLogger("api_client")

    def fetch_records(self):
        """從 Cloudflare D1 獲取所有交易紀錄"""
        try:
            self.logger.info(f"正在請求交易紀錄: {WORKER_API_URL_RECORDS}")
            response = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
            response.raise_for_status()
            data = response.json()
            if data.get('success'):
                return data.get('data', [])
            else:
                self.logger.error(f"獲取紀錄失敗: {data.get('error')}")
                return []
        except Exception as e:
            self.logger.error(f"連線至 Cloudflare 發生錯誤: {e}")
            return []

    def upload_portfolio(self, portfolio_data, target_user_id=None):
        """
        上傳計算後的投資組合快照至 Cloudflare
        :param portfolio_data: 計算出的 JSON 格式數據
        :param target_user_id: 選填。指定此快照所屬的使用者 Email (用於多人隔離)
        """
        try:
            # 構造傳輸 Payload
            # 如果提供了 target_user_id，將原始數據包裹在 data 欄位中，並附帶 target_user_id
            # Worker 的 handleUploadPortfolio 會根據此結構來決定存入哪個使用者的空間
            if target_user_id:
                payload = {
                    "target_user_id": target_user_id,
                    "data": portfolio_data
                }
            else:
                # 若無指定使用者（如管理員全域更新），則直接發送原始數據
                payload = portfolio_data

            self.logger.info(f"正在上傳快照數據至: {WORKER_API_URL_PORTFOLIO} (目標使用者: {target_user_id if target_user_id else 'Default'})")
            
            response = requests.post(
                WORKER_API_URL_PORTFOLIO, 
                json=payload, 
                headers=API_HEADERS
            )
            response.raise_for_status()
            
            result = response.json()
            if result.get('success'):
                self.logger.info("快照上傳成功。")
                return True
            else:
                self.logger.error(f"快照上傳失敗: {result.get('error')}")
                return False
        except Exception as e:
            self.logger.error(f"上傳快照至 Cloudflare 發生錯誤: {e}")
            return False
