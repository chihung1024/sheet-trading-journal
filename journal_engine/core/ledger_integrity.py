"""Deterministic Schema-2 transaction prefix-integrity checks.

Gate C deliberately separates source-ledger validity from calculator execution
semantics. The calculator may reorder same-day transaction types and currently
supports a compatibility CLAMP policy. This module instead replays the
independent split-adjusted ledger in the deterministic Schema-2 source order:
Date, then record id.

The audit does not claim that record id is broker execution chronology. It only
establishes that the persisted ledger never requires a negative long position
under its own stable order.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Tuple

import pandas as pd


ABSOLUTE_QTY_TOLERANCE = 1e-9
RELATIVE_BUY_TOLERANCE = 1e-12
SUPPORTED_POSITION_TYPES = frozenset({"BUY", "SELL", "DIV"})
ALL_SCOPE = "all"


class LedgerIntegrityError(RuntimeError):
    """Raised when a transaction ledger cannot be trusted for calculation."""


class LedgerIntegrityInputError(LedgerIntegrityError):
    """Raised when deterministic prefix replay cannot be constructed."""


@dataclass(frozen=True)
class LedgerPrefixViolation:
    """First negative quantity prefix for one scope/symbol replay."""

    user_label: str
    scope: str
    symbol: str
    date: str
    record_id: int
    txn_type: str
    requested_qty: float
    quantity_before: float
    quantity_after: float
    tolerance: float

    def diagnostic(self) -> str:
        return (
            "Transaction prefix integrity violation "
            f"[user={self.user_label}, scope={self.scope}, symbol={self.symbol}, "
            f"date={self.date}, record_id={self.record_id}, type={self.txn_type}, "
            f"requested_qty={self.requested_qty:.12g}, "
            f"qty_before={self.quantity_before:.12g}, "
            f"qty_after={self.quantity_after:.12g}, "
            f"tolerance={self.tolerance:.12g}]"
        )


@dataclass(frozen=True)
class LedgerIntegrityAudit:
    """Read-only prefix audit result for one user's split-adjusted ledger."""

    row_count: int
    scope_count: int
    symbol_scope_count: int
    violations: Tuple[LedgerPrefixViolation, ...]

    @property
    def valid(self) -> bool:
        return not self.violations


def parse_transaction_tags(value: Any) -> Tuple[str, ...]:
    """Return unique tags using the calculator's comma/semicolon semantics."""
    tags = []
    seen = set()
    for part in str(value or "").replace(";", ",").split(","):
        tag = part.strip()
        if not tag or tag in seen:
            continue
        tags.append(tag)
        seen.add(tag)
    return tuple(tags)


def quantity_tolerance(cumulative_abs_buy_qty: float) -> float:
    """High-precision quantity tolerance for unrounded ledger replay."""
    cumulative = abs(_finite_number(cumulative_abs_buy_qty, "cumulative buy quantity"))
    return max(ABSOLUTE_QTY_TOLERANCE, cumulative * RELATIVE_BUY_TOLERANCE)


def audit_transaction_prefix_integrity(
    transactions_df: pd.DataFrame,
    *,
    user_label: str = "***",
) -> LedgerIntegrityAudit:
    """Audit ``all`` and every active tag scope in Date/id source order.

    The input must already be expressed in a common share unit, normally by
    ``build_split_adjusted_validation_ledger``. One violation is retained per
    scope/symbol because later rows cannot repair the trustworthiness of an
    already-negative prefix.
    """
    normalized = _normalize_ledger(transactions_df)
    tags = sorted(
        {
            tag
            for value in normalized["Tag"]
            for tag in parse_transaction_tags(value)
        }
    )
    scopes = (ALL_SCOPE, *tags)

    violations = []
    symbol_scope_count = 0
    for scope in scopes:
        scoped = normalized if scope == ALL_SCOPE else normalized[
            normalized["Tag"].map(lambda value: scope in parse_transaction_tags(value))
        ]
        for symbol, symbol_df in scoped.groupby("Symbol", sort=True):
            symbol_scope_count += 1
            violation = _first_symbol_prefix_violation(
                symbol_df,
                user_label=str(user_label or "***"),
                scope=scope,
                symbol=symbol,
            )
            if violation is not None:
                violations.append(violation)

    return LedgerIntegrityAudit(
        row_count=len(normalized),
        scope_count=len(scopes),
        symbol_scope_count=symbol_scope_count,
        violations=tuple(violations),
    )


