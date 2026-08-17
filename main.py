import logging
import math
import os
import sys
from datetime import timedelta
from typing import List, Optional, Tuple

import pandas as pd

from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.semantic_market_data import SemanticMarketDataClient as MarketDataClient
from journal_engine.config import API_KEY
from journal_engine.core.account_value_preview import attach_account_value_preview
from journal_engine.core.calculation_manifest import (
    CalculationManifestError,
    resolve_engine_source_commit,
)
from journal_engine.core.calculator import PortfolioCalculator
from journal_engine.core.cash_ledger import build_shadow_cash_ledger
from journal_engine.core.currency_detector import CurrencyDetector
from journal_engine.core.daily_pnl_reconciler import reconcile_snapshot_daily_pnl
from journal_engine.core.ledger_integrity import validate_transaction_prefix_integrity
from journal_engine.core.production_manifest import (
    ProductionManifestError,
    build_production_calculation_manifest,
    resolve_calculation_context,
)
from journal_engine.core.split_ledger import (
    build_split_adjusted_validation_ledger,
    validate_adjusted_ledger_parity,
)
from journal_engine.core.transaction_calendar import ensure_transaction_dates_in_market_calendar
from journal_engine.core.validator import PortfolioValidator


SUPPORTED_TRANSACTION_TYPES = {"BUY", "SELL", "DIV"}
SHADOW_TRANSACTION_METADATA_COLUMNS = (
    "currency",
    "executed_at",
    "execution_sequence",
    "event_source",
)
LEGACY_DAILY_PNL_MISMATCH_PREFIX = "Daily PnL formula/aggregation mismatch:"
PRODUCTION_OVERSELL_POLICY = "CLAMP"


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


class LegacyDailyPnLMismatchCapture(logging.Filter):
    """Capture the superseded calculator warning before canonical reconciliation.

    The calculator still computes its historical parallel aggregation for
    compatibility. PR-04 replaces that value with a canonical component ledger
    and fails closed if the ledger does not reconcile to history. Suppressing
    only this obsolete intermediate warning avoids reporting it as the final
    result; all other calculator warnings remain visible.
    """

    def __init__(self) -> None:
        super().__init__()
        self.messages: List[str] = []

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if message.startswith(LEGACY_DAILY_PNL_MISMATCH_PREFIX):
            self.messages.append(message)
            return False
        return True


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def observe_shadow_cash_ledger(api_client, user_id: str, raw_user_df: pd.DataFrame):
    """Collect privacy-safe, non-authoritative cash completeness evidence."""
    logger = logging.getLogger("main")
    try:
        cash_events = api_client.fetch_cash_events(user_id)
    except Exception as exc:  # Shadow observation must never block the securities snapshot.
        logger.warning(
            "Cash shadow evidence unavailable [stage=feed,error=%s]",
            type(exc).__name__,
        )
        return None

    try:
        report = build_shadow_cash_ledger(raw_user_df, cash_events)
    except Exception as exc:  # Fail open only for this non-authoritative observation surface.
        logger.warning(
            "Cash shadow evidence unavailable [stage=derive,error=%s]",
            type(exc).__name__,
        )
        return None

    currencies = sorted(summary.currency for summary in report.currencies)
    issue_codes = sorted({issue.code for issue in report.issues})
    logger.info(
        "Cash shadow evidence [complete=%s,transaction_rows=%s,resolved_transaction_rows=%s,cash_event_rows=%s,resolved_cash_event_rows=%s,currencies=%s,issue_codes=%s]",
        report.complete,
        report.transaction_rows,
        report.resolved_transaction_rows,
        report.cash_event_rows,
        report.resolved_cash_event_rows,
        currencies,
        issue_codes,
    )
    return report


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

    # R2.2C shadow transport keeps the API field names deliberately lowercase.
    # PortfolioCalculator treats public `Timestamp` / `Sequence` columns as
    # same-day ordering authority, so these fields must never be aliased to
    # those names before the separate chronology evidence gate is approved.
    for metadata_column in SHADOW_TRANSACTION_METADATA_COLUMNS:
        if metadata_column not in df.columns:
            df[metadata_column] = None

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

    # Keep the batch runner's domain contract aligned with the Worker write boundary.
    # Existing records with price=0 remain accepted for backward compatibility until
    # a production-data preflight can prove that tightening the write contract is safe.
    if (df["Qty"] <= 0).any():
        raise PortfolioUpdateError("交易紀錄欄位 Qty 必須大於 0")
    if (df["Price"] < 0).any():
        raise PortfolioUpdateError("交易紀錄欄位 Price 不得小於 0")

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


