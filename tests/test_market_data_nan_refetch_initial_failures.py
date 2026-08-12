from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.market_data import MarketDataClient


class EmptyTicker:
    def history(self, **kwargs):
        return pd.DataFrame()


class ExplodingTicker:
    def history(self, **kwargs):
        raise RuntimeError("simulated initial provider failure")


class CleanTicker:
    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return pd.DataFrame(
            {
                "Close": [500.0],
                "Adj Close": [500.0],
                "Dividends": [0.0],
                "Stock Splits": [0.0],
            },
            index=pd.to_datetime(["2026-08-11"]),
        )


def test_initial_empty_history_keeps_existing_no_data_behavior_without_retry():
    client = MarketDataClient()
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return EmptyTicker() if symbol == "AAA" else CleanTicker()

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    assert "AAA" not in market_data
    assert calls["AAA"] == 1
    assert calls["SPY"] == 1
    sleep.assert_not_called()


def test_initial_provider_exception_keeps_existing_no_data_behavior_without_retry():
    client = MarketDataClient()
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        return ExplodingTicker() if symbol == "AAA" else CleanTicker()

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep") as sleep:
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))

    assert "AAA" not in market_data
    assert calls["AAA"] == 1
    assert calls["SPY"] == 1
    sleep.assert_not_called()
