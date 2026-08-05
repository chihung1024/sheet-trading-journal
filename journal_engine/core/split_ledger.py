"""Build an audited split-adjusted transaction ledger for validation.

The portfolio calculator values positions against split-adjusted prices and therefore
must compare serialized holdings against transaction quantities expressed in the same
post-split share units.  This module keeps the source ledger immutable and applies the
same market-data multiplier through a small, independently testable boundary.
"""

from __future__ import annotations

import logging
import math
from typing import Any

import pandas as pd


logger = logging.getLogger(__name__)


class SplitLedgerError(RuntimeError):
    """Raised when a split multiplier cannot produce a trustworthy ledger."""


def _finite_number(value: Any, label: str) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise SplitLedgerError(f"{label} is not numeric") from exc
    if not math.isfinite(numeric):
        raise SplitLedgerError(f"{label} is not finite")
    return numeric


def build_split_adjusted_validation_ledger(
    transactions_df: pd.DataFrame,
    market_client: Any,
) -> pd.DataFrame:
    """Return a deep-copied ledger expressed in current post-split share units.

    BUY and SELL quantities/prices are transformed with the same multiplier used by
    the calculator.  DIV rows are intentionally unchanged because their Qty/Price
    fields represent an income record rather than an open-position lot.

    The function fails closed for missing columns, invalid multipliers, non-finite
    transformed values, or any violation of the transaction-notional invariant.
    """
    required_columns = {"Date", "Symbol", "Type", "Qty", "Price"}
    missing = sorted(required_columns - set(transactions_df.columns))
    if missing:
        raise SplitLedgerError(
            f"validation ledger is missing required columns: {', '.join(missing)}"
        )
    if not hasattr(market_client, "get_transaction_multiplier"):
        raise SplitLedgerError("market client does not provide split multipliers")

    adjusted = transactions_df.copy(deep=True)

    for index, row in adjusted.iterrows():
        transaction_type = str(row["Type"]).strip().upper()
        if transaction_type not in {"BUY", "SELL"}:
            continue

        symbol = str(row["Symbol"]).strip().upper()
        if not symbol:
            raise SplitLedgerError("validation ledger contains an empty symbol")

        qty = _finite_number(row["Qty"], f"{symbol} quantity")
        price = _finite_number(row["Price"], f"{symbol} price")
        multiplier = _finite_number(
            market_client.get_transaction_multiplier(symbol, row["Date"]),
            f"{symbol} split multiplier",
        )
        if multiplier <= 0:
            raise SplitLedgerError(f"{symbol} split multiplier must be positive")

        adjusted_qty = qty * multiplier
        adjusted_price = price / multiplier
        if not math.isfinite(adjusted_qty) or not math.isfinite(adjusted_price):
            raise SplitLedgerError(f"{symbol} split adjustment produced a non-finite value")

        original_notional = qty * price
        adjusted_notional = adjusted_qty * adjusted_price
        tolerance = max(abs(original_notional) * 1e-10, 1e-8)
        if abs(original_notional - adjusted_notional) > tolerance:
            raise SplitLedgerError(
                f"{symbol} split adjustment violated the transaction notional invariant"
            )

        adjusted.at[index, "Qty"] = adjusted_qty
        adjusted.at[index, "Price"] = adjusted_price

        if not math.isclose(multiplier, 1.0, rel_tol=0.0, abs_tol=1e-12):
            logger.info(
                "[%s] Validation ledger applied split multiplier %.12g",
                symbol,
                multiplier,
            )

    return adjusted
