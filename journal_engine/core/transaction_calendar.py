"""Transaction-aware market calendar helpers.

Portfolio calculations iterate over dates present in downloaded market data. A trade
can legitimately be recorded on a date that is not yet present in the daily market
series (for example, a same-day pre-market update or a non-trading-day import). If
that date is absent from every held symbol's market index, the calculator silently
skips the transaction.

This module adds only the missing transaction valuation dates. Prices and split
factors are carried forward from the latest prior market row, while corporate-action
cash fields are cleared so an event is never duplicated on the synthetic date.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

import pandas as pd


logger = logging.getLogger(__name__)


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


def ensure_transaction_dates_in_market_calendar(
    market_client: Any,
    transactions_df: pd.DataFrame,
    as_of_date: Optional[Any] = None,
) -> Dict[str, List[pd.Timestamp]]:
    """Insert missing transaction dates into each symbol's market-data calendar.

    A missing date is valued using the most recent market row at or before that date.
    The copied row keeps price and cumulative split information, but action cash/event
    columns are reset to zero. The function fails closed if the symbol has no market
    data, no prior row from which a defensible as-of valuation can be obtained, or a
    transaction is dated after the calculation's current Taiwan calendar date.
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

        added_dates: List[pd.Timestamp] = []
        for transaction_date in sorted(transaction_dates):
            if transaction_date in symbol_df.index:
                continue

            prior_position = symbol_df.index.searchsorted(transaction_date, side="right") - 1
            if prior_position < 0:
                raise TransactionCalendarError(
                    f"{symbol} transaction date {transaction_date.date()} precedes available market data"
                )

            source_date = symbol_df.index[prior_position]
            synthetic_row = symbol_df.iloc[prior_position].copy()
            for column in action_columns:
                if column in synthetic_row.index:
                    synthetic_row[column] = 0.0

            symbol_df.loc[transaction_date] = synthetic_row
            symbol_df = symbol_df.sort_index()
            added_dates.append(transaction_date)
            logger.info(
                "[%s] Added transaction valuation date %s using as-of market row %s",
                symbol,
                transaction_date.strftime("%Y-%m-%d"),
                source_date.strftime("%Y-%m-%d"),
            )

        market_data[symbol] = symbol_df
        if added_dates:
            inserted[symbol] = added_dates

    return inserted