def _has_positive_asof(series: pd.Series, required_date) -> bool:
    """Return whether a positive finite observation exists on/before required_date."""
    if series is None or series.empty:
        return False
    target = pd.Timestamp(required_date)
    if getattr(target, "tzinfo", None) is not None:
        target = target.tz_localize(None)
    target = target.normalize()
    try:
        value = float(series.asof(target))
    except Exception:
        return False
    return math.isfinite(value) and value > 0


def validate_required_market_data(
    market_client,
    required_tickers,
    required_dates_by_ticker=None,
) -> None:
    """Fail closed unless required price/FX data covers each calculation start."""
    market_data = getattr(market_client, "market_data", None)
    if not isinstance(market_data, dict):
        raise PortfolioUpdateError("市場資料客戶端未提供可驗證的 market_data")

    required_dates = {
        str(symbol).strip().upper(): pd.Timestamp(value)
        for symbol, value in (required_dates_by_ticker or {}).items()
        if str(symbol or "").strip() and value is not None
    }

    missing = []
    invalid = []
    price_coverage = []
    normalized_tickers = sorted(
        {str(ticker).strip().upper() for ticker in required_tickers if ticker}
    )
    for symbol in normalized_tickers:
        frame = market_data.get(symbol)
        if frame is None or not isinstance(frame, pd.DataFrame) or frame.empty:
            missing.append(symbol)
            continue
        if not PortfolioValidator.validate_price_data(symbol, frame):
            invalid.append(symbol)
            continue

        required_date = required_dates.get(symbol)
        if required_date is not None:
            prices = pd.to_numeric(frame["Close_Adjusted"], errors="coerce")
            prices.index = pd.to_datetime(frame.index).tz_localize(None).normalize()
            if not _has_positive_asof(prices, required_date):
                price_coverage.append(
                    f"{symbol}@{required_date.strftime('%Y-%m-%d')}"
                )

    details = []
    if missing:
        details.append(f"缺少資料: {', '.join(missing)}")
    if invalid:
        details.append(f"價格資料無效: {', '.join(invalid)}")
    if price_coverage:
        details.append(f"價格歷史覆蓋不足: {', '.join(price_coverage)}")

    validate_fx = getattr(market_client, "validate_required_fx_data", None)
    if callable(validate_fx):
        missing_fx = validate_fx(required_tickers)
        if missing_fx:
            details.append(f"缺少匯率幣別: {', '.join(missing_fx)}")

    fx_coverage = []
    fx_by_currency = getattr(market_client, "fx_rates_by_currency", None)
    if isinstance(fx_by_currency, dict) and required_dates:
        for symbol, required_date in sorted(required_dates.items()):
            currency = CurrencyDetector.detect(symbol)
            if currency == "TWD":
                continue
            series = fx_by_currency.get(currency)
            if not _has_positive_asof(series, required_date):
                fx_coverage.append(
                    f"{symbol}/{currency}@{required_date.strftime('%Y-%m-%d')}"
                )
    if fx_coverage:
        details.append(f"匯率歷史覆蓋不足: {', '.join(fx_coverage)}")

    if details:
        raise PortfolioUpdateError(f"必要市場資料驗證失敗（{'；'.join(details)}）")


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
    logger.info("=== 啟動交易日誌更新程序 (PR-04 canonical Daily PnL) ===")

    if not API_KEY:
        raise PortfolioUpdateError("環境變數中找不到 API_KEY")

    try:
        calculation_now = resolve_calculation_context()
        engine_source_commit = resolve_engine_source_commit(environ=os.environ)
    except (CalculationManifestError, ProductionManifestError) as exc:
        raise PortfolioUpdateError(
            f"source commit / calculation context configuration failed: {exc}"
        ) from exc

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
    required_dates_by_ticker = {
        str(symbol): group["Date"].min()
        for symbol, group in df.groupby("Symbol")
    }

    for user_id in user_list:
        benchmark = api_client.get_user_benchmark(user_id)
        if benchmark == "SPY" and fallback_benchmark != "SPY":
            benchmark = fallback_benchmark
        user_benchmarks[user_id] = benchmark
        all_tickers.add(benchmark)

        user_first_date = df.loc[df["user_id"] == user_id, "Date"].min()
        benchmark_required_date = user_first_date - timedelta(days=1)
        existing_required = required_dates_by_ticker.get(benchmark)
        if existing_required is None or benchmark_required_date < existing_required:
            required_dates_by_ticker[benchmark] = benchmark_required_date

        logger.info("用戶 %s 使用 benchmark: %s", mask_user_id(user_id), benchmark)

    earliest_transaction_date = df["Date"].min()
    fetch_start_date = earliest_transaction_date - timedelta(days=90)
    logger.info("最早交易日期: %s", earliest_transaction_date.strftime("%Y-%m-%d"))
    logger.info("開始下載市場數據，標的數: %s", len(all_tickers))
    market_client.download_data(sorted(all_tickers), fetch_start_date)

    inserted_dates = ensure_transaction_dates_in_market_calendar(
        market_client,
        df,
        allow_leading_transaction_seed=True,
        as_of_date=calculation_now,
    )
    if inserted_dates:
        inserted_count = sum(len(dates) for dates in inserted_dates.values())
        logger.info(
            "已加入 %s 個缺失交易估值日期，涵蓋 %s 個標的",
            inserted_count,
            len(inserted_dates),
        )

    validate_required_market_data(
        market_client,
        all_tickers,
        required_dates_by_ticker=required_dates_by_ticker,
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

            cash_report = observe_shadow_cash_ledger(api_client, user_id, raw_user_df)

            validation_df = build_split_adjusted_validation_ledger(
                raw_user_df,
                market_client,
            )
            integrity_audit = validate_transaction_prefix_integrity(
                validation_df,
                user_label=masked_user,
            )
            logger.info(
                "交易 prefix integrity 通過: user=%s rows=%s scopes=%s symbol_scopes=%s",
                masked_user,
                integrity_audit.row_count,
                integrity_audit.scope_count,
                integrity_audit.symbol_scope_count,
            )

            calculator = PortfolioCalculator(
                raw_user_df.copy(deep=True),
                market_client,
                benchmark_ticker=benchmark,
                api_client=api_client,
                oversell_policy=PRODUCTION_OVERSELL_POLICY,
                calculation_now=calculation_now,
            )
            calculator_logger = logging.getLogger("journal_engine.core.calculator")
            legacy_mismatch_capture = LegacyDailyPnLMismatchCapture()
            calculator_logger.addFilter(legacy_mismatch_capture)
            try:
                snapshot = calculator.run()
            finally:
                calculator_logger.removeFilter(legacy_mismatch_capture)

            if snapshot is None:
                raise PortfolioUpdateError("計算器未產生快照")
            snapshot.benchmark_symbol = benchmark
            if calculation_capture.messages:
                raise PortfolioUpdateError(
                    f"計算期間 validator 回報 {len(calculation_capture.messages)} 項錯誤"
                )

            reconciliation_results = reconcile_snapshot_daily_pnl(
                snapshot,
                calculator.df,
                calculator,
            )
            reconciled_groups = sum(
                result.get("status") == "reconciled"
                for result in reconciliation_results
            )
            logger.info(
                "Canonical Daily PnL reconciliation completed: "
                "groups=%s, legacy_diagnostics=%s",
                reconciled_groups,
                len(legacy_mismatch_capture.messages),
            )

            if not validate_adjusted_ledger_parity(calculator.df, validation_df):
                raise PortfolioUpdateError("計算器與驗證器的拆股復權交易帳本不一致")

            try:
                fx_context = market_client.get_realtime_fx_snapshot(calculation_now)
            except Exception as exc:
                logger.warning(
                    "Account value preview FX unavailable [error=%s]",
                    type(exc).__name__,
                )
                fx_context = {}

            try:
                snapshot = attach_account_value_preview(
                    snapshot,
                    cash_report=cash_report,
                    fx_context=fx_context,
                )
                preview = snapshot.account_value_preview
                logger.info(
                    "Account value preview [status=%s,cash_ledger_complete=%s,currencies=%s,reason=%s,missing_fx=%s]",
                    preview.status,
                    preview.cash_ledger_complete,
                    [component.currency for component in preview.cash_components],
                    preview.reason,
                    preview.missing_cash_fx_currencies,
                )
            except Exception as exc:
                # R2.6A is additive. A preview implementation defect must not erase
                # the already-reviewed securities snapshot path; no account value is
                # published in this fallback.
                logger.warning(
                    "Account value preview unavailable [stage=assemble,error=%s]",
                    type(exc).__name__,
                )

            try:
                snapshot.calculation_manifest = build_production_calculation_manifest(
                    raw_user_df=raw_user_df,
                    market_client=market_client,
                    benchmark=benchmark,
                    calculation_now=calculation_now,
                    engine_source_commit=engine_source_commit,
                    oversell_policy=PRODUCTION_OVERSELL_POLICY,
                )
            except ProductionManifestError as exc:
                raise PortfolioUpdateError(
                    f"calculation manifest assembly failed: {exc}"
                ) from exc

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
