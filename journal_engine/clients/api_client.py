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
RECORD_PAGE_LIMIT = 1_000
MAX_RECORD_PAGES = 2_000
MAX_RECORD_COUNT = 1_000_000


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
        """Fetch every records page and fail closed on inconsistent pagination."""
        self.logger.info("正在連線至交易紀錄 API")
        records: List[Dict[str, Any]] = []
        cursor: Optional[str] = None
        seen_cursors = set()

        for page_number in range(1, MAX_RECORD_PAGES + 1):
            params: Dict[str, Any] = {"limit": RECORD_PAGE_LIMIT}
            if cursor:
                params["cursor"] = cursor
            try:
                response = requests.get(
                    WORKER_API_URL_RECORDS,
                    headers=self._headers(target_user_id),
                    params=params,
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

            page_records = payload.get("data")
            page = payload.get("page")
            if not isinstance(page_records, list):
                raise CloudflareAPIError("交易紀錄 API 的 data 欄位不是陣列")
            if page is None and page_number == 1 and cursor is None:
                if len(page_records) >= RECORD_PAGE_LIMIT:
                    raise CloudflareAPIError("舊版交易紀錄 API 可能已截斷資料")
                self.logger.warning("交易紀錄 API 使用舊版單頁格式")
                self.logger.info("成功取得 %s 筆交易紀錄", len(page_records))
                return page_records
            if not isinstance(page, dict):
                raise CloudflareAPIError("交易紀錄 API 缺少分頁資訊")

            count = page.get("count")
            limit = page.get("limit")
            has_more = page.get("has_more")
            next_cursor = page.get("next_cursor")
            if not isinstance(count, int) or count != len(page_records):
                raise CloudflareAPIError("交易紀錄 API 分頁筆數不一致")
            if not isinstance(limit, int) or limit < 1 or limit > RECORD_PAGE_LIMIT:
                raise CloudflareAPIError("交易紀錄 API 分頁上限無效")
            if not isinstance(has_more, bool):
                raise CloudflareAPIError("交易紀錄 API has_more 無效")
            if has_more:
                if not isinstance(next_cursor, str) or not next_cursor:
                    raise CloudflareAPIError("交易紀錄 API 缺少 next_cursor")
                if next_cursor in seen_cursors:
                    raise CloudflareAPIError("交易紀錄 API 發生 cursor 循環")
                seen_cursors.add(next_cursor)
            elif next_cursor is not None:
                raise CloudflareAPIError("交易紀錄 API 結束頁仍回傳 cursor")

            records.extend(page_records)
            if len(records) > MAX_RECORD_COUNT:
                raise CloudflareAPIError("交易紀錄 API 回傳筆數超過安全上限")
            self.logger.info(
                "交易紀錄 API 第 %s 頁完成：本頁 %s 筆，累計 %s 筆",
                page_number,
                len(page_records),
                len(records),
            )
            if not has_more:
                self.logger.info("成功取得 %s 筆交易紀錄", len(records))
                return records
            cursor = next_cursor

        raise CloudflareAPIError("交易紀錄 API 分頁數超過安全上限")

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