def validate_transaction_prefix_integrity(
    transactions_df: pd.DataFrame,
    *,
    user_label: str = "***",
) -> LedgerIntegrityAudit:
    """Fail closed on the first deterministic negative position prefix."""
    audit = audit_transaction_prefix_integrity(
        transactions_df,
        user_label=user_label,
    )
    if audit.violations:
        raise LedgerIntegrityError(audit.violations[0].diagnostic())
    return audit


def _normalize_ledger(transactions_df: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(transactions_df, pd.DataFrame):
        raise LedgerIntegrityInputError("transaction ledger must be a DataFrame")

    required = {"id", "Date", "Symbol", "Type", "Qty"}
    missing = sorted(required - set(transactions_df.columns))
    if missing:
        raise LedgerIntegrityInputError(
            f"transaction ledger is missing required columns: {', '.join(missing)}"
        )

    normalized = transactions_df.copy(deep=True)
    if "Tag" not in normalized.columns:
        normalized["Tag"] = ""
    normalized["Tag"] = normalized["Tag"].fillna("")

    record_ids = []
    for raw_id in normalized["id"]:
        if isinstance(raw_id, bool):
            raise LedgerIntegrityInputError("record id must be a positive integer")
        try:
            numeric = int(raw_id)
            numeric_float = float(raw_id)
        except (TypeError, ValueError, OverflowError) as exc:
            raise LedgerIntegrityInputError("record id must be a positive integer") from exc
        if not math.isfinite(numeric_float) or numeric <= 0 or numeric_float != numeric:
            raise LedgerIntegrityInputError("record id must be a positive integer")
        record_ids.append(numeric)
    if len(record_ids) != len(set(record_ids)):
        raise LedgerIntegrityInputError("transaction ledger contains duplicate record ids")
    normalized["id"] = record_ids

    try:
        dates = pd.to_datetime(normalized["Date"], errors="raise")
    except (TypeError, ValueError) as exc:
        raise LedgerIntegrityInputError("transaction ledger contains an invalid date") from exc
    if dates.isna().any():
        raise LedgerIntegrityInputError("transaction ledger contains an empty date")
    if getattr(dates.dt, "tz", None) is not None:
        dates = dates.dt.tz_localize(None)
    normalized["Date"] = dates.dt.normalize()

    normalized["Symbol"] = normalized["Symbol"].astype(str).str.strip().str.upper()
    normalized["Type"] = normalized["Type"].astype(str).str.strip().str.upper()
    if (normalized["Symbol"] == "").any():
        raise LedgerIntegrityInputError("transaction ledger contains an empty symbol")
    unsupported = sorted(set(normalized["Type"]) - SUPPORTED_POSITION_TYPES)
    if unsupported:
        raise LedgerIntegrityInputError(
            f"transaction ledger contains unsupported types: {', '.join(unsupported)}"
        )

    quantities = []
    for raw_qty in normalized["Qty"]:
        qty = _finite_number(raw_qty, "transaction quantity")
        if qty <= 0:
            raise LedgerIntegrityInputError("transaction quantity must be positive")
        quantities.append(qty)
    normalized["Qty"] = quantities

    return normalized.sort_values(["Date", "id"], kind="stable").reset_index(drop=True)


def _first_symbol_prefix_violation(
    symbol_df: pd.DataFrame,
    *,
    user_label: str,
    scope: str,
    symbol: str,
) -> LedgerPrefixViolation | None:
    quantity = 0.0
    cumulative_abs_buy_qty = 0.0

    for _, row in symbol_df.sort_values(["Date", "id"], kind="stable").iterrows():
        txn_type = row["Type"]
        requested_qty = float(row["Qty"])
        before = quantity

        if txn_type == "BUY":
            cumulative_abs_buy_qty += abs(requested_qty)
            quantity += requested_qty
        elif txn_type == "SELL":
            quantity -= requested_qty
        else:  # DIV has no position-quantity effect.
            continue

        tolerance = quantity_tolerance(cumulative_abs_buy_qty)
        if quantity < -tolerance:
            return LedgerPrefixViolation(
                user_label=user_label,
                scope=scope,
                symbol=symbol,
                date=pd.Timestamp(row["Date"]).strftime("%Y-%m-%d"),
                record_id=int(row["id"]),
                txn_type=txn_type,
                requested_qty=requested_qty,
                quantity_before=before,
                quantity_after=quantity,
                tolerance=tolerance,
            )
        if abs(quantity) <= tolerance:
            quantity = 0.0

    return None


def _finite_number(value: Any, label: str) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise LedgerIntegrityInputError(f"{label} must be finite") from exc
    if not math.isfinite(numeric):
        raise LedgerIntegrityInputError(f"{label} must be finite")
    return numeric
