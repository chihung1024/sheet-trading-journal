from __future__ import annotations

import pytest
from pydantic import ValidationError

from journal_engine.core.account_daily_pnl_preview import (
    AccountDailyPnlCashRow,
    AccountDailyPnlPreview,
)


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
