import math

import pandas as pd
import pytest

from journal_engine.core.ledger_integrity import (
    ABSOLUTE_QTY_TOLERANCE,
    LedgerIntegrityError,
    LedgerIntegrityInputError,
    audit_transaction_prefix_integrity,
    parse_transaction_tags,
    quantity_tolerance,
    validate_transaction_prefix_integrity,
)
from journal_engine.core.split_ledger import build_split_adjusted_validation_ledger


def frame(rows):
    result = pd.DataFrame(rows)
    if "Tag" not in result.columns:
        result["Tag"] = ""
    return result


def row(record_id, date, txn_type, qty, *, symbol="AAA", tag=""):
    return {
        "id": record_id,
        "Date": pd.Timestamp(date),
        "Symbol": symbol,
        "Type": txn_type,
        "Qty": qty,
        "Price": 100.0,
        "Tag": tag,
    }


class FakeSplitMarket:
    def __init__(self, multipliers):
        self.multipliers = multipliers

    def get_transaction_multiplier(self, symbol, date):
        key = (symbol, pd.Timestamp(date).strftime("%Y-%m-%d"))
        return self.multipliers.get(key, self.multipliers.get(symbol, 1.0))


def test_exact_zero_closeout_is_valid():
    ledger = frame([
        row(1, "2026-01-01", "BUY", 10),
        row(2, "2026-01-02", "SELL", 10),
    ])

    audit = validate_transaction_prefix_integrity(ledger, user_label="al***@example.com")

    assert audit.valid is True
    assert audit.violations == ()
    assert audit.scope_count == 1


def test_fractional_round_trip_is_valid():
    ledger = frame([
        row(1, "2026-01-01", "BUY", 0.0396),
        row(2, "2026-01-02", "BUY", 0.9604),
        row(3, "2026-01-03", "SELL", 0.4),
        row(4, "2026-01-04", "SELL", 0.6),
    ])

    assert validate_transaction_prefix_integrity(ledger).valid is True


def test_first_row_sell_fails_with_structured_diagnostic():
    ledger = frame([row(7, "2026-01-02", "SELL", 1.25)])

    audit = audit_transaction_prefix_integrity(ledger, user_label="us***@example.com")

    assert audit.valid is False
    assert len(audit.violations) == 1
    violation = audit.violations[0]
    assert violation.scope == "all"
    assert violation.symbol == "AAA"
    assert violation.record_id == 7
    assert violation.quantity_before == pytest.approx(0.0)
    assert violation.quantity_after == pytest.approx(-1.25)
    assert "us***@example.com" in violation.diagnostic()

    with pytest.raises(LedgerIntegrityError, match="record_id=7"):
        validate_transaction_prefix_integrity(ledger, user_label="us***@example.com")


def test_partial_oversell_fails_at_the_overselling_record():
    ledger = frame([
        row(1, "2026-01-01", "BUY", 5),
        row(2, "2026-01-02", "SELL", 3),
        row(3, "2026-01-03", "SELL", 3),
        row(4, "2026-01-04", "BUY", 10),
    ])

    violation = audit_transaction_prefix_integrity(ledger).violations[0]

    assert violation.record_id == 3
    assert violation.quantity_before == pytest.approx(2.0)
    assert violation.quantity_after == pytest.approx(-1.0)


def test_tolerance_edge_normalizes_tiny_negative_residue_to_zero():
    accepted = ABSOLUTE_QTY_TOLERANCE * 0.5
    rejected = ABSOLUTE_QTY_TOLERANCE * 2.0

    valid_ledger = frame([
        row(1, "2026-01-01", "BUY", 1.0),
        row(2, "2026-01-02", "SELL", 1.0 + accepted),
        row(3, "2026-01-03", "BUY", 0.25),
        row(4, "2026-01-04", "SELL", 0.25),
    ])
    invalid_ledger = frame([
        row(1, "2026-01-01", "BUY", 1.0),
        row(2, "2026-01-02", "SELL", 1.0 + rejected),
    ])

    assert validate_transaction_prefix_integrity(valid_ledger).valid is True
    assert audit_transaction_prefix_integrity(invalid_ledger).valid is False


def test_relative_tolerance_scales_only_above_absolute_floor():
    assert quantity_tolerance(1.0) == pytest.approx(ABSOLUTE_QTY_TOLERANCE)
    assert quantity_tolerance(10_000.0) == pytest.approx(1e-8)
    assert quantity_tolerance(-10_000.0) == pytest.approx(1e-8)


def test_prefix_audit_runs_on_split_adjusted_common_share_units():
    raw = frame([
        row(1, "2026-01-01", "BUY", 10),
        row(2, "2026-06-01", "SELL", 20),
    ])
    market = FakeSplitMarket({
        ("AAA", "2026-01-01"): 2.0,
        ("AAA", "2026-06-01"): 1.0,
    })

    assert audit_transaction_prefix_integrity(raw).valid is False

    adjusted = build_split_adjusted_validation_ledger(raw, market)
    audit = validate_transaction_prefix_integrity(adjusted)

    assert adjusted.loc[0, "Qty"] == pytest.approx(20.0)
    assert audit.valid is True


def test_multi_tag_scopes_are_audited_independently():
    ledger = frame([
        row(1, "2026-01-01", "BUY", 10, tag="Core; Momentum"),
        row(2, "2026-01-02", "SELL", 5, tag="Core"),
        row(3, "2026-01-03", "SELL", 5, tag="Satellite"),
    ])

    audit = audit_transaction_prefix_integrity(ledger)

    assert parse_transaction_tags("Core; Momentum,Core") == ("Core", "Momentum")
    assert audit.scope_count == 4  # all + Core + Momentum + Satellite
    assert {(v.scope, v.symbol, v.record_id) for v in audit.violations} == {
        ("Satellite", "AAA", 3),
    }


