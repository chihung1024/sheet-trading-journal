"""Build and audit split-adjusted transaction ledgers."""

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


def _normalized_date(value: Any, label: str) -> pd.Timestamp:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise SplitLedgerError(f"{label} is not a valid date") from exc
    if pd.isna(timestamp):
        raise SplitLedgerError(f"{label} is empty")
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp.normalize()


def build_split_adjusted_validation_ledger(
    transactions_df: pd.DataFrame,
    market_client: Any,
) -> pd.DataFrame:
    """Return a deep-copied ledger expressed in current post-split share units.

    BUY and SELL quantities/prices are transformed with the same multiplier API used
    by the calculator. DIV rows are intentionally unchanged because their Qty/Price
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

        transaction_date = _normalized_date(
            row["Date"],
            f"{symbol} transaction date",
        )
        qty = _finite_number(row["Qty"], f"{symbol} quantity")
        price = _finite_number(row["Price"], f"{symbol} price")
        multiplier = _finite_number(
            market_client.get_transaction_multiplier(symbol, transaction_date),
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
                "[%s] Split-adjusted %s on %s: factor=%.12g, "
                "qty %.8f -> %.8f, price %.8f -> %.8f",
                symbol,
                transaction_type,
                transaction_date.strftime("%Y-%m-%d"),
                multiplier,
                qty,
                adjusted_qty,
                price,
                adjusted_price,
            )

    return adjusted


def validate_adjusted_ledger_parity(
    calculator_df: pd.DataFrame,
    validation_df: pd.DataFrame,
    quantity_tolerance: float = 1e-9,
    price_tolerance: float = 1e-9,
) -> bool:
    """Verify calculator and independent validation ledgers are row-identical.

    This check is intentionally independent from holdings aggregation. It catches any
    divergence in split multipliers, date normalization, transaction filtering, or
    in-place mutation before a snapshot can be uploaded.
    """
    required_columns = {"Date", "Symbol", "Type", "Qty", "Price"}
    for label, frame in (
        ("calculator ledger", calculator_df),
        ("validation ledger", validation_df),
    ):
        missing = sorted(required_columns - set(frame.columns))
        if missing:
            raise SplitLedgerError(
                f"{label} is missing required columns: {', '.join(missing)}"
            )

    def relevant_rows(frame: pd.DataFrame) -> pd.DataFrame:
        rows = frame.copy(deep=True)
        rows["Type"] = rows["Type"].astype(str).str.strip().str.upper()
        return rows[rows["Type"].isin({"BUY", "SELL"})]

    calculator_rows = relevant_rows(calculator_df)
    validation_rows = relevant_rows(validation_df)

    calculator_indices = list(calculator_rows.index)
    validation_indices = list(validation_rows.index)
    if calculator_indices != validation_indices:
        logger.error(
            "Split ledger row-index mismatch: calculator=%s validation=%s",
            calculator_indices,
            validation_indices,
        )
        return False

    valid = True
    for index in calculator_indices:
        calc_row = calculator_rows.loc[index]
        validation_row = validation_rows.loc[index]

        calc_symbol = str(calc_row["Symbol"]).strip().upper()
        validation_symbol = str(validation_row["Symbol"]).strip().upper()
        calc_type = str(calc_row["Type"]).strip().upper()
        validation_type = str(validation_row["Type"]).strip().upper()
        calc_date = _normalized_date(calc_row["Date"], f"row {index} calculator date")
        validation_date = _normalized_date(
            validation_row["Date"],
            f"row {index} validation date",
        )

        calc_qty = _finite_number(calc_row["Qty"], f"row {index} calculator quantity")
        validation_qty = _finite_number(
            validation_row["Qty"],
            f"row {index} validation quantity",
        )
        calc_price = _finite_number(
            calc_row["Price"],
            f"row {index} calculator price",
        )
        validation_price = _finite_number(
            validation_row["Price"],
            f"row {index} validation price",
        )

        identity_matches = (
            calc_symbol == validation_symbol
            and calc_type == validation_type
            and calc_date == validation_date
        )
        quantity_matches = math.isclose(
            calc_qty,
            validation_qty,
            rel_tol=1e-12,
            abs_tol=quantity_tolerance,
        )
        price_matches = math.isclose(
            calc_price,
            validation_price,
            rel_tol=1e-12,
            abs_tol=price_tolerance,
        )

        if identity_matches and quantity_matches and price_matches:
            continue

        logger.error(
            "Split ledger parity mismatch at row %s: "
            "calculator=(%s,%s,%s,qty=%.12g,price=%.12g) "
            "validation=(%s,%s,%s,qty=%.12g,price=%.12g)",
            index,
            calc_symbol,
            calc_type,
            calc_date.strftime("%Y-%m-%d"),
            calc_qty,
            calc_price,
            validation_symbol,
            validation_type,
            validation_date.strftime("%Y-%m-%d"),
            validation_qty,
            validation_price,
        )
        valid = False

    if valid:
        logger.info(
            "Split-adjusted ledger parity verified for %s BUY/SELL rows",
            len(calculator_rows),
        )

    return valid
