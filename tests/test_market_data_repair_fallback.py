from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _malformed_history(*, impossible_ohlc=False, dividend=0.0):
    final_high = 99.75 if impossible_ohlc else 102.0
    return pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, final_high],
            "Low": [98.0, 99.5],
            "Close": [100.0, float("nan")],
            "Adj Close": [100.0, float("nan")],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, dividend],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def _valid_history(final_close=101.0):
    return pd.DataFrame(
        {
            "Open": [99.0, 100.0],
            "High": [101.0, max(102.0, final_close)],
            "Low": [98.0, min(99.5, final_close)],
            "Close": [100.0, final_close],
            "Adj Close": [100.0, final_close],
            "Volume": [1000.0, 12345.0],
            "Dividends": [0.0, 0.0],
            "Stock Splits": [0.0, 0.0],
            "Capital Gains": [0.0, 0.0],
        },
        index=pd.to_datetime(["2026-08-10", "2026-08-11"]),
    )


def _intraday_history(final_close=101.75, *, opening=100.0):
    index = pd.DatetimeIndex(
        ["2026-08-11 09:30:00", "2026-08-11 10:30:00"],
        tz="America/New_York",
    )
    return pd.DataFrame(
        {
            "Open": [opening, 102.0],
            "High": [103.0, 103.0],
            "Low": [99.0, 101.0],
            "Close": [102.0, final_close],
            "Adj Close": [102.0, final_close],
            "Volume": [6000.0, 5000.0],
        },
        index=index,
    )


class StaticTicker:
    def __init__(self, frame):
        self.frame = frame

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return self.frame.copy(deep=True)


class IntradayRecoveryTicker:
    def __init__(self, malformed, intraday):
        self.malformed = malformed
        self.intraday = intraday

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        if kwargs.get("interval") == "1h":
            assert kwargs.get("auto_adjust") is False
            assert kwargs.get("actions") is False
            assert kwargs.get("prepost") is False
            assert kwargs.get("repair") is False
            assert kwargs.get("keepna") is True
            return self.intraday.copy(deep=True)
        return self.malformed.copy(deep=True)


def _download(client, ticker_factory):
    with patch.object(client, "_download_currency_fx", return_value=None), patch(
        "journal_engine.clients.market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch(
        "journal_engine.clients.semantic_market_data.yf.Ticker",
        side_effect=ticker_factory,
    ), patch("journal_engine.clients.market_data.time.sleep"):
        market_data, _ = client.download_data(["AAA"], pd.Timestamp("2026-05-02"))
    return market_data


def test_persistent_daily_nan_uses_two_identical_raw_intraday_observations():
    client = SemanticMarketDataClient()
    malformed = _malformed_history()
    intraday = _intraday_history()
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, intraday)
        return StaticTicker(spy)

    market_data = _download(client, ticker_factory)
    frame = market_data["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    # Two broad raw daily attempts must fail before two fresh raw 1h observations.
    assert calls["AAA"] == 4
    assert frame.loc[event_date, "Open"] == 100.0
    assert frame.loc[event_date, "High"] == 103.0
    assert frame.loc[event_date, "Low"] == 99.0
    assert frame.loc[event_date, "Close"] == 101.75
    assert frame.loc[event_date, "Close_Adjusted"] == 101.75
    # Daily volume remains authoritative; intraday volume is not promoted into it.
    assert frame.loc[event_date, "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", frame) is True
    assert (
        "two exact-date same-provider raw 1h regular-session observations"
        in client.price_metadata_by_symbol["AAA"]["selection_reason"]
    )


def test_intraday_recovery_reconstructs_structurally_impossible_daily_ohlc():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    intraday = _intraday_history()
    spy = _valid_history(500.0)

    def ticker_factory(symbol):
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, intraday)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    assert malformed.loc[event_date, "High"] < malformed.loc[event_date, "Open"]
    assert frame.loc[event_date, "High"] == 103.0
    assert frame.loc[event_date, "Low"] == 99.0
    assert frame.loc[event_date, "Close"] == 101.75
    assert PortfolioValidator.validate_price_data("AAA", frame) is True


def test_raw_intraday_observations_must_be_identical():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    intraday_first = _intraday_history(101.75)
    intraday_second = _intraday_history(101.80)
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        call_index = calls[symbol]
        calls[symbol] += 1
        if symbol != "AAA":
            return StaticTicker(spy)
        intraday = intraday_first if call_index == 2 else intraday_second
        return IntradayRecoveryTicker(malformed, intraday)

    frame = _download(client, ticker_factory)["AAA"]

    assert calls["AAA"] == 4
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_intraday_recovery_requires_original_daily_open_anchor():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    intraday = _intraday_history(opening=100.25)
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, intraday)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]

    assert calls["AAA"] == 3
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_intraday_recovery_never_overrides_nonzero_daily_actions():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True, dividend=0.25)
    intraday = _intraday_history()
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, intraday)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]

    # The price-only path must reject before any intraday request because daily
    # corporate-action evidence remains authoritative.
    assert calls["AAA"] == 2
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False
