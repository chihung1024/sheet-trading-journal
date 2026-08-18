"""Semantic normalization and strict recovery for malformed provider daily rows.

The underlying :class:`MarketDataClient` intentionally fails closed when its selected
valuation field contains NaN. This adapter preserves that behavior for ambiguous or
malformed market data while allowing two evidence-based recovery paths:

1. A persistent invalid zero-action provider row may be reconstructed from two
   independent raw regular-session granularities (1h and 15m) from the same
   Yahoo/yfinance provider for the exact affected calendar date. Each granularity must
   contain multiple structurally valid price bars and both must reconstruct the same
   daily OHLC/adjusted-close observation. If the two representations transiently
   disagree, one bounded fresh cross-granularity re-observation is allowed. Freshness
   itself is owned by :class:`YahooIntradayEvidenceSession`, which explicitly bypasses
   yfinance's historical-response LRU without changing market query semantics. Each
   granularity is fetched and validated lazily inside the same freshness boundary, so
   invalid 1h evidence prevents an unnecessary 15m request. The second observation is
   accepted only when both fresh representations converge to a value already observed
   in the first round. Persistent disagreement remains fail-closed. Completely empty
   keepna buckets are ignored only when they carry no contradictory non-zero volume;
   partially populated or contradictory bars remain fail-closed. Only price fields are
   replaced; the original daily volume and corporate-action evidence stay authoritative.
2. If exact-date intraday recovery is unavailable, a proven pure positive
   cash-dividend-only row may use the existing explicit ``asof_carry_forward`` effective
   valuation contract.

Everything else remains fail-closed. There are no ticker/date exceptions, alternate
provider substitutions, guessed prices, unsupported capital-gain recovery, or relaxed
ledger/validator rules.
"""

from __future__ import annotations

import logging
import math
import threading
from typing import Any

import pandas as pd
import yfinance as yf

from .market_data import VALUATION_SOURCE_COLUMN, VALUATION_SOURCE_DATE_COLUMN, MarketDataClient
from .yahoo_intraday_evidence import (
    INTRADAY_EVIDENCE_INTERVALS,
    YahooIntradayEvidenceError,
    YahooIntradayEvidenceSession,
)

logger = logging.getLogger(__name__)
_RAW_PRICE_COLUMNS = ("Open", "High", "Low", "Close", "Adj Close")
_REQUIRED_ACTION_COLUMNS = ("Dividends", "Stock Splits")
_INTRADAY_TIEBREAKER_INTERVAL = "5m"
_MAX_NARROW_RECOVERY_ROWS = 5
_MIN_INTRADAY_BARS = 2
_PRICE_REL_TOL = 1e-7
_PRICE_ABS_TOL = 1e-7


