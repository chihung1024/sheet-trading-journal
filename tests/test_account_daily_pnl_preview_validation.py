from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
import pytest
from pydantic import ValidationError

from journal_engine.core.account_daily_pnl_preview import (
    AccountDailyPnlCashRow,
    AccountDailyPnlPreview,
    _balance_as_of,
    _date,
    _decimal,
    _fx_context_for_date,
    _period_activity_reason,
    _positive_fx,
)
from journal_engine.core.cash_ledger import build_shadow_cash_ledger


def _valid_cash_row(**overrides):
    payload = {
        "symbol": "現金 USD",
        "currency": "USD",
        "begin_balance_native": 1.0,
        "end_balance_native": 1.0,
        "begin_fx": 30.0,
        "end_fx": 31.0,
        "fx_pnl_twd": 1.0,
        "execution_pnl_twd": 0.0,
        "total_pnl_twd": 1.0,
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"end_balance_native": float("nan")}, "requires finite values"),
        ({"begin_fx": 0.0}, "requires positive FX"),
        ({"total_pnl_twd": 2.0}, "components do not reconcile"),
    ],
)
def test_cash_row_validator_fails_closed_for_invalid_financial_evidence(overrides, message):
    with pytest.raises(ValidationError, match=message):
        AccountDailyPnlCashRow(**_valid_cash_row(**overrides))


def _valid_ready_preview(**overrides):
    payload = {
        "status": "ready",
        "cash_ledger_complete": True,
        "as_of_date": "2026-08-05",
        "prev_date": "2026-08-04",
        "securities_daily_pnl_twd": 1.0,
        "cash_daily_pnl_twd": 0.0,
        "account_daily_pnl_twd": 1.0,
        "account_daily_pnl_raw_twd": 1.0,
        "daily_pnl_base_value_twd": 100.0,
        "securities_fx_pnl_twd": 0.0,
        "cash_fx_pnl_twd": 0.0,
        "component_totals": {"price_pnl_twd": 1.0},
        "day_ledger": [{"total_pnl_twd": 1.0}],
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"cash_ledger_complete": False}, "requires complete cash ledger"),
        ({"reason": "cash_evidence_unavailable"}, "cannot carry unavailable reason"),
        ({"missing_cash_fx_currencies": ["USD"]}, "cannot carry unavailable reason"),
        ({"prev_date": None}, "requires period dates"),
        ({"securities_daily_pnl_twd": None}, "requires finite totals"),
        ({"day_ledger": []}, "requires day ledger"),
        ({"day_ledger": [{"total_pnl_twd": 2.0}]}, "day ledger does not reconcile"),
        ({"component_totals": {"price_pnl_twd": 2.0}}, "components do not reconcile"),
    ],
)
def test_ready_preview_validator_rejects_partial_or_unreconciled_authority(overrides, message):
    with pytest.raises(ValidationError, match=message):
        AccountDailyPnlPreview(**_valid_ready_preview(**overrides))


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"reason": None}, "requires reason"),
        ({"account_daily_pnl_twd": 1.0}, "cannot publish account totals"),
        ({"day_ledger": [{"total_pnl_twd": 0.0}]}, "cannot publish partial ledger"),
        ({"component_totals": {"fx_pnl_twd": 0.0}}, "cannot publish partial ledger"),
    ],
)
def test_unavailable_preview_validator_never_leaks_partial_account_numbers(overrides, message):
    payload = {
        "status": "unavailable",
        "cash_ledger_complete": False,
        "reason": "cash_evidence_unavailable",
    }
    payload.update(overrides)
    with pytest.raises(ValidationError, match=message):
        AccountDailyPnlPreview(**payload)


def _transactions(*rows):
    frame = pd.DataFrame(rows)
    if frame.empty:
        return pd.DataFrame(
            columns=["id", "Date", "Type", "Qty", "Price", "Commission", "Tax", "currency"]
        )
    frame["Date"] = pd.to_datetime(frame["Date"])
    for column in ("Commission", "Tax"):
        if column not in frame.columns:
            frame[column] = 0
    return frame


def test_scalar_and_date_helpers_fail_closed_without_coercing_unknown_values():
    assert _decimal(None) is None
    assert _decimal(float("nan")) is None
    assert _decimal("1.25") == Decimal("1.25")
    assert _date(None) is None
    assert _date("not-a-date") is None
    assert _date("2026-08-05") == date(2026, 8, 5)


def test_fx_context_helpers_use_reviewed_fallback_order_and_identity_fx():
    class HistoricalOnly:
        def get_fx_snapshot(self, value_date):
            return {"USD": 30.0}

    class RealtimeOnly:
        def get_realtime_fx_snapshot(self, value_date):
            return {"USD": 31.0}

    class NoFx:
        pass

    value_date = date(2026, 8, 5)
    assert _fx_context_for_date(HistoricalOnly(), value_date, realtime=True) == {"USD": 30.0}
    assert _fx_context_for_date(RealtimeOnly(), value_date, realtime=True) == {"USD": 31.0}
    assert _fx_context_for_date(RealtimeOnly(), value_date, realtime=False) == {}
    assert _fx_context_for_date(NoFx(), value_date, realtime=False) == {}
    assert _positive_fx({}, "TWD") == Decimal("1")
    assert _positive_fx({"USD": 0.0}, "USD") is None
    assert _positive_fx({"USD": 31.0}, "USD") == Decimal("31.0")


def test_cash_history_and_period_helpers_reject_unknown_exposure_timing():
    opening_events = [{
        "id": 10,
        "event_date": "2026-08-01",
        "event_type": "OPENING_BALANCE",
        "amount": 1000,
        "currency": "USD",
    }]
    opening_only = build_shadow_cash_ledger(_transactions(), opening_events)
    assert _balance_as_of(opening_only, "USD", date(2026, 7, 31)) is None
    assert _balance_as_of(opening_only, "USD", date(2026, 8, 1)) == Decimal("1000")

    intermediate_trade = build_shadow_cash_ledger(
        _transactions({
            "id": 1,
            "Date": "2026-08-03",
            "Type": "BUY",
            "Qty": 1,
            "Price": 100,
            "currency": "USD",
        }),
        opening_events,
    )
    assert _period_activity_reason(
        intermediate_trade,
        date(2026, 8, 2),
        date(2026, 8, 5),
    ) == "intermediate_transaction_activity_ambiguous"
