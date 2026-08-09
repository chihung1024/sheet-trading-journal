from collections import OrderedDict

import pandas as pd
import pytest
from pydantic import ValidationError

from journal_engine.core.calculation_manifest import CalculationManifestError
from journal_engine.core.input_provenance import (
    EffectiveFxInputsIdentity,
    EffectiveMarketInputsIdentity,
    ProviderProvenanceDiagnostics,
    build_fx_inputs_identity,
    build_market_inputs_identity,
    build_provider_provenance_diagnostics,
    canonical_fx_inputs_projection,
    canonical_market_inputs_projection,
)


def _market_frame() -> pd.DataFrame:
    frame = pd.DataFrame(
        {
            "Close_Adjusted": [100.0, 101.0, 102.0],
            "Dividends": [0.0, 1.0, 0.0],
            "Split_Factor": [1.0, 1.0, 2.0],
            "Valuation_Source": [
                "market",
                "asof_carry_forward",
                "transaction_price_seed",
            ],
            "Valuation_Source_Date": [
                "2026-01-01",
                "2026-01-01",
                "2026-01-03",
            ],
            "Open": [99.0, 100.0, 101.0],
            "High": [101.0, 102.0, 103.0],
            "Low": [98.0, 99.0, 100.0],
            "Close": [100.0, 101.0, 102.0],
            "Volume": [1000.0, 2000.0, 3000.0],
        },
        index=pd.to_datetime(["2026-01-01", "2026-01-02", "2026-01-03"]),
    )
    return frame


def _ordinary_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Close_Adjusted": [50.0, 51.0],
            "Dividends": [0.0, 0.0],
            "Split_Factor": [1.0, 1.0],
            "Volume": [10.0, 20.0],
        },
        index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
    )


def _market_data():
    return {"aaa": _market_frame(), "bbb": _ordinary_frame()}


def _fx_history():
    return {
        "USD": pd.Series(
            [32.0, 32.5],
            index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
        ),
        "JPY": pd.Series(
            [0.21, 0.22],
            index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
        ),
    }


def test_market_projection_is_order_invariant_and_excludes_vendor_payload_noise():
    original = _market_data()
    changed = OrderedDict(
        [
            ("BBB", _ordinary_frame().iloc[::-1].copy()),
            ("AAA", _market_frame().iloc[::-1].copy()),
        ]
    )
    changed["AAA"]["Open"] = [999.0, 998.0, 997.0]
    changed["AAA"]["High"] = [999.0, 998.0, 997.0]
    changed["AAA"]["Low"] = [1.0, 2.0, 3.0]
    changed["AAA"]["Close"] = [5.0, 6.0, 7.0]
    changed["AAA"]["Volume"] = [9.0, 8.0, 7.0]
    changed["BBB"]["Volume"] = [999.0, 888.0]

    first = build_market_inputs_identity(original, required_symbols=["bbb", "aaa"])
    second = build_market_inputs_identity(changed, required_symbols=["AAA", "BBB"])
    projection = canonical_market_inputs_projection(original, required_symbols=["AAA", "BBB"])

    assert first == second
    assert [entry["symbol"] for entry in projection["symbols"]] == ["AAA", "BBB"]
    assert [row["date"].isoformat() for row in projection["symbols"][0]["rows"]] == [
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
    ]
    assert set(projection["symbols"][0]["rows"][0]) == {
        "date",
        "close_adjusted",
        "dividends",
        "split_factor",
        "valuation_source",
        "valuation_source_date",
    }
    assert first.symbol_count == 2
    assert first.row_count == 5
    assert first.synthetic_row_counts == {
        "asof_carry_forward": 1,
        "transaction_price_seed": 1,
    }


