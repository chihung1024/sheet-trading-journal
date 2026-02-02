import requests
import json
import logging
from ..config import Config
from ..models import PortfolioSnapshot

logger = logging.getLogger(__name__)

class APIClient:
    """
    Cloudflare KV 傳輸客戶端 (v14.0)
    負責將計算後的投資組合快照同步至雲端 KV 儲存空間。
    """

    def __init__(self):
        """初始化 API 客戶端，從 Config 獲取必要憑證"""
        self.api_token = Config.CF_API_TOKEN
        self.account_id = Config.CF_ACCOUNT_ID
        self.namespace_id = Config.CF_KV_NAMESPACE_ID
        
        # Cloudflare KV API 基礎 URL
        self.base_url = (
            f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/"
            f"storage/kv/namespaces/{self.namespace_id}/values"
        )

    def _get_headers(self):
        """建立 API 請求標頭"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    def upload_snapshot(self, snapshot: PortfolioSnapshot, key: str = "portfolio_data") -> bool:
        """
        🚀 [v14.0] 將完整的投資組合快照序列化並上傳至 Cloudflare KV。
        
        Args:
            snapshot: PortfolioSnapshot 物件，包含 all 與各分組數據。
            key: KV 儲存用的鍵值名稱，預設為 'portfolio_data'。
        
        Returns:
            bool: 是否上傳成功。
        """
        if not all([self.api_token, self.account_id, self.namespace_id]):
            logger.error("❌ [API] 缺少 Cloudflare KV 配置，無法上傳。")
            return False

        try:
            # 1. 序列化資料：Pydantic v2 使用 model_dump_json
            # 此步驟會處理日期格式轉換與多層巢狀字典（groups）
            json_data = snapshot.model_dump_json()
            
            logger.info(f"📡 [API] 正在上傳資料至 KV Key: '{key}' (大小: {len(json_data)/1024:.2f} KB)...")

            # 2. 發送 PUT 請求至 Cloudflare
            response = requests.put(
                f"{self.base_url}/{key}",
                headers=self._get_headers(),
                data=json_data,
                timeout=30 # 設定超時防止程序掛起
            )

            # 3. 檢查回應狀態
            if response.status_code == 200:
                logger.info("✅ [API] 雲端同步完成。")
                return True
            else:
                logger.error(f"❌ [API] 上傳失敗 (HTTP {response.status_code})")
                logger.error(f"   回應內容: {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"💥 [API] 網路連線發生異常: {e}")
            return False
        except Exception as e:
            logger.error(f"💥 [API] 序列化或處理過程中發生未預期錯誤: {e}")
            return False

    def test_connection(self) -> bool:
        """測試 Cloudflare API 連線權限是否正常"""
        try:
            test_key = "connection_test"
            response = requests.get(
                f"{self.base_url}/{test_key}",
                headers=self._get_headers(),
                timeout=10
            )
            # 只要不是 401 或 403，代表 Token 是有效的
            if response.status_code in [200, 404]:
                logger.info("✅ [API] Cloudflare API 連線測試通過。")
                return True
            else:
                logger.error(f"❌ [API] 連線測試失敗: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ [API] 連線測試異常: {e}")
            return False
