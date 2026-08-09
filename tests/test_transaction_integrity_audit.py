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


def transaction(record_id, txn_type, qty, *, note="", tag="Core", date="2026-01-02"):
    return {
        "id": record_id,
        "user_id": "alpha@example.com",
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


def test_structured_provenance_is_counted_without_exposing_raw_identifiers():
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

    assert result["nonempty_notes"] == 2
    assert result["token_counts"]["import_key"] == 2
    assert result["token_counts"]["order_id"] == 2
    assert result["token_counts"]["trade_id"] == 2
    assert len(result["duplicate_import_key_groups"]) == 1
    assert len(result["duplicate_trade_id_groups"]) == 1
    assert len(result["repeated_order_id_groups"]) == 1
    duplicate = result["duplicate_import_key_groups"][0]
    assert duplicate["record_ids"] == [1, 2]
    assert duplicate["fingerprint"] != "IBKR-739305860"
    assert "IBKR-739305860" not in str(result)


def test_build_audit_result_is_clear_for_valid_prefixes_and_unique_provenance(monkeypatch):
    monkeypatch.setenv("GITHUB_SHA", "abc123")
    frame = normalized_rows([
        transaction(1, "BUY", 2, note="import_key=one trade_id=fill-1"),
        transaction(2, "SELL", 2, note="import_key=two trade_id=fill-2", date="2026-01-03"),
    ])

    result = audit_tool.build_audit_result(frame, ["alpha@example.com"], FakeMarket())

    assert result["mode"] == "read_only"
    assert result["source_commit"] == "abc123"
    assert result["qualification"] == "clear"
    assert result["summary"]["users"] == 1
    assert result["summary"]["rows"] == 2
    assert result["summary"]["prefix_violations"] == 0
    assert result["summary"]["duplicate_import_key_groups"] == 0
    assert result["users"][0]["user"] == "al***@example.com"


def test_build_audit_result_blocks_negative_source_prefix_without_mutation():
    frame = normalized_rows([
        transaction(1, "SELL", 1),
        transaction(2, "BUY", 1),
    ])

    result = audit_tool.build_audit_result(frame, ["alpha@example.com"], FakeMarket())

    assert result["qualification"] == "blocked"
    assert result["summary"]["prefix_violations"] == 2  # all + Core
    assert {item["record_id"] for item in result["prefix_violations"]} == {1}
    assert {item["user"] for item in result["prefix_violations"]} == {"al***@example.com"}


def test_split_coverage_fails_closed_when_market_data_is_missing():
    frame = normalized_rows([transaction(1, "BUY", 1)])
    market = FakeMarket()
    market.market_data = {}

    with pytest.raises(audit_tool.ProductionAuditError, match="unavailable"):
        audit_tool.validate_split_multiplier_coverage(frame, market)


def test_split_coverage_rejects_multiplier_api_divergence():
    frame = normalized_rows([transaction(1, "BUY", 1)])
    market = FakeMarket(factor=2.0)
    market.get_transaction_multiplier = lambda symbol, date: 1.0

    with pytest.raises(audit_tool.ProductionAuditError, match="diverges"):
        audit_tool.validate_split_multiplier_coverage(frame, market)


def test_notes_are_optional_and_never_required_for_calculation_audit():
    frame = normalized_rows([transaction(1, "BUY", 1)]).drop(columns=["note"])

    result = audit_tool.audit_structured_note_provenance(frame)

    assert result["rows"] == 1
    assert result["nonempty_notes"] == 0
    assert result["token_counts"] == {}
