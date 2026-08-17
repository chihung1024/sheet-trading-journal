from decimal import Decimal

import pandas as pd
import pytest
from pydantic import ValidationError

from journal_engine.core.account_value_preview import (
    AccountValueCashComponent,
    AccountValuePreview,
    PortfolioSnapshotWithAccountValuePreview,
    attach_account_value_preview,
    build_account_value_preview,
)
from journal_engine.core.cash_ledger import (
    ShadowCashCurrencySummary,
    ShadowCashLedgerReport,
    build_shadow_cash_ledger,
)
from journal_engine.models import PortfolioSnapshot, PortfolioSummary


def _transactions(currency="USD"):
    return pd.DataFrame([
        {
            "id": 1,
            "Date": pd.Timestamp("2026-01-02"),
            "Type": "BUY",
            "Qty": 1,
            "Price": 10,
            "Commission": 0,
            "Tax": 0,
            "currency": currency,
        }
    ])


def _complete_report(currency="USD", opening=100):
    return build_shadow_cash_ledger(
        _transactions(currency),
        [{
            "id": 11,
            "event_date": "2026-01-01",
            "event_type": "OPENING_BALANCE",
            "amount": opening,
            "currency": currency,
        }],
    )


def _summary(total_value=5_000):
    return PortfolioSummary(
        total_value=total_value,
        invested_capital=4_000,
        total_pnl=1_000,
        twr=0.1,
        realized_pnl=0,
        benchmark_twr=0.05,
    )


def _ready_payload(**overrides):
    payload = {
        "status": "ready",
        "cash_ledger_complete": True,
        "securities_value_twd": 5_000,
        "cash_value_twd": 100,
        "account_value_twd": 5_100,
        "cash_components": [
            AccountValueCashComponent(
                currency="USD",
                balance_native=2,
                fx_twd_per_native=50,
                value_twd=100,
            )
        ],
    }
    payload.update(overrides)
    return payload


def test_ready_preview_reconciles_securities_and_authoritative_cash():
    report = _complete_report("USD", opening=100)
    assert report.complete is True
    assert report.summary_for("USD").balance == Decimal("90")

    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=report,
        fx_context={"USD": 32},
    )

    assert preview.status == "ready"
    assert preview.cash_ledger_complete is True
    assert preview.securities_value_twd == 5_000
    assert preview.cash_value_twd == 2_880
    assert preview.account_value_twd == 7_880
    assert len(preview.cash_components) == 1
    component = preview.cash_components[0]
    assert component.currency == "USD"
    assert component.balance_native == 90
    assert component.fx_twd_per_native == 32
    assert component.value_twd == 2_880


def test_preview_fails_closed_when_cash_evidence_is_unavailable():
    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=None,
        fx_context={"USD": 32},
    )

    assert preview.status == "unavailable"
    assert preview.reason == "cash_evidence_unavailable"
    assert preview.cash_ledger_complete is False
    assert preview.account_value_twd is None


def test_preview_fails_closed_when_cash_ledger_is_incomplete():
    report = build_shadow_cash_ledger(_transactions("USD"), [])
    assert report.complete is False

    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=report,
        fx_context={"USD": 32},
    )

    assert preview.status == "unavailable"
    assert preview.reason == "cash_ledger_incomplete"
    assert preview.account_value_twd is None
    assert preview.cash_value_twd is None
    assert preview.cash_components == []


@pytest.mark.parametrize("rate", [None, 0, -1, float("nan")])
def test_preview_fails_closed_when_required_cash_fx_is_missing_or_invalid(rate):
    report = _complete_report("EUR", opening=100)
    assert report.complete is True

    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=report,
        fx_context={"EUR": rate},
    )

    assert preview.status == "unavailable"
    assert preview.reason == "cash_fx_unavailable"
    assert preview.cash_ledger_complete is True
    assert preview.missing_cash_fx_currencies == ["EUR"]
    assert preview.account_value_twd is None
    assert preview.cash_components == []


