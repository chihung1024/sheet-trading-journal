from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.market_data import MarketDataClient


def _history(close_values=(10.0, 11.0)):
    return pd.DataFrame(
        {
            "Close": list(close_values),
            "Adj Close": list(close_values),
            "Stock Splits": [0.0, 0.0],
            "Dividends": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-01-02", "2026-01-05"]),
    )


class FakeTicker:
    def __init__(self, symbol, *, realtime_price=None):
        self.symbol = symbol
        self.fast_info = {
            "last_price": realtime_price,
            "regular_market_price": None,
        }

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return _history().copy(deep=True)


def test_prepare_data_keeps_selector_metadata_on_returned_frame():
    client = MarketDataClient()

    prepared = client._prepare_data("AAA", _history())

    assert prepared.attrs["price_provenance"] == {
        "price_source": "Close",
        "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
    }


def test_download_data_collects_sidecars_after_worker_threads_complete():
    client = MarketDataClient()
    tickers = {
        "AAA": FakeTicker("AAA", realtime_price=12.5),
        "SPY": FakeTicker("SPY", realtime_price=None),
    }

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    assert set(market_data) >= {"AAA", "SPY"}
    assert client.price_metadata_by_symbol == {
        "AAA": {
            "price_source": "Close",
            "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
        },
        "SPY": {
            "price_source": "Close",
            "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
        },
    }
    assert client.realtime_overlay_symbols == {"AAA"}
    assert market_data["AAA"]["Close_Adjusted"].iloc[-1] == 12.5
    assert market_data["SPY"]["Close_Adjusted"].iloc[-1] == 11.0


def test_download_data_resets_provenance_sidecars_for_each_download():
    client = MarketDataClient()
    client.price_metadata_by_symbol = {"STALE": {"price_source": "Close", "selection_reason": "old"}}
    client.realtime_overlay_symbols = {"STALE"}

    tickers = {
        "AAA": FakeTicker("AAA", realtime_price=None),
        "SPY": FakeTicker("SPY", realtime_price=None),
    }
    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    assert "STALE" not in client.price_metadata_by_symbol
    assert "STALE" not in client.realtime_overlay_symbols
    assert client.realtime_overlay_symbols == set()
