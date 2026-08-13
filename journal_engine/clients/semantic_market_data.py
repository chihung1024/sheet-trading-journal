"""Semantic normalization and strict recovery for malformed provider daily rows.

The underlying :class:`MarketDataClient` intentionally fails closed when its selected
valuation field contains NaN. This adapter preserves that behavior for ambiguous or
malformed market data while allowing two evidence-based recovery paths:

1. A persistent invalid provider row may be re-requested from the same provider for
   the exact affected calendar date. Recovery is accepted only when two fresh narrow
   daily requests reproduce the same complete OHLC/volume observation and preserve the
   original corporate-action semantics. No price is synthesized or carried forward.
2. If exact-date recovery is unavailable, a proven pure positive cash-dividend-only row
   may use the existing explicit ``asof_carry_forward`` effective valuation contract.

Everything else remains fail-closed. There are no ticker/date exceptions, alternate
provider substitutions, guessed prices, or relaxed ledger/validator rules.
"""

from __future__ import annotations

import logging
import math
import threading
from typing import Any

import pandas as pd
import yfinance as yf

from .market_data import (
    VALUATION_SOURCE_COLUMN,
    VALUATION_SOURCE_DATE_COLUMN,
    MarketDataClient,
)


logger = logging.getLogger(__name__)

_RAW_PRICE_COLUMNS = ("Open", "High", "Low", "Close", "Adj Close")
_REQUIRED_ACTION_COLUMNS = ("Dividends", "Stock Splits")
_NARROW_RECOVERY_ATTEMPTS = 2
_MAX_NARROW_RECOVERY_ROWS = 5


