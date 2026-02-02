import requests
import json
import logging
import math
from datetime import date, datetime
from typing import Any

from ..config import WORKER_API_URL_RECORDS, WORKER_API_URL_PORTFOLIO, API_HEADERS, API_KEY
from ..models import PortfolioSnapshot


def _json_sanitize(obj: Any) -> Any:
    """
    Make obj JSON-compliant for requests.post(json=...),
    which uses json.dumps(..., allow_nan=False).

    Rules:
      - float NaN/Inf/-Inf -> None
      - numpy scalar -> Python scalar (via .item())
      - pandas Timestamp/DatetimeIndex/date/datetime -> ISO string
      - dict/list/tuple -> recursive
      - other -> unchanged
    """
    # Fast path for None / bool / int / str
    if obj is None or isinstance(obj, (bool, int, str)):
        return obj

    # datetime/date -> isoformat
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    # floats: ban NaN/Inf
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj

    # numpy scalar: has .item()
    if hasattr(obj, "item") and callable(getattr(obj, "item")):
        try:
            return _json_sanitize(obj.item())
        except Exception:
            pass

    # pandas Timestamp: has .to_pydatetime or isoformat
    if hasattr(obj, "to_pydatetime") and callable(getattr(obj, "to_pydatetime")):
        try:
            return obj.to_pydatetime().isoformat()
        except Exception:
            pass

    # dict
    if isinstance(obj, dict):
        return {str(k): _json_sanitize(v) for k, v in obj.items()}

    # list/tuple
    if isinstance(obj, (list, tuple)):
        return [_json_sanitize(v) for v in obj]

    # fallback: try to stringify if it's not JSON serializable
    try:
        json.dumps(obj)
        return obj
    except Exception:
        return str(obj)


class CloudflareClient:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.api_base_url = WORKER_API_URL_RECORDS.rsplit('/api/', 1)[0]  # 獲取 base URL
    
    def fetch_records(self) -> list:
        """從 Worker API 獲取交易紀錄"""
        self.logger.info(f"正在連線至 API: {WORKER_API_URL_RECORDS}")
        try:
            resp = requests.get(WORKER_API_URL_RECORDS, headers=API_HEADERS)
            
            if resp.status_code != 200:
                self.logger.error(f"API 連線失敗 [Status: {resp.status_code}]: {resp.text}")
                return []

            api_json = resp.json()
            if not api_json.get('success'):
                self.logger.error(f"API 回傳錯誤: {api_json.get('error')}")
                return []
                
            records = api_json.get('data', [])
            self.logger.info(f"成功取得 {len(records)} 筆交易紀錄")
            return records
            
        except Exception as e:
            self.logger.error(f"API 連線發生例外狀況: {e}")
            return []

    def delete_record(self, record_id: int) -> bool:
        """
        [v2.53] 刪除單筆交易記錄
        :param record_id: 記錄 ID
        :return: 是否刪除成功
        """
        self.logger.info(f"正在刪除記錄 ID: {record_id}")
        try:
            resp = requests.delete(
                WORKER_API_URL_RECORDS,
                json={"id": record_id},
                headers=API_HEADERS
            )
            
            if resp.status_code == 200:
                api_json = resp.json()
                if api_json.get('success'):
                    self.logger.info(f"✓ 記錄 {record_id} 刪除成功")
                    return True
                else:
                    self.logger.warning(f"✗ 刪除記錄 {record_id} 失敗: {api_json.get('error')}")
                    return False
            else:
                self.logger.warning(f"✗ 刪除記錄 {record_id} 失敗 [Status: {resp.status_code}]: {resp.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"✗ 刪除記錄 {record_id} 發生異常: {e}")
            return False
    
    def delete_records(self, record_ids: list) -> dict:
        """
        [v2.53] 批量刪除交易記錄
        :param record_ids: 記錄 ID 列表
        :return: {'success': int, 'failed': int, 'failed_ids': list}
        """
        if not record_ids:
            return {'success': 0, 'failed': 0, 'failed_ids': []}
        
        self.logger.info(f"正在批量刪除 {len(record_ids)} 筆記錄...")
        
        success_count = 0
        failed_count = 0
        failed_ids = []
        
        for record_id in record_ids:
            if self.delete_record(record_id):
                success_count += 1
            else:
                failed_count += 1
                failed_ids.append(record_id)
        
        result = {
            'success': success_count,
            'failed': failed_count,
            'failed_ids': failed_ids
        }
        
        self.logger.info(f"批量刪除完成: 成功 {success_count} 筆, 失敗 {failed_count} 筆")
        return result

    def get_user_benchmark(self, user_email: str) -> str:
        """
        [v2.54] 從資料庫獲取用戶的 benchmark 設定
        :param user_email: 用戶 email
        :return: benchmark 代碼 (預設為 'SPY')
        """
        try:
            response = requests.get(
                f"{self.api_base_url}/api/user-settings",
                headers={
                    "X-API-KEY": API_KEY,
                    "X-Target-User": user_email
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('benchmark'):
                    benchmark = data['benchmark']
                    self.logger.info(f"用戶 {user_email} 的 benchmark: {benchmark}")
                    return benchmark
                else:
                    self.logger.warning(f"無法獲取用戶 {user_email} 的 benchmark，使用預設值 SPY")
                    return 'SPY'
            else:
                self.logger.warning(f"無法獲取用戶 {user_email} 的 benchmark [Status: {response.status_code}]，使用預設值 SPY")
                return 'SPY'
        except Exception as e:
            self.logger.error(f"獲取 benchmark 設定時發生錯誤: {e}，使用預設值 SPY")
            return 'SPY'

    def upload_portfolio(self, snapshot: PortfolioSnapshot, target_user_id: str = None):
        """
        上傳計算結果至 Cloudflare D1
        :param snapshot: 計算好的快照物件 (Pydantic Model)
        :param target_user_id: (選填) 指定這份資料屬於哪個使用者 Email，供管理員代理上傳使用
        """
        self.logger.info(f"計算完成，正在上傳 {target_user_id if target_user_id else 'System'} 的投資組合至 Cloudflare D1...")
        
        # 將 Pydantic model dump 出來後做 JSON-safe sanitize（避免 NaN/Inf）
        raw_data = snapshot.model_dump()
        safe_data = _json_sanitize(raw_data)

        payload = {
            "target_user_id": target_user_id,
            "data": safe_data
        }
        
        try:
            response = requests.post(
                WORKER_API_URL_PORTFOLIO,
                json=payload,
                headers=API_HEADERS
            )
            
            if response.status_code == 200:
                self.logger.info(f"上傳成功! Worker 回應: {response.text}")
            else:
                self.logger.error(f"上傳失敗 [{response.status_code}]: {response.text}")
                
        except Exception as e:
            self.logger.error(f"上傳過程發生錯誤: {e}")
