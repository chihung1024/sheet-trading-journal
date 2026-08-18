"""Performance-metric primitives with explicit validity/provenance semantics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import math
from typing import Any, Callable, Iterable, Optional

import pandas as pd
from pyxirr import xirr as pyxirr_xirr


MAX_SUPPORTED_ABS_XIRR_PERCENT = 1_000_000.0


@dataclass(frozen=True)
class ModifiedDietzMetric:
    """Modified Dietz numeric compatibility value plus validity metadata."""

    value: float
    status: str
    reason: Optional[str]


@dataclass(frozen=True)
class TwrReliability:
    """Reliability state for a linked TWR history."""

    status: str
    reason: Optional[str]
    invalid_since: Optional[str]


@dataclass(frozen=True)
class XirrMetric:
    """Backward-compatible numeric XIRR plus explicit validity metadata."""

    value_percent: float
    status: str
    reason: Optional[str]
    asof_date: Optional[str]
    cashflow_conventional: Optional[bool]


def _finite_float(value: Any) -> Optional[float]:
    try:
        numeric = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return numeric if math.isfinite(numeric) else None


def calculate_modified_dietz_metric(
    beginning_value: float,
    ending_value: float,
    cashflows: Iterable[float],
    weights: Optional[Iterable[float]] = None,
    *,
    epsilon: float = 1e-9,
) -> ModifiedDietzMetric:
    """Calculate Modified Dietz without treating an undefined period as real 0%.

    The returned numeric value remains ``0.0`` for unavailable periods solely as a
    compatibility sentinel. Callers must consult ``status`` before interpreting it as
    an actual period return.
    """
    beginning = _finite_float(beginning_value)
    if beginning is None:
        return ModifiedDietzMetric(0.0, "undefined", "invalid_beginning_value")

    ending = _finite_float(ending_value)
    if ending is None:
        return ModifiedDietzMetric(0.0, "undefined", "invalid_ending_value")

    if beginning < -epsilon:
        return ModifiedDietzMetric(0.0, "undefined", "negative_beginning_value")

    raw_cashflows = list(cashflows) if cashflows is not None else []
    normalized_cashflows: list[float] = []
    for cashflow in raw_cashflows:
        numeric = _finite_float(cashflow)
        if numeric is None:
            return ModifiedDietzMetric(0.0, "undefined", "invalid_cashflow")
        normalized_cashflows.append(numeric)

    if not normalized_cashflows:
        if beginning <= epsilon:
            if abs(ending) <= epsilon:
                return ModifiedDietzMetric(0.0, "not_applicable", "no_capital_exposure")
            return ModifiedDietzMetric(0.0, "undefined", "zero_beginning_value")
        value = (ending - beginning) / beginning
        if not math.isfinite(value):
            return ModifiedDietzMetric(0.0, "undefined", "non_finite_return")
        return ModifiedDietzMetric(value, "ok", None)

    if weights is None:
        normalized_weights = [0.5] * len(normalized_cashflows)
    else:
        raw_weights = list(weights)
        if len(raw_weights) != len(normalized_cashflows):
            return ModifiedDietzMetric(0.0, "undefined", "weights_length_mismatch")
        normalized_weights = []
        for weight in raw_weights:
            numeric = _finite_float(weight)
            if numeric is None or numeric < 0.0 or numeric > 1.0:
                return ModifiedDietzMetric(0.0, "undefined", "invalid_weight")
            normalized_weights.append(numeric)

    weighted_cashflows = sum(
        weight * cashflow
        for weight, cashflow in zip(normalized_weights, normalized_cashflows)
    )
    denominator = beginning + weighted_cashflows
    if not math.isfinite(denominator):
        return ModifiedDietzMetric(0.0, "undefined", "non_finite_denominator")
    if abs(denominator) < epsilon:
        return ModifiedDietzMetric(0.0, "undefined", "zero_denominator")

    numerator = ending - beginning - sum(normalized_cashflows)
    value = numerator / denominator
    if not math.isfinite(value):
        return ModifiedDietzMetric(0.0, "undefined", "non_finite_return")
    return ModifiedDietzMetric(value, "ok", None)


def annotate_twr_history(
    history: list[dict[str, Any]],
    *,
    epsilon: float = 1e-9,
) -> TwrReliability:
    """Annotate linked TWR reliability without changing any legacy numeric TWR value.

    Current production uses midpoint (0.5) weights for all daily cash flows. History
    already stores raw ending value and the inverse-signed user-facing net cash flow,
    so each period's Modified Dietz validity can be reconstructed after calculation.
    Once one subperiod is undefined, cumulative TWR reliability stays undefined even
    if later subperiods are individually calculable.
    """
    if not history:
        return TwrReliability("not_applicable", "no_history", None)

    chain_status = "not_applicable"
    chain_reason: Optional[str] = "no_return_periods"
    invalid_since: Optional[str] = None

    first = history[0]
    first["twr_period_status"] = "not_applicable"
    first["twr_period_reason"] = "baseline"
    first["twr_status"] = chain_status
    first["twr_reason"] = chain_reason
    first["twr_invalid_since"] = None

    for index in range(1, len(history)):
        previous = history[index - 1]
        current = history[index]
        period_date = str(current.get("date") or "") or None

        beginning = _finite_float(
            previous.get("_raw_total_value", previous.get("total_value", 0.0))
        )
        ending = _finite_float(
            current.get("_raw_total_value", current.get("total_value", 0.0))
        )
        published_net_cashflow = _finite_float(
            current.get(
                "_raw_net_cashflow_twd",
                current.get("net_cashflow_twd", 0.0),
            )
        )

        if beginning is None or ending is None:
            period_status = "undefined"
            period_reason = "invalid_valuation"
        elif published_net_cashflow is None:
            period_status = "undefined"
            period_reason = "invalid_cashflow"
        elif beginning < -epsilon:
            period_status = "undefined"
            period_reason = "negative_beginning_value"
        else:
            dietz_cashflow = -published_net_cashflow

            if beginning > epsilon:
                metric = calculate_modified_dietz_metric(
                    beginning,
                    ending,
                    [dietz_cashflow] if abs(dietz_cashflow) > epsilon else [],
                    epsilon=epsilon,
                )
                period_status = metric.status
                period_reason = metric.reason
            elif ending > epsilon:
                if dietz_cashflow > epsilon:
                    bootstrap_factor = ending / dietz_cashflow
                    if math.isfinite(bootstrap_factor) and bootstrap_factor >= 0.0:
                        period_status = "ok"
                        period_reason = None
                    else:
                        period_status = "undefined"
                        period_reason = "invalid_bootstrap_factor"
                else:
                    period_status = "undefined"
                    period_reason = "unfunded_value_from_zero"
            elif abs(dietz_cashflow) <= epsilon:
                period_status = "not_applicable"
                period_reason = "no_capital_exposure"
            else:
                period_status = "undefined"
                period_reason = "zero_exposure_with_cashflow"

        current["twr_period_status"] = period_status
        current["twr_period_reason"] = period_reason

        if chain_status != "undefined":
            if period_status == "undefined":
                chain_status = "undefined"
                chain_reason = period_reason or "undefined_period"
                invalid_since = period_date
            elif period_status == "ok":
                chain_status = "ok"
                chain_reason = None

        current["twr_status"] = chain_status
        current["twr_reason"] = chain_reason
        current["twr_invalid_since"] = invalid_since

    return TwrReliability(chain_status, chain_reason, invalid_since)


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
    rows = list(cashflows) if cashflows is not None else []
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
    if abs(value_percent) > MAX_SUPPORTED_ABS_XIRR_PERCENT:
        return XirrMetric(
            0.0,
            "undefined",
            "solver_outside_supported_range",
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
