"""Performance-metric primitives with explicit validity/provenance semantics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import math
from typing import Any, Callable, Iterable, Optional

import pandas as pd
from pyxirr import xirr as pyxirr_xirr


@dataclass(frozen=True)
class XirrMetric:
    """Backward-compatible numeric XIRR plus explicit validity metadata."""

    value_percent: float
    status: str
    reason: Optional[str]
    asof_date: Optional[str]
    cashflow_conventional: Optional[bool]


def _normalize_date(value: Any) -> date:
    timestamp = pd.Timestamp(value)
    if pd.isna(timestamp):
        raise ValueError("date is NaT")
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp.date()


def _is_conventional(amounts: Iterable[float]) -> Optional[bool]:
    """Return whether non-zero cash flows change sign at most once."""
    signs = []
    for amount in amounts:
        if amount > 0:
            signs.append(1)
        elif amount < 0:
            signs.append(-1)
    if len(signs) < 2:
        return None
    sign_changes = sum(left != right for left, right in zip(signs, signs[1:]))
    return sign_changes <= 1


def calculate_xirr_metric(
    cashflows: Iterable[dict[str, Any]],
    terminal_value_twd: float,
    terminal_date: Any,
    *,
    solver: Optional[Callable[..., Any]] = None,
) -> XirrMetric:
    """Calculate XIRR without conflating an undefined result with a true 0% return.

    `terminal_value_twd` must be the raw valuation amount and `terminal_date` must be
    the date to which that valuation actually applies. The legacy numeric field stays
    at 0.0 when XIRR is unavailable; callers must use `status` to distinguish that
    compatibility sentinel from a real zero return.
    """
    rows = list(cashflows or [])
    if not rows:
        return XirrMetric(0.0, "not_applicable", "no_cashflows", None, None)

    try:
        terminal_value = float(terminal_value_twd)
    except (TypeError, ValueError):
        return XirrMetric(0.0, "undefined", "invalid_terminal_value", None, None)
    if not math.isfinite(terminal_value) or terminal_value < 0:
        return XirrMetric(0.0, "undefined", "invalid_terminal_value", None, None)

    try:
        normalized_terminal_date = _normalize_date(terminal_date)
    except Exception:
        return XirrMetric(0.0, "undefined", "invalid_terminal_date", None, None)

    dates = []
    amounts = []
    for row in rows:
        try:
            amount = float(row["amount"])
            flow_date = _normalize_date(row["date"])
        except (KeyError, TypeError, ValueError, OverflowError):
            return XirrMetric(
                0.0,
                "undefined",
                "invalid_cashflow",
                normalized_terminal_date.isoformat(),
                None,
            )
        if not math.isfinite(amount):
            return XirrMetric(
                0.0,
                "undefined",
                "invalid_cashflow",
                normalized_terminal_date.isoformat(),
                None,
            )
        dates.append(flow_date)
        amounts.append(amount)

    dates.append(normalized_terminal_date)
    amounts.append(terminal_value)

    conventional = _is_conventional(amounts)
    has_negative = any(amount < 0 for amount in amounts)
    has_positive = any(amount > 0 for amount in amounts)
    if not (has_negative and has_positive):
        return XirrMetric(
            0.0,
            "undefined",
            "insufficient_sign_change",
            normalized_terminal_date.isoformat(),
            conventional,
        )

    if len(set(dates)) < 2:
        return XirrMetric(
            0.0,
            "undefined",
            "insufficient_date_span",
            normalized_terminal_date.isoformat(),
            conventional,
        )

    solve = solver or pyxirr_xirr
    try:
        rate = solve(dates, amounts)
    except Exception:
        return XirrMetric(
            0.0,
            "undefined",
            "solver_error",
            normalized_terminal_date.isoformat(),
            conventional,
        )

    if rate is None:
        return XirrMetric(
            0.0,
            "undefined",
            "solver_no_solution",
            normalized_terminal_date.isoformat(),
            conventional,
        )

    try:
        value_percent = float(rate) * 100.0
    except (TypeError, ValueError, OverflowError):
        return XirrMetric(
            0.0,
            "undefined",
            "solver_non_finite",
            normalized_terminal_date.isoformat(),
            conventional,
        )
    if not math.isfinite(value_percent):
        return XirrMetric(
            0.0,
            "undefined",
            "solver_non_finite",
            normalized_terminal_date.isoformat(),
            conventional,
        )

    return XirrMetric(
        round(value_percent, 2),
        "ok",
        None,
        normalized_terminal_date.isoformat(),
        conventional,
    )
