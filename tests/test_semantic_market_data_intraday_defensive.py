from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient


def _values():
    return {
        "Open": 101.0,
        "High": 103.0,
        "Low": 100.0,
        "Close": 102.0,
        "Adj Close": 102.0,
    }


def _prepared_recovery_frame(*, volume=1200.0):
    return pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.0],
            "Close": [101.0, float("nan")],
            "Adj Close": [101.0, float("nan")],
            "Close_Adjusted": [101.0, float("nan")],
            "Volume": [1000.0, volume],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
            "Split_Factor": [1.0, 1.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def test_cross_granularity_agreement_requires_all_price_fields_and_tight_match():
    values = _values()
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, dict(values)) is True

    near = dict(values)
    near["Close"] += 1e-8
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, near) is True

    missing = dict(values)
    missing.pop("Close")
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, missing) is False

    changed = dict(values)
    changed["Close"] = 102.01
    assert SemanticMarketDataClient._intraday_price_candidates_agree(values, changed) is False


def test_intraday_recovery_rejects_invalid_daily_volume_before_provider_request():
    client = SemanticMarketDataClient()
    # Daily volume remains part of the authoritative daily evidence boundary even
    # when the price fields are reconstructed from independent intraday granularities.
    for volume in (-1.0, float("nan")):
        frame = _prepared_recovery_frame(volume=volume)
        with patch("journal_engine.clients.semantic_market_data.yf.Ticker") as ticker:
            recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
        assert recovered is frame
        assert dates == ()
        ticker.assert_not_called()


def test_intraday_candidate_rejects_partial_nonfinite_bar_before_aggregation():
    frame = pd.DataFrame(
        {
            "Open": [101.0, float("nan")],
            "High": [103.0, 103.0],
            "Low": [100.0, 101.0],
            "Close": [102.0, 102.0],
            "Adj Close": [102.0, 102.0],
        },
        index=pd.DatetimeIndex(
            ["2026-08-11 09:30:00", "2026-08-11 10:30:00"],
            tz="America/New_York",
        ),
    )
    assert SemanticMarketDataClient._complete_intraday_price_candidate(
        frame,
        pd.Timestamp("2026-08-11"),
    ) is None


def test_intraday_recovery_fails_closed_if_date_normalization_unexpectedly_fails():
    client = SemanticMarketDataClient()
    frame = pd.DataFrame(
        {"Close_Adjusted": [100.0, float("nan")]},
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )

    with patch.object(client, "_normalize_date", return_value=None), patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker"
    ) as ticker:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)

    assert recovered is frame
    assert dates == ()
    ticker.assert_not_called()


def test_dividend_asof_materializer_normalizes_timezone_aware_source_date():
    client = SemanticMarketDataClient()
    timezone = "America/New_York"
    event_date = pd.Timestamp("2026-08-11", tz=timezone)
    frame = pd.DataFrame(
        {"Close_Adjusted": [100.0, float("nan")]},
        index=pd.DatetimeIndex(
            [pd.Timestamp("2026-08-10", tz=timezone), event_date]
        ),
    )
    signature = ((event_date, 0.5, 0.0, 1.0),)

    with patch.object(
        SemanticMarketDataClient,
        "_dividend_action_only_signature",
        return_value=signature,
    ):
        materialized, applied = client._materialize_action_only_asof_valuations(
            frame,
            signature,
        )

    assert applied is True
    assert materialized.loc[event_date, "Close_Adjusted"] == 100.0
    assert materialized.loc[event_date, "Valuation_Source"] == "asof_carry_forward"
    assert materialized.loc[event_date, "Valuation_Source_Date"] == "2026-08-10"
