"""Semantic normalization and strict recovery for malformed provider daily rows.

The underlying :class:`MarketDataClient` intentionally fails closed when its selected
valuation field contains NaN. This adapter preserves that behavior for ambiguous or
malformed market data while composing two row-level evidence authorities:

1. A persistent invalid zero-action provider row may be reconstructed from fresh raw
   regular-session evidence from the same Yahoo/yfinance provider for the exact affected
   date. Recovery uses an ordered set of multiple intraday granularities and requires a
   unique semantic quorum of complete daily OHLC/adjusted-close candidates. Granularities
   are fetched lazily until the quorum is proven or can no longer be reached; an invalid,
   unavailable, or disagreeing representation is evidence against that representation,
   not a ticker-specific exception. There is no temporal retry, tolerance widening, or
   symbol/date branching. Completely empty keepna buckets are ignored only when they
   carry no contradictory non-zero volume. Intraday evidence replaces price fields only;
   original daily volume and corporate actions remain authoritative.
2. Invalid rows are classified independently. A stable pure positive cash-dividend-only
   row may use the explicit ``asof_carry_forward`` effective valuation contract even when
   another row for the same symbol independently requires intraday price recovery. The
   dividend signature must agree across the two ordinary daily observations; unsupported
   split/capital-gain/action rows remain unresolved and fail closed.

Everything else remains fail-closed. There are no ticker/date exceptions, alternate
provider substitutions, guessed prices, unsupported corporate-action recovery, or relaxed
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
_SEMANTIC_INTRADAY_INTERVALS = INTRADAY_EVIDENCE_INTERVALS + ("5m",)
_SEMANTIC_INTRADAY_QUORUM = 2
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



    def _resolve_intraday_price_quorum(self, observation, event_date: pd.Timestamp):
        """Resolve a unique price candidate from ordered multi-granularity evidence.

        Every interval is governed by the same semantic candidate validator. Invalid or
        unavailable representations may be outvoted only when the remaining representations
        establish the configured quorum. Ambiguous qualified candidates remain fail-closed.
        """
        intervals = _SEMANTIC_INTRADAY_INTERVALS
        quorum = _SEMANTIC_INTRADAY_QUORUM
        if quorum < 2 or quorum > len(intervals):
            return None, (), ()

        candidates: list[tuple[str, dict[str, float]]] = []
        attempted: list[str] = []
        for interval in intervals:
            attempted.append(interval)
            try:
                intraday = observation.fetch(interval)
            except YahooIntradayEvidenceError as exc:
                logger.warning(
                    "exact-date intraday evidence unavailable for %s interval=%s: %s",
                    event_date.strftime("%Y-%m-%d"),
                    interval,
                    exc,
                )
            else:
                candidate = self._complete_intraday_price_candidate(intraday, event_date)
                if candidate is None:
                    logger.warning(
                        "exact-date intraday representation invalid for %s interval=%s",
                        event_date.strftime("%Y-%m-%d"),
                        interval,
                    )
                else:
                    candidates.append((interval, candidate[0]))

            qualified: list[tuple[str, dict[str, float], tuple[str, ...]]] = []
            for candidate_interval, candidate_values in candidates:
                supporters = tuple(
                    other_interval
                    for other_interval, other_values in candidates
                    if self._intraday_price_candidates_agree(candidate_values, other_values)
                )
                if len(supporters) >= quorum:
                    qualified.append((candidate_interval, candidate_values, supporters))

            if qualified:
                anchor = qualified[0][1]
                if not all(
                    self._intraday_price_candidates_agree(anchor, candidate_values)
                    for _interval, candidate_values, _supporters in qualified[1:]
                ):
                    logger.warning(
                        "exact-date intraday evidence produced multiple incompatible quorum candidates for %s",
                        event_date.strftime("%Y-%m-%d"),
                    )
                    return None, (), tuple(attempted)
                agreeing = tuple(
                    candidate_interval
                    for candidate_interval, candidate_values in candidates
                    if self._intraday_price_candidates_agree(anchor, candidate_values)
                )
                return anchor, agreeing, tuple(attempted)

            remaining = len(intervals) - len(attempted)
            best_support = max(
                (
                    sum(
                        1
                        for _other_interval, other_values in candidates
                        if self._intraday_price_candidates_agree(candidate_values, other_values)
                    )
                    for _candidate_interval, candidate_values in candidates
                ),
                default=0,
            )
            if best_support + remaining < quorum:
                break

        return None, (), tuple(attempted)

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
        return tuple(signature) if signature else None

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
                    intervals=_SEMANTIC_INTRADAY_INTERVALS,
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
            agreeing_intervals: tuple[str, ...] = ()
            attempted_intervals: tuple[str, ...] = ()
            try:
                with evidence_session.observation(event_date) as observation:
                    consensus, agreeing_intervals, attempted_intervals = (
                        self._resolve_intraday_price_quorum(observation, event_date)
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
                logger.warning(
                    "[%s] exact-date intraday evidence did not establish a unique quorum for %s: attempted=%s",
                    symbol,
                    event_date.strftime("%Y-%m-%d"),
                    ",".join(attempted_intervals),
                )
                return frame, ()
            logger.warning(
                "[%s] exact-date intraday evidence quorum accepted for %s: agreeing=%s attempted=%s",
                symbol,
                event_date.strftime("%Y-%m-%d"),
                ",".join(agreeing_intervals),
                ",".join(attempted_intervals),
            )
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
            "same-provider raw regular-session multi-granularity quorum evidence"
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
                    "[%s] persistent invalid daily row(s) recovered from exact-date same-provider multi-granularity quorum evidence: dates=%s count=%s",
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
