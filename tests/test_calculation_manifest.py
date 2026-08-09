from datetime import date, datetime, timezone

import pandas as pd
import pytest
from pydantic import ValidationError

from journal_engine.core.calculation_manifest import (
    CalculationManifestError,
    DeterministicCalculationIdentity,
    SourceRecordsIdentity,
    build_deterministic_calculation_identity,
    build_runtime_config_identity,
    build_source_records_identity,
    canonical_json_bytes,
    canonical_runtime_config_projection,
    canonical_sha256,
    canonical_source_records_projection,
    resolve_engine_source_commit,
)


ENGINE_SHA = "a" * 40
MARKET_SHA = "b" * 64
FX_SHA = "c" * 64


def _records() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "id": 2,
                "Date": "2026-01-02",
                "Symbol": "nvda",
                "Type": "buy",
                "Qty": 1.25,
                "Price": 200.5,
                "Commission": 0.2,
                "Tax": 0.0,
                "Tag": None,
                "note": "ignored note two",
                "created_at": "2026-01-02T10:00:00Z",
            },
            {
                "id": 1,
                "Date": "2026-01-01",
                "Symbol": " 2330.tw ",
                "Type": "BUY",
                "Qty": 2.0,
                "Price": 1000.0,
                "Commission": 1.0,
                "Tax": -0.1,
                "Tag": "Core",
                "note": "ignored note one",
                "created_at": "2026-01-01T10:00:00Z",
            },
        ]
    )


def _identities():
    records = build_source_records_identity(_records())
    config = build_runtime_config_identity(
        benchmark_symbol="SPY",
        base_currency="TWD",
        oversell_policy="CLAMP",
    )
    return records, config


def test_canonical_json_has_exact_versioned_byte_contract():
    actual = canonical_json_bytes({"b": 1.5, "a": "台灣"})

    assert actual == (
        b'{"canonical_json_version":1,"value":{"a":"\xe5\x8f\xb0\xe7\x81\xa3",'
        b'"b":{"$float_hex":"0x1.8000000000000p+0"}}}'
    )
    assert canonical_sha256({"a": "台灣", "b": 1.5}) == canonical_sha256(
        {"b": 1.5, "a": "台灣"}
    )


def test_canonical_json_preserves_type_and_sequence_semantics():
    assert canonical_json_bytes((1, 2.0, date(2026, 1, 2))) == canonical_json_bytes(
        [1, 2.0, date(2026, 1, 2)]
    )
    assert canonical_sha256(0.0) != canonical_sha256(-0.0)
    assert canonical_sha256([1, 2]) != canonical_sha256([2, 1])
    assert canonical_sha256(True) != canonical_sha256(1)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_canonical_json_rejects_non_finite_floats(value):
    with pytest.raises(CalculationManifestError, match="finite"):
        canonical_json_bytes(value)


def test_canonical_json_rejects_ambiguous_or_unsupported_types():
    with pytest.raises(CalculationManifestError, match="datetime is ambiguous"):
        canonical_json_bytes(datetime(2026, 1, 1, tzinfo=timezone.utc))
    with pytest.raises(CalculationManifestError, match="mapping keys"):
        canonical_json_bytes({1: "not allowed"})
    with pytest.raises(CalculationManifestError, match="unsupported canonical value type"):
        canonical_json_bytes({"set"})


def test_source_projection_is_stable_and_excludes_irrelevant_columns():
    original = _records()
    reordered = original.iloc[::-1].copy()
    reordered = reordered[list(reversed(reordered.columns))]
    reordered["note"] = ["changed", "also changed"]
    reordered["created_at"] = ["2099", "2098"]

    projection = canonical_source_records_projection(original)
    identity = build_source_records_identity(original)
    reordered_identity = build_source_records_identity(reordered)

    assert [row["id"] for row in projection["rows"]] == [1, 2]
    assert projection["rows"][0]["Symbol"] == "2330.TW"
    assert projection["rows"][1]["Symbol"] == "NVDA"
    assert projection["rows"][1]["Tag"] == ""
    assert projection["rows"][0]["Tax"] == -0.1
    assert identity == reordered_identity
    assert identity.record_count == 2
    assert identity.max_record_id == 2


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("Price", 1001.0),
        ("Qty", 3.0),
        ("Commission", 1.1),
        ("Tax", 0.2),
        ("Tag", "Satellite"),
        ("Type", "SELL"),
        ("Symbol", "AMD"),
        ("id", 10),
        ("Date", "2026-01-03"),
    ],
)
def test_source_digest_changes_for_material_fields(column, value):
    baseline = build_source_records_identity(_records()).sha256
    changed = _records()
    changed.loc[1, column] = value

    assert build_source_records_identity(changed).sha256 != baseline


