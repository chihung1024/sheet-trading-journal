"""Fresh same-provider intraday observations for semantic market-data recovery.

This module owns the transport/freshness contract only. It does not decide whether a
price is financially valid and it never mutates daily/accounting data.

Why explicit cache control exists:
``yfinance==1.5.2`` routes historical ``Ticker.history`` requests through an LRU-backed
``YfData.cache_get`` path when the request end is sufficiently in the past. A repeated
call with identical arguments can therefore replay cached bytes instead of producing a
fresh provider observation. Semantic recovery needs independent observations, so each
bounded observation clears only yfinance's HTTP response LRU before fetching the two
raw regular-session granularities.

The cache operation is intentionally fail-closed. If the pinned yfinance cache contract
changes, recovery refuses to manufacture freshness from an unknown implementation.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any

import pandas as pd
from yfinance.data import YfData

INTRADAY_EVIDENCE_INTERVALS = ("1h", "15m")
_INTRADAY_REQUEST_TIMEOUT_SECONDS = 10.0


class YahooIntradayEvidenceError(RuntimeError):
    """Raised when a fresh raw Yahoo observation cannot be established."""


class YahooIntradayEvidenceSession:
    """Bounded, cache-cleared Yahoo observations for one symbol.

    Ticker objects are created once per interval and reused across observation rounds.
    Freshness comes from explicitly clearing yfinance's historical HTTP-response LRU,
    not from constructing new Ticker wrappers or changing market-data query semantics.
    A class-level lock prevents one recovery session from clearing the shared singleton
    cache while another session is in the middle of an observation.
    """

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
        self._tickers = {interval: ticker_factory(self.symbol) for interval in self.intervals}

    @staticmethod
    def _clear_yfinance_history_response_cache() -> None:
        try:
            cache_get = YfData().cache_get
            cache_clear = cache_get.cache_clear
        except Exception as exc:  # yfinance internal contract changed or unavailable
            raise YahooIntradayEvidenceError(
                "yfinance historical response cache cannot be cleared safely"
            ) from exc
        if not callable(cache_clear):
            raise YahooIntradayEvidenceError(
                "yfinance historical response cache exposes no callable cache_clear"
            )
        cache_clear()

    def observe(self, event_date: pd.Timestamp) -> dict[str, pd.DataFrame]:
        """Return one truly fresh raw observation for every configured granularity."""

        start = pd.Timestamp(event_date)
        end = start + pd.Timedelta(days=1)
        frames: dict[str, pd.DataFrame] = {}

        with self._fresh_observation_lock:
            self._clear_yfinance_history_response_cache()
            for interval in self.intervals:
                ticker = self._tickers[interval]
                try:
                    frames[interval] = ticker.history(
                        start=start,
                        end=end,
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
                        f"Yahoo intraday observation failed for {self.symbol} interval={interval}"
                    ) from exc

        return frames
