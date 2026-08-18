"""Fresh same-provider intraday observations for semantic market-data recovery.

This module owns the transport/freshness contract only. It does not decide whether a
price is financially valid and it never mutates daily/accounting data.

``yfinance==1.5.2`` routes sufficiently old historical ``Ticker.history`` requests
through an LRU-backed ``YfData.cache_get`` path. Repeating an identical request can
therefore replay cached bytes rather than establish an independent provider observation.
Each bounded observation here explicitly clears that HTTP-response LRU first.

An observation is a context manager so semantic validation can fetch one granularity at
a time and fail fast. If 1h evidence is already structurally invalid, 15m is never
requested. A class-level lock spans cache-clear plus all requested granularities so one
recovery session cannot invalidate another session's freshness boundary.

If the pinned yfinance cache contract changes, freshness fails closed.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any, Iterator

import pandas as pd
from yfinance.data import YfData

INTRADAY_EVIDENCE_INTERVALS = ("1h", "15m")
_INTRADAY_REQUEST_TIMEOUT_SECONDS = 10.0


class YahooIntradayEvidenceError(RuntimeError):
    """Raised when a fresh raw Yahoo observation cannot be established."""


class _YahooIntradayObservation:
    def __init__(self, session: "YahooIntradayEvidenceSession", event_date: pd.Timestamp) -> None:
        self._session = session
        self._start = pd.Timestamp(event_date)
        self._end = self._start + pd.Timedelta(days=1)

    def fetch(self, interval: str) -> pd.DataFrame:
        if interval not in self._session.intervals:
            raise YahooIntradayEvidenceError(f"unsupported intraday evidence interval={interval}")
        ticker = self._session._ticker_for(interval)
        try:
            return ticker.history(
                start=self._start,
                end=self._end,
                interval=interval,
                auto_adjust=False,
                actions=False,
                prepost=False,
                repair=False,
                keepna=True,
                timeout=_INTRADAY_REQUEST_TIMEOUT_SECONDS,
            )
        except Exception as exc:
            raise YahooIntradayEvidenceError(
                f"Yahoo intraday observation failed for {self._session.symbol} interval={interval}"
            ) from exc


class YahooIntradayEvidenceSession:
    """Bounded, cache-cleared Yahoo observations for one symbol."""

    _fresh_observation_lock = threading.Lock()

    def __init__(
        self,
        symbol: str,
        *,
        ticker_factory: Callable[[str], Any],
        intervals: tuple[str, ...] = INTRADAY_EVIDENCE_INTERVALS,
    ) -> None:
        if not symbol:
            raise ValueError("symbol is required")
        if not intervals:
            raise ValueError("at least one intraday interval is required")
        self.symbol = str(symbol)
        self.intervals = tuple(intervals)
        self._ticker_factory = ticker_factory
        self._tickers: dict[str, Any] = {}

    def _ticker_for(self, interval: str) -> Any:
        ticker = self._tickers.get(interval)
        if ticker is None:
            ticker = self._ticker_factory(self.symbol)
            self._tickers[interval] = ticker
        return ticker

    @staticmethod
    def _clear_yfinance_history_response_cache() -> None:
        try:
            cache_get = YfData().cache_get
            cache_clear = cache_get.cache_clear
        except Exception as exc:
            raise YahooIntradayEvidenceError(
                "yfinance historical response cache cannot be cleared safely"
            ) from exc
        if not callable(cache_clear):
            raise YahooIntradayEvidenceError(
                "yfinance historical response cache exposes no callable cache_clear"
            )
        cache_clear()

    @contextmanager
    def observation(self, event_date: pd.Timestamp) -> Iterator[_YahooIntradayObservation]:
        """Open one cache-cleared freshness boundary with lazy per-interval fetching."""

        with self._fresh_observation_lock:
            self._clear_yfinance_history_response_cache()
            yield _YahooIntradayObservation(self, event_date)
