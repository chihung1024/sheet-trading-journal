"""Run the portfolio update while publishing a safe, typed failure code for CI.

The calculation engine remains authoritative. This wrapper resolves an optional opaque
calculation-job target through the trusted Worker boundary, then observes the engine's
exception boundary and writes only a fixed enum to GITHUB_OUTPUT.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Iterable, Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import main as runner
from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient
from journal_engine.core.daily_pnl_reconciler import DailyPnLReconciliationError


CONFIGURATION_FAILED = "CONFIGURATION_FAILED"
RECORDS_API_FAILED = "RECORDS_API_FAILED"
SETTINGS_API_FAILED = "SETTINGS_API_FAILED"
RECORD_VALIDATION_FAILED = "RECORD_VALIDATION_FAILED"
MARKET_DATA_FAILED = "MARKET_DATA_FAILED"
CALCULATION_FAILED = "CALCULATION_FAILED"
RECONCILIATION_FAILED = "RECONCILIATION_FAILED"
SNAPSHOT_VALIDATION_FAILED = "SNAPSHOT_VALIDATION_FAILED"
SNAPSHOT_UPLOAD_FAILED = "SNAPSHOT_UPLOAD_FAILED"
MULTIPLE_USER_FAILURES = "MULTIPLE_USER_FAILURES"
UNKNOWN_CALCULATION_FAILED = "UNKNOWN_CALCULATION_FAILED"

SAFE_FAILURE_CODES = frozenset(
    {
        CONFIGURATION_FAILED,
        RECORDS_API_FAILED,
        SETTINGS_API_FAILED,
        RECORD_VALIDATION_FAILED,
        MARKET_DATA_FAILED,
        CALCULATION_FAILED,
        RECONCILIATION_FAILED,
        SNAPSHOT_VALIDATION_FAILED,
        SNAPSHOT_UPLOAD_FAILED,
        MULTIPLE_USER_FAILURES,
        UNKNOWN_CALCULATION_FAILED,
    }
)

PER_USER_FAILURE_LOG_TEMPLATE = "使用者 %s 處理失敗: %s"


class UserFailureCapture(logging.Handler):
    """Capture exception objects from main's per-user failure log records."""

    def __init__(self) -> None:
        super().__init__(level=logging.ERROR)
        self.exceptions: list[Exception] = []

    def emit(self, record: logging.LogRecord) -> None:
        if record.name != "main" or not record.exc_info:
            return
        if record.msg != PER_USER_FAILURE_LOG_TEMPLATE:
            return
        exc = record.exc_info[1]
        if isinstance(exc, Exception):
            self.exceptions.append(exc)


def resolve_target_user(
    api_client: CloudflareClient,
    *,
    calculation_job_id: str = "",
    legacy_target_user_id: str = "",
) -> str:
    """Resolve an opaque job target; job identity always wins over legacy targeting."""
    job_id = str(calculation_job_id or "").strip()
    if job_id:
        return api_client.resolve_calculation_job_target(job_id)
    return str(legacy_target_user_id or "").strip()


def configure_target_user_from_environment() -> str:
    """Set the engine's existing private target env from the opaque workflow job id."""
    calculation_job_id = os.environ.get("CALCULATION_JOB_ID", "").strip()
    legacy_target_user_id = os.environ.get("TARGET_USER_ID", "").strip()
    client = CloudflareClient() if calculation_job_id else None
    target_user_id = resolve_target_user(
        client,
        calculation_job_id=calculation_job_id,
        legacy_target_user_id=legacy_target_user_id,
    )
    # Keep main.py unchanged: its existing target contract is now populated only inside
    # this trusted process. Scheduled runs explicitly clear stale target state.
    os.environ["TARGET_USER_ID"] = target_user_id
    return target_user_id


def classify_failure(exc: Exception, *, per_user: bool = False) -> str:
    """Map an exception to a fixed, non-sensitive operational category."""
    if isinstance(exc, DailyPnLReconciliationError):
        return RECONCILIATION_FAILED

    message = str(exc)

    if isinstance(exc, CloudflareAPIError):
        if "benchmark" in message or "benchmark 設定" in message:
            return SETTINGS_API_FAILED
        if "投資組合" in message or "上傳" in message:
            return SNAPSHOT_UPLOAD_FAILED
        return RECORDS_API_FAILED

    if isinstance(exc, runner.PortfolioUpdateError):
        if "API_KEY" in message:
            return CONFIGURATION_FAILED
        if (
            message.startswith("交易紀錄")
            or "目標使用者" in message
            or "使用者交易資料意外為空" in message
        ):
            return RECORD_VALIDATION_FAILED
        if "市場資料" in message or "匯率" in message or "價格歷史覆蓋" in message:
            return MARKET_DATA_FAILED
        if "拆股復權交易帳本不一致" in message:
            return RECONCILIATION_FAILED
        if "快照驗證失敗" in message:
            return SNAPSHOT_VALIDATION_FAILED
        if "上傳" in message or "Worker 未明確確認上傳成功" in message:
            return SNAPSHOT_UPLOAD_FAILED
        if "計算器未產生快照" in message or "計算期間 validator" in message:
            return CALCULATION_FAILED

    if per_user:
        return CALCULATION_FAILED
    return UNKNOWN_CALCULATION_FAILED


def collapse_user_failure_codes(exceptions: Iterable[Exception]) -> Optional[str]:
    codes = {classify_failure(exc, per_user=True) for exc in exceptions}
    if not codes:
        return None
    if len(codes) == 1:
        return next(iter(codes))
    return MULTIPLE_USER_FAILURES


def write_github_output(error_code: str, output_path: Optional[str] = None) -> None:
    if error_code and error_code not in SAFE_FAILURE_CODES:
        raise ValueError("unsafe calculation error code")
    path = output_path if output_path is not None else os.environ.get("GITHUB_OUTPUT", "")
    if not path:
        return
    with Path(path).open("a", encoding="utf-8") as handle:
        handle.write(f"error_code={error_code}\n")


def main() -> int:
    runner.setup_logging()
    logger = logging.getLogger("calculation_runner")
    main_logger = logging.getLogger("main")
    capture = UserFailureCapture()
    main_logger.addHandler(capture)

    try:
        configure_target_user_from_environment()
        runner.run_update()
    except Exception as exc:
        user_code = collapse_user_failure_codes(capture.exceptions)
        error_code = user_code or classify_failure(exc)
        write_github_output(error_code)
        logger.error("Portfolio update failed [error_code=%s]", error_code)
        return 1
    finally:
        main_logger.removeHandler(capture)

    write_github_output("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
