"""Semantic normalization for provider rows that are events, not price observations.

The underlying :class:`MarketDataClient` intentionally fails closed when its selected
valuation field contains NaN. This adapter preserves that behavior for ambiguous or
malformed price bars, while recognizing one narrower provider shape after the existing
bounded same-provider retry has independently reproduced it:

- every raw OHLC field is missing;
- volume is zero/missing;
- the row carries a finite positive cash dividend;
- no stock split or unsupported capital-gain event is present; and
- both successful invalid provider attempts report the same event semantics and the
  same selected price source.

Such a row is not treated as a vendor market close. It is converted into the existing
``asof_carry_forward`` effective-valuation contract: only ``Close_Adjusted`` is supplied
from the latest prior finite selected valuation, raw OHLC remains missing, the dividend
field remains untouched, and provenance records the actual price source date.

Non-zero stock splits deliberately remain fail-closed. A split can change both the
share-count basis and the contemporaneous price basis; without an authoritative price
observation, a generic carry-forward rule would be financially under-specified. The
same conservative rule applies to capital gains, which the calculator does not model.

This keeps transient/mixed price corruption fail-closed, avoids ticker/date-specific
special cases, and makes supported provider-row semantics explicit for calculator and
deterministic input provenance consumers.
"""

from __future__ import annotations

import logging
import math
import threading
from typing import Any

import pandas as pd

from .market_data import (
    VALUATION_SOURCE_COLUMN,
    VALUATION_SOURCE_DATE_COLUMN,
    MarketDataClient,
)


logger = logging.getLogger(__name__)

_RAW_PRICE_COLUMNS = ("Open", "High", "Low", "Close", "Adj Close")
_REQUIRED_ACTION_COLUMNS = ("Dividends", "Stock Splits")


class SemanticMarketDataClient(MarketDataClient):
    """Production market client with persistent event-row semantic normalization."""

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
            # A supported event row has no usable vendor price observation at all. If
            # any OHLC field exists, it is a malformed/mixed price bar and must remain
            # under the original fail-closed path.
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

            # Capital gains are not currently modeled by the calculator. Never make
            # an update green by silently discarding a material unsupported cash event.
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
                # Without a prior real/effective valuation there is no defensible
                # carry-forward source. Preserve the original NaN and fail closed.
                return frame, False

            source_date = pd.Timestamp(prior.index[-1])
            if source_date.tzinfo is not None:
                source_date = source_date.tz_localize(None)
            staged.append((event_date, float(prior.iloc[-1]), source_date.normalize()))

        for event_date, price, source_date in staged:
            # Do not mutate raw vendor OHLC/Close_Raw fields. Close_Adjusted is the
            # calculation-effective valuation channel and provenance makes its source
            # explicit as a carry-forward rather than a claimed market close.
            work.at[event_date, "Close_Adjusted"] = price
            work.at[event_date, VALUATION_SOURCE_COLUMN] = "asof_carry_forward"
            work.at[event_date, VALUATION_SOURCE_DATE_COLUMN] = source_date.strftime(
                "%Y-%m-%d"
            )

        work.attrs.update(original_attrs)
        return work, True

    def download_data(self, tickers: list, start_date):
        """Run the bounded retry, then normalize only proven dividend-only rows."""
        with self._semantic_attempt_lock:
            self._invalid_attempt_evidence = {}

        market_data, fx_rates = super().download_data(tickers, start_date)

        for symbol, frame in list(self.market_data.items()):
            if not self._selected_price_contains_nan(frame):
                continue

            with self._semantic_attempt_lock:
                attempts = list(self._invalid_attempt_evidence.get(str(symbol), ()))

            # Normalization requires two *successful prepared* invalid responses.
            # Empty/exception/missing-row/action-evidence failures in the second fetch
            # therefore retain only one evidence record and remain fail-closed.
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