class SemanticMarketDataClient(MarketDataClient):
    """Production market client with evidence-based provider-row recovery."""

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
    def _complete_narrow_daily_candidate(
        cls,
        frame: pd.DataFrame,
        expected_date: pd.Timestamp,
    ):
        """Return a canonical complete daily-row candidate or ``None``.

        The candidate must be an exact-date single row with finite positive OHLC,
        internally consistent high/low bounds, finite non-negative volume, complete
        dividend/split evidence, and finite optional adjustment/capital-gain values.
        """
        if frame is None or frame.empty:
            return None

        work = frame.copy(deep=True)
        index = pd.to_datetime(work.index, errors="coerce")
        if index.isna().any():
            return None
        if index.tz is not None:
            index = index.tz_localize(None)
        work.index = index.normalize()

        matches = work.loc[work.index == expected_date]
        if len(matches) != 1:
            return None
        row = matches.iloc[0]

        values: dict[str, float] = {}
        for column in ("Open", "High", "Low", "Close"):
            if column not in row.index:
                return None
            value = cls._finite_number(row[column])
            if value is None or value <= 0.0:
                return None
            values[column] = value

        if (
            values["High"] < values["Low"]
            or values["High"] < max(values["Open"], values["Close"])
            or values["Low"] > min(values["Open"], values["Close"])
        ):
            return None

        if "Volume" not in row.index:
            return None
        volume = cls._finite_number(row["Volume"])
        if volume is None or volume < 0.0:
            return None
        values["Volume"] = volume

        action_signature = cls._action_signature_from_row(row)
        if action_signature is None:
            return None
        values["Dividends"], values["Stock Splits"], values["Capital Gains"] = (
            action_signature
        )

        if "Adj Close" in row.index:
            if pd.isna(row["Adj Close"]):
                return None
            adjusted = cls._finite_number(row["Adj Close"])
            if adjusted is None or adjusted <= 0.0:
                return None
            values["Adj Close"] = adjusted

        signature = tuple((column, values[column]) for column in sorted(values))
        return values, signature

    @classmethod
    def _pure_action_only_signature(cls, frame: pd.DataFrame):
        """Return a stable dividend-only signature, or ``None`` when ambiguous.

        The signature covers *all* selected-price NaN rows in the frame. Partial OHLC
        bars, non-zero volume, malformed action fields, stock splits, capital gains, or
        rows without a positive dividend are deliberately unclassifiable so the base
        fail-closed validator remains authoritative.
        """
        if frame is None or frame.empty or "Close_Adjusted" not in frame.columns:
            return None

        selected = pd.to_numeric(frame["Close_Adjusted"], errors="coerce")
        invalid = frame.loc[selected.isna()]
        if invalid.empty:
            return ()

        required = _RAW_PRICE_COLUMNS + ("Volume",) + _REQUIRED_ACTION_COLUMNS + (
            "Split_Factor",
        )
        if any(column not in frame.columns for column in required):
            return None

        signature = []
        for raw_date, row in invalid.iterrows():
            if any(not pd.isna(row[column]) for column in _RAW_PRICE_COLUMNS):
                return None

            volume = row["Volume"]
            if not pd.isna(volume):
                numeric_volume = cls._finite_number(volume)
                if numeric_volume is None or numeric_volume != 0.0:
                    return None

            dividend = cls._finite_number(row["Dividends"])
            split = cls._finite_number(row["Stock Splits"])
            split_factor = cls._finite_number(row["Split_Factor"])
            if dividend is None or dividend <= 0.0:
                return None
            if split is None or split != 0.0:
                return None
            if split_factor is None or split_factor <= 0.0:
                return None

            capital_gain = 0.0
            if "Capital Gains" in frame.columns and not pd.isna(row["Capital Gains"]):
                numeric_capital_gain = cls._finite_number(row["Capital Gains"])
                if numeric_capital_gain is None:
                    return None
                capital_gain = numeric_capital_gain
            if capital_gain != 0.0:
                return None

            event_date = pd.Timestamp(raw_date)
            if pd.isna(event_date):
                return None
            if event_date.tzinfo is not None:
                event_date = event_date.tz_localize(None)

            signature.append(
                (
                    event_date.normalize(),
                    dividend,
                    split,
                    split_factor,
                )
            )

        return tuple(signature)

    def _prepare_data(self, symbol, df):
        """Record compact evidence from each successful invalid provider attempt."""
        prepared = super()._prepare_data(symbol, df)
        if self._selected_price_contains_nan(prepared):
            metadata = dict(prepared.attrs.get("price_provenance") or {})
            evidence = {
                "signature": self._pure_action_only_signature(prepared),
                "price_source": metadata.get("price_source"),
            }
            with self._semantic_attempt_lock:
                self._invalid_attempt_evidence.setdefault(str(symbol), []).append(evidence)
        return prepared

    def _recover_with_exact_date_daily_evidence(
        self,
        symbol: str,
        frame: pd.DataFrame,
    ) -> tuple[pd.DataFrame, tuple[pd.Timestamp, ...]]:
        """Recover persistent NaN rows from repeated exact-date provider observations.

        Recovery is atomic across all invalid selected-price rows. If any affected date
        cannot produce two identical, complete same-provider daily observations whose
        corporate-action semantics match the original broad response, the original
        frame is returned unchanged for downstream fail-closed validation.
        """
        if frame is None or frame.empty or "Close_Adjusted" not in frame.columns:
            return frame, ()

        selected = pd.to_numeric(frame["Close_Adjusted"], errors="coerce")
        invalid_index = list(frame.index[selected.isna()])
        if not invalid_index:
            return frame, ()
        if len(invalid_index) > _MAX_NARROW_RECOVERY_ROWS:
            logger.warning(
                "[%s] exact-date recovery skipped: invalid row count %s exceeds bound %s",
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
            original_actions = self._action_signature_from_row(original_rows.iloc[0])
            if original_actions is None:
                return frame, ()

            candidates = []
            for _attempt in range(_NARROW_RECOVERY_ATTEMPTS):
                try:
                    ticker_obj = yf.Ticker(symbol)
                    narrow = ticker_obj.history(
                        start=event_date,
                        end=event_date + pd.Timedelta(days=1),
                        interval="1d",
                        auto_adjust=False,
                        actions=True,
                        prepost=True,
                    )
                except Exception as exc:
                    logger.warning(
                        "[%s] exact-date daily recovery request failed for %s: %s",
                        symbol,
                        event_date.strftime("%Y-%m-%d"),
                        exc,
                    )
                    return frame, ()

                candidate = self._complete_narrow_daily_candidate(narrow, event_date)
                if candidate is None:
                    return frame, ()
                values, signature = candidate
                candidate_actions = (
                    values["Dividends"],
                    values["Stock Splits"],
                    values.get("Capital Gains", 0.0),
                )
                if candidate_actions != original_actions:
                    logger.warning(
                        "[%s] exact-date daily recovery action mismatch for %s; fail closed",
                        symbol,
                        event_date.strftime("%Y-%m-%d"),
                    )
                    return frame, ()
                candidates.append((values, signature))

            if (
                len(candidates) != _NARROW_RECOVERY_ATTEMPTS
                or len({signature for _values, signature in candidates}) != 1
            ):
                logger.warning(
                    "[%s] exact-date daily recovery was not stable for %s; fail closed",
                    symbol,
                    event_date.strftime("%Y-%m-%d"),
                )
                return frame, ()
            staged[event_date] = candidates[-1][0]

        work = normalized_frame.copy(deep=True)
        for event_date, values in staged.items():
            for column, value in values.items():
                if column == "Capital Gains" and column not in work.columns:
                    continue
                work.at[event_date, column] = value
            if VALUATION_SOURCE_COLUMN in work.columns:
                work.at[event_date, VALUATION_SOURCE_COLUMN] = "market"
            if VALUATION_SOURCE_DATE_COLUMN in work.columns:
                work.at[event_date, VALUATION_SOURCE_DATE_COLUMN] = (
                    event_date.strftime("%Y-%m-%d")
                )

        # Re-run the canonical price selector and split-factor derivation over the
        # complete frame. This avoids patching derived financial fields by hand.
        rebuilt = super()._prepare_data(symbol, work)
        if self._selected_price_contains_nan(rebuilt):
            return frame, ()

        metadata = dict(rebuilt.attrs.get("price_provenance") or {})
        reason = str(metadata.get("selection_reason") or "").strip()
        metadata["selection_reason"] = (
            f"{reason}; persistent invalid daily row recovered by two exact-date "
            "same-provider daily observations"
        ).strip("; ")
        rebuilt.attrs["price_provenance"] = metadata
        return rebuilt, tuple(sorted(staged))

    @classmethod
    def _materialize_action_only_asof_valuations(
        cls,
        frame: pd.DataFrame,
        signature,
    ) -> tuple[pd.DataFrame, bool]:
        """Convert proven dividend-only event rows into explicit as-of valuations."""
        current_signature = cls._pure_action_only_signature(frame)
        if not signature or current_signature != signature:
            return frame, False

        work = frame.copy(deep=True)
        original_attrs = dict(frame.attrs)

        if VALUATION_SOURCE_COLUMN not in work.columns:
            work[VALUATION_SOURCE_COLUMN] = "market"
        if VALUATION_SOURCE_DATE_COLUMN not in work.columns:
            work[VALUATION_SOURCE_DATE_COLUMN] = [
                pd.Timestamp(index).normalize().strftime("%Y-%m-%d")
                for index in work.index
            ]

        selected = pd.to_numeric(work["Close_Adjusted"], errors="coerce")
        staged: list[tuple[pd.Timestamp, float, pd.Timestamp]] = []
        for event_date, _dividend, _split, _split_factor in signature:
            prior = selected.loc[selected.index < event_date]
            prior = prior[
                prior.map(
                    lambda value: (
                        not pd.isna(value)
                        and math.isfinite(float(value))
                        and float(value) > 0.0
                    )
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
            work.at[event_date, VALUATION_SOURCE_DATE_COLUMN] = source_date.strftime(
                "%Y-%m-%d"
            )

        work.attrs.update(original_attrs)
        return work, True

    def download_data(self, tickers: list, start_date):
        """Run base retry, exact-date recovery, then narrow semantic fallback."""
        with self._semantic_attempt_lock:
            self._invalid_attempt_evidence = {}

        market_data, fx_rates = super().download_data(tickers, start_date)

        for symbol, frame in list(self.market_data.items()):
            if not self._selected_price_contains_nan(frame):
                continue

            recovered, recovered_dates = self._recover_with_exact_date_daily_evidence(
                str(symbol),
                frame,
            )
            if recovered_dates:
                self.market_data[symbol] = recovered
                metadata = dict(recovered.attrs.get("price_provenance") or {})
                if metadata:
                    self.price_metadata_by_symbol[symbol] = metadata
                logger.warning(
                    "[%s] persistent invalid daily row(s) recovered from exact-date "
                    "same-provider evidence: dates=%s count=%s",
                    symbol,
                    ",".join(date.strftime("%Y-%m-%d") for date in recovered_dates),
                    len(recovered_dates),
                )
                continue

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

            normalized, applied = self._materialize_action_only_asof_valuations(
                frame,
                signature,
            )
            if not applied:
                continue

            self.market_data[symbol] = normalized
            event_dates = ",".join(
                event_date.strftime("%Y-%m-%d") for event_date, *_ in signature
            )
            logger.warning(
                "[%s] persistent dividend-only row(s) normalized as explicit "
                "as-of effective valuation: dates=%s count=%s",
                symbol,
                event_dates,
                len(signature),
            )

        return self.market_data, fx_rates
