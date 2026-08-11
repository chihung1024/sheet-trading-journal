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


class IntradayFrameTicker:
    def __init__(self, frame):
        self.frame = frame

    def history(self, **kwargs):
        return self.frame.copy(deep=True)


def test_prepare_data_keeps_selector_metadata_on_returned_frame():
    client = MarketDataClient()

    prepared = client._prepare_data("AAA", _history())

    assert prepared.attrs["price_provenance"] == {
        "price_source": "Close",
        "selection_reason": "Scheme A: price-return valuation uses Close (split-adjusted)",
    }


def test_intraday_quote_requires_close_timestamp_and_positive_price():
    no_close = IntradayFrameTicker(
        pd.DataFrame(
            {"Open": [12.0]},
            index=pd.to_datetime(["2026-01-06 10:30:00"]),
        )
    )
    invalid_prices = IntradayFrameTicker(
        pd.DataFrame(
            {"Close": [float("nan"), 0.0, -1.0]},
            index=pd.to_datetime(
                [
                    "2026-01-06 10:30:00",
                    "2026-01-06 10:31:00",
                    "2026-01-06 10:32:00",
                ]
            ),
        )
    )
    missing_timestamp = IntradayFrameTicker(
        pd.DataFrame(
            {"Close": [12.0]},
            index=pd.DatetimeIndex([pd.NaT]),
        )
    )
    valid_naive = IntradayFrameTicker(
        pd.DataFrame(
            {"Close": [12.0, 12.5]},
            index=pd.to_datetime(
                ["2026-01-06 10:30:00", "2026-01-06 10:31:00"]
            ),
        )
    )

    assert MarketDataClient._get_intraday_quote_with_date(no_close) is None
    assert MarketDataClient._get_intraday_quote_with_date(invalid_prices) is None
    assert MarketDataClient._get_intraday_quote_with_date(missing_timestamp) is None
    price, timestamp = MarketDataClient._get_intraday_quote_with_date(valid_naive)
    assert price == 12.5
    assert timestamp == pd.Timestamp("2026-01-06 10:31:00")


def test_realtime_row_helper_fails_closed_for_missing_or_invalid_evidence():
    history = _history()

    unchanged, applied = MarketDataClient._append_realtime_valuation_row(
        pd.DataFrame(), 12.5, pd.Timestamp("2026-01-06")
    )
    assert unchanged.empty
    assert applied is False

    unchanged, applied = MarketDataClient._append_realtime_valuation_row(
        history, 0.0, pd.Timestamp("2026-01-06")
    )
    assert unchanged.equals(history)
    assert applied is False

    unchanged, applied = MarketDataClient._append_realtime_valuation_row(
        history, 12.5, pd.NaT
    )
    assert unchanged.equals(history)
    assert applied is False

    unchanged, applied = MarketDataClient._append_realtime_valuation_row(
        history, 12.5, pd.Timestamp("2026-01-04")
    )
    assert unchanged.equals(history)
    assert applied is False


def test_realtime_row_helper_preserves_existing_provenance_and_clears_optional_fields():
    # Production download_data normalizes daily history to a timezone-naive date
    # index before calling the helper. Keep that invariant here while proving that
    # an exchange-timezone quote timestamp is normalized safely.
    history = _history().assign(
        Open=[9.5, 10.5],
        High=[10.5, 11.5],
        Low=[9.0, 10.0],
        Volume=[100.0, 200.0],
        **{
            "Capital Gains": [0.0, 0.2],
            "Valuation_Source": ["market", "market"],
            "Valuation_Source_Date": ["2026-01-02", "2026-01-05"],
        },
    )

    result, applied = MarketDataClient._append_realtime_valuation_row(
        history,
        12.5,
        pd.Timestamp("2026-01-06 10:31:00", tz="America/New_York"),
    )

    assert applied is True
    synthetic = result.loc[pd.Timestamp("2026-01-06")]
    assert synthetic["Close"] == 12.5
    assert synthetic["Adj Close"] == 12.5
    assert synthetic["Open"] == 12.5
    assert synthetic["High"] == 12.5
    assert synthetic["Low"] == 12.5
    assert synthetic["Volume"] == 0.0
    assert synthetic["Dividends"] == 0.0
    assert synthetic["Stock Splits"] == 0.0
    assert synthetic["Capital Gains"] == 0.0
    assert synthetic["Valuation_Source"] == "realtime_quote"
    assert synthetic["Valuation_Source_Date"] == "2026-01-06"


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
