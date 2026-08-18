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
