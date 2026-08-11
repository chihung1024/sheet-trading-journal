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
    def __init__(self, symbol, *, realtime_price=None, intraday_timestamp=None):
        self.symbol = symbol
        self.fast_info = {
            "last_price": realtime_price,
            "regular_market_price": None,
        }
        self.realtime_price = realtime_price
        self.intraday_timestamp = intraday_timestamp

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            if self.realtime_price is None or self.intraday_timestamp is None:
                return pd.DataFrame()
            return pd.DataFrame(
                {"Close": [self.realtime_price]},
                index=pd.DatetimeIndex([pd.Timestamp(self.intraday_timestamp)]),
            )
        return _history().copy(deep=True)


def test_prepare_data_keeps_selector_metadata_on_returned_frame():
    client = MarketDataClient()

    prepared = client._prepare_data("AAA", _history())

    assert prepared.attrs["price_provenance"] == {
        "price_source": "Close",
        "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
    }


def test_download_data_ignores_undated_fast_info_for_historical_rows():
    client = MarketDataClient()
    tickers = {
        "AAA": FakeTicker("AAA", realtime_price=12.5),
        "SPY": FakeTicker("SPY"),
    }

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    assert market_data["AAA"]["Close_Adjusted"].iloc[-1] == 11.0
    assert pd.Timestamp("2026-01-05") == market_data["AAA"].index[-1]
    assert client.realtime_overlay_symbols == set()


def test_download_data_appends_only_newer_dated_realtime_valuation_row():
    client = MarketDataClient()
    tickers = {
        "AAA": FakeTicker(
            "AAA",
            realtime_price=12.5,
            intraday_timestamp="2026-01-06 10:31:00-05:00",
        ),
        "SPY": FakeTicker("SPY"),
    }

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    aaa = market_data["AAA"]
    assert list(aaa.index) == list(
        pd.to_datetime(["2026-01-02", "2026-01-05", "2026-01-06"])
    )
    assert aaa.loc[pd.Timestamp("2026-01-05"), "Close_Adjusted"] == 11.0
    assert aaa.loc[pd.Timestamp("2026-01-06"), "Close_Adjusted"] == 12.5
    assert aaa.loc[pd.Timestamp("2026-01-05"), "Valuation_Source"] == "market"
    assert aaa.loc[pd.Timestamp("2026-01-06"), "Valuation_Source"] == "realtime_quote"
    assert aaa.loc[pd.Timestamp("2026-01-06"), "Valuation_Source_Date"] == "2026-01-06"
    assert aaa.loc[pd.Timestamp("2026-01-06"), "Dividends"] == 0.0
    assert aaa.loc[pd.Timestamp("2026-01-06"), "Stock Splits"] == 0.0
    assert client.realtime_overlay_symbols == {"AAA"}


def test_download_data_same_date_intraday_never_overwrites_daily_row():
    client = MarketDataClient()
    tickers = {
        "AAA": FakeTicker(
            "AAA",
            realtime_price=12.5,
            intraday_timestamp="2026-01-05 15:59:00-05:00",
        ),
        "SPY": FakeTicker("SPY"),
    }

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    aaa = market_data["AAA"]
    assert list(aaa.index) == list(pd.to_datetime(["2026-01-02", "2026-01-05"]))
    assert aaa.loc[pd.Timestamp("2026-01-05"), "Close_Adjusted"] == 11.0
    assert client.realtime_overlay_symbols == set()


def test_download_data_collects_selector_metadata_after_worker_threads_complete():
    client = MarketDataClient()
    tickers = {
        "AAA": FakeTicker(
            "AAA",
            realtime_price=12.5,
            intraday_timestamp="2026-01-06 10:31:00-05:00",
        ),
        "SPY": FakeTicker("SPY"),
    }

    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

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


def test_download_data_resets_provenance_sidecars_for_each_download():
    client = MarketDataClient()
    client.price_metadata_by_symbol = {"STALE": {"price_source": "Close", "selection_reason": "old"}}
    client.realtime_overlay_symbols = {"STALE"}

    tickers = {
        "AAA": FakeTicker("AAA"),
        "SPY": FakeTicker("SPY"),
    }
    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=lambda symbol: tickers[symbol],
    ):
        client.download_data(["AAA"], pd.Timestamp("2026-01-02"))

    assert "STALE" not in client.price_metadata_by_symbol
    assert "STALE" not in client.realtime_overlay_symbols
    assert client.realtime_overlay_symbols == set()