class SemanticMarketDataClient(MarketDataClient):
    def __init__(self) -> None:
        super().__init__()
        self._semantic_attempt_lock = threading.Lock()
        self._invalid_attempt_evidence: dict[str, list[dict[str, Any]]] = {}

    @staticmethod
    def _finite_number(value: Any) -> float | None:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return None
        return numeric if math.isfinite(numeric) else None

    @staticmethod
    def _normalize_date(value: Any) -> pd.Timestamp | None:
        try:
            timestamp = pd.Timestamp(value)
        except (TypeError, ValueError):
            return None
        if pd.isna(timestamp):
            return None
        if timestamp.tzinfo is not None:
            timestamp = timestamp.tz_localize(None)
        return timestamp.normalize()

    @classmethod
    def _action_signature_from_row(cls, row: pd.Series):
        for column in _REQUIRED_ACTION_COLUMNS:
            if column not in row.index:
                return None
        dividend = cls._finite_number(row["Dividends"])
        split = cls._finite_number(row["Stock Splits"])
        if dividend is None or split is None:
            return None
        capital_gain = 0.0
        if "Capital Gains" in row.index and not pd.isna(row["Capital Gains"]):
            capital_gain = cls._finite_number(row["Capital Gains"])
            if capital_gain is None:
                return None
        return dividend, split, capital_gain

    @classmethod
    def _complete_intraday_price_candidate(
        cls,
        frame: pd.DataFrame,
        expected_date: pd.Timestamp,
    ):
        if frame is None or frame.empty:
            return None
        work = frame.copy(deep=True)
        index = pd.to_datetime(work.index, errors="coerce")
        if index.isna().any() or index.tz is None:
            return None
        work.index = index
        work = work.sort_index()
        if work.index.has_duplicates:
            return None

        expected_day = expected_date.date()
        day = work.loc[[timestamp.date() == expected_day for timestamp in work.index]]
        required_columns = ("Open", "High", "Low", "Close", "Adj Close")
        if any(column not in day.columns for column in required_columns):
            return None

        valid_bars: list[tuple[pd.Timestamp, dict[str, float]]] = []
        bar_signature = []
        for timestamp, row in day.iterrows():
            observed = {column: cls._finite_number(row[column]) for column in required_columns}
            present = tuple(value is not None for value in observed.values())
            if not any(present):
                empty_volume = (
                    cls._finite_number(row["Volume"]) if "Volume" in row.index else None
                )
                if empty_volume is not None and empty_volume != 0.0:
                    return None
                continue
            if not all(present):
                return None

            bar_values = {column: float(value) for column, value in observed.items()}
            if any(value <= 0.0 for value in bar_values.values()):
                return None
            if (
                bar_values["High"] < bar_values["Low"]
                or bar_values["High"] < max(bar_values["Open"], bar_values["Close"])
                or bar_values["Low"] > min(bar_values["Open"], bar_values["Close"])
            ):
                return None
            if not math.isclose(
                bar_values["Close"],
                bar_values["Adj Close"],
                rel_tol=_PRICE_REL_TOL,
                abs_tol=_PRICE_ABS_TOL,
            ):
                return None
            valid_bars.append((timestamp, bar_values))
            bar_signature.append(
                (
                    timestamp.isoformat(),
                    bar_values["Open"],
                    bar_values["High"],
                    bar_values["Low"],
                    bar_values["Close"],
                    bar_values["Adj Close"],
                )
            )

        if len(valid_bars) < _MIN_INTRADAY_BARS:
            return None

        values = {
            "Open": valid_bars[0][1]["Open"],
            "High": max(bar[1]["High"] for bar in valid_bars),
            "Low": min(bar[1]["Low"] for bar in valid_bars),
            "Close": valid_bars[-1][1]["Close"],
            "Adj Close": valid_bars[-1][1]["Adj Close"],
        }
        return values, tuple(bar_signature)

    @staticmethod
    def _intraday_price_candidates_agree(
        first: dict[str, float],
        second: dict[str, float],
    ) -> bool:
        required_columns = ("Open", "High", "Low", "Close", "Adj Close")
        if any(column not in first or column not in second for column in required_columns):
            return False
        return all(
            math.isclose(
                first[column],
                second[column],
                rel_tol=_PRICE_REL_TOL,
                abs_tol=_PRICE_ABS_TOL,
            )
            for column in required_columns
        )


    @classmethod
    def _dividend_action_only_signature(cls, frame: pd.DataFrame):
        """Return independently eligible dividend-only invalid rows.

        Other malformed rows are ignored by this classifier so they cannot suppress
        stable corporate-action evidence from a different date. Unsupported rows are
        never normalized here and remain visible to the final fail-closed validator.
        """
        if frame is None or frame.empty or "Close_Adjusted" not in frame.columns:
            return None
        selected = pd.to_numeric(frame["Close_Adjusted"], errors="coerce")
        invalid = frame.loc[selected.isna()]
        if invalid.empty:
            return ()
        required = _RAW_PRICE_COLUMNS + ("Volume",) + _REQUIRED_ACTION_COLUMNS + ("Split_Factor",)
        if any(column not in frame.columns for column in required):
            return None
        signature = []
        for raw_date, row in invalid.iterrows():
            if any(not pd.isna(row[column]) for column in _RAW_PRICE_COLUMNS):
                continue
            volume = row["Volume"]
            if not pd.isna(volume):
                numeric_volume = cls._finite_number(volume)
                if numeric_volume is None or numeric_volume != 0.0:
                    continue
            dividend = cls._finite_number(row["Dividends"])
            split = cls._finite_number(row["Stock Splits"])
            split_factor = cls._finite_number(row["Split_Factor"])
            if dividend is None or dividend <= 0.0:
                continue
            if split is None or split != 0.0:
                continue
            if split_factor is None or split_factor <= 0.0:
                continue
            capital_gain = 0.0
            if "Capital Gains" in frame.columns and not pd.isna(row["Capital Gains"]):
                capital_gain = cls._finite_number(row["Capital Gains"])
                if capital_gain is None:
                    continue
            if capital_gain != 0.0:
                continue
            event_date = cls._normalize_date(raw_date)
            if event_date is None:
                return None
            signature.append((event_date, dividend, split, split_factor))
        return tuple(signature)

    def _prepare_data(self, symbol, df):
        prepared = super()._prepare_data(symbol, df)
        if self._selected_price_contains_nan(prepared):
            metadata = dict(prepared.attrs.get("price_provenance") or {})
            evidence = {
                "signature": self._dividend_action_only_signature(prepared),
                "price_source": metadata.get("price_source"),
            }
            with self._semantic_attempt_lock:
                self._invalid_attempt_evidence.setdefault(str(symbol), []).append(evidence)
        return prepared

    def _recover_with_exact_date_intraday_evidence(
        self,
        symbol: str,
        frame: pd.DataFrame,
    ) -> tuple[pd.DataFrame, tuple[pd.Timestamp, ...]]:
        if frame is None or frame.empty or "Close_Adjusted" not in frame.columns:
            return frame, ()
        selected = pd.to_numeric(frame["Close_Adjusted"], errors="coerce")
        invalid_index = list(frame.index[selected.isna()])
        if not invalid_index:
            return frame, ()
        if len(invalid_index) > _MAX_NARROW_RECOVERY_ROWS:
            logger.warning(
                "[%s] exact-date intraday recovery skipped: invalid row count %s exceeds bound %s",
                symbol,
                len(invalid_index),
                _MAX_NARROW_RECOVERY_ROWS,
            )
            return frame, ()

        normalized_frame = frame.copy(deep=True)
        normalized_index = pd.to_datetime(normalized_frame.index, errors="coerce")
        if normalized_index.isna().any():
            return frame, ()
        if normalized_index.tz is not None:
            normalized_index = normalized_index.tz_localize(None)
        normalized_frame.index = normalized_index.normalize()

        invalid_dates = []
        for raw_date in invalid_index:
            event_date = self._normalize_date(raw_date)
            if event_date is None:
                return frame, ()
            if event_date not in invalid_dates:
                invalid_dates.append(event_date)

        staged: dict[pd.Timestamp, dict[str, float]] = {}
        for event_date in invalid_dates:
            original_rows = normalized_frame.loc[normalized_frame.index == event_date]
            if len(original_rows) != 1:
                return frame, ()
            original_row = original_rows.iloc[0]
            original_actions = self._action_signature_from_row(original_row)
            if original_actions is None or original_actions != (0.0, 0.0, 0.0):
                continue
            original_volume = self._finite_number(original_row.get("Volume"))
            if original_volume is None or original_volume < 0.0:
                return frame, ()

            try:
                evidence_session = YahooIntradayEvidenceSession(
                    str(symbol),
                    ticker_factory=yf.Ticker,
                    intervals=INTRADAY_EVIDENCE_INTERVALS + (_INTRADAY_TIEBREAKER_INTERVAL,),
                )
            except Exception as exc:
                logger.warning(
                    "[%s] exact-date Yahoo intraday evidence session could not be created for %s: %s",
                    symbol,
                    event_date.strftime("%Y-%m-%d"),
                    exc,
                )
                return frame, ()


            consensus: dict[str, float] | None = None
            try:
                with evidence_session.observation(event_date) as observation:
                    candidates: dict[str, dict[str, float]] = {}
                    for interval in INTRADAY_EVIDENCE_INTERVALS:
                        intraday = observation.fetch(interval)
                        candidate = self._complete_intraday_price_candidate(intraday, event_date)
                        if candidate is None:
                            logger.warning(
                                "[%s] exact-date raw intraday evidence invalid for %s interval=%s; fail closed",
                                symbol,
                                event_date.strftime("%Y-%m-%d"),
                                interval,
                            )
                            return frame, ()
                        candidates[interval] = candidate[0]

                    first_interval, second_interval = INTRADAY_EVIDENCE_INTERVALS
                    first = candidates[first_interval]
                    second = candidates[second_interval]
                    if self._intraday_price_candidates_agree(first, second):
                        consensus = first
                    else:
                        logger.warning(
                            "[%s] exact-date raw intraday primary granularities disagree for %s; requesting %s tie-breaker",
                            symbol,
                            event_date.strftime("%Y-%m-%d"),
                            _INTRADAY_TIEBREAKER_INTERVAL,
                        )
                        intraday = observation.fetch(_INTRADAY_TIEBREAKER_INTERVAL)
                        candidate = self._complete_intraday_price_candidate(intraday, event_date)
                        if candidate is None:
                            logger.warning(
                                "[%s] exact-date raw intraday tie-breaker invalid for %s; fail closed",
                                symbol,
                                event_date.strftime("%Y-%m-%d"),
                            )
                            return frame, ()
                        tie_breaker = candidate[0]
                        matches_first = self._intraday_price_candidates_agree(tie_breaker, first)
                        matches_second = self._intraday_price_candidates_agree(tie_breaker, second)
                        if matches_first == matches_second:
                            logger.warning(
                                "[%s] exact-date raw intraday evidence has no unique 2-of-3 consensus for %s; fail closed",
                                symbol,
                                event_date.strftime("%Y-%m-%d"),
                            )
                            return frame, ()
                        consensus = first if matches_first else second
                        logger.warning(
                            "[%s] exact-date raw intraday disagreement resolved by %s 2-of-3 consensus for %s",
                            symbol,
                            _INTRADAY_TIEBREAKER_INTERVAL,
                            event_date.strftime("%Y-%m-%d"),
                        )
            except YahooIntradayEvidenceError as exc:
                logger.warning(
                    "[%s] exact-date fresh Yahoo intraday observation failed for %s: %s",
                    symbol,
                    event_date.strftime("%Y-%m-%d"),
                    exc,
                )
                return frame, ()

            if consensus is None:
                return frame, ()
            staged[event_date] = consensus

        if not staged:
            return frame, ()

        work = normalized_frame.copy(deep=True)
        for event_date, values in staged.items():
            for column, value in values.items():
                work.at[event_date, column] = value
            if VALUATION_SOURCE_COLUMN in work.columns:
                work.at[event_date, VALUATION_SOURCE_COLUMN] = "market"
            if VALUATION_SOURCE_DATE_COLUMN in work.columns:
                work.at[event_date, VALUATION_SOURCE_DATE_COLUMN] = event_date.strftime("%Y-%m-%d")


        rebuilt = super()._prepare_data(symbol, work)
        rebuilt_selected = pd.to_numeric(rebuilt["Close_Adjusted"], errors="coerce")
        for event_date in staged:
            if event_date not in rebuilt_selected.index:
                return frame, ()
            rebuilt_value = rebuilt_selected.loc[event_date]
            if isinstance(rebuilt_value, pd.Series):
                return frame, ()
            numeric_value = self._finite_number(rebuilt_value)
            if numeric_value is None or numeric_value <= 0.0:
                return frame, ()
        metadata = dict(rebuilt.attrs.get("price_provenance") or {})
        reason = str(metadata.get("selection_reason") or "").strip()
        metadata["selection_reason"] = (
            f"{reason}; persistent invalid daily row recovered by cross-validated exact-date "
            "same-provider raw 1h/15m regular-session observations with 5m tie-breaker when required"
        ).strip("; ")
        rebuilt.attrs["price_provenance"] = metadata
        return rebuilt, tuple(sorted(staged))

    @classmethod
    def _materialize_action_only_asof_valuations(
        cls,
        frame: pd.DataFrame,
        signature,
    ) -> tuple[pd.DataFrame, bool]:
        current_signature = cls._dividend_action_only_signature(frame)
        if not signature or current_signature != signature:
            return frame, False
        work = frame.copy(deep=True)
        original_attrs = dict(frame.attrs)
        if VALUATION_SOURCE_COLUMN not in work.columns:
            work[VALUATION_SOURCE_COLUMN] = "market"
        if VALUATION_SOURCE_DATE_COLUMN not in work.columns:
            work[VALUATION_SOURCE_DATE_COLUMN] = [
                pd.Timestamp(index).normalize().strftime("%Y-%m-%d") for index in work.index
            ]
        selected = pd.to_numeric(work["Close_Adjusted"], errors="coerce")
        staged: list[tuple[pd.Timestamp, float, pd.Timestamp]] = []
        for event_date, _dividend, _split, _split_factor in signature:
            prior = selected.loc[selected.index < event_date]
            prior = prior[
                prior.map(
                    lambda value: not pd.isna(value)
                    and math.isfinite(float(value))
                    and float(value) > 0.0
                )
            ]
            if prior.empty:
                return frame, False
            source_date = pd.Timestamp(prior.index[-1])
            if source_date.tzinfo is not None:
                source_date = source_date.tz_localize(None)
            staged.append((event_date, float(prior.iloc[-1]), source_date.normalize()))
        for event_date, price, source_date in staged:
            work.at[event_date, "Close_Adjusted"] = price
            work.at[event_date, VALUATION_SOURCE_COLUMN] = "asof_carry_forward"
            work.at[event_date, VALUATION_SOURCE_DATE_COLUMN] = source_date.strftime("%Y-%m-%d")
        work.attrs.update(original_attrs)
        return work, True

    def download_data(self, tickers: list, start_date):
        with self._semantic_attempt_lock:
            self._invalid_attempt_evidence = {}
        market_data, fx_rates = super().download_data(tickers, start_date)
        for symbol, frame in list(self.market_data.items()):
            if not self._selected_price_contains_nan(frame):
                continue
            recovered, recovered_dates = self._recover_with_exact_date_intraday_evidence(str(symbol), frame)
            if recovered_dates:
                self.market_data[symbol] = recovered
                metadata = dict(recovered.attrs.get("price_provenance") or {})
                if metadata:
                    self.price_metadata_by_symbol[symbol] = metadata
                logger.warning(
                    "[%s] persistent invalid daily row(s) recovered from cross-validated exact-date same-provider raw 1h/15m evidence: dates=%s count=%s",
                    symbol,
                    ",".join(date.strftime("%Y-%m-%d") for date in recovered_dates),
                    len(recovered_dates),
                )
                frame = recovered

            with self._semantic_attempt_lock:
                attempts = list(self._invalid_attempt_evidence.get(str(symbol), ()))
            if len(attempts) < 2:
                continue
            first = attempts[-2]
            second = attempts[-1]
            signature = first.get("signature")
            if not signature or signature != second.get("signature"):
                continue
            if first.get("price_source") != second.get("price_source"):
                continue
            normalized, applied = self._materialize_action_only_asof_valuations(frame, signature)
            if not applied:
                continue
            self.market_data[symbol] = normalized
            event_dates = ",".join(event_date.strftime("%Y-%m-%d") for event_date, *_ in signature)
            logger.warning(
                "[%s] persistent dividend-only row(s) normalized as explicit as-of effective valuation: dates=%s count=%s",
                symbol,
                event_dates,
                len(signature),
            )
        return self.market_data, fx_rates
