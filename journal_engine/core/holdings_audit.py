"""Strict holdings audit across the union of transaction and snapshot symbols."""

from __future__ import annotations

import logging
import math
from typing import Any, Dict

import pandas as pd


logger = logging.getLogger(__name__)


class HoldingsAuditError(RuntimeError):
    """Raised when holdings cannot be audited safely."""


def _finite(value: Any, label: str) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise HoldingsAuditError(f"{label} is not numeric") from exc
    if not math.isfinite(numeric):
        raise HoldingsAuditError(f"{label} is not finite")
    return numeric


def validate_snapshot_holdings_union(
    snapshot: Any,
    transactions_df: pd.DataFrame,
    tolerance: float = 0.011,
) -> bool:
    """Compare BUY-SELL quantities with snapshot holdings for every relevant symbol.

    The legacy validator iterates only over symbols already present in the snapshot.
    A newly purchased symbol that was skipped by the calculator is therefore absent
    from that loop and can escape validation. This audit uses the union of transaction
    symbols and snapshot symbols, treating a missing holding as quantity zero.
    """
    required_columns = {"Symbol", "Type", "Qty"}
    missing = sorted(required_columns - set(transactions_df.columns))
    if missing:
        raise HoldingsAuditError(
            f"holdings audit is missing required columns: {', '.join(missing)}"
        )

    snapshot_holdings: Dict[str, float] = {}
    for holding in getattr(snapshot, "holdings", []) or []:
        symbol = str(getattr(holding, "symbol", "")).strip().upper()
        if not symbol:
            raise HoldingsAuditError("snapshot contains an empty holding symbol")
        snapshot_holdings[symbol] = _finite(
            getattr(holding, "qty", 0.0),
            f"{symbol} snapshot quantity",
        )

    normalized = transactions_df.copy(deep=True)
    normalized["Symbol"] = normalized["Symbol"].astype(str).str.strip().str.upper()
    normalized["Type"] = normalized["Type"].astype(str).str.strip().str.upper()
    normalized["Qty"] = pd.to_numeric(normalized["Qty"], errors="coerce")
    if normalized["Qty"].isna().any() or not normalized["Qty"].map(math.isfinite).all():
        raise HoldingsAuditError("holdings audit contains a non-finite quantity")

    transaction_symbols = set(normalized["Symbol"].dropna()) - {""}
    all_symbols = sorted(transaction_symbols | set(snapshot_holdings))
    valid = True

    for symbol in all_symbols:
        symbol_txns = normalized[normalized["Symbol"] == symbol]
        buy_qty = float(symbol_txns[symbol_txns["Type"] == "BUY"]["Qty"].sum())
        sell_qty = float(symbol_txns[symbol_txns["Type"] == "SELL"]["Qty"].sum())
        expected_qty = buy_qty - sell_qty
        actual_qty = snapshot_holdings.get(symbol, 0.0)

        if abs(actual_qty - expected_qty) <= tolerance:
            continue

        if "Date" in symbol_txns.columns and not symbol_txns.empty:
            parsed_dates = pd.to_datetime(symbol_txns["Date"], errors="coerce").dropna()
            if not parsed_dates.empty:
                date_range = (
                    f"{parsed_dates.min().strftime('%Y-%m-%d')}.."
                    f"{parsed_dates.max().strftime('%Y-%m-%d')}"
                )
            else:
                date_range = "unavailable"
        else:
            date_range = "unavailable"

        logger.error(
            "[%s] Holdings union mismatch: Buy=%.4f, Sell=%.4f, "
            "Expected=%.4f, Actual=%.4f, Rows=%s, Dates=%s",
            symbol,
            buy_qty,
            sell_qty,
            expected_qty,
            actual_qty,
            len(symbol_txns),
            date_range,
        )
        valid = False

    return valid
