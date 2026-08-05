import logging
import math
import os
import sys
from datetime import timedelta
from typing import List, Optional, Tuple

import pandas as pd

from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.config import API_KEY
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.split_ledger import (
    build_split_adjusted_validation_ledger,
    validate_adjusted_ledger_parity,
)
from journal_engine.core.transaction_calendar import ensure_transaction_dates_in_market_calendar
from journal_engine.core.validator import PortfolioValidator


SUPPORTED_TRANSACTION_TYPES = {"BUY", "SELL", "DIV"}


class PortfolioUpdateError(RuntimeError):
    """Raised when a portfolio update cannot be verified as successful."""


class ValidationErrorCapture(logging.Handler):
    """Capture validator ERROR records so they can block an upload."""

    def __init__(self) -> None:
        super().__init__(level=logging.ERROR)
        self.messages: List[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.ERROR:
            self.messages.append(record.getMessage())


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def mask_user_id(user_id: Optional[str]) -> str:
    value = str(user_id or "").strip()
    if not value:
        return "ALL"
    if "@" not in value:
        return f"{value[:2]}***" if len(value) > 2 else "***"
    local, domain = value.split("@", 1)
    visible = local[:2] if len(local) >= 2 else local[:1]
    return f"{visible}***@{domain}"


def get_benchmark_from_env() -> Tuple[str, str]:
    custom_benchmark = os.environ.get("CUSTOM_BENCHMARK", "SPY").strip().upper()
    target_user_id = os.environ.get("TARGET_USER_ID", "").strip()
    if not custom_benchmark:
        custom_benchmark = "SPY"
    return custom_benchmark, target_user_id


def prepare_transactions(records: list, target_user_id: str = "") -> Tuple[pd.DataFrame, List[str]]:
    """Normalize records and enforce optional target-user isolation."""
    if not isinstance(records, list):
        raise PortfolioUpdateError("交易紀錄 API 回傳格式錯誤")
    if not records:
        raise PortfolioUpdateError("交易紀錄 API 回傳零筆資料，拒絕產生空快照")

    df = pd.DataFrame(records)
    required_columns = {"user_id", "txn_date", "symbol", "txn_type", "qty", "price"}
    missing_columns = sorted(required_columns - set(df.columns))
    if missing_columns:
        raise PortfolioUpdateError(
            f"交易紀錄缺少必要欄位: {', '.join(missing_columns)}"
        )

    if df["user_id"].isna().any():
        raise PortfolioUpdateError("交易紀錄包含空白 user_id")
    df["user_id"] = df["user_id"].astype(str).str.strip()
    if (df["user_id"] == "").any():
        raise PortfolioUpdateError("交易紀錄包含空白 user_id")

    if target_user_id:
        target_key = target_user_id.strip().casefold()
        user_keys = df["user_id"].str.casefold()
        df = df[user_keys == target_key].copy()
        if df.empty:
            raise PortfolioUpdateError(
                f"找不到目標使用者 {mask_user_id(target_user_id)} 的交易紀錄"
            )

    for optional_column, default_value in (
        ("fee", 0.0),
        ("tax", 0.0),
        ("tag", ""),
    ):
        if optional_column not in df.columns:
            df[optional_column] = default_value
    df["tag"] = df["tag"].fillna("")

    if df["symbol"].isna().any() or df["txn_type"].isna().any():
        raise PortfolioUpdateError("交易紀錄包含空白 Symbol 或 Type")

    df.rename(
        columns={
            "txn_date": "Date",
            "symbol": "Symbol",
            "txn_type": "Type",
            "qty": "Qty",
            "price": "Price",
            "fee": "Commission",
            "tax": "Tax",
            "tag": "Tag",
        },
        inplace=True,
    )

    try:
        df["Date"] = pd.to_datetime(df["Date"], errors="raise")
        df["Qty"] = pd.to_numeric(df["Qty"], errors="raise")
        df["Price"] = pd.to_numeric(df["Price"], errors="raise")
        for column in ("Commission", "Tax"):
            df[column] = pd.to_numeric(df[column], errors="raise").fillna(0.0)
    except (TypeError, ValueError) as exc:
        raise PortfolioUpdateError("交易紀錄包含無法解析的日期或數字") from exc

    if df["Date"].isna().any():
        raise PortfolioUpdateError("交易紀錄包含空白日期")
    for column in ("Qty", "Price", "Commission", "Tax"):
        if df[column].isna().any() or not df[column].map(math.isfinite).all():
            raise PortfolioUpdateError(f"交易紀錄欄位 {column} 包含非有限數值")

    df["Symbol"] = df["Symbol"].astype(str).str.strip().str.upper()
    df["Type"] = df["Type"].astype(str).str.strip().str.upper()
    if (df["Symbol"] == "").any() or (df["Type"] == "").any():
        raise PortfolioUpdateError("交易紀錄包含空白 Symbol 或 Type")

    unsupported_types = sorted(set(df["Type"]) - SUPPORTED_TRANSACTION_TYPES)
    if unsupported_types:
        raise PortfolioUpdateError(
            f"交易紀錄包含不支援的 Type: {', '.join(unsupported_types)}"
        )

    sort_columns = ["Date"]
    if "id" in df.columns:
        sort_columns.append("id")
    df = df.sort_values(sort_columns, kind="stable").reset_index(drop=True)

    users = list(dict.fromkeys(df["user_id"].tolist()))
    if target_user_id and len(users) != 1:
        raise PortfolioUpdateError("目標使用者篩選後仍包含多個使用者")
    return df, users


def validate_before_upload(snapshot, user_df: pd.DataFrame) -> None:
    """Block upload when the calculator or snapshot validator emits an error."""
    validator_logger = logging.getLogger("journal_engine.core.validator")
    capture = ValidationErrorCapture()
    validator_logger.addHandler(capture)
    try:
        is_valid = PortfolioValidator.validate_snapshot_for_upload(snapshot, user_df)
    finally:
        validator_logger.removeHandler(capture)

    if not is_valid or capture.messages:
        raise PortfolioUpdateError(
            f"快照驗證失敗，共偵測到 {max(len(capture.messages), 1)} 項錯誤"
        )


def run_update() -> None:
    logger = logging.getLogger("main")
    logger.info("=== 啟動交易日誌更新程序 (PR-02B transaction-aware calendar) ===")

    if not API_KEY:
        raise PortfolioUpdateError("環境變數中找不到 API_KEY")

    fallback_benchmark, target_user_id = get_benchmark_from_env()
    logger.info(
        "觸發參數: Fallback Benchmark=%s, TargetUser=%s",
        fallback_benchmark,
        mask_user_id(target_user_id),
    )

    api_client = CloudflareClient()
    market_client = MarketDataClient()

    logger.info("正在從 Cloudflare 獲取原始交易紀錄")
    records = api_client.fetch_records(target_user_id=target_user_id or None)
    df, user_list = prepare_transactions(records, target_user_id)

    logger.info("本次將處理 %s 位使用者", len(user_list))
    user_benchmarks = {}
    all_tickers = set(df["Symbol"].unique().tolist())

    for user_id in user_list:
        benchmark = api_client.get_user_benchmark(user_id)
        if benchmark == "SPY" and fallback_benchmark != "SPY":
            benchmark = fallback_benchmark
        user_benchmarks[user_id] = benchmark
        all_tickers.add(benchmark)
        logger.info("用戶 %s 使用 benchmark: %s", mask_user_id(user_id), benchmark)

    earliest_transaction_date = df["Date"].min()
    fetch_start_date = earliest_transaction_date - timedelta(days=90)
    logger.info("最早交易日期: %s", earliest_transaction_date.strftime("%Y-%m-%d"))
    logger.info("開始下載市場數據，標的數: %s", len(all_tickers))
    market_client.download_data(sorted(all_tickers), fetch_start_date)

    inserted_dates = ensure_transaction_dates_in_market_calendar(market_client, df)
    if inserted_dates:
        inserted_count = sum(len(dates) for dates in inserted_dates.values())
        logger.info(
            "已加入 %s 個缺失交易估值日期，涵蓋 %s 個標的",
            inserted_count,
            len(inserted_dates),
        )

    failed_users: List[str] = []
    successful_users = 0

    for user_id in user_list:
        masked_user = mask_user_id(user_id)
        benchmark = user_benchmarks[user_id]
        validator_logger = logging.getLogger("journal_engine.core.validator")
        calculation_capture = ValidationErrorCapture()
        validator_logger.addHandler(calculation_capture)

        try:
            logger.info("正在處理使用者 %s (Benchmark: %s)", masked_user, benchmark)
            raw_user_df = df[df["user_id"] == user_id].copy(deep=True)
            if raw_user_df.empty:
                raise PortfolioUpdateError("使用者交易資料意外為空")

            calculator = PortfolioCalculator(
                raw_user_df.copy(deep=True),
                market_client,
                benchmark_ticker=benchmark,
                api_client=api_client,
            )
            snapshot = calculator.run()
            if snapshot is None:
                raise PortfolioUpdateError("計算器未產生快照")
            if calculation_capture.messages:
                raise PortfolioUpdateError(
                    f"計算期間 validator 回報 {len(calculation_capture.messages)} 項錯誤"
                )

            validation_df = build_split_adjusted_validation_ledger(
                raw_user_df,
                market_client,
            )
            if not validate_adjusted_ledger_parity(calculator.df, validation_df):
                raise PortfolioUpdateError("計算器與驗證器的拆股復權交易帳本不一致")

            validate_before_upload(snapshot, validation_df)
            if api_client.upload_portfolio(snapshot, target_user_id=user_id) is not True:
                raise PortfolioUpdateError("Worker 未明確確認上傳成功")

            successful_users += 1
            logger.info("使用者 %s 處理成功", masked_user)
        except Exception as exc:
            failed_users.append(masked_user)
            logger.exception("使用者 %s 處理失敗: %s", masked_user, exc)
        finally:
            validator_logger.removeHandler(calculation_capture)

    if failed_users:
        raise PortfolioUpdateError(
            f"本次更新有 {len(failed_users)} 位使用者失敗；成功 {successful_users} 位"
        )
    if successful_users != len(user_list):
        raise PortfolioUpdateError("成功使用者數與預期不一致")

    logger.info("=== 所有使用者處理完成：成功 %s，失敗 0 ===", successful_users)


def main() -> int:
    setup_logging()
    try:
        run_update()
    except Exception as exc:
        logging.getLogger("main").exception("更新程序失敗: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
