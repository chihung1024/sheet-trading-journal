"""Generic invariants for ordered multi-granularity semantic evidence quorum recovery."""

from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _partial_daily_frame():
    return pd.DataFrame(
        {
            "Open": [100.0, 101.0],
            "High": [102.0, 103.0],
            "Low": [99.0, 100.0],
            "Close": [101.0, float("nan")],
            "Adj Close": [101.0, float("nan")],
            "Close_Adjusted": [101.0, float("nan")],
            "Close_Raw": [101.0, float("nan")],
            "Volume": [1000.0, 1200.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
            "Split_Factor": [1.0, 1.0],
            "Dividend_Adj_Factor": [1.0, 1.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def _intraday(*, close=102.25, open_price=101.0):
    return pd.DataFrame(
        {
            "Open": [open_price, 102.0],
            "High": [103.0, 103.5],
            "Low": [99.0, 101.0],
            "Close": [102.0, close],
            "Adj Close": [102.0, close],
            "Volume": [600.0, 600.0],
        },
        index=pd.DatetimeIndex(
            ["2026-08-11 09:30:00", "2026-08-11 10:30:00"],
            tz="America/New_York",
        ),
    )


class _Ticker:
    def __init__(self, frame):
        self.frame = frame
        self.calls = []

    def history(self, **kwargs):
        self.calls.append(dict(kwargs))
        return self.frame.copy(deep=True)


def _recover(*evidence_frames):
    client = SemanticMarketDataClient()
    frame = _partial_daily_frame()
    tickers = [_Ticker(item) for item in evidence_frames]
    clients = iter(tickers)
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=lambda _symbol: next(clients),
    ) as ticker:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    return recovered, dates, ticker, tickers


def test_quorum_stops_after_first_two_consistent_representations():
    stable = _intraday()
    recovered, dates, ticker, tickers = _recover(stable, stable)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 2
    assert [len(item.calls) for item in tickers] == [1, 1]
    assert [item.calls[0]["interval"] for item in tickers] == ["1h", "15m"]
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_quorum_can_form_after_one_valid_representation_disagrees():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    third = _intraday(open_price=101.0)
    recovered, dates, ticker, tickers = _recover(first, second, third)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 3
    assert [item.calls[0]["interval"] for item in tickers] == ["1h", "15m", "5m"]
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Open"] == 101.0
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_quorum_can_form_when_earlier_representation_is_invalid():
    invalid = pd.DataFrame()
    stable = _intraday(open_price=100.5)
    recovered, dates, ticker, tickers = _recover(invalid, stable, stable)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 3
    assert [item.calls[0]["interval"] for item in tickers] == ["1h", "15m", "5m"]
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Open"] == 100.5
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_three_distinct_valid_representations_remain_fail_closed():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    third = _intraday(open_price=100.0)
    recovered, dates, ticker, _tickers = _recover(first, second, third)

    assert dates == ()
    assert ticker.call_count == 3
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False


def test_quorum_fails_closed_when_only_one_valid_representation_exists():
    valid = _intraday(open_price=101.0)
    invalid = pd.DataFrame()
    recovered, dates, ticker, _tickers = _recover(valid, invalid, invalid)

    assert dates == ()
    assert ticker.call_count == 3
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False
