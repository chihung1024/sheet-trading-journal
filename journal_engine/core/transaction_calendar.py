"""Transaction-aware market calendar helpers.

Portfolio calculations iterate over dates present in downloaded market data. A trade
can legitimately be recorded on a date that is not yet present in the daily market
series. This module makes transaction-processing dates explicit in each symbol's
calendar without pretending that transaction-derived marks are vendor market closes.

Ordinary missing dates carry forward the latest prior market row. A transaction date
that narrowly precedes the first downloaded market row can instead be bootstrapped
from a positive BUY/SELL execution price observed in the ledger when the caller
explicitly opts in. Every synthetic row is provenance-labelled and corporate-action
cash/event fields are cleared.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional

import pandas as pd


logger = logging.getLogger(__name__)

MAX_TRANSACTION_BOOTSTRAP_GAP_DAYS = 7
VALUATION_SOURCE_COLUMN = "Valuation_Source"
VALUATION_SOURCE_DATE_COLUMN = "Valuation_Source_Date"


class TransactionCalendarError(RuntimeError):
    """Raised when a transaction date cannot be represented safely."""


def _normalize_date(value: Any, label: str) -> pd.Timestamp:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise TransactionCalendarError(f"{label} is not a valid date") from exc

    if pd.isna(timestamp):
        raise TransactionCalendarError(f"{label} is empty")
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp.normalize()


def _positive_finite(value: Any) -> bool:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(numeric) and numeric > 0


def _transaction_price_seed(
    transactions_df: pd.DataFrame,
    symbol: str,
    transaction_date: pd.Timestamp,
) -> Optional[float]:
    """Return the last positive BUY/SELL execution price observed on the date."""
    if "Price" not in transactions_df.columns or "Type" not in transactions_df.columns:
        return None

    dates = pd.to_datetime(transactions_df["Date"], errors="coerce")
    if getattr(dates.dt, "tz", None) is not None:
        dates = dates.dt.tz_localize(None)
    mask = (
        transactions_df["Symbol"].astype(str).str.strip().str.upper().eq(symbol)
        & dates.dt.normalize().eq(transaction_date)
        & transactions_df["Type"].astype(str).str.strip().str.upper().isin({"BUY", "SELL"})
    )
    candidates = transactions_df.loc[mask, "Price"]
    for value in reversed(candidates.tolist()):
        if _positive_finite(value):
            return float(value)
    return None


def _set_synthetic_price(row: pd.Series, adjusted_price: float, raw_price: float) -> pd.Series:
    """Set valuation price fields without leaking a future vendor close."""
    if "Close_Adjusted" in row.index:
        row["Close_Adjusted"] = adjusted_price
    if "Close_Raw" in row.index:
        row["Close_Raw"] = raw_price
    for column in ("Close", "Adj Close", "Open", "High", "Low"):
        if column in row.index:
            row[column] = raw_price
    if "Volume" in row.index:
        row["Volume"] = 0.0
    return row


def ensure_transaction_dates_in_market_calendar(
    market_client: Any,
    transactions_df: pd.DataFrame,
    as_of_date: Optional[Any] = None,
    *,
    allow_leading_transaction_seed: bool = False,
) -> Dict[str, List[pd.Timestamp]]:
    """Insert missing transaction-processing dates into market-data calendars.

    Missing dates after historical coverage begins use the latest prior market row.
    By default, dates before the original first market row remain fail-closed. When
    ``allow_leading_transaction_seed`` is explicitly true, a leading date may use a
    transaction-observed seed only when the gap is at most
    ``MAX_TRANSACTION_BOOTSTRAP_GAP_DAYS`` and that date contains a positive BUY/SELL
    execution price. The seed is converted to the same split-adjusted basis as
    ``Close_Adjusted``. Large history gaps, absent market data, missing execution
    prices, and future-dated transactions remain fatal.
    """
    if transactions_df is None or transactions_df.empty:
        return {}

    required_columns = {"Date", "Symbol"}
    missing = sorted(required_columns - set(transactions_df.columns))
    if missing:
        raise TransactionCalendarError(
            f"transaction calendar is missing required columns: {', '.join(missing)}"
        )

    market_data = getattr(market_client, "market_data", None)
    if not isinstance(market_data, dict):
        raise TransactionCalendarError("market client does not expose market_data")

    calculation_date = _normalize_date(
        as_of_date if as_of_date is not None else pd.Timestamp.now(tz="Asia/Taipei"),
        "transaction calendar as-of date",
    )

    dates_by_symbol: Dict[str, set[pd.Timestamp]] = defaultdict(set)
    for _, row in transactions_df.iterrows():
        symbol = str(row["Symbol"]).strip().upper()
        if not symbol:
            raise TransactionCalendarError("transaction calendar contains an empty symbol")

        transaction_date = _normalize_date(
            row["Date"],
            f"{symbol} transaction date",
        )
        if transaction_date > calculation_date:
            raise TransactionCalendarError(
                f"{symbol} transaction date {transaction_date.date()} is after calculation date "
                f"{calculation_date.date()}"
            )
        dates_by_symbol[symbol].add(transaction_date)

    inserted: Dict[str, List[pd.Timestamp]] = {}
    action_columns = ("Dividends", "Stock Splits", "Capital Gains")

    for symbol, transaction_dates in dates_by_symbol.items():
        if symbol not in market_data or market_data[symbol] is None:
            raise TransactionCalendarError(f"{symbol} has no downloaded market data")

        symbol_df = market_data[symbol].copy()
        if symbol_df.empty:
            raise TransactionCalendarError(f"{symbol} market data is empty")

        normalized_index = pd.to_datetime(symbol_df.index)
        if normalized_index.tz is not None:
            normalized_index = normalized_index.tz_localize(None)
        symbol_df.index = normalized_index.normalize()
        symbol_df = symbol_df[~symbol_df.index.duplicated(keep="last")].sort_index()

        original_first_market_date = symbol_df.index.min()
        if VALUATION_SOURCE_COLUMN not in symbol_df.columns:
            symbol_df[VALUATION_SOURCE_COLUMN] = "market"
        if VALUATION_SOURCE_DATE_COLUMN not in symbol_df.columns:
            symbol_df[VALUATION_SOURCE_DATE_COLUMN] = symbol_df.index.strftime("%Y-%m-%d")

        added_dates: List[pd.Timestamp] = []
        for transaction_date in sorted(transaction_dates):
            if transaction_date in symbol_df.index:
                continue

            if transaction_date < original_first_market_date:
                if not allow_leading_transaction_seed:
                    raise TransactionCalendarError(
                        f"{symbol} transaction date {transaction_date.date()} precedes available market data"
                    )

                gap_days = int((original_first_market_date - transaction_date).days)
                if gap_days > MAX_TRANSACTION_BOOTSTRAP_GAP_DAYS:
                    raise TransactionCalendarError(
                        f"{symbol} transaction date {transaction_date.date()} precedes available market data "
                        f"by {gap_days} days"
                    )

                raw_seed = _transaction_price_seed(transactions_df, symbol, transaction_date)
                if raw_seed is None:
                    raise TransactionCalendarError(
                        f"{symbol} transaction date {transaction_date.date()} precedes available market data "
                        "and has no positive BUY/SELL transaction price seed"
                    )

                template = symbol_df.loc[original_first_market_date].copy()
                split_factor = template.get("Split_Factor", 1.0)
                if not _positive_finite(split_factor):
                    split_factor = 1.0
                adjusted_seed = raw_seed / float(split_factor)
                synthetic_row = _set_synthetic_price(
                    template,
                    adjusted_price=adjusted_seed,
                    raw_price=raw_seed,
                )
                source_label = "transaction_price_seed"
                source_date = transaction_date
                logger.info(
                    "[%s] Added transaction valuation date %s from transaction price seed %.8f "
                    "(split factor %.8f; first market row %s)",
                    symbol,
                    transaction_date.strftime("%Y-%m-%d"),
                    raw_seed,
                    float(split_factor),
                    original_first_market_date.strftime("%Y-%m-%d"),
                )
            else:
                prior_position = symbol_df.index.searchsorted(transaction_date, side="right") - 1
                if prior_position < 0:
                    raise TransactionCalendarError(
                        f"{symbol} transaction date {transaction_date.date()} precedes available market data"
                    )
                source_date = symbol_df.index[prior_position]
                synthetic_row = symbol_df.iloc[prior_position].copy()
                source_label = "asof_carry_forward"
                logger.info(
                    "[%s] Added transaction valuation date %s using as-of market row %s",
                    symbol,
                    transaction_date.strftime("%Y-%m-%d"),
                    source_date.strftime("%Y-%m-%d"),
                )

            for column in action_columns:
                if column in synthetic_row.index:
                    synthetic_row[column] = 0.0
            synthetic_row[VALUATION_SOURCE_COLUMN] = source_label
            synthetic_row[VALUATION_SOURCE_DATE_COLUMN] = source_date.strftime("%Y-%m-%d")

            symbol_df.loc[transaction_date] = synthetic_row
            symbol_df = symbol_df.sort_index()
            added_dates.append(transaction_date)

        market_data[symbol] = symbol_df
        if added_dates:
            inserted[symbol] = added_dates

    return inserted