def test_market_projection_defaults_match_effective_calculation_semantics():
    implicit = pd.DataFrame(
        {"Close_Adjusted": [10.0]},
        index=pd.to_datetime(["2026-01-01"]),
    )
    explicit = pd.DataFrame(
        {
            "Close_Adjusted": [10.0],
            "Dividends": [0.0],
            "Split_Factor": [1.0],
            "Valuation_Source": ["market"],
            "Valuation_Source_Date": ["2026-01-01"],
        },
        index=pd.to_datetime(["2026-01-01"]),
    )

    assert build_market_inputs_identity({"AAA": implicit}) == build_market_inputs_identity(
        {"AAA": explicit}
    )


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("Close_Adjusted", 111.0),
        ("Dividends", 2.0),
        ("Split_Factor", 3.0),
        ("Valuation_Source", "market"),
        ("Valuation_Source_Date", "2026-01-02"),
    ],
)
def test_market_digest_changes_for_material_effective_inputs(column, value):
    baseline = build_market_inputs_identity(_market_data(), required_symbols=["AAA"]).sha256
    changed = _market_data()
    changed["aaa"][column] = changed["aaa"][column].astype(object)
    changed["aaa"].loc[pd.Timestamp("2026-01-02"), column] = value

    if column == "Valuation_Source" and value == "market":
        changed["aaa"].loc[
            pd.Timestamp("2026-01-02"), "Valuation_Source_Date"
        ] = "2026-01-02"

    assert build_market_inputs_identity(changed, required_symbols=["AAA"]).sha256 != baseline


def test_required_market_subset_excludes_unrequested_symbols():
    baseline = build_market_inputs_identity(_market_data(), required_symbols=["AAA"])
    changed = _market_data()
    changed["bbb"].loc[pd.Timestamp("2026-01-01"), "Close_Adjusted"] = 9999.0

    assert build_market_inputs_identity(changed, required_symbols=["AAA"]) == baseline


@pytest.mark.parametrize(
    ("mutator", "message"),
    [
        (lambda data: data.update({"AAA": []}), "market data must be a DataFrame"),
        (lambda data: data.update({"AAA": _market_frame().iloc[0:0]}), "must not be empty"),
        (
            lambda data: data.update({"AAA": _market_frame().drop(columns=["Close_Adjusted"])}),
            "missing Close_Adjusted",
        ),
    ],
)
def test_market_projection_rejects_invalid_frames(mutator, message):
    data = _market_data()
    mutator(data)
    with pytest.raises(CalculationManifestError, match=message):
        canonical_market_inputs_projection(data, required_symbols=["AAA"])


def test_market_projection_rejects_missing_and_duplicate_normalized_symbols():
    with pytest.raises(CalculationManifestError, match="missing required symbols"):
        canonical_market_inputs_projection(_market_data(), required_symbols=["MISSING"])

    duplicate = {"aaa": _market_frame(), " AAA ": _market_frame()}
    with pytest.raises(CalculationManifestError, match="duplicate normalized symbols"):
        canonical_market_inputs_projection(duplicate)

    with pytest.raises(CalculationManifestError, match="unique after normalization"):
        canonical_market_inputs_projection(_market_data(), required_symbols=["aaa", " AAA "])


@pytest.mark.parametrize(
    ("index", "message"),
    [
        (["not-a-date"], "invalid date"),
        ([pd.Timestamp("2026-01-01", tz="UTC")], "timezone-naive"),
        ([pd.Timestamp("2026-01-01 12:00:00")], "dates only"),
        ([pd.Timestamp("2026-01-01"), pd.Timestamp("2026-01-01")], "duplicate dates"),
    ],
)
def test_market_projection_rejects_ambiguous_indices(index, message):
    values = [10.0] * len(index)
    frame = pd.DataFrame({"Close_Adjusted": values}, index=index)
    with pytest.raises(CalculationManifestError, match=message):
        canonical_market_inputs_projection({"AAA": frame})


@pytest.mark.parametrize(
    ("column", "value", "message"),
    [
        ("Close_Adjusted", 0.0, "Close_Adjusted must be positive"),
        ("Close_Adjusted", float("nan"), "Close_Adjusted must be finite"),
        ("Dividends", float("inf"), "Dividends must be finite"),
        ("Split_Factor", 0.0, "Split_Factor must be positive"),
        ("Split_Factor", True, "Split_Factor must be numeric"),
    ],
)
def test_market_projection_rejects_invalid_material_values(column, value, message):
    data = {"AAA": _ordinary_frame()}
    data["AAA"][column] = data["AAA"][column].astype(object)
    data["AAA"].loc[pd.Timestamp("2026-01-01"), column] = value
    with pytest.raises(CalculationManifestError, match=message):
        canonical_market_inputs_projection(data)


