from __future__ import annotations

import pandas as pd

from journal_engine.core.account_daily_pnl_preview import build_account_daily_pnl_preview
from journal_engine.core.account_value_preview import attach_account_value_preview
from journal_engine.core.cash_ledger import build_shadow_cash_ledger
from journal_engine.models import PortfolioGroupData, PortfolioSnapshot, PortfolioSummary


class FxMarket:
    def __init__(self, rows):
        self.rows = {pd.Timestamp(key).date(): dict(value) for key, value in rows.items()}

    def get_fx_snapshot(self, value_date):
        target = pd.Timestamp(value_date).date()
        return {"TWD": 1.0, **self.rows.get(target, {})}

    def get_realtime_fx_snapshot(self, value_date=None):
        return self.get_fx_snapshot(value_date)


def transaction_rows(*rows):
    frame = pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(columns=[
            "id", "Date", "Type", "Qty", "Price", "Commission", "Tax", "currency"
        ])
    frame["Date"] = pd.to_datetime(frame["Date"])
    for column, default in (("Commission", 0), ("Tax", 0)):
        if column not in frame.columns:
            frame[column] = default
    return frame


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


def snapshot_with_value_preview(report, row, *, pending=None, end_fx=31.0):
    summary = PortfolioSummary(
        total_value=row["end_qty"] * row["end_price"] * row["end_fx"],
        invested_capital=1.0,
        total_pnl=0.0,
        twr=0.0,
        realized_pnl=0.0,
        benchmark_twr=0.0,
        daily_pnl_twd=round(row["total_pnl_twd"]),
        daily_pnl_asof_date="2026-08-05",
        daily_pnl_prev_date="2026-08-04",
    )
    group = PortfolioGroupData(
        summary=summary,
        holdings=[],
        history=[],
        day_ledger=[row],
        pending_dividends=pending or [],
    )
    base = PortfolioSnapshot(
        updated_at="2026-08-05 12:00",
        base_currency="TWD",
        exchange_rate=end_fx,
        summary=summary,
        holdings=[],
        history=[],
        groups={"all": group},
    )
    return attach_account_value_preview(
        base,
        cash_report=report,
        fx_context={"USD": end_fx, "TWD": 1.0},
    )


def historical_buy_report(*, opening=1500, extra_cash_events=None):
    tx = transaction_rows({
        "id": 1,
        "Date": "2026-08-02",
        "Type": "BUY",
        "Qty": 10,
        "Price": 100,
        "Commission": 0,
        "Tax": 0,
        "currency": "USD",
    })
    events = [{
        "id": 10,
        "event_date": "2026-08-01",
        "event_type": "OPENING_BALANCE",
        "amount": opening,
        "currency": "USD",
    }]
    events.extend(extra_cash_events or [])
    return build_shadow_cash_ledger(tx, events)


def test_account_fx_uses_securities_plus_authoritative_foreign_cash_exposure():
    report = historical_buy_report(opening=1500)  # prior-day USD cash = 500
    snapshot = snapshot_with_value_preview(report, security_row())
    market = FxMarket({
        "2026-08-04": {"USD": 30.0},
        "2026-08-05": {"USD": 31.0},
    })

    preview = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=market,
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )

    assert preview.status == "ready"
    assert preview.securities_fx_pnl_twd == 1000.0
    assert preview.cash_fx_pnl_twd == 500.0
    assert preview.component_totals["fx_pnl_twd"] == 1500.0
    assert preview.account_daily_pnl_raw_twd == 1500.0
    assert preview.account_daily_pnl_twd == 1500.0
    assert preview.daily_pnl_base_value_twd == 45000.0
    assert preview.cash_rows[0].symbol == "現金 USD"
    assert preview.cash_rows[0].total_pnl_twd == 500.0


