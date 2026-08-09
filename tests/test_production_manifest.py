import json
from datetime import date

import pandas as pd
import pytest
from pydantic import ValidationError

from journal_engine.core.calculation_manifest import (
    build_deterministic_calculation_identity,
    build_runtime_config_identity,
    build_source_records_identity,
)
from journal_engine.core.input_provenance import (
    build_fx_inputs_identity,
    build_market_inputs_identity,
    build_provider_provenance_diagnostics,
)
from journal_engine.models import CalculationManifest, PortfolioSnapshot, PortfolioSummary


def _source_records():
    return pd.DataFrame(
        [
            {
                "id": 1,
                "Date": pd.Timestamp("2026-01-02"),
                "Symbol": "NVDA",
                "Type": "BUY",
                "Qty": 2.0,
                "Price": 100.0,
                "Commission": 1.0,
                "Tax": 0.0,
                "Tag": "growth",
            }
        ]
    )


def _market_data():
    return {
        "NVDA": pd.DataFrame(
            {
                "Close_Adjusted": [50.0, 55.0],
                "Dividends": [0.0, 1.0],
                "Split_Factor": [2.0, 1.0],
                "Valuation_Source": ["market", "market"],
                "Valuation_Source_Date": ["2026-01-02", "2026-01-05"],
            },
            index=pd.to_datetime(["2026-01-02", "2026-01-05"]),
        )
    }


def _manifest(*, calculated_at="2026-01-05T15:00:00+08:00"):
    source_identity = build_source_records_identity(_source_records())
    runtime_identity = build_runtime_config_identity(
        benchmark_symbol="SPY",
        base_currency="TWD",
        oversell_policy="CLAMP",
    )
    market_identity = build_market_inputs_identity(_market_data(), required_symbols=["NVDA"])
    fx_identity = build_fx_inputs_identity(
        {
            "USD": pd.Series(
                [32.0, 32.5],
                index=pd.to_datetime(["2026-01-02", "2026-01-05"]),
            )
        },
        required_currencies=["TWD", "USD"],
        realtime_fx_rates_by_currency={"USD": 32.5},
        include_realtime=True,
    )
    deterministic = build_deterministic_calculation_identity(
        engine_source_commit="1" * 40,
        source_records=source_identity,
        runtime_config=runtime_identity,
        market_inputs_sha256=market_identity.sha256,
        fx_inputs_sha256=fx_identity.sha256,
        calculation_as_of=date(2026, 1, 5),
    )
    provider = build_provider_provenance_diagnostics(
        metadata_by_symbol={
            "NVDA": {
                "price_source": "Close",
                "selection_reason": "Scheme A",
            }
        },
        realtime_overlay_symbols=["NVDA"],
    )
    return CalculationManifest(
        deterministic_identity=deterministic,
        market_inputs=market_identity,
        fx_inputs=fx_identity,
        provider_diagnostics=provider,
        calculated_at=calculated_at,
    )


def _summary():
    return PortfolioSummary(
        total_value=100.0,
        invested_capital=90.0,
        total_pnl=10.0,
        twr=1.0,
        realized_pnl=0.0,
        benchmark_twr=0.5,
    )


def test_legacy_snapshot_without_manifest_remains_valid():
    snapshot = PortfolioSnapshot(
        updated_at="2026-01-05 15:00",
        base_currency="TWD",
        exchange_rate=32.5,
        summary=_summary(),
        holdings=[],
        history=[],
    )

    assert snapshot.calculation_manifest is None


def test_snapshot_manifest_round_trip_is_json_safe_and_versioned():
    manifest = _manifest()
    snapshot = PortfolioSnapshot(
        updated_at="2026-01-05 15:00",
        base_currency="TWD",
        exchange_rate=32.5,
        benchmark_symbol="SPY",
        summary=_summary(),
        holdings=[],
        history=[],
        calculation_manifest=manifest,
    )

    dumped = snapshot.model_dump(mode="json")
    json.dumps(dumped)
    restored = PortfolioSnapshot.model_validate(dumped)

    assert dumped["calculation_manifest"]["manifest_version"] == 1
    assert dumped["calculation_manifest"]["deterministic_identity"]["calculation_as_of"] == "2026-01-05"
    assert restored.calculation_manifest == manifest


def test_manifest_rejects_naive_calculated_at():
    with pytest.raises(ValidationError, match="calculated_at must be timezone-aware"):
        _manifest(calculated_at="2026-01-05T15:00:00")


def test_manifest_rejects_market_digest_inconsistency():
    manifest = _manifest()
    payload = manifest.model_dump()
    payload["market_inputs"] = payload["market_inputs"].copy()
    payload["market_inputs"]["sha256"] = "f" * 64

    with pytest.raises(ValidationError, match="market_inputs.sha256"):
        CalculationManifest.model_validate(payload)


def test_manifest_rejects_fx_digest_inconsistency():
    manifest = _manifest()
    payload = manifest.model_dump()
    payload["fx_inputs"] = payload["fx_inputs"].copy()
    payload["fx_inputs"]["sha256"] = "e" * 64

    with pytest.raises(ValidationError, match="fx_inputs.sha256"):
        CalculationManifest.model_validate(payload)
