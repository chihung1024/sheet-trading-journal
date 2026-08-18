from collections import defaultdict
from unittest.mock import patch

import pandas as pd

from journal_engine.clients.semantic_market_data import SemanticMarketDataClient
from journal_engine.core.validator import PortfolioValidator


def _malformed_history(*, impossible_ohlc=False, dividend=0.0, opening=100.0):
    final_high = 99.75 if impossible_ohlc else 102.0
    return pd.DataFrame(
        {
            "Open": [99.0, opening],
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


def _intraday_history(final_close=101.75, *, opening=100.0, include_empty_bucket=False):
    timestamps = ["2026-08-11 09:30:00", "2026-08-11 10:30:00"]
    rows = {
        "Open": [opening, 102.0],
        "High": [103.0, 103.0],
        "Low": [99.0, 101.0],
        "Close": [102.0, final_close],
        "Adj Close": [102.0, final_close],
        "Volume": [6000.0, 5000.0],
    }
    if include_empty_bucket:
        timestamps.insert(1, "2026-08-11 10:00:00")
        for column in ("Open", "High", "Low", "Close", "Adj Close"):
            rows[column].insert(1, float("nan"))
        # This mirrors the real Yahoo keepna representation observed for AIHY/PHOX:
        # a no-trade bucket has no price fields and explicit zero volume.
        rows["Volume"].insert(1, 0.0)
    return pd.DataFrame(
        rows,
        index=pd.DatetimeIndex(timestamps, tz="America/New_York"),
    )


class StaticTicker:
    def __init__(self, frame):
        self.frame = frame

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        return self.frame.copy(deep=True)


class IntradayRecoveryTicker:
    def __init__(self, malformed, one_hour, fifteen_minute=None):
        self.malformed = malformed
        self.one_hour = one_hour
        self.fifteen_minute = fifteen_minute if fifteen_minute is not None else one_hour

    def history(self, **kwargs):
        if kwargs.get("period") == "1d":
            return pd.DataFrame()
        interval = kwargs.get("interval")
        if interval in ("1h", "15m"):
            assert kwargs.get("auto_adjust") is False
            assert kwargs.get("actions") is False
            assert kwargs.get("prepost") is False
            assert kwargs.get("repair") is False
            assert kwargs.get("keepna") is True
            frame = self.one_hour if interval == "1h" else self.fifteen_minute
            return frame.copy(deep=True)
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


def test_persistent_daily_nan_uses_cross_granularity_intraday_consensus():
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

    frame = _download(client, ticker_factory)["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    # Two broad daily attempts fail first, then one 1h and one 15m observation.
    assert calls["AAA"] == 4
    assert frame.loc[event_date, "Open"] == 100.0
    assert frame.loc[event_date, "High"] == 103.0
    assert frame.loc[event_date, "Low"] == 99.0
    assert frame.loc[event_date, "Close"] == 101.75
    assert frame.loc[event_date, "Close_Adjusted"] == 101.75
    assert frame.loc[event_date, "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", frame) is True
    assert "multi-granularity quorum evidence" in client.price_metadata_by_symbol["AAA"]["selection_reason"]


def test_intraday_recovery_reconstructs_daily_ohlc_even_when_daily_ohlc_is_polluted():
    client = SemanticMarketDataClient()
    # The affected provider failure can corrupt the daily OHLC as well as Close.
    malformed = _malformed_history(impossible_ohlc=True, opening=250.0)
    intraday = _intraday_history(opening=100.0)
    spy = _valid_history(500.0)

    def ticker_factory(symbol):
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, intraday)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]
    event_date = pd.Timestamp("2026-08-11")

    assert frame.loc[event_date, "Open"] == 100.0
    assert frame.loc[event_date, "High"] == 103.0
    assert frame.loc[event_date, "Low"] == 99.0
    assert frame.loc[event_date, "Close"] == 101.75
    assert frame.loc[event_date, "Volume"] == 12345.0
    assert PortfolioValidator.validate_price_data("AAA", frame) is True


def test_cross_granularity_intraday_observations_must_agree():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    one_hour = _intraday_history(101.75)
    fifteen_minute = _intraday_history(101.80)
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol != "AAA":
            return StaticTicker(spy)
        return IntradayRecoveryTicker(malformed, one_hour, fifteen_minute)

    frame = _download(client, ticker_factory)["AAA"]

    assert calls["AAA"] == 5
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False


def test_intraday_recovery_ignores_fully_empty_zero_volume_keepna_buckets():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    sparse = _intraday_history(include_empty_bucket=True)
    spy = _valid_history(500.0)

    def ticker_factory(symbol):
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, sparse)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]

    assert frame.loc[pd.Timestamp("2026-08-11"), "Close_Adjusted"] == 101.75
    assert PortfolioValidator.validate_price_data("AAA", frame) is True


def test_intraday_recovery_rejects_price_empty_bucket_with_nonzero_volume():
    client = SemanticMarketDataClient()
    malformed = _malformed_history(impossible_ohlc=True)
    contradictory = _intraday_history(include_empty_bucket=True)
    empty_timestamp = pd.Timestamp("2026-08-11 10:00:00", tz="America/New_York")
    contradictory.loc[empty_timestamp, "Volume"] = 100.0
    spy = _valid_history(500.0)
    calls = defaultdict(int)

    def ticker_factory(symbol):
        calls[symbol] += 1
        if symbol == "AAA":
            return IntradayRecoveryTicker(malformed, contradictory)
        return StaticTicker(spy)

    frame = _download(client, ticker_factory)["AAA"]

    # A contradictory representation does not decide the whole recovery. The resolver
    # evaluates the next representation, then stops once a 2-vote quorum is mathematically
    # impossible; the final optional representation is not requested and the row remains
    # fail-closed.
    assert calls["AAA"] == 4
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

    assert calls["AAA"] == 2
    assert frame["Close_Adjusted"].isna().sum() == 1
    assert PortfolioValidator.validate_price_data("AAA", frame) is False