def test_same_day_source_order_uses_record_id_not_type_priority():
    valid_round_trip = frame([
        row(10, "2026-01-02", "BUY", 5),
        row(11, "2026-01-02", "SELL", 5),
        row(12, "2026-01-02", "BUY", 2),
        row(13, "2026-01-02", "SELL", 2),
    ])
    invalid_source_order = frame([
        row(21, "2026-01-02", "SELL", 5),
        row(22, "2026-01-02", "BUY", 5),
    ])

    assert validate_transaction_prefix_integrity(valid_round_trip).valid is True
    violation = audit_transaction_prefix_integrity(invalid_source_order).violations[0]
    assert violation.record_id == 21
    assert violation.txn_type == "SELL"


def test_input_rows_are_sorted_by_date_then_id_deterministically():
    ledger = frame([
        row(3, "2026-01-02", "SELL", 1),
        row(2, "2026-01-02", "BUY", 1),
        row(1, "2026-01-01", "BUY", 1),
    ])

    audit = validate_transaction_prefix_integrity(ledger)

    assert audit.valid is True


def test_dividend_does_not_change_position_prefix():
    ledger = frame([
        row(1, "2026-01-01", "BUY", 1),
        row(2, "2026-01-02", "DIV", 100),
        row(3, "2026-01-03", "SELL", 1),
    ])

    assert validate_transaction_prefix_integrity(ledger).valid is True


def test_missing_tag_column_defaults_to_untagged_scope():
    ledger = pd.DataFrame([
        {
            "id": 1,
            "Date": "2026-01-01",
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": 1.0,
        },
        {
            "id": 2,
            "Date": "2026-01-02",
            "Symbol": "AAA",
            "Type": "SELL",
            "Qty": 1.0,
        },
    ])

    audit = validate_transaction_prefix_integrity(ledger)

    assert audit.valid is True
    assert audit.scope_count == 1


def test_timezone_aware_dates_are_normalized_without_changing_order():
    ledger = pd.DataFrame([
        {
            "id": 1,
            "Date": pd.Timestamp("2026-01-01T01:00:00Z"),
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": 1.0,
            "Tag": "",
        },
        {
            "id": 2,
            "Date": pd.Timestamp("2026-01-02T01:00:00Z"),
            "Symbol": "AAA",
            "Type": "SELL",
            "Qty": 1.0,
            "Tag": "",
        },
    ])

    assert validate_transaction_prefix_integrity(ledger).valid is True


def test_non_dataframe_input_fails_closed():
    with pytest.raises(LedgerIntegrityInputError, match="must be a DataFrame"):
        audit_transaction_prefix_integrity([])


@pytest.mark.parametrize(
    "raw_id",
    [True, "not-an-id", 1.5, float("nan"), float("inf")],
)
def test_invalid_record_ids_fail_closed(raw_id):
    ledger = frame([
        {
            "id": raw_id,
            "Date": "2026-01-01",
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": 1.0,
        }
    ])

    with pytest.raises(LedgerIntegrityInputError, match="positive integer"):
        audit_transaction_prefix_integrity(ledger)


@pytest.mark.parametrize(
    "date_value, message",
    [
        ("not-a-date", "invalid date"),
        (pd.NaT, "empty date"),
    ],
)
def test_invalid_dates_fail_closed(date_value, message):
    ledger = frame([
        {
            "id": 1,
            "Date": date_value,
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": 1.0,
        }
    ])

    with pytest.raises(LedgerIntegrityInputError, match=message):
        audit_transaction_prefix_integrity(ledger)


def test_empty_symbol_fails_closed():
    ledger = frame([row(1, "2026-01-01", "BUY", 1.0, symbol="   ")])

    with pytest.raises(LedgerIntegrityInputError, match="empty symbol"):
        audit_transaction_prefix_integrity(ledger)


@pytest.mark.parametrize("qty", ["bad", float("nan"), float("inf"), -float("inf")])
def test_non_finite_or_unparseable_quantity_fails_closed(qty):
    ledger = frame([
        {
            "id": 1,
            "Date": "2026-01-01",
            "Symbol": "AAA",
            "Type": "BUY",
            "Qty": qty,
        }
    ])

    with pytest.raises(LedgerIntegrityInputError, match="must be finite"):
        audit_transaction_prefix_integrity(ledger)


def test_non_finite_tolerance_input_fails_closed():
    with pytest.raises(LedgerIntegrityInputError, match="must be finite"):
        quantity_tolerance(math.nan)


@pytest.mark.parametrize(
    "rows, message",
    [
        ([row(1, "2026-01-01", "BUY", 1), row(1, "2026-01-02", "SELL", 1)], "duplicate record ids"),
        ([{k: v for k, v in row(1, "2026-01-01", "BUY", 1).items() if k != "id"}], "missing required columns"),
        ([row(0, "2026-01-01", "BUY", 1)], "positive integer"),
        ([row(1, "2026-01-01", "BUY", 0)], "must be positive"),
        ([row(1, "2026-01-01", "SHORT", 1)], "unsupported types"),
    ],
)
def test_ambiguous_or_invalid_input_fails_closed(rows, message):
    with pytest.raises(LedgerIntegrityInputError, match=message):
        audit_transaction_prefix_integrity(frame(rows))
