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


def _intraday(close):
    return pd.DataFrame(
        {
            "Open": [101.0, 102.0],
            "High": [103.0, 103.5],
            "Low": [100.0, 101.0],
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
    def __init__(self, frames):
        self._frames = iter(frames)
        self.calls = []

    def history(self, **kwargs):
        self.calls.append(dict(kwargs))
        return next(self._frames).copy(deep=True)


def _recover(one_hour_frames, fifteen_minute_frames):
    client = SemanticMarketDataClient()
    frame = _partial_daily_frame()
    one_hour = _Ticker(one_hour_frames)
    fifteen_minute = _Ticker(fifteen_minute_frames)
    clients = iter((one_hour, fifteen_minute))
    with patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=lambda _symbol: next(clients),
    ) as ticker, patch("journal_engine.clients.semantic_market_data.time.sleep") as sleep:
        recovered, dates = client._recover_with_exact_date_intraday_evidence("AAA", frame)
    return recovered, dates, ticker, sleep, one_hour, fifteen_minute


def test_first_round_consensus_requires_no_reobservation():
    stable = _intraday(102.25)
    recovered, dates, ticker, sleep, one_hour, fifteen_minute = _recover([stable], [stable])

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 2
    assert len(one_hour.calls) == 1
    assert len(fifteen_minute.calls) == 1
    sleep.assert_not_called()
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.25
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_transient_disagreement_can_converge_after_one_fresh_reobservation():
    stale = _intraday(102.25)
    current = _intraday(102.50)
    recovered, dates, ticker, sleep, one_hour, fifteen_minute = _recover(
        [stale, current],
        [current, current],
    )

    assert dates == (pd.Timestamp("2026-08-11"),)
    assert ticker.call_count == 2
    assert len(one_hour.calls) == 2
    assert len(fifteen_minute.calls) == 2
    sleep.assert_called_once_with(1.0)
    assert recovered.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 102.50
    assert PortfolioValidator.validate_price_data("AAA", recovered) is True


def test_persistent_cross_granularity_disagreement_remains_fail_closed():
    first = _intraday(102.25)
    second = _intraday(102.50)
    recovered, dates, ticker, sleep, one_hour, fifteen_minute = _recover(
        [first, first],
        [second, second],
    )

    assert dates == ()
    assert ticker.call_count == 2
    assert len(one_hour.calls) == 2
    assert len(fifteen_minute.calls) == 2
    sleep.assert_called_once_with(1.0)
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False


def test_second_round_third_value_is_not_accepted_as_convergence():
    first = _intraday(102.25)
    second = _intraday(102.50)
    third = _intraday(102.75)
    recovered, dates, ticker, sleep, one_hour, fifteen_minute = _recover(
        [first, third],
        [second, third],
    )

    assert dates == ()
    assert ticker.call_count == 2
    assert len(one_hour.calls) == 2
    assert len(fifteen_minute.calls) == 2
    sleep.assert_called_once_with(1.0)
    assert recovered["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", recovered) is False
