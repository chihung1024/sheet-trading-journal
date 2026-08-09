import pandas as pd
import pytest

from journal_engine.core.calculation_manifest import CalculationManifestError
from journal_engine.core.input_provenance import (
    build_provider_provenance_diagnostics,
    canonical_fx_inputs_projection,
    canonical_market_inputs_projection,
)


def _single_row_frame(*, valuation_source="market", valuation_source_date="2026-01-01"):
    return pd.DataFrame(
        {
            "Close_Adjusted": [10.0],
            "Dividends": [0.0],
            "Split_Factor": [1.0],
            "Valuation_Source": [valuation_source],
            "Valuation_Source_Date": [valuation_source_date],
        },
        index=pd.to_datetime(["2026-01-01"]),
    )


def _usd_history():
    return {
        "USD": pd.Series(
            [32.0],
            index=pd.to_datetime(["2026-01-01"]),
        )
    }


def test_market_projection_rejects_non_mapping_and_empty_market_mapping():
    with pytest.raises(CalculationManifestError, match="market_data must be a mapping"):
        canonical_market_inputs_projection([])

    with pytest.raises(CalculationManifestError, match="market symbol set must not be empty"):
        canonical_market_inputs_projection({})


@pytest.mark.parametrize("symbol", [None, "   "])
def test_market_projection_rejects_empty_symbol_names(symbol):
    with pytest.raises(CalculationManifestError, match="market symbol must be non-empty"):
        canonical_market_inputs_projection({symbol: _single_row_frame()})


def test_market_projection_rejects_non_scalar_valuation_source():
    frame = _single_row_frame(valuation_source=["market"])

    with pytest.raises(CalculationManifestError, match="valuation source must be a scalar value"):
        canonical_market_inputs_projection({"AAA": frame})


def test_market_projection_rejects_non_scalar_valuation_source_date():
    frame = _single_row_frame(valuation_source_date=["2026-01-01"])

    with pytest.raises(
        CalculationManifestError,
        match="valuation source date must be a scalar value",
    ):
        canonical_market_inputs_projection({"AAA": frame})


@pytest.mark.parametrize(
    ("source_date", "message"),
    [
        ("not-a-date", "valuation source date is invalid"),
        ("", "valuation source date is empty"),
        (pd.Timestamp("2026-01-01", tz="UTC"), "valuation source date must be timezone-naive"),
        (pd.Timestamp("2026-01-01 12:00:00"), "valuation source date must not contain time-of-day"),
    ],
)
def test_market_projection_rejects_invalid_valuation_source_dates(source_date, message):
    frame = _single_row_frame(valuation_source_date=source_date)

    with pytest.raises(CalculationManifestError, match=message):
        canonical_market_inputs_projection({"AAA": frame})


def test_market_projection_defaults_missing_market_source_date_to_row_date():
    frame = _single_row_frame(valuation_source_date=pd.NA)
    projection = canonical_market_inputs_projection({"AAA": frame})

    row = projection["symbols"][0]["rows"][0]
    assert row["valuation_source"] == "market"
    assert row["valuation_source_date"].isoformat() == "2026-01-01"


def test_market_projection_rejects_synthetic_source_without_source_date_column():
    frame = _single_row_frame(valuation_source="asof_carry_forward").drop(
        columns=["Valuation_Source_Date"]
    )

    with pytest.raises(
        CalculationManifestError,
        match="synthetic valuation source date is missing",
    ):
        canonical_market_inputs_projection({"AAA": frame})


def test_market_projection_rejects_non_numeric_effective_value():
    frame = _single_row_frame()
    frame["Close_Adjusted"] = ["not-a-number"]

    with pytest.raises(CalculationManifestError, match="Close_Adjusted must be numeric"):
        canonical_market_inputs_projection({"AAA": frame})


def test_fx_projection_rejects_empty_required_currency_set():
    with pytest.raises(CalculationManifestError, match="FX currency set must not be empty"):
        canonical_fx_inputs_projection(_usd_history(), required_currencies=[])


@pytest.mark.parametrize("field", ["price_source", "selection_reason"])
def test_provider_diagnostics_treats_pd_na_metadata_as_missing(field):
    metadata = {
        "AAA": {
            "price_source": "Close",
            "selection_reason": "Scheme A",
        }
    }
    metadata["AAA"][field] = pd.NA

    with pytest.raises(
        CalculationManifestError,
        match="requires price_source and selection_reason",
    ):
        build_provider_provenance_diagnostics(metadata_by_symbol=metadata)


@pytest.mark.parametrize("field", ["price_source", "selection_reason"])
def test_provider_diagnostics_rejects_non_scalar_metadata(field):
    metadata = {
        "AAA": {
            "price_source": "Close",
            "selection_reason": "Scheme A",
        }
    }
    metadata["AAA"][field] = [metadata["AAA"][field]]

    with pytest.raises(CalculationManifestError, match="must be a scalar value"):
        build_provider_provenance_diagnostics(metadata_by_symbol=metadata)