def test_market_projection_rejects_invalid_synthetic_provenance():
    data = {"AAA": _market_frame()}
    data["AAA"].loc[pd.Timestamp("2026-01-02"), "Valuation_Source"] = "unknown"
    with pytest.raises(CalculationManifestError, match="unsupported valuation source"):
        canonical_market_inputs_projection(data)

    data = {"AAA": _market_frame()}
    data["AAA"].loc[pd.Timestamp("2026-01-02"), "Valuation_Source_Date"] = pd.NA
    with pytest.raises(CalculationManifestError, match="synthetic valuation source date is missing"):
        canonical_market_inputs_projection(data)

    data = {"AAA": _market_frame()}
    data["AAA"].loc[pd.Timestamp("2026-01-02"), "Valuation_Source_Date"] = "2026-01-03"
    with pytest.raises(CalculationManifestError, match="cannot be in the future"):
        canonical_market_inputs_projection(data)

    data = {"AAA": _market_frame()}
    data["AAA"].loc[pd.Timestamp("2026-01-01"), "Valuation_Source_Date"] = "2025-12-31"
    with pytest.raises(CalculationManifestError, match="market valuation source date must equal"):
        canonical_market_inputs_projection(data)

    data = {"AAA": _market_frame()}
    data["AAA"].loc[pd.Timestamp("2026-01-03"), "Valuation_Source_Date"] = "2026-01-02"
    with pytest.raises(
        CalculationManifestError,
        match="transaction_price_seed valuation source date must equal",
    ):
        canonical_market_inputs_projection(data)


def test_market_identity_models_reject_bad_digest_and_synthetic_diagnostics():
    with pytest.raises(ValidationError, match="market input digest"):
        EffectiveMarketInputsIdentity(
            sha256="x" * 64,
            symbol_count=1,
            row_count=1,
            synthetic_row_counts={},
        )
    with pytest.raises(ValidationError, match="unsupported source"):
        EffectiveMarketInputsIdentity(
            sha256="a" * 64,
            symbol_count=1,
            row_count=1,
            synthetic_row_counts={"unknown": 1},
        )
    with pytest.raises(ValidationError):
        EffectiveMarketInputsIdentity(
            sha256="a" * 64,
            symbol_count=1,
            row_count=1,
            synthetic_row_counts={"asof_carry_forward": -1},
        )


def test_fx_projection_is_order_invariant_and_twd_is_constant():
    history = _fx_history()
    reversed_history = OrderedDict(
        [
            ("JPY", history["JPY"].iloc[::-1]),
            ("USD", history["USD"].iloc[::-1]),
        ]
    )

    first = build_fx_inputs_identity(
        history,
        required_currencies=["twd", "usd", "jpy"],
        include_realtime=False,
    )
    second = build_fx_inputs_identity(
        reversed_history,
        required_currencies=["JPY", "USD", "TWD"],
        include_realtime=False,
    )
    projection = canonical_fx_inputs_projection(
        history,
        required_currencies=["TWD", "USD"],
    )

    assert first == second
    twd = projection["currencies"][0]
    assert twd == {
        "currency": "TWD",
        "constant_rate": 1.0,
        "historical_rows": [],
        "realtime_rate": None,
    }
    assert first.currency_count == 3
    assert first.historical_row_count == 4
    assert first.realtime_currency_count == 0


def test_fx_required_subset_excludes_unrequested_currency():
    baseline = build_fx_inputs_identity(_fx_history(), required_currencies=["USD"])
    changed = _fx_history()
    changed["JPY"].iloc[0] = 999.0

    assert build_fx_inputs_identity(changed, required_currencies=["USD"]) == baseline


