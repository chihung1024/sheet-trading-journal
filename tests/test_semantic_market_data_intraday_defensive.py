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


def _original(**overrides):
    values = {
        "Open": 101.0,
        "High": 103.0,
        "Low": 100.0,
        "Close": float("nan"),
        "Adj Close": float("nan"),
        "Volume": 1200.0,
    }
    values.update(overrides)
    return pd.Series(values)


def test_intraday_anchor_rejects_absent_nonpositive_open_and_negative_volume():
    values = _values()
    assert SemanticMarketDataClient._intraday_candidate_matches_original(
        values, _original(Open=float("nan"))
    ) is False
    assert SemanticMarketDataClient._intraday_candidate_matches_original(
        values, _original(Open=0.0)
    ) is False
    assert SemanticMarketDataClient._intraday_candidate_matches_original(
        values, _original(Volume=-1.0)
    ) is False


def test_intraday_anchor_allows_missing_optional_price_anchors_but_checks_finite_close():
    values = _values()
    unanchored = _original(
        High=float("nan"),
        Low=float("nan"),
        Close=float("nan"),
        **{"Adj Close": float("nan")},
    )
    assert SemanticMarketDataClient._intraday_candidate_matches_original(values, unanchored) is True

    matching = _original(Close=102.0, **{"Adj Close": 102.0})
    assert SemanticMarketDataClient._intraday_candidate_matches_original(values, matching) is True

    missing_close = dict(values)
    missing_close.pop("Close")
    assert SemanticMarketDataClient._intraday_candidate_matches_original(
        missing_close, _original(Close=102.0)
    ) is False


def test_intraday_candidate_rejects_nonfinite_bar_value_before_aggregation():
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
        _original(),
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
        "_pure_action_only_signature",
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
