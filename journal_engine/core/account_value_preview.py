"""Engine-owned current account-value preview.

R2.6A is deliberately additive. Existing ``summary.total_value`` remains the
securities-holdings market value and existing performance metrics remain
securities-only. This module can publish a separate current account-value
preview only when the deterministic shadow cash ledger is complete and every
cash currency has a reviewed engine-owned TWD conversion in the supplied FX
context.

The browser must never reproduce this arithmetic or source an alternate FX
rate. Missing cash/FX evidence therefore returns an explicit unavailable
preview instead of fabricating a value.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
import math
from typing import Any, Literal, Mapping, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

from ..models import PortfolioSnapshot
from .cash_ledger import ShadowCashLedgerReport


ACCOUNT_VALUE_PREVIEW_METHOD = "securities_plus_authoritative_cash_v1"
ACCOUNT_VALUE_PREVIEW_FX_POLICY = "engine_current_valuation_fx_context"


class AccountValueCashComponent(BaseModel):
    """One engine-valued cash balance in snapshot base currency."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    currency: str
    balance_native: float
    fx_twd_per_native: float
    value_twd: float


class AccountValuePreview(BaseModel):
    """Additive account-level preview contract carried by one snapshot."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    preview_version: Literal[1] = 1
    status: Literal["ready", "unavailable"]
    base_currency: Literal["TWD"] = "TWD"
    method: Literal["securities_plus_authoritative_cash_v1"] = ACCOUNT_VALUE_PREVIEW_METHOD
    fx_policy: Literal["engine_current_valuation_fx_context"] = ACCOUNT_VALUE_PREVIEW_FX_POLICY
    cash_ledger_complete: StrictBool
    securities_value_twd: Optional[float] = None
    cash_value_twd: Optional[float] = None
    account_value_twd: Optional[float] = None
    cash_components: list[AccountValueCashComponent] = Field(default_factory=list)
    reason: Optional[
        Literal[
            "cash_evidence_unavailable",
            "cash_ledger_incomplete",
            "cash_fx_unavailable",
            "securities_value_invalid",
        ]
    ] = None
    missing_cash_fx_currencies: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_state(self) -> "AccountValuePreview":
        if self.status == "ready":
            if not self.cash_ledger_complete:
                raise ValueError("ready account-value preview requires complete cash ledger")
            if self.reason is not None or self.missing_cash_fx_currencies:
                raise ValueError("ready account-value preview cannot carry unavailable reason")
            for field_name in (
                "securities_value_twd",
                "cash_value_twd",
                "account_value_twd",
            ):
                value = getattr(self, field_name)
                if value is None or not math.isfinite(float(value)):
                    raise ValueError(f"ready account-value preview requires finite {field_name}")
            component_total = sum(component.value_twd for component in self.cash_components)
            if not math.isclose(
                component_total,
                float(self.cash_value_twd),
                rel_tol=1e-12,
                abs_tol=1e-6,
            ):
                raise ValueError("cash component values do not reconcile")
            if not math.isclose(
                float(self.securities_value_twd) + float(self.cash_value_twd),
                float(self.account_value_twd),
                rel_tol=1e-12,
                abs_tol=1e-6,
            ):
                raise ValueError("account preview does not reconcile to securities + cash")
        else:
            if self.reason is None:
                raise ValueError("unavailable account-value preview requires a reason")
            if self.cash_value_twd is not None or self.account_value_twd is not None:
                raise ValueError("unavailable account-value preview cannot publish derived totals")
            if self.cash_components:
                raise ValueError("unavailable account-value preview cannot publish partial components")
        return self


class PortfolioSnapshotWithAccountValuePreview(PortfolioSnapshot):
    """Backward-compatible snapshot extension; Worker stores snapshot JSON opaquely."""

    account_value_preview: AccountValuePreview


def _finite_decimal(value) -> Optional[Decimal]:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not result.is_finite():
        return None
    return result


def _positive_fx(value) -> Optional[Decimal]:
    result = _finite_decimal(value)
    if result is None or result <= 0:
        return None
    return result


def _unavailable(
    *,
    reason: str,
    securities_value_twd: Optional[float],
    cash_ledger_complete: bool,
    missing_cash_fx_currencies: list[str] | None = None,
) -> AccountValuePreview:
    return AccountValuePreview(
        status="unavailable",
        cash_ledger_complete=cash_ledger_complete,
        securities_value_twd=securities_value_twd,
        reason=reason,
        missing_cash_fx_currencies=sorted(set(missing_cash_fx_currencies or [])),
    )


def build_account_value_preview(
    *,
    securities_value_twd,
    cash_report: Optional[ShadowCashLedgerReport],
    fx_context: Mapping[str, object] | None,
) -> AccountValuePreview:
    """Build a fail-closed current account-value preview from reviewed authorities."""

    securities_decimal = _finite_decimal(securities_value_twd)
    if securities_decimal is None:
        return _unavailable(
            reason="securities_value_invalid",
            securities_value_twd=None,
            cash_ledger_complete=bool(cash_report and cash_report.complete),
        )
    securities_value = float(securities_decimal)

    if cash_report is None:
        return _unavailable(
            reason="cash_evidence_unavailable",
            securities_value_twd=securities_value,
            cash_ledger_complete=False,
        )
    if not cash_report.complete:
        return _unavailable(
            reason="cash_ledger_incomplete",
            securities_value_twd=securities_value,
            cash_ledger_complete=False,
        )

    normalized_fx = dict(fx_context or {})
    normalized_fx["TWD"] = 1.0
    components: list[AccountValueCashComponent] = []
    missing_currencies: list[str] = []
    cash_value = Decimal("0")

    for summary in cash_report.currencies:
        balance = _finite_decimal(summary.balance)
        rate = _positive_fx(normalized_fx.get(summary.currency))
        if summary.status != "complete" or balance is None or rate is None:
            if rate is None:
                missing_currencies.append(summary.currency)
            else:
                return _unavailable(
                    reason="cash_ledger_incomplete",
                    securities_value_twd=securities_value,
                    cash_ledger_complete=False,
                )
            continue

        value_twd = balance * rate
        cash_value += value_twd
        components.append(AccountValueCashComponent(
            currency=summary.currency,
            balance_native=float(balance),
            fx_twd_per_native=float(rate),
            value_twd=float(value_twd),
        ))

    if missing_currencies:
        return _unavailable(
            reason="cash_fx_unavailable",
            securities_value_twd=securities_value,
            cash_ledger_complete=True,
            missing_cash_fx_currencies=missing_currencies,
        )

    account_value = securities_decimal + cash_value

    return AccountValuePreview(
        status="ready",
        cash_ledger_complete=True,
        securities_value_twd=securities_value,
        cash_value_twd=float(cash_value),
        account_value_twd=float(account_value),
        cash_components=components,
    )


class _SnapshotHistoryFxMarket:
    """Read FX contexts already embedded in the reconciled snapshot history."""

    def __init__(self, snapshot: PortfolioSnapshotWithAccountValuePreview) -> None:
        self.snapshot = snapshot

    @staticmethod
    def _normalized_date(value: Any) -> Optional[str]:
        text = str(value or "")[:10]
        try:
            return date.fromisoformat(text).isoformat()
        except ValueError:
            return None

    def _lookup(self, value_date: Any) -> dict[str, float]:
        target = self._normalized_date(value_date)
        if not target:
            return {"TWD": 1.0}

        histories = [list(self.snapshot.history or [])]
        group = self.snapshot.groups.get("all")
        if group is not None:
            histories.append(list(group.history or []))

        for history in histories:
            for row in reversed(history):
                if self._normalized_date(row.get("date")) != target:
                    continue
                raw = row.get("_raw_fx_rates")
                if isinstance(raw, Mapping):
                    result = {"TWD": 1.0}
                    for currency, value in raw.items():
                        rate = _positive_fx(value)
                        if rate is not None:
                            result[str(currency)] = float(rate)
                    return result
                legacy = _positive_fx(row.get("_raw_fx_rate", row.get("fx_rate")))
                if legacy is not None:
                    return {"TWD": 1.0, "USD": float(legacy)}
        return {"TWD": 1.0}

    def get_fx_snapshot(self, value_date: Any) -> dict[str, float]:
        return self._lookup(value_date)

    def get_realtime_fx_snapshot(self, value_date: Any = None) -> dict[str, float]:
        return self._lookup(value_date)


def _daily_calculation_as_of(snapshot: PortfolioSnapshotWithAccountValuePreview) -> date:
    text = str(snapshot.summary.daily_pnl_asof_date or "")
    try:
        return date.fromisoformat(text)
    except ValueError:
        return date.min


def attach_account_value_preview(
    snapshot: PortfolioSnapshot,
    *,
    cash_report: Optional[ShadowCashLedgerReport],
    fx_context: Mapping[str, object] | None,
) -> PortfolioSnapshotWithAccountValuePreview:
    """Attach current account value and additive account Daily P&L preview.

    The Daily P&L extension consumes only the canonical reconciled day ledger,
    the same authoritative cash report, and FX contexts already embedded in
    snapshot history. It performs no second market-data fetch.
    """

    preview = build_account_value_preview(
        securities_value_twd=snapshot.summary.total_value,
        cash_report=cash_report,
        fx_context=fx_context,
    )
    payload = snapshot.model_dump(mode="python")
    payload["account_value_preview"] = preview
    extended = PortfolioSnapshotWithAccountValuePreview.model_validate(payload)

    # Local import avoids a definition-time cycle: the Daily P&L subtype extends
    # PortfolioSnapshotWithAccountValuePreview.
    from .account_daily_pnl_preview import attach_account_daily_pnl_preview

    return attach_account_daily_pnl_preview(
        extended,
        cash_report=cash_report,
        market_client=_SnapshotHistoryFxMarket(extended),
        calculation_as_of=_daily_calculation_as_of(extended),
    )
