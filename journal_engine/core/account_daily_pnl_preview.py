"""Additive cash-inclusive account Daily P&L preview.

Legacy ``summary.daily_pnl_*`` and group ``day_ledger`` fields remain the
securities-only authority.  This module publishes a separate whole-account
preview only when the authoritative cash ledger can be reconstructed for both
ends of the canonical Daily P&L period and the required FX is available.

The account identity treats BUY/SELL/DIV cash movements as internal transfers.
External deposits/withdrawals inside the period are deliberately unsupported
because cash events currently carry only a calendar date, not authoritative
intra-day timing.  In that case the preview fails closed rather than assigning
an arbitrary FX exposure duration.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
import math
from typing import Any, Literal, Mapping, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

from .account_value_preview import PortfolioSnapshotWithAccountValuePreview
from .cash_ledger import ShadowCashLedgerEntry, ShadowCashLedgerReport


ACCOUNT_DAILY_PNL_METHOD = "securities_plus_authoritative_cash_daily_v1"
ACCOUNT_DAILY_PNL_FX_POLICY = "beginning_net_currency_exposure_v1"
RECONCILIATION_TOLERANCE_TWD = Decimal("0.02")


class AccountDailyPnlCashRow(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    row_kind: Literal["cash"] = "cash"
    symbol: str
    currency: str
    begin_balance_native: float
    end_balance_native: float
    begin_fx: float
    end_fx: float
    price_pnl_twd: float = 0.0
    fx_pnl_twd: float
    dividend_income_twd: float = 0.0
    execution_pnl_twd: float
    fee_tax_pnl_twd: float = 0.0
    total_pnl_twd: float

    @model_validator(mode="after")
    def validate_components(self) -> "AccountDailyPnlCashRow":
        values = (
            self.begin_balance_native,
            self.end_balance_native,
            self.begin_fx,
            self.end_fx,
            self.price_pnl_twd,
            self.fx_pnl_twd,
            self.dividend_income_twd,
            self.execution_pnl_twd,
            self.fee_tax_pnl_twd,
            self.total_pnl_twd,
        )
        if not all(math.isfinite(float(value)) for value in values):
            raise ValueError("cash Daily P&L row requires finite values")
        if self.begin_fx <= 0 or self.end_fx <= 0:
            raise ValueError("cash Daily P&L row requires positive FX")
        component_sum = (
            self.price_pnl_twd
            + self.fx_pnl_twd
            + self.dividend_income_twd
            + self.execution_pnl_twd
            + self.fee_tax_pnl_twd
        )
        if not math.isclose(component_sum, self.total_pnl_twd, rel_tol=0, abs_tol=0.01):
            raise ValueError("cash Daily P&L row components do not reconcile")
        return self

    def to_day_ledger_dict(self) -> dict[str, Any]:
        return {
            "row_kind": self.row_kind,
            "symbol": self.symbol,
            "market": "CASH",
            "currency": self.currency,
            "price_pnl_twd": self.price_pnl_twd,
            "fx_pnl_twd": self.fx_pnl_twd,
            "dividend_income_twd": self.dividend_income_twd,
            "execution_pnl_twd": self.execution_pnl_twd,
            "fee_tax_pnl_twd": self.fee_tax_pnl_twd,
            "total_pnl_twd": self.total_pnl_twd,
            "begin_cash_native": self.begin_balance_native,
            "end_cash_native": self.end_balance_native,
            "begin_fx": self.begin_fx,
            "end_fx": self.end_fx,
        }


class AccountDailyPnlPreview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    preview_version: Literal[1] = 1
    status: Literal["ready", "unavailable"]
    base_currency: Literal["TWD"] = "TWD"
    scope: Literal["whole_account"] = "whole_account"
    method: Literal["securities_plus_authoritative_cash_daily_v1"] = ACCOUNT_DAILY_PNL_METHOD
    fx_policy: Literal["beginning_net_currency_exposure_v1"] = ACCOUNT_DAILY_PNL_FX_POLICY
    cash_ledger_complete: StrictBool
    as_of_date: Optional[str] = None
    prev_date: Optional[str] = None
    securities_daily_pnl_twd: Optional[float] = None
    cash_daily_pnl_twd: Optional[float] = None
    account_daily_pnl_twd: Optional[float] = None
    account_daily_pnl_raw_twd: Optional[float] = None
    daily_pnl_base_value_twd: Optional[float] = None
    daily_pnl_roi_percent: Optional[float] = None
    securities_fx_pnl_twd: Optional[float] = None
    cash_fx_pnl_twd: Optional[float] = None
    component_totals: dict[str, float] = Field(default_factory=dict)
    day_ledger: list[dict[str, Any]] = Field(default_factory=list)
    cash_rows: list[AccountDailyPnlCashRow] = Field(default_factory=list)
    reason: Optional[
        Literal[
            "daily_pnl_evidence_unavailable",
            "cash_evidence_unavailable",
            "cash_ledger_incomplete",
            "cash_history_unavailable",
            "cash_fx_unavailable",
            "external_cash_flow_timing_ambiguous",
            "intermediate_transaction_activity_ambiguous",
            "unsettled_dividend_evidence",
            "account_reconciliation_failed",
        ]
    ] = None
    missing_cash_fx_currencies: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_state(self) -> "AccountDailyPnlPreview":
        if self.status == "ready":
            if not self.cash_ledger_complete:
                raise ValueError("ready account Daily P&L preview requires complete cash ledger")
            if self.reason is not None or self.missing_cash_fx_currencies:
                raise ValueError("ready account Daily P&L preview cannot carry unavailable reason")
            if not self.as_of_date or not self.prev_date:
                raise ValueError("ready account Daily P&L preview requires period dates")
            required_numbers = (
                self.securities_daily_pnl_twd,
                self.cash_daily_pnl_twd,
                self.account_daily_pnl_twd,
                self.account_daily_pnl_raw_twd,
                self.daily_pnl_base_value_twd,
                self.securities_fx_pnl_twd,
                self.cash_fx_pnl_twd,
            )
            if any(value is None or not math.isfinite(float(value)) for value in required_numbers):
                raise ValueError("ready account Daily P&L preview requires finite totals")
            if not self.day_ledger:
                raise ValueError("ready account Daily P&L preview requires day ledger")
            ledger_total = sum(float(row["total_pnl_twd"]) for row in self.day_ledger)
            if not math.isclose(
                ledger_total,
                float(self.account_daily_pnl_raw_twd),
                rel_tol=0,
                abs_tol=0.02,
            ):
                raise ValueError("account day ledger does not reconcile")
            component_sum = sum(float(value) for value in self.component_totals.values())
            if not math.isclose(
                component_sum,
                float(self.account_daily_pnl_raw_twd),
                rel_tol=0,
                abs_tol=0.02,
            ):
                raise ValueError("account Daily P&L components do not reconcile")
        else:
            if self.reason is None:
                raise ValueError("unavailable account Daily P&L preview requires reason")
            if self.account_daily_pnl_twd is not None or self.account_daily_pnl_raw_twd is not None:
                raise ValueError("unavailable account Daily P&L preview cannot publish account totals")
            if self.day_ledger or self.cash_rows or self.component_totals:
                raise ValueError("unavailable account Daily P&L preview cannot publish partial ledger")
        return self


class PortfolioSnapshotWithAccountPreviews(PortfolioSnapshotWithAccountValuePreview):
    account_daily_pnl_preview: AccountDailyPnlPreview


def _decimal(value: Any) -> Optional[Decimal]:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return result if result.is_finite() else None


def _date(value: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _unavailable(
    reason: str,
    *,
    cash_report: Optional[ShadowCashLedgerReport],
    as_of_date: Optional[date] = None,
    prev_date: Optional[date] = None,
    missing_cash_fx_currencies: list[str] | None = None,
) -> AccountDailyPnlPreview:
    return AccountDailyPnlPreview(
        status="unavailable",
        cash_ledger_complete=bool(cash_report and cash_report.complete),
        as_of_date=as_of_date.isoformat() if as_of_date else None,
        prev_date=prev_date.isoformat() if prev_date else None,
        reason=reason,
        missing_cash_fx_currencies=sorted(set(missing_cash_fx_currencies or [])),
    )


def _balance_as_of(
    report: ShadowCashLedgerReport,
    currency: str,
    target: date,
) -> Optional[Decimal]:
    summary = report.summary_for(currency)
    opening_date = _date(summary.opening_date)
    opening_balance = _decimal(summary.opening_balance)
    if summary.status != "complete" or opening_date is None or opening_balance is None:
        return None
    if target < opening_date:
        return None

    balance = opening_balance
    for entry in report.entries:
        if entry.currency != currency or entry.baseline:
            continue
        entry_date = _date(entry.date)
        if entry_date is None:
            return None
        if opening_date < entry_date <= target:
            balance += entry.amount
    return balance


def _period_activity_reason(
    report: ShadowCashLedgerReport,
    prev_date: date,
    as_of_date: date,
) -> Optional[str]:
    for entry in report.entries:
        entry_date = _date(entry.date)
        if entry_date is None or not (prev_date < entry_date <= as_of_date):
            continue
        if entry.source == "CASH_EVENT" and entry.event_type in {"DEPOSIT", "WITHDRAWAL"}:
            return "external_cash_flow_timing_ambiguous"
        if entry.source == "TRANSACTION" and entry_date != as_of_date:
            # Canonical day-ledger execution rows are scoped to the as-of valuation
            # date.  A transaction between the two valuation dates would require a
            # separately reviewed intermediate valuation/execution convention.
            return "intermediate_transaction_activity_ambiguous"
    return None


def _fx_context_for_date(market_client: Any, value_date: date, *, realtime: bool) -> Mapping[str, Any]:
    if realtime and hasattr(market_client, "get_realtime_fx_snapshot"):
        return dict(market_client.get_realtime_fx_snapshot(value_date) or {})
    if hasattr(market_client, "get_fx_snapshot"):
        return dict(market_client.get_fx_snapshot(value_date) or {})
    return {}


def _positive_fx(context: Mapping[str, Any], currency: str) -> Optional[Decimal]:
    if currency == "TWD":
        return Decimal("1")
    value = _decimal(context.get(currency))
    if value is None or value <= 0:
        return None
    return value


def _security_ledger(snapshot: PortfolioSnapshotWithAccountValuePreview) -> Optional[list[dict[str, Any]]]:
    group = snapshot.groups.get("all")
    if group is None or not isinstance(group.day_ledger, list) or not group.day_ledger:
        return None
    return [dict(row) for row in group.day_ledger]


def _row_decimal(row: Mapping[str, Any], key: str) -> Optional[Decimal]:
    return _decimal(row.get(key))


def build_account_daily_pnl_preview(
    *,
    snapshot: PortfolioSnapshotWithAccountValuePreview,
    cash_report: Optional[ShadowCashLedgerReport],
    market_client: Any,
    calculation_as_of: date,
) -> AccountDailyPnlPreview:
    """Build a fail-closed whole-account Daily P&L preview."""

    as_of_date = _date(snapshot.summary.daily_pnl_asof_date)
    prev_date = _date(snapshot.summary.daily_pnl_prev_date)
    security_rows = _security_ledger(snapshot)
    if as_of_date is None or prev_date is None or as_of_date <= prev_date or not security_rows:
        return _unavailable(
            "daily_pnl_evidence_unavailable",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )
    if cash_report is None:
        return _unavailable(
            "cash_evidence_unavailable",
            cash_report=None,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )
    if not cash_report.complete:
        return _unavailable(
            "cash_ledger_incomplete",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    activity_reason = _period_activity_reason(cash_report, prev_date, as_of_date)
    if activity_reason:
        return _unavailable(
            activity_reason,
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    pending = list(getattr(snapshot.groups.get("all"), "pending_dividends", []) or [])
    if any(str(getattr(item, "ex_date", "")) == as_of_date.isoformat() for item in pending):
        return _unavailable(
            "unsettled_dividend_evidence",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    component_keys = (
        "price_pnl_twd",
        "fx_pnl_twd",
        "dividend_income_twd",
        "execution_pnl_twd",
        "fee_tax_pnl_twd",
    )
    security_components = {key: Decimal("0") for key in component_keys}
    security_cashflow_by_currency: dict[str, Decimal] = {}
    security_begin_value = Decimal("0")
    security_end_value = Decimal("0")
    security_total = Decimal("0")

    for row in security_rows:
        currency = str(row.get("currency") or "").strip()
        if not currency:
            return _unavailable(
                "daily_pnl_evidence_unavailable",
                cash_report=cash_report,
                as_of_date=as_of_date,
                prev_date=prev_date,
            )
        values = {
            key: _row_decimal(row, key)
            for key in (
                "begin_qty",
                "end_qty",
                "begin_price",
                "end_price",
                "begin_fx",
                "end_fx",
                "buy_cost_twd",
                "sell_proceeds_twd",
                "dividend_income_twd",
                "total_pnl_twd",
                *component_keys,
            )
        }
        if any(value is None for value in values.values()):
            return _unavailable(
                "daily_pnl_evidence_unavailable",
                cash_report=cash_report,
                as_of_date=as_of_date,
                prev_date=prev_date,
            )
        if values["begin_fx"] <= 0 or values["end_fx"] <= 0:
            return _unavailable(
                "daily_pnl_evidence_unavailable",
                cash_report=cash_report,
                as_of_date=as_of_date,
                prev_date=prev_date,
            )

        security_begin_value += (
            values["begin_qty"] * values["begin_price"] * values["begin_fx"]
        )
        security_end_value += (
            values["end_qty"] * values["end_price"] * values["end_fx"]
        )
        security_total += values["total_pnl_twd"]
        for key in component_keys:
            security_components[key] += values[key]
        security_cashflow_by_currency[currency] = (
            security_cashflow_by_currency.get(currency, Decimal("0"))
            - values["buy_cost_twd"]
            + values["sell_proceeds_twd"]
            + values["dividend_income_twd"]
        )

    begin_fx_context = _fx_context_for_date(market_client, prev_date, realtime=False)
    end_fx_context = _fx_context_for_date(
        market_client,
        as_of_date,
        realtime=(as_of_date == calculation_as_of),
    )

    cash_rows: list[AccountDailyPnlCashRow] = []
    cash_begin_value = Decimal("0")
    cash_end_value = Decimal("0")
    cash_total = Decimal("0")
    cash_fx_total = Decimal("0")
    missing_fx: list[str] = []

    for summary in cash_report.currencies:
        currency = summary.currency
        begin_balance = _balance_as_of(cash_report, currency, prev_date)
        end_balance = _balance_as_of(cash_report, currency, as_of_date)
        if begin_balance is None or end_balance is None:
            return _unavailable(
                "cash_history_unavailable",
                cash_report=cash_report,
                as_of_date=as_of_date,
                prev_date=prev_date,
            )
        begin_fx = _positive_fx(begin_fx_context, currency)
        end_fx = _positive_fx(end_fx_context, currency)
        if begin_fx is None or end_fx is None:
            missing_fx.append(currency)
            continue

        begin_value = begin_balance * begin_fx
        end_value = end_balance * end_fx
        security_cashflow = security_cashflow_by_currency.get(currency, Decimal("0"))
        total_effect = end_value - begin_value - security_cashflow
        fx_effect = begin_balance * (end_fx - begin_fx)
        execution_effect = total_effect - fx_effect

        cash_begin_value += begin_value
        cash_end_value += end_value
        cash_total += total_effect
        cash_fx_total += fx_effect
        cash_rows.append(AccountDailyPnlCashRow(
            symbol=f"現金 {currency}",
            currency=currency,
            begin_balance_native=float(begin_balance),
            end_balance_native=float(end_balance),
            begin_fx=float(begin_fx),
            end_fx=float(end_fx),
            fx_pnl_twd=float(fx_effect),
            execution_pnl_twd=float(execution_effect),
            total_pnl_twd=float(total_effect),
        ))

    if missing_fx:
        return _unavailable(
            "cash_fx_unavailable",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
            missing_cash_fx_currencies=missing_fx,
        )

    # A currency used by a canonical security cash flow must exist in the cash
    # ledger. Otherwise account-level cancellation would silently drop a transfer.
    cash_currencies = {summary.currency for summary in cash_report.currencies}
    if any(currency not in cash_currencies for currency in security_cashflow_by_currency):
        return _unavailable(
            "cash_ledger_incomplete",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    account_begin_value = security_begin_value + cash_begin_value
    account_end_value = security_end_value + cash_end_value
    account_raw_total = security_total + cash_total
    account_identity_total = account_end_value - account_begin_value
    if abs(account_raw_total - account_identity_total) > RECONCILIATION_TOLERANCE_TWD:
        return _unavailable(
            "account_reconciliation_failed",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    component_totals = dict(security_components)
    component_totals["fx_pnl_twd"] += cash_fx_total
    component_totals["execution_pnl_twd"] += sum(
        (_decimal(row.execution_pnl_twd) or Decimal("0")) for row in cash_rows
    )
    if abs(sum(component_totals.values()) - account_raw_total) > RECONCILIATION_TOLERANCE_TWD:
        return _unavailable(
            "account_reconciliation_failed",
            cash_report=cash_report,
            as_of_date=as_of_date,
            prev_date=prev_date,
        )

    day_ledger = [*security_rows, *(row.to_day_ledger_dict() for row in cash_rows)]
    base_value_float = float(account_begin_value)
    roi = (
        round(float(account_raw_total / account_begin_value * Decimal("100")), 2)
        if account_begin_value > 0
        else None
    )

    return AccountDailyPnlPreview(
        status="ready",
        cash_ledger_complete=True,
        as_of_date=as_of_date.isoformat(),
        prev_date=prev_date.isoformat(),
        securities_daily_pnl_twd=float(security_total),
        cash_daily_pnl_twd=float(cash_total),
        account_daily_pnl_twd=float(round(account_raw_total, 0)),
        account_daily_pnl_raw_twd=float(account_raw_total),
        daily_pnl_base_value_twd=base_value_float,
        daily_pnl_roi_percent=roi,
        securities_fx_pnl_twd=float(security_components["fx_pnl_twd"]),
        cash_fx_pnl_twd=float(cash_fx_total),
        component_totals={key: float(value) for key, value in component_totals.items()},
        day_ledger=day_ledger,
        cash_rows=cash_rows,
    )


def attach_account_daily_pnl_preview(
    snapshot: PortfolioSnapshotWithAccountValuePreview,
    *,
    cash_report: Optional[ShadowCashLedgerReport],
    market_client: Any,
    calculation_as_of: date,
) -> PortfolioSnapshotWithAccountPreviews:
    preview = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=cash_report,
        market_client=market_client,
        calculation_as_of=calculation_as_of,
    )
    payload = snapshot.model_dump(mode="python")
    payload["account_daily_pnl_preview"] = preview
    return PortfolioSnapshotWithAccountPreviews.model_validate(payload)