def test_preview_fails_closed_when_securities_value_is_invalid():
    report = _complete_report("USD", opening=100)

    for invalid in (None, float("nan")):
        preview = build_account_value_preview(
            securities_value_twd=invalid,
            cash_report=report,
            fx_context={"USD": 32},
        )
        assert preview.status == "unavailable"
        assert preview.reason == "securities_value_invalid"
        assert preview.securities_value_twd is None
        assert preview.account_value_twd is None


def test_complete_report_with_broken_balance_invariant_fails_closed():
    broken_summary = ShadowCashCurrencySummary(
        currency="USD",
        opening_date="2026-01-01",
        opening_balance=Decimal("100"),
        net_movement_all=Decimal("0"),
        movement_since_opening=Decimal("0"),
        balance=None,
        pre_opening_movement_count=0,
        opening_date_movement_count=0,
        status="complete",
    )
    report = ShadowCashLedgerReport(
        entries=(),
        currencies=(broken_summary,),
        issues=(),
        transaction_rows=0,
        resolved_transaction_rows=0,
        cash_event_rows=0,
        resolved_cash_event_rows=0,
    )
    assert report.complete is True

    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=report,
        fx_context={"USD": 32},
    )

    assert preview.status == "unavailable"
    assert preview.reason == "cash_ledger_incomplete"
    assert preview.account_value_twd is None


def test_twd_cash_uses_identity_fx_without_external_rate():
    report = _complete_report("TWD", opening=100)

    preview = build_account_value_preview(
        securities_value_twd=5_000,
        cash_report=report,
        fx_context={},
    )

    assert preview.status == "ready"
    assert preview.cash_value_twd == 90
    assert preview.account_value_twd == 5_090
    assert preview.cash_components[0].fx_twd_per_native == 1


@pytest.mark.parametrize(
    "overrides, error_match",
    [
        ({"cash_ledger_complete": False}, "requires complete cash ledger"),
        ({"reason": "cash_fx_unavailable"}, "cannot carry unavailable reason"),
        ({"missing_cash_fx_currencies": ["USD"]}, "cannot carry unavailable reason"),
        ({"cash_value_twd": None}, "requires finite cash_value_twd"),
        ({"account_value_twd": float("nan")}, "requires finite account_value_twd"),
        ({"cash_value_twd": 101}, "cash component values do not reconcile"),
        ({"account_value_twd": 5_101}, "account preview does not reconcile"),
    ],
)
def test_ready_preview_model_rejects_non_reconciling_contract(overrides, error_match):
    with pytest.raises(ValidationError, match=error_match):
        AccountValuePreview(**_ready_payload(**overrides))


def test_unavailable_preview_requires_reason_and_forbids_partial_derived_values():
    with pytest.raises(ValidationError, match="requires a reason"):
        AccountValuePreview(status="unavailable", cash_ledger_complete=False)

    with pytest.raises(ValidationError, match="cannot publish derived totals"):
        AccountValuePreview(
            status="unavailable",
            cash_ledger_complete=False,
            reason="cash_ledger_incomplete",
            cash_value_twd=1,
        )

    with pytest.raises(ValidationError, match="cannot publish partial components"):
        AccountValuePreview(
            status="unavailable",
            cash_ledger_complete=False,
            reason="cash_ledger_incomplete",
            cash_components=[
                AccountValueCashComponent(
                    currency="USD",
                    balance_native=1,
                    fx_twd_per_native=1,
                    value_twd=1,
                )
            ],
        )


def test_attached_preview_is_additive_and_preserves_legacy_summary_semantics():
    legacy = PortfolioSnapshot(
        updated_at="2026-01-03 12:00",
        base_currency="TWD",
        exchange_rate=32,
        summary=_summary(total_value=5_000),
        holdings=[],
        history=[],
        groups={},
    )
    report = _complete_report("USD", opening=100)

    extended = attach_account_value_preview(
        legacy,
        cash_report=report,
        fx_context={"USD": 32},
    )

    assert isinstance(extended, PortfolioSnapshotWithAccountValuePreview)
    assert extended.summary.total_value == legacy.summary.total_value == 5_000
    payload = extended.model_dump(mode="json")
    assert payload["summary"]["total_value"] == 5_000
    assert payload["account_value_preview"]["account_value_twd"] == 7_880
    assert payload["account_value_preview"]["method"] == "securities_plus_authoritative_cash_v1"
