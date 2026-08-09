import json

import pandas as pd
import pytest

from tools import audit_transaction_integrity as audit_tool


def normalized_rows(rows):
    frame = pd.DataFrame(rows)
    if "Tag" not in frame.columns:
        frame["Tag"] = ""
    if "note" not in frame.columns:
        frame["note"] = ""
    frame["Date"] = pd.to_datetime(frame["Date"])
    return frame


def transaction(
    record_id,
    txn_type,
    qty,
    *,
    note="",
    tag="Core",
    date="2026-01-02",
    user_id="alpha@example.com",
):
    return {
        "id": record_id,
        "user_id": user_id,
        "Date": date,
        "Symbol": "AAA",
        "Type": txn_type,
        "Qty": qty,
        "Price": 100.0,
        "Commission": 0.0,
        "Tax": 0.0,
        "Tag": tag,
        "note": note,
    }


class FakeMarket:
    def __init__(self, factor=1.0):
        self.market_data = {
            "AAA": pd.DataFrame(
                {"Split_Factor": [factor, factor]},
                index=pd.to_datetime(["2026-01-01", "2026-01-03"]),
            )
        }
        self.factor = factor

    def get_transaction_multiplier(self, symbol, date):
        assert symbol == "AAA"
        return self.factor


def test_structured_provenance_counts_duplicates_without_exposing_identifiers():
    frame = normalized_rows([
        transaction(
            1,
            "BUY",
            1,
            note=(
                "IBKR import_key=IBKR-739305860 order_id=739305860 "
                "trade_id=fill-1 executed_at_utc=2026-01-02T01:00:00Z"
            ),
        ),
        transaction(
            2,
            "SELL",
            1,
            note=(
                "import_key=IBKR-739305860 | order_id=739305860 | "
                "trade_id=fill-1 | trade_time=2026-01-02T02:00:00Z"
            ),
        ),
    ])

    result = audit_tool.audit_structured_note_provenance(frame)
    rendered = json.dumps(result, sort_keys=True)

    assert result["nonempty_notes"] == 2
    assert result["token_counts"]["import_key"] == 2
    assert result["token_counts"]["order_id"] == 2
    assert result["token_counts"]["trade_id"] == 2
    assert result["duplicate_import_key"] == {"groups": 1, "rows": 2}
    assert result["duplicate_trade_id"] == {"groups": 1, "rows": 2}
    assert result["repeated_order_id"] == {"groups": 1, "rows": 2}
    assert "IBKR-739305860" not in rendered
    assert "739305860" not in rendered
    assert "fill-1" not in rendered
    assert "record_ids" not in rendered
    assert "fingerprint" not in rendered


def test_same_identifier_in_different_users_is_not_a_duplicate_group():
    frame = normalized_rows([
        transaction(
            1,
            "BUY",
            1,
            note="import_key=shared-order trade_id=shared-fill order_id=shared-order",
            user_id="alpha@example.com",
        ),
        transaction(
            2,
            "BUY",
            1,
            note="import_key=shared-order trade_id=shared-fill order_id=shared-order",
            user_id="beta@example.com",
        ),
    ])

    result = audit_tool.audit_structured_note_provenance(frame)

    assert result["duplicate_import_key"] == {"groups": 0, "rows": 0}
    assert result["duplicate_trade_id"] == {"groups": 0, "rows": 0}
    assert result["repeated_order_id"] == {"groups": 0, "rows": 0}


def test_build_audit_result_is_clear_for_valid_prefixes_and_unique_provenance(monkeypatch):
    monkeypatch.setenv("GITHUB_SHA", "abc123")
    frame = normalized_rows([
        transaction(1, "BUY", 2, note="import_key=one trade_id=fill-1"),
        transaction(2, "SELL", 2, note="import_key=two trade_id=fill-2", date="2026-01-03"),
    ])

    result = audit_tool.build_audit_result(frame, ["alpha@example.com"], FakeMarket())
    rendered = json.dumps(result, sort_keys=True)

    assert result["mode"] == "read_only"
    assert result["source_commit"] == "abc123"
    assert result["qualification"] == "clear"
    assert result["summary"]["users"] == 1
    assert result["summary"]["rows"] == 2
    assert result["summary"]["prefix_violations"] == 0
    assert result["summary"]["duplicate_import_key_groups"] == 0
    assert "alpha@example.com" not in rendered
    assert '"AAA"' not in rendered
    assert "fill-1" not in rendered
    assert "record_id" not in rendered
    assert "requested_qty" not in rendered


def test_build_audit_result_blocks_negative_source_prefix_with_counts_only():
    frame = normalized_rows([
        transaction(1, "SELL", 1),
        transaction(2, "BUY", 1),
    ])

    result = audit_tool.build_audit_result(frame, ["alpha@example.com"], FakeMarket())
    rendered = json.dumps(result, sort_keys=True)

    assert result["qualification"] == "blocked"
    assert result["summary"]["prefix_violations"] == 2  # all + Core
    assert result["summary"]["users_with_prefix_violations"] == 1
    assert result["summary"]["all_scope_prefix_violations"] == 1
    assert result["summary"]["tag_scope_prefix_violations"] == 1
    assert "alpha@example.com" not in rendered
    assert '"AAA"' not in rendered
    assert "record_id" not in rendered
    assert "qty_before" not in rendered
    assert "qty_after" not in rendered


def test_split_coverage_fails_closed_when_market_data_is_missing_without_symbol_in_error():
    frame = normalized_rows([transaction(1, "BUY", 1)])
    market = FakeMarket()
    market.market_data = {}

    with pytest.raises(audit_tool.ProductionAuditError, match="unavailable") as exc_info:
        audit_tool.validate_split_multiplier_coverage(frame, market)

    assert "AAA" not in str(exc_info.value)


def test_split_coverage_rejects_multiplier_api_divergence_without_symbol_in_error():
    frame = normalized_rows([transaction(1, "BUY", 1)])
    market = FakeMarket(factor=2.0)
    market.get_transaction_multiplier = lambda symbol, date: 1.0

    with pytest.raises(audit_tool.ProductionAuditError, match="diverges") as exc_info:
        audit_tool.validate_split_multiplier_coverage(frame, market)

    assert "AAA" not in str(exc_info.value)


def test_notes_are_optional_and_never_required_for_calculation_audit():
    frame = normalized_rows([transaction(1, "BUY", 1)]).drop(columns=["note"])

    result = audit_tool.audit_structured_note_provenance(frame)

    assert result["rows"] == 1
    assert result["nonempty_notes"] == 0
    assert result["token_counts"] == {}
    assert result["duplicate_import_key"] == {"groups": 0, "rows": 0}


def test_structured_provenance_requires_user_identity_for_safe_scoping():
    frame = normalized_rows([transaction(1, "BUY", 1, note="import_key=one")])
    frame.loc[0, "user_id"] = ""

    with pytest.raises(audit_tool.ProductionAuditError, match="no user identity"):
        audit_tool.audit_structured_note_provenance(frame)
