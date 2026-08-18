"""Regression coverage for composing independent row-level recovery authorities."""

from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _mixed_daily(*, dividend=1.25):
    return pd.DataFrame(
        {
            "Open": [99.0, float("nan"), 102.0],
            "High": [101.0, float("nan"), 104.0],
            "Low": [98.0, float("nan"), 101.0],
            "Close": [100.0, float("nan"), float("nan")],
            "Adj Close": [100.0, float("nan"), float("nan")],
            "Volume": [1000.0, 0.0, 5000.0],
            "Dividends": [0.0, dividend, 0.0],
            "Stock Splits": [0.0, 0.0, 0.0],
            "Capital Gains": [0.0, 0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11", "2026-08-12"]),
    )


def _spy_daily():
    return pd.DataFrame(
        {
            "Open": [500.0, 501.0],
            "High": [502.0, 503.0],
            "Low": [499.0, 500.0],
            "Close": [501.0, 502.0],
            "Adj Close": [501.0, 502.0],
            "Volume": [1000.0, 1000.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-11", "2026-08-12"]),
    )


def _intraday():
    return pd.DataFrame(
        {
            "Open": [102.0, 102.5],
            "High": [103.5, 104.0],
            "Low": [101.0, 102.0],
            "Close": [102.5, 103.0],
            "Adj Close": [102.5, 103.0],
            "Volume": [2500.0, 2500.0],
        },
        index=pd.DatetimeIndex(
            ["2026-08-12 09:30:00", "2026-08-12 10:30:00"],
            tz="America/New_York",
        ),
    )


class _Ticker:
    def __init__(self, daily, intraday=None):
        self.daily = daily
        self.intraday = intraday

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        if kwargs.get("interval") in ("1h", "15m", "5m"):
            return pd.DataFrame() if self.intraday is None else self.intraday.copy(deep=True)
        return self.daily.copy(deep=True)


def _download(first_daily, second_daily):
    client = SemanticMarketDataClient()
    calls = defaultdict(int)
    spy = _spy_daily()
    intraday = _intraday()

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol != "AAA":
            return _Ticker(spy)
        if call_index == 0:
            return _Ticker(first_daily)
        if call_index == 1:
            return _Ticker(second_daily)
        return _Ticker(second_daily, intraday)

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep"):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))
    return client, market_data["AAA"], calls


def test_mixed_dividend_event_and_zero_action_price_gap_recover_independently():
    client, frame, calls = _download(_mixed_daily(), _mixed_daily())
    action_date = pd.Timestamp("2026-08-11")
    price_date = pd.Timestamp("2026-08-12")

    assert calls["AAA"] == 4
    assert frame.loc[action_date, "Close_Adjusted"] == 100.0
    assert pd.isna(frame.loc[action_date, "Close"])
    assert pd.isna(frame.loc[action_date, "Close_Raw"])
    assert frame.loc[action_date, "Dividends"] == 1.25
    assert frame.loc[action_date, "Valuation_Source"] == "asof_carry_forward"
    assert frame.loc[action_date, "Valuation_Source_Date"] == "2026-08-10"
    assert frame.loc[price_date, "Close"] == 103.0
    assert frame.loc[price_date, "Close_Adjusted"] == 103.0
    assert frame.loc[price_date, "Dividends"] == 0.0
    assert client.get_dividend("AAA", action_date) == 1.25
    assert PortfolioValidator.validate_price_data("AAA", frame) is True


def test_mixed_recovery_does_not_normalize_unstable_dividend_evidence():
    _client, frame, _calls = _download(
        _mixed_daily(dividend=1.25),
        _mixed_daily(dividend=1.30),
    )
    action_date = pd.Timestamp("2026-08-11")
    price_date = pd.Timestamp("2026-08-12")

    assert pd.isna(frame.loc[action_date, "Close_Adjusted"])
    assert frame.loc[action_date, "Dividends"] == 1.30
    assert frame.loc[price_date, "Close_Adjusted"] == 103.0
    assert PortfolioValidator.validate_price_data("AAA", frame) is False