def test_source_identity_rejects_missing_empty_and_duplicate_inputs():
    with pytest.raises(CalculationManifestError, match="pandas DataFrame"):
        canonical_source_records_projection([])
    with pytest.raises(CalculationManifestError, match="missing required fields"):
        canonical_source_records_projection(_records().drop(columns=["Tax"]))
    with pytest.raises(CalculationManifestError, match="must not be empty"):
        canonical_source_records_projection(_records().iloc[0:0])

    duplicate = _records()
    duplicate.loc[0, "id"] = 1
    with pytest.raises(CalculationManifestError, match="ids must be unique"):
        canonical_source_records_projection(duplicate)


@pytest.mark.parametrize("bad_id", [True, 0, -1, 1.5, "x", float("inf")])
def test_source_identity_rejects_invalid_record_ids(bad_id):
    records = _records()
    records.loc[0, "id"] = bad_id
    with pytest.raises(CalculationManifestError, match="record id must be a positive integer"):
        canonical_source_records_projection(records)


@pytest.mark.parametrize(
    "bad_date",
    ["not-a-date", "2026-01-02T12:00:00", pd.Timestamp("2026-01-02", tz="UTC")],
)
def test_source_identity_rejects_ambiguous_dates(bad_date):
    records = _records()
    records.loc[0, "Date"] = bad_date
    with pytest.raises(CalculationManifestError, match="transaction Date"):
        canonical_source_records_projection(records)


@pytest.mark.parametrize(
    ("column", "value", "message"),
    [
        ("Symbol", "", "Symbol must be non-empty"),
        ("Type", "SPLIT", "unsupported transaction Type"),
        ("Qty", 0.0, "Qty must be positive"),
        ("Price", -0.01, "Price must be non-negative"),
        ("Qty", "not-number", "Qty must be numeric"),
        ("Commission", float("nan"), "Commission must be finite"),
        ("Tax", float("inf"), "Tax must be finite"),
    ],
)
def test_source_identity_fails_closed_on_invalid_financial_fields(column, value, message):
    records = _records()
    records.loc[0, column] = value
    with pytest.raises(CalculationManifestError, match=message):
        canonical_source_records_projection(records)


def test_runtime_config_is_normalized_deterministic_and_material():
    projection = canonical_runtime_config_projection(
        benchmark_symbol=" spy ",
        base_currency=" twd ",
        oversell_policy=" clamp ",
    )
    first = build_runtime_config_identity(
        benchmark_symbol=" spy ",
        base_currency=" twd ",
        oversell_policy=" clamp ",
    )
    second = build_runtime_config_identity(
        oversell_policy="CLAMP",
        base_currency="TWD",
        benchmark_symbol="SPY",
    )

    assert projection["benchmark_symbol"] == "SPY"
    assert projection["base_currency"] == "TWD"
    assert projection["oversell_policy"] == "CLAMP"
    assert first == second
    assert first.sha256 != build_runtime_config_identity(
        benchmark_symbol="QQQ",
        base_currency="TWD",
        oversell_policy="CLAMP",
    ).sha256
    assert first.sha256 != build_runtime_config_identity(
        benchmark_symbol="SPY",
        base_currency="USD",
        oversell_policy="CLAMP",
    ).sha256
    assert first.sha256 != build_runtime_config_identity(
        benchmark_symbol="SPY",
        base_currency="TWD",
        oversell_policy="ERROR",
    ).sha256


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        (
            {"benchmark_symbol": "", "base_currency": "TWD", "oversell_policy": "CLAMP"},
            "benchmark_symbol must be non-empty",
        ),
        (
            {"benchmark_symbol": "SPY", "base_currency": "", "oversell_policy": "CLAMP"},
            "base_currency must be non-empty",
        ),
        (
            {"benchmark_symbol": "SPY", "base_currency": "TWD", "oversell_policy": "IGNORE"},
            "oversell_policy must be CLAMP or ERROR",
        ),
    ],
)
def test_runtime_config_rejects_ambiguous_values(kwargs, message):
    with pytest.raises(CalculationManifestError, match=message):
        build_runtime_config_identity(**kwargs)


