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


def _recover(one_hour_frame, fifteen_minute_frame, five_minute_frame=None):
    client = SemanticMarketDataClient()
    frame = _partial_daily_frame()
    tickers = [_Ticker(one_hour_frame), _Ticker(fifteen_minute_frame)]
    if five_minute_frame is not None:
        tickers.append(_Ticker(five_minute_frame))
    clients = iter(tickers)
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=lambda _symbol: next(clients),
    ) as ticker:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    return recovered, dates, ticker, tickers


def test_primary_cross_granularity_consensus_needs_no_tiebreaker():
    stable = _intraday()
    recovered, dates, ticker, tickers = _recover(stable, stable)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 2
    assert [len(item.calls) for item in tickers] == [1, 1]
    assert [item.calls[0]["interval"] for item in tickers] == ["1h", "15m"]
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_5m_tiebreaker_can_confirm_first_primary_full_ohlc_candidate():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    tie_breaker = _intraday(open_price=101.0)
    recovered, dates, ticker, tickers = _recover(first, second, tie_breaker)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 3
    assert [item.calls[0]["interval"] for item in tickers] == ["1h", "15m", "5m"]
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Open"] == 101.0
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_5m_tiebreaker_can_confirm_second_primary_full_ohlc_candidate():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    tie_breaker = _intraday(open_price=100.5)
    recovered, dates, ticker, _tickers = _recover(first, second, tie_breaker)

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 3
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Open"] == 100.5
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_three_way_cross_granularity_disagreement_remains_fail_closed():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    third = _intraday(open_price=100.0)
    recovered, dates, ticker, _tickers = _recover(first, second, third)

    assert dates == ()
    assert ticker.call_count == 3
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False


def test_invalid_5m_tiebreaker_remains_fail_closed():
    first = _intraday(open_price=101.0)
    second = _intraday(open_price=100.5)
    invalid = pd.DataFrame()
    recovered, dates, ticker, _tickers = _recover(first, second, invalid)

    assert dates == ()
    assert ticker.call_count == 3
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False