def test_negative_foreign_cash_reduces_net_account_fx_exposure():
    report = historical_buy_report(opening=500)  # prior-day USD cash = -500
    snapshot = snapshot_with_value_preview(report, security_row())
    market = FxMarket({
        "2026-08-04": {"USD": 30.0},
        "2026-08-05": {"USD": 31.0},
    })

    preview = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=market,
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )

    assert preview.status == "ready"
    assert preview.securities_fx_pnl_twd == 1000.0
    assert preview.cash_fx_pnl_twd == -500.0
    assert preview.component_totals["fx_pnl_twd"] == 500.0
    assert preview.account_daily_pnl_twd == 500.0


def test_same_day_buy_is_internal_transfer_and_account_fx_uses_beginning_net_currency_exposure():
    tx = transaction_rows({
        "id": 1,
        "Date": "2026-08-05",
        "Type": "BUY",
        "Qty": 10,
        "Price": 100,
        "Commission": 0,
        "Tax": 0,
        "currency": "USD",
    })
    report = build_shadow_cash_ledger(tx, [{
        "id": 10,
        "event_date": "2026-08-01",
        "event_type": "OPENING_BALANCE",
        "amount": 1000,
        "currency": "USD",
    }])
    row = security_row(
        begin_qty=0.0,
        end_qty=10.0,
        buy_cost_twd=31000.0,
        fx_pnl_twd=0.0,
        total_pnl_twd=0.0,
    )
    snapshot = snapshot_with_value_preview(report, row)
    market = FxMarket({
        "2026-08-04": {"USD": 30.0},
        "2026-08-05": {"USD": 31.0},
    })

    preview = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=market,
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )

    assert preview.status == "ready"
    assert preview.account_daily_pnl_twd == 1000.0
    assert preview.component_totals["fx_pnl_twd"] == 1000.0
    assert preview.component_totals["execution_pnl_twd"] == 0.0
    assert preview.cash_rows[0].total_pnl_twd == 1000.0


def test_external_cash_flow_inside_daily_period_fails_closed_without_intraday_timing():
    report = historical_buy_report(
        opening=1500,
        extra_cash_events=[{
            "id": 11,
            "event_date": "2026-08-05",
            "event_type": "DEPOSIT",
            "amount": 100,
            "currency": "USD",
        }],
    )
    snapshot = snapshot_with_value_preview(report, security_row())
    market = FxMarket({
        "2026-08-04": {"USD": 30.0},
        "2026-08-05": {"USD": 31.0},
    })

    preview = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=market,
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )

    assert preview.status == "unavailable"
    assert preview.reason == "external_cash_flow_timing_ambiguous"
    assert preview.account_daily_pnl_twd is None
    assert preview.day_ledger == []


def test_missing_prior_cash_history_or_fx_fails_closed():
    tx = transaction_rows({
        "id": 1,
        "Date": "2026-08-05",
        "Type": "BUY",
        "Qty": 1,
        "Price": 100,
        "Commission": 0,
        "Tax": 0,
        "currency": "USD",
    })
    late_report = build_shadow_cash_ledger(tx, [{
        "id": 10,
        "event_date": "2026-08-05",
        "event_type": "OPENING_BALANCE",
        "amount": 0,
        "currency": "USD",
    }])
    # Same-day transaction makes this report incomplete, which must fail before
    # any attempt to guess a prior cash balance.
    late_snapshot = snapshot_with_value_preview(
        historical_buy_report(opening=1500),
        security_row(),
    )
    missing_history = build_account_daily_pnl_preview(
        snapshot=late_snapshot,
        cash_report=late_report,
        market_client=FxMarket({
            "2026-08-04": {"USD": 30.0},
            "2026-08-05": {"USD": 31.0},
        }),
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )
    assert missing_history.status == "unavailable"
    assert missing_history.reason == "cash_ledger_incomplete"

    report = historical_buy_report(opening=1500)
    snapshot = snapshot_with_value_preview(report, security_row())
    missing_fx = build_account_daily_pnl_preview(
        snapshot=snapshot,
        cash_report=report,
        market_client=FxMarket({"2026-08-04": {}, "2026-08-05": {}}),
        calculation_as_of=pd.Timestamp("2026-08-05").date(),
    )
    assert missing_fx.status == "unavailable"
    assert missing_fx.reason == "cash_fx_unavailable"
    assert missing_fx.missing_cash_fx_currencies == ["USD"]