def test_engine_source_commit_resolution_is_exact_and_fail_closed():
    assert resolve_engine_source_commit(ENGINE_SHA) == ENGINE_SHA
    assert resolve_engine_source_commit(environ={"GITHUB_SHA": ENGINE_SHA}) == ENGINE_SHA
    assert resolve_engine_source_commit(ENGINE_SHA, environ={"GITHUB_SHA": "b" * 40}) == ENGINE_SHA

    for invalid in (None, "", "a" * 7, "A" * 40, "main"):
        kwargs = {"environ": {}} if invalid is None else {"source_commit": invalid}
        with pytest.raises(CalculationManifestError, match="exact lowercase 40-character Git SHA"):
            resolve_engine_source_commit(**kwargs)


def test_combined_calculation_identity_is_deterministic_and_asof_sensitive():
    source, config = _identities()
    first = build_deterministic_calculation_identity(
        engine_source_commit=ENGINE_SHA,
        source_records=source,
        runtime_config=config,
        market_inputs_sha256=MARKET_SHA,
        fx_inputs_sha256=FX_SHA,
        calculation_as_of=date(2026, 1, 3),
    )
    second = build_deterministic_calculation_identity(
        engine_source_commit=ENGINE_SHA,
        source_records=source,
        runtime_config=config,
        market_inputs_sha256=MARKET_SHA,
        fx_inputs_sha256=FX_SHA,
        calculation_as_of=date(2026, 1, 3),
    )
    later = build_deterministic_calculation_identity(
        engine_source_commit=ENGINE_SHA,
        source_records=source,
        runtime_config=config,
        market_inputs_sha256=MARKET_SHA,
        fx_inputs_sha256=FX_SHA,
        calculation_as_of=date(2026, 1, 4),
    )
    different_market = build_deterministic_calculation_identity(
        engine_source_commit=ENGINE_SHA,
        source_records=source,
        runtime_config=config,
        market_inputs_sha256="d" * 64,
        fx_inputs_sha256=FX_SHA,
        calculation_as_of=date(2026, 1, 3),
    )

    assert first == second
    assert first.combined_sha256 != later.combined_sha256
    assert first.combined_sha256 != different_market.combined_sha256
    assert "calculated_at" not in first.model_dump()


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("engine_source_commit", "short", "Git SHA"),
        ("market_inputs_sha256", "short", "SHA-256"),
        ("fx_inputs_sha256", "short", "SHA-256"),
        ("calculation_as_of", datetime(2026, 1, 3), "must be a date"),
    ],
)
def test_combined_identity_builder_rejects_invalid_components(field, value, message):
    source, config = _identities()
    kwargs = {
        "engine_source_commit": ENGINE_SHA,
        "source_records": source,
        "runtime_config": config,
        "market_inputs_sha256": MARKET_SHA,
        "fx_inputs_sha256": FX_SHA,
        "calculation_as_of": date(2026, 1, 3),
    }
    kwargs[field] = value
    with pytest.raises(CalculationManifestError, match=message):
        build_deterministic_calculation_identity(**kwargs)


def test_identity_models_forbid_extra_fields_and_bad_digests():
    with pytest.raises(ValidationError):
        SourceRecordsIdentity(
            sha256="x" * 64,
            record_count=1,
            max_record_id=1,
        )

    source, config = _identities()
    valid = build_deterministic_calculation_identity(
        engine_source_commit=ENGINE_SHA,
        source_records=source,
        runtime_config=config,
        market_inputs_sha256=MARKET_SHA,
        fx_inputs_sha256=FX_SHA,
        calculation_as_of=date(2026, 1, 3),
    )
    payload = valid.model_dump()
    payload["unexpected"] = "forbidden"
    with pytest.raises(ValidationError):
        DeterministicCalculationIdentity.model_validate(payload)
