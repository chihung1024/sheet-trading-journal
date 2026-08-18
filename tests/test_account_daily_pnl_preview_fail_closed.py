from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from journal_engine.core.account_daily_pnl_preview import (
    _balance_as_of,
    build_account_daily_pnl_preview,
)
from journal_engine.core.account_value_preview import (
    PortfolioSnapshotWithAccountValuePreview,
    build_account_value_preview,
)
from journal_engine.core.cash_ledger import (
    ShadowCashCurrencySummary,
    ShadowCashLedgerEntry,
    ShadowCashLedgerReport,
)
from journal_engine.models import PortfolioGroupData, PortfolioSnapshot, PortfolioSummary


class FxMarket:
    def __init__(self, *, begin_usd=30.0, end_usd=31.0):
        self.begin_usd = begin_usd
        self.end_usd = end_usd

    def get_fx_snapshot(self, value_date):
        return {"TWD": 1.0, "USD": self.begin_usd}

    def get_realtime_fx_snapshot(self, value_date=None):
        return {"TWD": 1.0, "USD": self.end_usd}


def cash_report(
    *,
    currency="USD",
    opening_date="2026-08-01",
    opening_balance=Decimal("1500"),
    status="complete",
    entries=(),
):
    balance = opening_balance + sum(
        (entry.amount for entry in entries if not entry.baseline),
        Decimal("0"),
    )
    summary = ShadowCashCurrencySummary(
        currency=currency,
        opening_date=opening_date,
        opening_balance=opening_balance,
        net_movement_all=balance - opening_balance,
        movement_since_opening=balance - opening_balance,
        balance=balance,
        pre_opening_movement_count=0,
        opening_date_movement_count=0,
        status=status,
    )
    issues = () if status == "complete" else ()
    return ShadowCashLedgerReport(
        entries=tuple(entries),
        currencies=(summary,),
        issues=issues,
        transaction_rows=0,
        resolved_transaction_rows=0,
        cash_event_rows=0,
        resolved_cash_event_rows=0,
    )


def security_row(**overrides):
    row = {
        "symbol": "NVDA",
        "market": "US",
        "currency": "USD",
        "begin_qty": 10.0,
        "end_qty": 10.0,
        "begin_price": 100.0,
        "end_price": 100.0,
        "begin_fx": 30.0,
        "end_fx": 31.0,
        "cashflow_fx": 31.0,
        "buy_cost_twd": 0.0,
        "sell_proceeds_twd": 0.0,
        "dividend_income_twd": 0.0,
        "fee_tax_pnl_twd": 0.0,
        "price_pnl_twd": 0.0,
        "fx_pnl_twd": 1000.0,
        "execution_pnl_twd": 0.0,
        "total_pnl_twd": 1000.0,
    }
    row.update(overrides)
    return row


def snapshot_for(report, *, row=None, include_ledger=True, pending=None):
    row = security_row() if row is None else row
    summary = PortfolioSummary(
        total_value=31000.0,
        invested_capital=1.0,
        total_pnl=0.0,
        twr=0.0,
        realized_pnl=0.0,
        benchmark_twr=0.0,
        daily_pnl_twd=round(float(row.get("total_pnl_twd", 0.0))),
        daily_pnl_asof_date="2026-08-05",
        daily_pnl_prev_date="2026-08-04",
    )
    group = PortfolioGroupData(
        summary=summary,
        holdings=[],
        history=[],
        day_ledger=[row] if include_ledger else [],
        pending_dividends=pending or [],
    )
    base = PortfolioSnapshot(
        updated_at="2026-08-05 12:00",
        base_currency="TWD",
        exchange_rate=31.0,
        summary=summary,
        holdings=[],
        history=[],
        groups={"all": group},
    )
    account_value = build_account_value_preview(
        securities_value_twd=summary.total_value,
        cash_report=report,
        fx_context={"USD": 31.0, "TWD": 1.0},
    )
    payload = base.model_dump(mode="python")
    payload["account_value_preview"] = account_value
    return PortfolioSnapshotWithAccountValuePreview.model_validate(payload)


def build(snapshot, report, *, market=None):
    return build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=market or FxMarket(),
        calculation_as_of=date(2026, 8, 5),
    )


def test_balance_as_of_rejects_incomplete_summary_and_malformed_entry_date():
    incomplete = cash_report(status="missing_opening_balance")
    assert _balance_as_of(incomplete, "USD", date(2026, 8, 5)) is None

    bad_entry = ShadowCashLedgerEntry(
        date="not-a-date",
        currency="USD",
        source="TRANSACTION",
        source_id=1,
        event_type="BUY",
        amount=Decimal("-1"),
        baseline=False,
    )
    malformed = cash_report(entries=(bad_entry,))
    assert _balance_as_of(malformed, "USD", date(2026, 8, 5)) is None


def test_missing_daily_or_cash_evidence_fails_closed_before_account_math():
    report = cash_report()
    missing_daily = build(snapshot_for(report, include_ledger=False), report)
    assert missing_daily.status == "unavailable"
    assert missing_daily.reason == "daily_pnl_evidence_unavailable"

    missing_cash = build(snapshot_for(report), None)
    assert missing_cash.status == "unavailable"
    assert missing_cash.reason == "cash_evidence_unavailable"


def test_pending_dividend_on_asof_date_blocks_account_preview():
    report = cash_report()
    pending = [{
        "symbol": "NVDA",
        "ex_date": "2026-08-05",
        "shares_held": 10,
        "dividend_per_share_gross": 1,
        "total_gross": 10,
        "total_net_usd": 7,
        "total_net_twd": 217,
        "fx_rate": 31,
    }]
    preview = build(snapshot_for(report, pending=pending), report)
    assert preview.status == "unavailable"
    assert preview.reason == "unsettled_dividend_evidence"


@pytest.mark.parametrize(
    "row",
    [
        security_row(currency=""),
        security_row(begin_price=None),
        security_row(begin_fx=0.0),
    ],
)
def test_malformed_security_day_ledger_never_becomes_account_authority(row):
    report = cash_report()
    preview = build(snapshot_for(report, row=row), report)
    assert preview.status == "unavailable"
    assert preview.reason == "daily_pnl_evidence_unavailable"


def test_cash_history_must_cover_the_beginning_of_the_daily_period():
    report = cash_report(opening_date="2026-08-05")
    preview = build(snapshot_for(report), report)
    assert preview.status == "unavailable"
    assert preview.reason == "cash_history_unavailable"


def test_security_currency_without_authoritative_cash_currency_fails_closed():
    report = cash_report(currency="TWD", opening_balance=Decimal("0"))
    preview = build(snapshot_for(report), report)
    assert preview.status == "unavailable"
    assert preview.reason == "cash_ledger_incomplete"


def test_account_value_identity_mismatch_fails_before_component_publication():
    report = cash_report()
    row = security_row(total_pnl_twd=2000.0)
    preview = build(snapshot_for(report, row=row), report)
    assert preview.status == "unavailable"
    assert preview.reason == "account_reconciliation_failed"
    assert preview.component_totals == {}


def test_component_mismatch_fails_even_when_account_value_identity_reconciles():
    report = cash_report()
    row = security_row(price_pnl_twd=1.0)
    preview = build(snapshot_for(report, row=row), report)
    assert preview.status == "unavailable"
    assert preview.reason == "account_reconciliation_failed"
    assert preview.component_totals == {}