def test_historical_fx_change_changes_digest():
    baseline = build_fx_inputs_identity(_fx_history(), required_currencies=["USD"])
    changed = _fx_history()
    changed["USD"].iloc[0] = 31.0

    assert build_fx_inputs_identity(changed, required_currencies=["USD"]).sha256 != baseline.sha256


def test_realtime_fx_is_included_only_when_requested():
    history = _fx_history()
    baseline = build_fx_inputs_identity(
        history,
        required_currencies=["USD"],
        realtime_fx_rates_by_currency={"USD": 33.0},
        include_realtime=False,
    )
    ignored_change = build_fx_inputs_identity(
        history,
        required_currencies=["USD"],
        realtime_fx_rates_by_currency={"USD": 99.0},
        include_realtime=False,
    )
    realtime = build_fx_inputs_identity(
        history,
        required_currencies=["USD", "TWD"],
        realtime_fx_rates_by_currency={"USD": 33.0},
        include_realtime=True,
    )
    realtime_changed = build_fx_inputs_identity(
        history,
        required_currencies=["USD", "TWD"],
        realtime_fx_rates_by_currency={"USD": 34.0},
        include_realtime=True,
    )

    assert baseline == ignored_change
    assert realtime.sha256 != realtime_changed.sha256
    assert realtime.includes_realtime is True
    assert realtime.realtime_currency_count == 2  # USD + constant TWD


def test_realtime_flag_captures_presence_even_when_optional_rate_missing():
    identity = build_fx_inputs_identity(
        _fx_history(),
        required_currencies=["USD"],
        include_realtime=True,
    )
    projection = canonical_fx_inputs_projection(
        _fx_history(),
        required_currencies=["USD"],
        include_realtime=True,
    )

    assert identity.includes_realtime is True
    assert identity.realtime_currency_count == 0
    assert projection["currencies"][0]["realtime_rate"] is None


@pytest.mark.parametrize(
    ("history", "currencies", "message"),
    [
        ([], ["USD"], "must be a mapping"),
        ({"USD": [1.0]}, ["USD"], "must be a Series"),
        ({"USD": pd.Series(dtype=float)}, ["USD"], "must not be empty"),
        ({}, ["USD"], "missing required currency"),
    ],
)
def test_fx_projection_rejects_invalid_history_shapes(history, currencies, message):
    with pytest.raises(CalculationManifestError, match=message):
        canonical_fx_inputs_projection(history, required_currencies=currencies)


def test_fx_projection_rejects_duplicate_normalized_currency_inputs():
    history = {
        "usd": _fx_history()["USD"],
        " USD ": _fx_history()["USD"],
    }
    with pytest.raises(CalculationManifestError, match="duplicate normalized currencies"):
        canonical_fx_inputs_projection(history, required_currencies=["USD"])

    with pytest.raises(CalculationManifestError, match="unique after normalization"):
        canonical_fx_inputs_projection(_fx_history(), required_currencies=["usd", " USD "])


def test_fx_projection_rejects_invalid_realtime_mapping_and_value():
    with pytest.raises(CalculationManifestError, match="realtime FX rates must be a mapping"):
        canonical_fx_inputs_projection(
            _fx_history(),
            required_currencies=["USD"],
            realtime_fx_rates_by_currency=[],
            include_realtime=True,
        )

    realtime = {"usd": 33.0, " USD ": 34.0}
    with pytest.raises(CalculationManifestError, match="duplicate normalized currencies"):
        canonical_fx_inputs_projection(
            _fx_history(),
            required_currencies=["USD"],
            realtime_fx_rates_by_currency=realtime,
            include_realtime=True,
        )

    with pytest.raises(CalculationManifestError, match="realtime FX rate must be positive"):
        canonical_fx_inputs_projection(
            _fx_history(),
            required_currencies=["USD"],
            realtime_fx_rates_by_currency={"USD": 0.0},
            include_realtime=True,
        )


