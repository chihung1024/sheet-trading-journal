from datetime import datetime
from types import SimpleNamespace

import pandas as pd
import pytest
import pytz

from journal_engine.core.production_manifest import (
    ProductionManifestError,
    build_production_calculation_manifest,
    resolve_calculation_context,
)


def _frame(dates, prices):
    return pd.DataFrame(
        {
            "Close_Adjusted": prices,
            "Dividends": [0.0] * len(dates),
            "Split_Factor": [1.0] * len(dates),
            "Valuation_Source": ["market"] * len(dates),
            "Valuation_Source_Date": dates,
        },
        index=pd.to_datetime(dates),
    )


def _raw_user_df():
    return pd.DataFrame(
        [
            {
                "id": 101,
                "user_id": "alpha@example.com",
                "Date": pd.Timestamp("2026-01-02"),
                "Symbol": "NVDA",
                "Type": "BUY",
                "Qty": 2.0,
                "Price": 100.0,
                "Commission": 1.0,
                "Tax": 0.0,
                "Tag": "growth",
            },
            {
                "id": 102,
                "user_id": "alpha@example.com",
                "Date": pd.Timestamp("2026-01-03"),
                "Symbol": "2330.TW",
                "Type": "BUY",
                "Qty": 1.0,
                "Price": 500.0,
                "Commission": 0.0,
                "Tax": 0.0,
                "Tag": "core",
            },
        ]
    )


def _market_client():
    dates = ["2025-12-01", "2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06"]
    market_data = {
        "SPY": _frame(dates, [90.0, 99.0, 100.0, 101.0, 999.0]),
        "NVDA": _frame(dates, [40.0, 49.0, 50.0, 55.0, 999.0]),
        "2330.TW": _frame(dates, [400.0, 490.0, 500.0, 510.0, 9999.0]),
        "MSFT": _frame(dates, [1.0, 2.0, 3.0, 4.0, 5.0]),
    }
    usd = pd.Series(
        [31.0, 31.5, 32.0, 32.5, 99.0],
        index=pd.to_datetime(dates),
    )
    eur = pd.Series(
        [35.0, 35.5, 36.0, 36.5, 88.0],
        index=pd.to_datetime(dates),
    )
    metadata = {
        symbol: {
            "price_source": "Close",
            "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
        }
        for symbol in market_data
    }
    return SimpleNamespace(
        market_data=market_data,
        fx_rates_by_currency={"USD": usd, "EUR": eur},
        realtime_fx_rates_by_currency={"USD": 32.5, "EUR": 36.5},
        price_metadata_by_symbol=metadata,
        realtime_overlay_symbols={"NVDA", "MSFT"},
        get_prev_trading_date=lambda symbol, value_date: pd.Timestamp("2026-01-01"),
    )


def _fixed_now():
    return pytz.timezone("Asia/Taipei").localize(datetime(2026, 1, 5, 15, 0))


def test_build_production_manifest_is_user_scoped_and_asof_bounded():
    client = _market_client()

    manifest = build_production_calculation_manifest(
        raw_user_df=_raw_user_df(),
        market_client=client,
        benchmark="SPY",
        calculation_now=_fixed_now(),
        engine_source_commit="a" * 40,
        oversell_policy="CLAMP",
    )

    assert manifest.manifest_version == 1
    assert manifest.calculated_at == "2026-01-05T15:00:00+08:00"
    assert manifest.deterministic_identity.calculation_as_of.isoformat() == "2026-01-05"
    assert manifest.deterministic_identity.source_records.record_count == 2
    assert manifest.deterministic_identity.source_records.max_record_id == 102
    assert manifest.deterministic_identity.runtime_config.benchmark_symbol == "SPY"
    assert manifest.deterministic_identity.runtime_config.oversell_policy == "CLAMP"

    assert manifest.market_inputs.symbol_count == 3
    assert manifest.fx_inputs.currency_count == 2
    assert manifest.provider_diagnostics.price_sources == {
        "2330.TW": "Close",
        "NVDA": "Close",
        "SPY": "Close",
    }
    assert manifest.provider_diagnostics.realtime_overlay_symbols == ("NVDA",)


def test_manifest_identity_ignores_other_users_future_rows_and_unrelated_currency():
    baseline_client = _market_client()
    baseline = build_production_calculation_manifest(
        raw_user_df=_raw_user_df(),
        market_client=baseline_client,
        benchmark="SPY",
        calculation_now=_fixed_now(),
        engine_source_commit="a" * 40,
        oversell_policy="CLAMP",
    )

    changed_client = _market_client()
    changed_client.market_data["MSFT"].loc[:, "Close_Adjusted"] = 123456.0
    changed_client.fx_rates_by_currency["EUR"].loc[:] = 777.0
    changed_client.realtime_fx_rates_by_currency["EUR"] = 888.0
    for symbol in ("SPY", "NVDA", "2330.TW"):
        changed_client.market_data[symbol].loc[pd.Timestamp("2026-01-06"), "Close_Adjusted"] = 777777.0
    changed_client.fx_rates_by_currency["USD"].loc[pd.Timestamp("2026-01-06")] = 444.0

    changed = build_production_calculation_manifest(
        raw_user_df=_raw_user_df(),
        market_client=changed_client,
        benchmark="SPY",
        calculation_now=_fixed_now(),
        engine_source_commit="a" * 40,
        oversell_policy="CLAMP",
    )

    assert changed.market_inputs == baseline.market_inputs
    assert changed.fx_inputs == baseline.fx_inputs
    assert changed.deterministic_identity == baseline.deterministic_identity


def test_manifest_builder_fails_closed_when_required_provider_metadata_is_missing():
    client = _market_client()
    del client.price_metadata_by_symbol["NVDA"]

    with pytest.raises(ProductionManifestError, match="provider provenance.*NVDA"):
        build_production_calculation_manifest(
            raw_user_df=_raw_user_df(),
            market_client=client,
            benchmark="SPY",
            calculation_now=_fixed_now(),
            engine_source_commit="a" * 40,
            oversell_policy="CLAMP",
        )


def test_calculation_context_is_timezone_aware_taipei_time():
    calculation_now = resolve_calculation_context()

    assert calculation_now.tzinfo is not None
    assert calculation_now.utcoffset() is not None
    assert getattr(calculation_now.tzinfo, "zone", None) == "Asia/Taipei"
