import logging
from typing import Any, Dict, List, Optional, Tuple

import requests

from ..config import (
    API_HEADERS,
    API_KEY,
    WORKER_API_URL_PORTFOLIO,
    WORKER_API_URL_RECORDS,
)
from ..models import PortfolioSnapshot


REQUEST_TIMEOUT: Tuple[float, float] = (5.0, 30.0)


class CloudflareAPIError(RuntimeError):
    """Raised when the Worker API cannot provide a verified result."""


def _mask_user_id(user_id: Optional[str]) -> str:
    value = str(user_id or "").strip()
    if not value:
        return "System"
    if "@" not in value:
        return f"{value[:2]}***" if len(value) > 2 else "***"
    local, domain = value.split("@", 1)
    visible = local[:2] if len(local) >= 2 else local[:1]
    return f"{visible}***@{domain}"


class CloudflareClient:
    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.api_base_url = WORKER_API_URL_RECORDS.rsplit("/api/", 1)[0]

    @staticmethod
    def _headers(target_user_id: Optional[str] = None) -> Dict[str, str]:
        headers = dict(API_HEADERS)
        if target_user_id:
            headers["X-Target-User"] = target_user_id
        return headers

    @staticmethod
    def _decode_json(response: requests.Response, operation: str) -> Dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise CloudflareAPIError(
                f"{operation} returned invalid JSON [status={response.status_code}]"
            ) from exc
        if not isinstance(payload, dict):
            raise CloudflareAPIError(f"{operation} returned a non-object JSON payload")
        return payload

    def fetch_records(self, target_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch transaction records and reject unverifiable API responses."""
        self.logger.info("正在連線至交易紀錄 API")
        try:
            response = requests.get(
                WORKER_API_URL_RECORDS,
                headers=self._headers(target_user_id),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise CloudflareAPIError("交易紀錄 API 連線失敗") from exc

        if response.status_code != 200:
            raise CloudflareAPIError(
                f"交易紀錄 API 回應失敗 [status={response.status_code}]"
            )

        payload = self._decode_json(response, "交易紀錄 API")
        if payload.get("success") is not True:
            raise CloudflareAPIError("交易紀錄 API 未回傳 success=true")

        records = payload.get("data")
        if not isinstance(records, list):
            raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")

        self.logger.info("成功取得 %s 筆交易紀錄", len(records))
        return records

    def delete_record(self, record_id: int) -> bool:
        """Delete one transaction record; retain bool semantics for existing callers."""
        self.logger.info("正在刪除記錄 ID: %s", record_id)
        try:
            response = requests.delete(
                WORKER_API_URL_RECORDS,
                json={"id": record_id},
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            self.logger.error("刪除記錄 %s 發生連線錯誤: %s", record_id, type(exc).__name__)
            return False

        if response.status_code != 200:
            self.logger.warning(
                "刪除記錄 %s 失敗 [status=%s]", record_id, response.status_code
            )
            return False

        try:
            payload = self._decode_json(response, "刪除交易紀錄 API")
        except CloudflareAPIError as exc:
            self.logger.error("刪除記錄 %s 失敗: %s", record_id, exc)
            return False

        if payload.get("success") is True:
            self.logger.info("記錄 %s 刪除成功", record_id)
            return True

        self.logger.warning("刪除記錄 %s 未獲 success=true", record_id)
        return False

    def delete_records(self, record_ids: list) -> dict:
        """Delete multiple records and return the existing summary shape."""
        if not record_ids:
            return {"success": 0, "failed": 0, "failed_ids": []}

        self.logger.info("正在批量刪除 %s 筆記錄", len(record_ids))
        failed_ids = [record_id for record_id in record_ids if not self.delete_record(record_id)]
        result = {
            "success": len(record_ids) - len(failed_ids),
            "failed": len(failed_ids),
            "failed_ids": failed_ids,
        }
        self.logger.info(
            "批量刪除完成: 成功 %s 筆, 失敗 %s 筆",
            result["success"],
            result["failed"],
        )
        return result

    def get_user_benchmark(self, user_email: str) -> str:
        """Fetch one user's benchmark; transport/server failures are fatal."""
        masked_user = _mask_user_id(user_email)
        try:
            response = requests.get(
                f"{self.api_base_url}/api/user-settings",
                headers={
                    "X-API-KEY": API_KEY,
                    "X-Target-User": user_email,
                },
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise CloudflareAPIError(
                f"無法取得 {masked_user} 的 benchmark 設定"
            ) from exc

        if response.status_code != 200:
            raise CloudflareAPIError(
                f"benchmark API 回應失敗 [user={masked_user}, status={response.status_code}]"
            )

        payload = self._decode_json(response, "benchmark API")
        if payload.get("success") is not True:
            raise CloudflareAPIError(
                f"benchmark API 未回傳 success=true [user={masked_user}]"
            )

        benchmark = str(payload.get("benchmark") or "SPY").strip().upper()
        if not benchmark:
            benchmark = "SPY"
        self.logger.info("用戶 %s 的 benchmark: %s", masked_user, benchmark)
        return benchmark

    def upload_portfolio(
        self,
        snapshot: PortfolioSnapshot,
        target_user_id: Optional[str] = None,
    ) -> bool:
        """Upload a snapshot and return only after Worker confirms success=true."""
        masked_user = _mask_user_id(target_user_id)
        self.logger.info("正在上傳 %s 的投資組合快照", masked_user)

        payload = {
            "target_user_id": target_user_id,
            "data": snapshot.model_dump(),
        }

        try:
            response = requests.post(
                WORKER_API_URL_PORTFOLIO,
                json=payload,
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise CloudflareAPIError(
                f"投資組合上傳失敗 [user={masked_user}]"
            ) from exc

        if response.status_code != 200:
            raise CloudflareAPIError(
                f"投資組合 API 回應失敗 [user={masked_user}, status={response.status_code}]"
            )

        result = self._decode_json(response, "投資組合 API")
        if result.get("success") is not True:
            raise CloudflareAPIError(
                f"投資組合 API 未確認上傳成功 [user={masked_user}]"
            )

        self.logger.info("%s 的投資組合快照上傳成功", masked_user)
        return True
