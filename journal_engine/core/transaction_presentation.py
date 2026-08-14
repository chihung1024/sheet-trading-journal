"""Authoritative record-linked transaction presentation values.

This module projects normalized source records onto the exact transaction cash-flow
semantics already used by :class:`PortfolioCalculator`, using production
currency-aware transaction-date FX. It is presentation output only: it does not
change holdings, FIFO, realized P&L, TWR, XIRR, Daily P&L, or calculation identity.
"""

from __future__ import annotations

import math
from typing import Any, Iterable

import pandas as pd

from ..models import TransactionPresentation
from .currency_detector import CurrencyDetector


TRANSACTION_PRESENTATION_VERSION = 1
_REQUIRED_COLUMNS = (
    "id",
    "Date",
    "Symbol",
    "Type",
    "Qty",
    "Price",
    "Commission",
    "Tax",
)
_SUPPORTED_TYPES = {"BUY", "SELL", "DIV"}


class TransactionPresentationError(ValueError):
    """Raised when authoritative transaction presentation cannot be proven."""


def _finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise TransactionPresentationError(f"{label} must be numeric")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise TransactionPresentationError(f"{label} must be numeric") from exc
    if not math.isfinite(numeric):
        raise TransactionPresentationError(f"{label} must be finite")
    return numeric


def _positive_record_id(value: Any) -> int:
    if isinstance(value, bool):
        raise TransactionPresentationError("record id must be a positive integer")
    try:
        numeric = float(value)
        record_id = int(numeric)
    except (TypeError, ValueError, OverflowError) as exc:
        raise TransactionPresentationError("record id must be a positive integer") from exc
    if not math.isfinite(numeric) or numeric != record_id or record_id <= 0:
        raise TransactionPresentationError("record id must be a positive integer")
    return record_id


def _transaction_date(value: Any) -> pd.Timestamp:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise TransactionPresentationError("transaction date is invalid") from exc
    if pd.isna(timestamp) or timestamp.tzinfo is not None:
        raise TransactionPresentationError("transaction date must be timezone-naive")
    if timestamp != timestamp.normalize():
        raise TransactionPresentationError("transaction date must not contain time-of-day")
    return timestamp.normalize()


def _transaction_fx_rate(market_client: Any, symbol: str, value_date: pd.Timestamp) -> tuple[str, float]:
    currency = CurrencyDetector.detect(symbol)
    if currency == "TWD":
        return currency, 1.0

    get_snapshot = getattr(market_client, "get_fx_snapshot", None)
    if not callable(get_snapshot):
        raise TransactionPresentationError(
            f"currency-aware FX snapshot is required for {currency} symbol {symbol}"
        )
    try:
        fx_context = get_snapshot(value_date)
        fx_rate = float(CurrencyDetector.get_fx_multiplier(symbol, fx_context))
    except Exception as exc:
        raise TransactionPresentationError(
            f"authoritative transaction-date FX is unavailable for {symbol} on {value_date.date()}"
        ) from exc
    if not math.isfinite(fx_rate) or fx_rate <= 0:
        raise TransactionPresentationError(
            f"authoritative transaction-date FX is invalid for {symbol} on {value_date.date()}"
        )
    return currency, fx_rate


def _net_cashflow_native(
    txn_type: str,
    qty: float,
    price: float,
    commission: float,
    tax: float,
) -> float:
    """Mirror PortfolioCalculator's existing signed transaction cash-flow semantics."""
    gross = qty * price
    fee = abs(commission)
    tax_amount = abs(tax)
    if txn_type == "BUY":
        return -(gross + fee + tax_amount)
    if txn_type == "SELL":
        return gross - fee - tax_amount
    if txn_type == "DIV":
        # Confirmed DIV records already carry the actual native cash-flow price.
        # PortfolioCalculator intentionally does not apply Commission/Tax again.
        return gross
    raise TransactionPresentationError(f"unsupported transaction type: {txn_type}")


def build_transaction_presentations(
    source_records: pd.DataFrame,
    market_client: Any,
) -> list[TransactionPresentation]:
    """Build one authoritative presentation row per source record id.

    The source DataFrame must be the normalized, pre-split-adjustment user ledger from
    ``main.prepare_transactions``. Split adjustment preserves transaction notional,
    but using the source ledger keeps the projection directly correlated with the D1
    record the browser displays.
    """
    if not isinstance(source_records, pd.DataFrame):
        raise TransactionPresentationError("source records must be a pandas DataFrame")
    missing = [column for column in _REQUIRED_COLUMNS if column not in source_records.columns]
    if missing:
        raise TransactionPresentationError(
            "source records missing required fields: " + ", ".join(missing)
        )
    if source_records.empty:
        return []

    work = source_records.loc[:, list(_REQUIRED_COLUMNS)].copy(deep=True)
    work = work.sort_values(["Date", "id"], kind="stable")

    presentations: list[TransactionPresentation] = []
    seen_ids: set[int] = set()
    for row in work.itertuples(index=False):
        values = dict(zip(_REQUIRED_COLUMNS, row))
        record_id = _positive_record_id(values["id"])
        if record_id in seen_ids:
            raise TransactionPresentationError("source record ids must be unique")
        seen_ids.add(record_id)

        value_date = _transaction_date(values["Date"])
        symbol = str(values["Symbol"] or "").strip().upper()
        if not symbol:
            raise TransactionPresentationError("transaction symbol must be non-empty")
        txn_type = str(values["Type"] or "").strip().upper()
        if txn_type not in _SUPPORTED_TYPES:
            raise TransactionPresentationError(f"unsupported transaction type: {txn_type}")

        qty = _finite_number(values["Qty"], "Qty")
        price = _finite_number(values["Price"], "Price")
        commission = _finite_number(values["Commission"], "Commission")
        tax = _finite_number(values["Tax"], "Tax")
        if qty <= 0:
            raise TransactionPresentationError("Qty must be positive")
        if price < 0:
            raise TransactionPresentationError("Price must be non-negative")

        currency, fx_rate = _transaction_fx_rate(market_client, symbol, value_date)
        native_cashflow = _net_cashflow_native(
            txn_type,
            qty,
            price,
            commission,
            tax,
        )
        twd_cashflow = native_cashflow * fx_rate
        if not math.isfinite(native_cashflow) or not math.isfinite(twd_cashflow):
            raise TransactionPresentationError("transaction cash flow must be finite")

        presentations.append(
            TransactionPresentation(
                record_id=record_id,
                currency=currency,
                fx_rate=fx_rate,
                net_cashflow_native=native_cashflow,
                net_cashflow_twd=twd_cashflow,
            )
        )

    return presentations


def presentation_record_ids(
    presentations: Iterable[TransactionPresentation],
) -> list[int]:
    """Small explicit helper for runner/tests to assert complete source coverage."""
    return [int(item.record_id) for item in presentations]
