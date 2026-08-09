import pandas as pd
import pytest

from journal_engine.core.calculation_manifest import CalculationManifestError
from journal_engine.core.input_provenance import (
    build_provider_provenance_diagnostics,
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


def test_market_projection_rejects_empty_market_mapping():
    with pytest.raises(CalculationManifestError, match="market symbol set must not be empty"):
        canonical_market_inputs_projection({})


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