@pytest.mark.parametrize(
    ("index", "message"),
    [
        (["not-a-date"], "invalid date"),
        ([pd.Timestamp("2026-01-01", tz="UTC")], "timezone-naive"),
        ([pd.Timestamp("2026-01-01 12:00:00")], "dates only"),
        ([pd.Timestamp("2026-01-01"), pd.Timestamp("2026-01-01")], "duplicate dates"),
    ],
)
def test_fx_projection_rejects_ambiguous_history_indices(index, message):
    series = pd.Series([32.0] * len(index), index=index)
    with pytest.raises(CalculationManifestError, match=message):
        canonical_fx_inputs_projection({"USD": series}, required_currencies=["USD"])


@pytest.mark.parametrize("rate", [0.0, -1.0, float("nan"), float("inf"), True])
def test_fx_projection_rejects_invalid_historical_rates(rate):
    history = _fx_history()
    history["USD"] = history["USD"].astype(object)
    history["USD"].iloc[0] = rate
    with pytest.raises(CalculationManifestError, match="FX rate must be"):
        canonical_fx_inputs_projection(history, required_currencies=["USD"])


def test_fx_identity_model_rejects_bad_digest():
    with pytest.raises(ValidationError, match="FX input digest"):
        EffectiveFxInputsIdentity(
            sha256="z" * 64,
            currency_count=1,
            historical_row_count=0,
            includes_realtime=False,
            realtime_currency_count=0,
        )


def test_provider_diagnostics_are_normalized_and_not_part_of_market_digest():
    market_identity = build_market_inputs_identity(_market_data(), required_symbols=["AAA"])
    first = build_provider_provenance_diagnostics(
        metadata_by_symbol={
            "aaa": {
                "price_source": "Close",
                "selection_reason": "Scheme A",
            }
        },
        realtime_overlay_symbols=["aaa"],
    )
    second = build_provider_provenance_diagnostics(
        metadata_by_symbol={
            "AAA": {
                "price_source": "Realtime",
                "selection_reason": "different provider metadata",
            }
        },
        realtime_overlay_symbols=[],
    )

    assert first.price_sources == {"AAA": "Close"}
    assert first.selection_reasons == {"AAA": "Scheme A"}
    assert first.realtime_overlay_symbols == ("AAA",)
    assert first != second
    assert build_market_inputs_identity(_market_data(), required_symbols=["AAA"]) == market_identity


def test_provider_diagnostics_accept_overlay_generator_once():
    overlays = (symbol for symbol in ["bbb", "aaa"])
    diagnostics = build_provider_provenance_diagnostics(realtime_overlay_symbols=overlays)

    assert diagnostics.realtime_overlay_symbols == ("AAA", "BBB")


@pytest.mark.parametrize(
    ("metadata", "message"),
    [
        ([], "provider metadata must be a mapping"),
        ({"AAA": []}, "provider metadata must be a mapping"),
        ({"AAA": {"price_source": "Close"}}, "requires price_source and selection_reason"),
    ],
)
def test_provider_diagnostics_reject_invalid_metadata(metadata, message):
    with pytest.raises(CalculationManifestError, match=message):
        build_provider_provenance_diagnostics(metadata_by_symbol=metadata)


def test_provider_diagnostics_reject_duplicate_normalized_symbols():
    metadata = {
        "aaa": {"price_source": "Close", "selection_reason": "A"},
        " AAA ": {"price_source": "Close", "selection_reason": "B"},
    }
    with pytest.raises(CalculationManifestError, match="duplicate normalized symbols"):
        build_provider_provenance_diagnostics(metadata_by_symbol=metadata)


def test_provider_diagnostics_model_forbids_extra_fields_and_version_changes():
    valid = build_provider_provenance_diagnostics()
    payload = valid.model_dump()
    payload["unexpected"] = True
    with pytest.raises(ValidationError):
        ProviderProvenanceDiagnostics.model_validate(payload)

    payload = valid.model_dump()
    payload["diagnostics_version"] = 2
    with pytest.raises(ValidationError):
        ProviderProvenanceDiagnostics.model_validate(payload)
