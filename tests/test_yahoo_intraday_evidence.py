from unittest.mock import Mock, patch

import pandas as pd
import pytest

from journal_engine.clients.yahoo_intraday_evidence import (
    YahooIntradayEvidenceError,
    YahooIntradayEvidenceSession,
)


class _Ticker:
    def __init__(self):
        self.calls = []

    def history(self, **kwargs):
        self.calls.append(dict(kwargs))
        return pd.DataFrame(
            {
                "Open": [100.0, 101.0],
                "High": [101.5, 102.0],
                "Low": [99.5, 100.5],
                "Close": [101.0, 101.5],
                "Adj Close": [101.0, 101.5],
                "Volume": [100.0, 120.0],
            },
            index=pd.DatetimeIndex(
                ["2026-08-17 09:30:00", "2026-08-17 10:30:00"],
                tz="America/New_York",
            ),
        )


class _CacheGet:
    def __init__(self):
        self.cache_clear = Mock()


class _Data:
    def __init__(self, cache_get):
        self.cache_get = cache_get


def test_each_observation_explicitly_clears_cache_and_reuses_lazy_tickers():
    tickers = [_Ticker(), _Ticker()]
    ticker_iter = iter(tickers)
    cache_get = _CacheGet()
    factory = Mock(side_effect=lambda _symbol: next(ticker_iter))

    with patch(
        "journal_engine.clients.yahoo_intraday_evidence.YfData",
        return_value=_Data(cache_get),
    ):
        session = YahooIntradayEvidenceSession("AAA", ticker_factory=factory)
        with session.observation(pd.Timestamp("2026-08-17")) as first:
            first.fetch("1h")
            first.fetch("15m")
        with session.observation(pd.Timestamp("2026-08-17")) as second:
            second.fetch("1h")
            second.fetch("15m")

    assert cache_get.cache_clear.call_count == 2
    assert factory.call_count == 2
    for ticker in tickers:
        assert len(ticker.calls) == 2
        for call in ticker.calls:
            assert call["auto_adjust"] is False
            assert call["actions"] is False
            assert call["prepost"] is False
            assert call["repair"] is False
            assert call["keepna"] is True
            assert call["timeout"] == 10.0


def test_lazy_fetch_does_not_construct_unrequested_second_granularity():
    ticker = _Ticker()
    cache_get = _CacheGet()
    factory = Mock(return_value=ticker)

    with patch(
        "journal_engine.clients.yahoo_intraday_evidence.YfData",
        return_value=_Data(cache_get),
    ):
        session = YahooIntradayEvidenceSession("AAA", ticker_factory=factory)
        with session.observation(pd.Timestamp("2026-08-17")) as observation:
            observation.fetch("1h")

    cache_get.cache_clear.assert_called_once_with()
    factory.assert_called_once_with("AAA")
    assert len(ticker.calls) == 1


def test_missing_yfinance_cache_clear_contract_fails_closed_before_provider_request():
    ticker = _Ticker()

    class _BrokenData:
        cache_get = object()

    with patch(
        "journal_engine.clients.yahoo_intraday_evidence.YfData",
        return_value=_BrokenData(),
    ):
        session = YahooIntradayEvidenceSession(
            "AAA",
            ticker_factory=lambda _symbol: ticker,
            intervals=("1h",),
        )
        with pytest.raises(YahooIntradayEvidenceError, match="cache"):
            with session.observation(pd.Timestamp("2026-08-17")):
                pass

    assert ticker.calls == []


def test_provider_failure_is_wrapped_as_evidence_error():
    class _ExplodingTicker:
        def history(self, **_kwargs):
            raise RuntimeError("provider unavailable")

    cache_get = _CacheGet()
    with patch(
        "journal_engine.clients.yahoo_intraday_evidence.YfData",
        return_value=_Data(cache_get),
    ):
        session = YahooIntradayEvidenceSession(
            "AAA",
            ticker_factory=lambda _symbol: _ExplodingTicker(),
            intervals=("1h",),
        )
        with pytest.raises(YahooIntradayEvidenceError, match="interval=1h"):
            with session.observation(pd.Timestamp("2026-08-17")) as observation:
                observation.fetch("1h")

    cache_get.cache_clear.assert_called_once_with()


def test_unsupported_interval_fails_closed_without_provider_request():
    ticker = _Ticker()
    cache_get = _CacheGet()

    with patch(
        "journal_engine.clients.yahoo_intraday_evidence.YfData",
        return_value=_Data(cache_get),
    ):
        session = YahooIntradayEvidenceSession(
            "AAA",
            ticker_factory=lambda _symbol: ticker,
            intervals=("1h",),
        )
        with session.observation(pd.Timestamp("2026-08-17")) as observation:
            with pytest.raises(YahooIntradayEvidenceError, match="unsupported"):
                observation.fetch("15m")

    assert ticker.calls == []
