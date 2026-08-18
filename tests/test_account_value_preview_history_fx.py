from __future__ import annotations

from datetime import date

from journal_engine.core.account_value_preview import (
    AccountValuePreview,
    PortfolioSnapshotWithAccountValuePreview,
    _SnapshotHistoryFxMarket,
    _daily_calculation_as_of,
)
from journal_engine.models import PortfolioGroupData, PortfolioSnapshot, PortfolioSummary


def snapshot(*, root_history=None, group_history=None, include_group=True, as_of="2026-08-05"):
    summary = PortfolioSummary(
        total_value=0.0,
        invested_capital=0.0,
        total_pnl=0.0,
        twr=0.0,
        realized_pnl=0.0,
        benchmark_twr=0.0,
        daily_pnl_twd=0.0,
        daily_pnl_asof_date=as_of,
        daily_pnl_prev_date="2026-08-04",
    )
    groups = {}
    if include_group:
        groups["all"] = PortfolioGroupData(
            summary=summary,
            holdings=[],
            history=list(group_history or []),
            day_ledger=[],
        )
    base = PortfolioSnapshot(
        updated_at="2026-08-05 12:00",
        base_currency="TWD",
        exchange_rate=31.0,
        summary=summary,
        holdings=[],
        history=list(root_history or []),
        groups=groups,
    )
    payload = base.model_dump(mode="python")
    payload["account_value_preview"] = AccountValuePreview(
        status="unavailable",
        cash_ledger_complete=False,
        securities_value_twd=0.0,
        reason="cash_evidence_unavailable",
    )
    return PortfolioSnapshotWithAccountValuePreview.model_validate(payload)


def test_snapshot_history_fx_normalizes_dates_and_invalid_targets_fail_to_twd_identity():
    market = _SnapshotHistoryFxMarket(snapshot(include_group=False))

    assert market._normalized_date("2026-08-05T12:34:56+08:00") == "2026-08-05"
    assert market._normalized_date(None) is None
    assert market._normalized_date("not-a-date") is None
    assert market.get_fx_snapshot("not-a-date") == {"TWD": 1.0}


def test_snapshot_history_fx_uses_currency_map_and_drops_nonpositive_or_malformed_rates():
    market = _SnapshotHistoryFxMarket(snapshot(root_history=[{
        "date": "2026-08-04",
        "_raw_fx_rates": {
            "USD": 30.0,
            "EUR": 0.0,
            "JPY": "bad",
        },
    }]))

    assert market.get_fx_snapshot(date(2026, 8, 4)) == {"TWD": 1.0, "USD": 30.0}


def test_snapshot_history_fx_falls_through_root_history_to_group_legacy_usd_rate():
    market = _SnapshotHistoryFxMarket(snapshot(
        root_history=[{"date": "2026-08-03", "_raw_fx_rates": {"USD": 29.0}}],
        group_history=[{"date": "2026-08-05", "_raw_fx_rate": 31.0}],
    ))

    assert market.get_realtime_fx_snapshot(date(2026, 8, 5)) == {"TWD": 1.0, "USD": 31.0}


def test_snapshot_history_fx_returns_identity_when_no_history_row_has_reviewed_fx():
    market = _SnapshotHistoryFxMarket(snapshot(
        root_history=[{"date": "2026-08-04", "_raw_fx_rate": 0.0}],
        include_group=False,
    ))

    assert market.get_fx_snapshot(date(2026, 8, 4)) == {"TWD": 1.0}


def test_daily_calculation_asof_is_exact_date_or_fail_closed_minimum():
    assert _daily_calculation_as_of(snapshot(as_of="2026-08-05")) == date(2026, 8, 5)
    assert _daily_calculation_as_of(snapshot(as_of="bad-date")) == date.min
