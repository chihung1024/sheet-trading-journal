import pandas as pd
import pytest

from journal_engine.core.calculation_manifest import CalculationManifestError
from journal_engine.core.input_provenance import (
    build_market_inputs_identity,
    canonical_market_inputs_projection,
)


def _realtime_frame(source_date="2026-01-06"):
    return pd.DataFrame(
        {
            "Close_Adjusted": [11.0, 12.5],
            "Dividends": [0.0, 0.0],
            "Split_Factor": [1.0, 1.0],
            "Valuation_Source": ["market", "realtime_quote"],
            "Valuation_Source_Date": ["2026-01-05", source_date],
        },
        index=pd.to_datetime(["2026-01-05", "2026-01-06"]),
    )


def test_realtime_quote_is_hashed_as_explicit_synthetic_market_input():
    frame = _realtime_frame()

    projection = canonical_market_inputs_projection(
        {"AAA": frame},
        required_symbols=["AAA"],
    )
    identity = build_market_inputs_identity(
        {"AAA": frame},
        required_symbols=["AAA"],
    )

    realtime_row = projection["symbols"][0]["rows"][-1]
    assert realtime_row["date"].isoformat() == "2026-01-06"
    assert realtime_row["valuation_source"] == "realtime_quote"
    assert realtime_row["valuation_source_date"].isoformat() == "2026-01-06"
    assert realtime_row["close_adjusted"] == 12.5
    assert identity.synthetic_row_counts == {"realtime_quote": 1}


def test_realtime_quote_source_date_must_equal_synthetic_valuation_date():
    with pytest.raises(
        CalculationManifestError,
        match="realtime_quote valuation source date must equal row date",
    ):
        build_market_inputs_identity(
            {"AAA": _realtime_frame(source_date="2026-01-05")},
            required_symbols=["AAA"],
        )
