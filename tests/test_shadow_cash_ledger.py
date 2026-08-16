from decimal import Decimal

import numpy as np
import pandas as pd
import pytest

from journal_engine.core.cash_ledger import (
    ShadowCashLedgerInputError,
    build_shadow_cash_ledger,
)


def tx_df(rows):
    return pd.DataFrame(rows, columns=[
        "id", "Date", "Type", "Qty", "Price", "Commission", "Tax", "currency"
    ])


def test_complete_currency_ledger_uses_explicit_baseline_and_authoritative_economics():
    transactions = tx_df([
        [10, "2026-01-02", "BUY", 2, 100, -1, 0, "USD"],
        [11, "2026-01-04", "DIV", 1, 5, 0, 0, "USD"],
        [12, "2026-01-05", "SELL", 1, 120, 1, 0, "USD"],
    ])
    cash_events = [
        {"id": 1, "event_date": "2026-01-01", "event_type": "OPENING_BALANCE", "amount": 1000, "currency": "USD"},
        {"id": 2, "event_date": "2026-01-03", "event_type": "DEPOSIT", "amount": 100, "currency": "USD"},
        {"id": 3, "event_date": "2026-01-06", "event_type": "WITHDRAWAL", "amount": 50, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)
    usd = report.summary_for("USD")

    assert report.complete is True
    assert report.transaction_rows == 3
    assert report.resolved_transaction_rows == 3
    assert report.cash_event_rows == report.resolved_cash_event_rows == 3
    assert usd.opening_balance == Decimal("1000")
    assert usd.net_movement_all == Decimal("-27")
    assert usd.movement_since_opening == Decimal("-27")
    assert usd.balance == Decimal("973")
    assert [entry.amount for entry in report.entries if entry.source == "TRANSACTION"] == [
        Decimal("-201"), Decimal("5"), Decimal("119")
    ]


def test_missing_opening_reports_movement_without_fabricating_zero_balance():
    transactions = tx_df([
        [1, "2026-02-01", "BUY", 1, 50, 0, 0, "TWD"],
    ])

    report = build_shadow_cash_ledger(transactions, [])
    twd = report.summary_for("TWD")

    assert report.complete is False
    assert twd.status == "missing_opening"
    assert twd.opening_balance is None
    assert twd.balance is None
    assert twd.net_movement_all == Decimal("-50")
    assert [issue.code for issue in report.issues] == ["MISSING_OPENING_BALANCE"]


@pytest.mark.parametrize("missing_currency", [None, np.nan, pd.NA])
def test_missing_transaction_currency_is_unresolved_and_never_inferred_from_symbol(missing_currency):
    transactions = tx_df([
        [1, "2026-02-01", "BUY", 1, 50, 0, 0, missing_currency],
    ])
    cash_events = [
        {"id": 1, "event_date": "2026-01-01", "event_type": "OPENING_BALANCE", "amount": 1000, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)

    assert report.complete is False
    assert report.resolved_transaction_rows == 0
    assert report.summary_for("USD").balance == Decimal("1000")
    assert [issue.code for issue in report.issues] == ["TRANSACTION_CURRENCY_MISSING"]


def test_gbp_quote_unit_is_not_silently_promoted_to_gbp_cash():
    transactions = tx_df([
        [1, "2026-02-01", "BUY", 10, 250, 0, 0, "GBp"],
    ])
    report = build_shadow_cash_ledger(transactions, [])

    assert report.complete is False
    assert report.entries == ()
    assert report.currencies == ()
    assert [issue.code for issue in report.issues] == ["TRANSACTION_QUOTE_UNIT_UNRESOLVED"]


def test_opening_date_activity_is_fail_closed_without_intraday_authority():
    transactions = tx_df([
        [5, "2026-03-01", "BUY", 1, 100, 0, 0, "USD"],
    ])
    cash_events = [
        {"id": 2, "event_date": "2026-03-01", "event_type": "OPENING_BALANCE", "amount": 500, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)
    usd = report.summary_for("USD")

    assert report.complete is False
    assert usd.status == "opening_date_ambiguous"
    assert usd.balance is None
    assert usd.opening_date_movement_count == 1
    assert [issue.code for issue in report.issues] == ["OPENING_DATE_ACTIVITY_AMBIGUOUS"]


def test_opening_baseline_absorbs_earlier_audit_movements_but_does_not_reconstruct_them():
    transactions = tx_df([
        [1, "2026-01-01", "BUY", 1, 100, 0, 0, "USD"],
        [2, "2026-03-02", "DIV", 1, 5, 0, 0, "USD"],
    ])
    cash_events = [
        {"id": 1, "event_date": "2026-03-01", "event_type": "OPENING_BALANCE", "amount": -25, "currency": "USD"},
        {"id": 2, "event_date": "2026-03-03", "event_type": "DEPOSIT", "amount": 20, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)
    usd = report.summary_for("USD")

    assert report.complete is True
    assert usd.pre_opening_movement_count == 1
    assert usd.net_movement_all == Decimal("-75")
    assert usd.movement_since_opening == Decimal("25")
    assert usd.balance == Decimal("0")


def test_deterministic_output_does_not_depend_on_same_day_input_order():
    rows_a = [
        [9, "2026-04-02", "SELL", 1, 20, 0, 0, "USD"],
        [7, "2026-04-02", "BUY", 1, 10, 0, 0, "USD"],
    ]
    rows_b = list(reversed(rows_a))
    cash_events = [
        {"id": 1, "event_date": "2026-04-01", "event_type": "OPENING_BALANCE", "amount": 100, "currency": "USD"},
    ]

    report_a = build_shadow_cash_ledger(tx_df(rows_a), cash_events)
    report_b = build_shadow_cash_ledger(tx_df(rows_b), cash_events)

    assert report_a == report_b
    assert report_a.summary_for("USD").balance == Decimal("110")
    assert [entry.source_id for entry in report_a.entries if entry.source == "TRANSACTION"] == [7, 9]


def test_confirmed_dividend_price_is_net_cash_but_nonzero_fee_tax_is_unresolved():
    transactions = tx_df([
        [1, "2026-05-01", "DIV", 1, 12.34, 0, 0, "USD"],
        [2, "2026-05-02", "DIV", 1, 5, 1, 0, "USD"],
    ])
    cash_events = [
        {"id": 1, "event_date": "2026-04-01", "event_type": "OPENING_BALANCE", "amount": 100, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)

    assert report.complete is False
    assert report.resolved_transaction_rows == 1
    assert [entry.amount for entry in report.entries if entry.source == "TRANSACTION"] == [Decimal("12.34")]
    assert [issue.code for issue in report.issues] == ["DIVIDEND_ECONOMICS_UNRESOLVED"]


def test_cash_event_direction_and_negative_opening_are_strict_and_explicit():
    transactions = tx_df([])
    cash_events = [
        {"id": 1, "event_date": "2026-06-01", "event_type": "OPENING_BALANCE", "amount": -50, "currency": "USD"},
        {"id": 2, "event_date": "2026-06-02", "event_type": "DEPOSIT", "amount": 30, "currency": "USD"},
        {"id": 3, "event_date": "2026-06-03", "event_type": "WITHDRAWAL", "amount": 10, "currency": "USD"},
    ]

    report = build_shadow_cash_ledger(transactions, cash_events)

    assert report.complete is True
    assert report.summary_for("USD").balance == Decimal("-30")
    assert [entry.amount for entry in report.entries] == [
        Decimal("-50"), Decimal("30"), Decimal("-10")
    ]


@pytest.mark.parametrize(
    "cash_event, message",
    [
        ({"id": 1, "event_date": "2026-02-30", "event_type": "OPENING_BALANCE", "amount": 1, "currency": "USD"}, "real calendar date"),
        ({"id": 1, "event_date": "2026-01-01", "event_type": "DEPOSIT", "amount": 0, "currency": "USD"}, "amount must be positive"),
        ({"id": 1, "event_date": "2026-01-01", "event_type": "WITHDRAWAL", "amount": -1, "currency": "USD"}, "amount must be positive"),
        ({"id": 1, "event_date": "2026-01-01", "event_type": "OPENING_BALANCE", "amount": 1, "currency": "GBp"}, "three uppercase letters"),
    ],
)
def test_invalid_cash_event_facts_fail_closed(cash_event, message):
    with pytest.raises(ShadowCashLedgerInputError, match=message):
        build_shadow_cash_ledger(tx_df([]), [cash_event])


def test_duplicate_opening_balance_fails_even_if_upstream_database_should_prevent_it():
    cash_events = [
        {"id": 1, "event_date": "2026-01-01", "event_type": "OPENING_BALANCE", "amount": 1, "currency": "USD"},
        {"id": 2, "event_date": "2026-02-01", "event_type": "OPENING_BALANCE", "amount": 2, "currency": "USD"},
    ]
    with pytest.raises(ShadowCashLedgerInputError, match="multiple opening balances"):
        build_shadow_cash_ledger(tx_df([]), cash_events)


def test_no_facts_is_not_authoritative_zero_cash():
    report = build_shadow_cash_ledger(tx_df([]), [])

    assert report.complete is False
    assert report.currencies == ()
    assert [issue.code for issue in report.issues] == ["NO_CASH_FACTS"]


# R2.4A accounting core keeps the repository-wide missing-branch ceiling unchanged.
# These tests intentionally exercise every fail-closed branch of the new module.
import journal_engine.core.cash_ledger as cash_ledger


def base_tx(**overrides):
    row = {
        "id": 1,
        "Date": "2026-07-01",
        "Type": "BUY",
        "Qty": 1,
        "Price": 10,
        "Commission": 0,
        "Tax": 0,
        "currency": "USD",
    }
    row.update(overrides)
    return tx_df([[row[column] for column in [
        "id", "Date", "Type", "Qty", "Price", "Commission", "Tax", "currency"
    ]]])


def opening(currency="USD"):
    return [{
        "id": 1,
        "event_date": "2026-06-01",
        "event_type": "OPENING_BALANCE",
        "amount": 100,
        "currency": currency,
    }]


def test_report_helpers_fail_closed_for_unknown_or_inconsistent_summary_state():
    report = build_shadow_cash_ledger(tx_df([]), opening())
    with pytest.raises(KeyError, match="EUR"):
        report.summary_for("EUR")

    incomplete = cash_ledger.ShadowCashCurrencySummary(
        currency="EUR",
        opening_date=None,
        opening_balance=None,
        net_movement_all=Decimal("0"),
        movement_since_opening=Decimal("0"),
        balance=None,
        pre_opening_movement_count=0,
        opening_date_movement_count=0,
        status="missing_opening",
    )
    synthetic = cash_ledger.ShadowCashLedgerReport(
        entries=(),
        currencies=(report.summary_for("USD"), incomplete),
        issues=(),
        transaction_rows=0,
        resolved_transaction_rows=0,
        cash_event_rows=1,
        resolved_cash_event_rows=1,
    )
    assert synthetic.complete is False


def test_transaction_container_and_required_columns_fail_closed():
    with pytest.raises(ShadowCashLedgerInputError, match="must be a DataFrame"):
        build_shadow_cash_ledger([], [])
    with pytest.raises(ShadowCashLedgerInputError, match="missing required columns"):
        build_shadow_cash_ledger(pd.DataFrame({"id": [1]}), [])


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"Type": "ADJUSTMENT"}, "unsupported type"),
        ({"Type": pd.NA}, "unsupported type"),
        ({"Qty": 0}, "quantity must be positive"),
        ({"Price": -1}, "price must not be negative"),
        ({"Qty": True}, "finite number"),
        ({"Qty": None}, "finite number"),
        ({"Qty": "bad"}, "finite number"),
        ({"Qty": float("inf")}, "finite number"),
    ],
)
def test_invalid_transaction_economics_fail_closed(overrides, message):
    with pytest.raises(ShadowCashLedgerInputError, match=message):
        build_shadow_cash_ledger(base_tx(**overrides), opening())


def test_invalid_transaction_currency_is_evidence_not_inference():
    report = build_shadow_cash_ledger(base_tx(currency="usd"), opening())
    assert report.complete is False
    assert report.resolved_transaction_rows == 0
    assert [issue.code for issue in report.issues] == ["TRANSACTION_CURRENCY_INVALID"]


@pytest.mark.parametrize("bad_id", [True, "abc", 0, 1.5])
def test_invalid_transaction_ids_fail_closed(bad_id):
    with pytest.raises(ShadowCashLedgerInputError, match="positive integer"):
        build_shadow_cash_ledger(base_tx(id=bad_id), opening())


def test_duplicate_transaction_ids_fail_closed():
    frame = pd.concat([base_tx(id=1), base_tx(id=1)], ignore_index=True)
    with pytest.raises(ShadowCashLedgerInputError, match="ids must be unique"):
        build_shadow_cash_ledger(frame, opening())


def test_nonfinite_id_guard_is_not_bypassed_by_custom_numeric_protocol():
    class NonFiniteId:
        def __int__(self):
            return 1
        def __float__(self):
            return float("inf")

    with pytest.raises(ShadowCashLedgerInputError, match="positive integer"):
        cash_ledger._normalize_unique_ids([NonFiniteId()], "test")


@pytest.mark.parametrize(
    "bad_events, message",
    [
        (42, "must be iterable"),
        ([42], "must be a mapping"),
        ([{"id": 1, "event_date": "2026-01-01", "event_type": "OTHER", "amount": 1, "currency": "USD"}], "unsupported type"),
        ([{"id": 1, "event_date": "2026-01-01", "event_type": pd.NA, "amount": 1, "currency": "USD"}], "unsupported type"),
        ([{"id": 1, "event_date": "2026-01-01", "event_type": "DEPOSIT", "amount": 1, "currency": pd.NA}], "three uppercase letters"),
        ([{"id": 1, "event_date": "2026-01-01", "event_type": "DEPOSIT", "amount": "bad", "currency": "USD"}], "finite number"),
        ([{"id": 1, "event_date": "2026-01-01", "event_type": "DEPOSIT", "amount": float("inf"), "currency": "USD"}], "finite number"),
    ],
)
def test_invalid_cash_event_shapes_fail_closed(bad_events, message):
    with pytest.raises(ShadowCashLedgerInputError, match=message):
        build_shadow_cash_ledger(tx_df([]), bad_events)


def test_internal_multiple_opening_invariant_fails_closed():
    entries = (
        cash_ledger.ShadowCashLedgerEntry("2026-01-01", "USD", "CASH_EVENT", 1, "OPENING_BALANCE", Decimal("1"), True),
        cash_ledger.ShadowCashLedgerEntry("2026-02-01", "USD", "CASH_EVENT", 2, "OPENING_BALANCE", Decimal("2"), True),
    )
    with pytest.raises(ShadowCashLedgerInputError, match="multiple opening balances"):
        cash_ledger._summarize_currencies(entries)


@pytest.mark.parametrize(
    "bad_date, message",
    [
        (None, "required"),
        ({}, "invalid"),
        ("", "invalid"),
        (20260816, "not a number"),
    ],
)
def test_transaction_date_validation_fails_closed(bad_date, message):
    with pytest.raises(ShadowCashLedgerInputError, match=message):
        build_shadow_cash_ledger(base_tx(Date=bad_date), opening())


def test_timezone_aware_transaction_date_preserves_calendar_date_without_claiming_chronology():
    report = build_shadow_cash_ledger(
        base_tx(Date=pd.Timestamp("2026-07-01T23:30:00+08:00")),
        opening(),
    )
    movement = next(entry for entry in report.entries if entry.source == "TRANSACTION")
    assert movement.date == "2026-07-01"


@pytest.mark.parametrize("missing_date", [None, pd.NA])
def test_cash_event_missing_date_is_consistent_validation_error(missing_date):
    events = [{
        "id": 1,
        "event_date": missing_date,
        "event_type": "OPENING_BALANCE",
        "amount": 1,
        "currency": "USD",
    }]
    with pytest.raises(ShadowCashLedgerInputError, match="YYYY-MM-DD"):
        build_shadow_cash_ledger(tx_df([]), events)


def test_scalar_missing_helper_fails_safe_when_pandas_missingness_is_unavailable_or_nonscalar(monkeypatch):
    monkeypatch.setattr(cash_ledger.pd, "isna", lambda value: (_ for _ in ()).throw(TypeError("boom")))
    assert cash_ledger._is_na(object()) is False

    monkeypatch.setattr(cash_ledger.pd, "isna", lambda value: np.array([True, False]))
    assert cash_ledger._is_na(object()) is False



def test_none_cash_event_collection_means_no_supplied_events_not_zero_cash():
    report = build_shadow_cash_ledger(tx_df([]), None)

    assert report.complete is False
    assert report.cash_event_rows == 0
    assert report.resolved_cash_event_rows == 0
    assert report.currencies == ()
    assert [issue.code for issue in report.issues] == ["NO_CASH_FACTS"]
