from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.market_data import MarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _history(*, final_close, dividend=0.0):
    index = pd.to_datetime(["2026-08-10", "2026-08-11"])
    return pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, 102.0],
            "Low": [98.0, 99.5],
            "Close": [100.0, final_close],
            "Adj Close": [100.0, final_close],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, dividend],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=index,
    )


class FakeTicker:
    def __init__(self, daily_frame):
        self.daily_frame = daily_frame

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return self.daily_frame.copy(deep=True)


class ExplodingTicker:
    def history(self, **kwargs):
        raise RuntimeError("simulated provider re-fetch failure")


def test_transient_nan_selected_price_is_fresh_refetched_without_imputation():
    client = MarketDataClient()
    invalid = _history(final_close=float("nan"), dividend=0.25)
    recovered = _history(final_close=101.25, dividend=0.25)
    spy = _history(final_close=500.0)

    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol == "AAA":
            frames = [invalid, recovered]
            return FakeTicker(frames[min(call_index, len(frames) - 1)])
        return FakeTicker(spy)

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    aaa = market_data["AAA"]
    recovered_row = aaa.loc[pd.Timestamp("2026-08-11")]

    assert calls["AAA"] == 2
    assert calls["SPY"] == 1
    sleep.assert_called_once()
    assert recovered_row["Close_Adjusted"] == 101.25
    assert recovered_row["Close_Raw"] == 101.25
    assert recovered_row["Dividends"] == 0.25
    assert recovered_row["Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", aaa) is True


def test_persistent_nan_selected_price_remains_fail_closed_after_bounded_refetch():
    client = MarketDataClient()
    invalid = _history(final_close=float("nan"), dividend=0.25)
    spy = _history(final_close=500.0)

    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return FakeTicker(invalid if symbol == "AAA" else spy)

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    aaa = market_data["AAA"]

    assert calls["AAA"] == 2
    assert calls["SPY"] == 1
    sleep.assert_called_once()
    assert aaa["Close_Adjusted"].isna().sum() == 1
    assert pd.isna(aaa.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"])
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Dividends"] == 0.25
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", aaa) is False


def test_empty_refetch_preserves_first_invalid_response_for_fail_closed_validation():
    client = MarketDataClient()
    invalid = _history(final_close=float("nan"), dividend=0.25)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol == "AAA":
            return FakeTicker(invalid if call_index == 0 else pd.DataFrame())
        return FakeTicker(spy)

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    aaa = market_data["AAA"]
    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert aaa["Close_Adjusted"].isna().sum() == 1
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Dividends"] == 0.25
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", aaa) is False


def test_exception_refetch_preserves_first_invalid_response_for_fail_closed_validation():
    client = MarketDataClient()
    invalid = _history(final_close=float("nan"), dividend=0.25)
    spy = _history(final_close=500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol == "AAA":
            return FakeTicker(invalid) if call_index == 0 else ExplodingTicker()
        return FakeTicker(spy)

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    aaa = market_data["AAA"]
    assert calls["AAA"] == 2
    sleep.assert_called_once()
    assert aaa["Close_Adjusted"].isna().sum() == 1
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Dividends"] == 0.25
    assert aaa.loc[pd.Timestamp("2026-08-11"), "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", aaa) is False
