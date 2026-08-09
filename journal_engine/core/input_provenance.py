"""Pure effective market/FX input provenance for Gate D / D1c.

The identities in this module describe calculation-effective numeric state, not raw
vendor payloads. Provider/source diagnostics are deliberately modeled separately so
provider metadata changes do not silently alter effective-input digests.

No network access, production runner integration, persistence, or clock behavior is
implemented here.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping
from datetime import date
import math
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .calculation_manifest import CalculationManifestError, canonical_sha256


MARKET_INPUT_CANONICALIZATION_VERSION = 1
FX_INPUT_CANONICALIZATION_VERSION = 1
PROVIDER_DIAGNOSTICS_VERSION = 1

VALUATION_SOURCE_COLUMN = "Valuation_Source"
VALUATION_SOURCE_DATE_COLUMN = "Valuation_Source_Date"
ALLOWED_VALUATION_SOURCES = {
    "market",
    "asof_carry_forward",
    "transaction_price_seed",
}


class EffectiveMarketInputsIdentity(BaseModel):
    """Digest and compact diagnostics for effective market calculation inputs."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    canonicalization_version: Literal[1] = MARKET_INPUT_CANONICALIZATION_VERSION
    sha256: str
    symbol_count: int = Field(ge=1)
    row_count: int = Field(ge=1)
    synthetic_row_counts: dict[str, int]

    @field_validator("sha256")
    @classmethod
    def validate_digest(cls, value: str) -> str:
        if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
            raise ValueError("market input digest must be lowercase SHA-256 hex")
        return value

    @field_validator("synthetic_row_counts")
    @classmethod
    def validate_synthetic_counts(cls, value: dict[str, int]) -> dict[str, int]:
        allowed = ALLOWED_VALUATION_SOURCES - {"market"}
        if any(key not in allowed for key in value):
            raise ValueError("synthetic_row_counts contains an unsupported source")
        if any(count < 0 for count in value.values()):
            raise ValueError("synthetic row counts must be non-negative")
        return value


class EffectiveFxInputsIdentity(BaseModel):
    """Digest and compact diagnostics for effective FX calculation inputs."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    canonicalization_version: Literal[1] = FX_INPUT_CANONICALIZATION_VERSION
    sha256: str
    currency_count: int = Field(ge=1)
    historical_row_count: int = Field(ge=0)
    includes_realtime: bool
    realtime_currency_count: int = Field(ge=0)

    @field_validator("sha256")
    @classmethod
    def validate_digest(cls, value: str) -> str:
        if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
            raise ValueError("FX input digest must be lowercase SHA-256 hex")
        return value


class ProviderProvenanceDiagnostics(BaseModel):
    """Non-hashed provider diagnostics kept separate from effective numeric identity."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    diagnostics_version: Literal[1] = PROVIDER_DIAGNOSTICS_VERSION
    price_sources: dict[str, str] = Field(default_factory=dict)
    selection_reasons: dict[str, str] = Field(default_factory=dict)
    realtime_overlay_symbols: tuple[str, ...] = ()


def _normalize_name(value: Any, label: str) -> str:
    if value is None:
        raise CalculationManifestError(f"{label} must be non-empty")
    try:
        if bool(pd.isna(value)):
            raise CalculationManifestError(f"{label} must be non-empty")
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError(f"{label} must be a scalar value") from exc
    text = str(value).strip().upper()
    if not text:
        raise CalculationManifestError(f"{label} must be non-empty")
    return text


def _normalize_date(value: Any, label: str) -> date:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError(f"{label} is invalid") from exc
    if pd.isna(timestamp):
        raise CalculationManifestError(f"{label} is empty")
    if timestamp.tzinfo is not None:
        raise CalculationManifestError(f"{label} must be timezone-naive")
    if timestamp != timestamp.normalize():
        raise CalculationManifestError(f"{label} must not contain time-of-day")
    return timestamp.date()


def _finite_number(value: Any, label: str, *, positive: bool = False) -> float:
    if isinstance(value, bool):
        raise CalculationManifestError(f"{label} must be numeric")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError(f"{label} must be numeric") from exc
    if not math.isfinite(numeric):
        raise CalculationManifestError(f"{label} must be finite")
    if positive and numeric <= 0:
        raise CalculationManifestError(f"{label} must be positive")
    return numeric


def _normalize_required_names(values: Iterable[Any], label: str) -> list[str]:
    normalized = [_normalize_name(value, label) for value in values]
    if not normalized:
        raise CalculationManifestError(f"{label} set must not be empty")
    if len(set(normalized)) != len(normalized):
        raise CalculationManifestError(f"{label} values must be unique after normalization")
    return sorted(normalized)


def _normalize_market_frame(symbol: str, frame: pd.DataFrame) -> list[dict[str, Any]]:
    if not isinstance(frame, pd.DataFrame):
        raise CalculationManifestError(f"{symbol} market data must be a DataFrame")
    if frame.empty:
        raise CalculationManifestError(f"{symbol} market data must not be empty")
    if "Close_Adjusted" not in frame.columns:
        raise CalculationManifestError(f"{symbol} market data missing Close_Adjusted")

    normalized_index = pd.to_datetime(frame.index, errors="coerce")
    if normalized_index.isna().any():
        raise CalculationManifestError(f"{symbol} market index contains an invalid date")
    if normalized_index.tz is not None:
        raise CalculationManifestError(f"{symbol} market index must be timezone-naive")
    if any(timestamp != timestamp.normalize() for timestamp in normalized_index):
        raise CalculationManifestError(f"{symbol} market index must contain dates only")
    if normalized_index.duplicated().any():
        raise CalculationManifestError(f"{symbol} market index contains duplicate dates")

    work = frame.copy()
    work.index = normalized_index
    work = work.sort_index()

    rows: list[dict[str, Any]] = []
    for timestamp, raw in work.iterrows():
        row_date = timestamp.date()
        close_adjusted = _finite_number(
            raw["Close_Adjusted"],
            f"{symbol} {row_date} Close_Adjusted",
            positive=True,
        )
        dividends = (
            _finite_number(raw["Dividends"], f"{symbol} {row_date} Dividends")
            if "Dividends" in work.columns
            else 0.0
        )
        split_factor = (
            _finite_number(
                raw["Split_Factor"],
                f"{symbol} {row_date} Split_Factor",
                positive=True,
            )
            if "Split_Factor" in work.columns
            else 1.0
        )

        if VALUATION_SOURCE_COLUMN in work.columns:
            source = str(raw[VALUATION_SOURCE_COLUMN]).strip().lower()
            if source not in ALLOWED_VALUATION_SOURCES:
                raise CalculationManifestError(
                    f"{symbol} {row_date} has unsupported valuation source: {source or '<empty>'}"
                )
        else:
            source = "market"

        if VALUATION_SOURCE_DATE_COLUMN in work.columns:
            raw_source_date = raw[VALUATION_SOURCE_DATE_COLUMN]
            if pd.isna(raw_source_date):
                if source == "market":
                    source_date = row_date
                else:
                    raise CalculationManifestError(
                        f"{symbol} {row_date} synthetic valuation source date is missing"
                    )
            else:
                source_date = _normalize_date(
                    raw_source_date,
                    f"{symbol} {row_date} valuation source date",
                )
        else:
            if source != "market":
                raise CalculationManifestError(
                    f"{symbol} {row_date} synthetic valuation source date is missing"
                )
            source_date = row_date

        if source_date > row_date:
            raise CalculationManifestError(
                f"{symbol} {row_date} valuation source date cannot be in the future"
            )
        if source in {"market", "transaction_price_seed"} and source_date != row_date:
            raise CalculationManifestError(
                f"{symbol} {row_date} {source} valuation source date must equal row date"
            )

        rows.append(
            {
                "date": row_date,
                "close_adjusted": close_adjusted,
                "dividends": dividends,
                "split_factor": split_factor,
                "valuation_source": source,
                "valuation_source_date": source_date,
            }
        )
    return rows


def canonical_market_inputs_projection(
    market_data: Mapping[str, pd.DataFrame],
    *,
    required_symbols: Iterable[Any] | None = None,
) -> dict[str, Any]:
    """Project effective market inputs, excluding irrelevant vendor payload columns."""

    if not isinstance(market_data, Mapping):
        raise CalculationManifestError("market_data must be a mapping")
    if required_symbols is None:
        symbols = _normalize_required_names(market_data.keys(), "market symbol")
    else:
        symbols = _normalize_required_names(required_symbols, "market symbol")

    normalized_market: dict[str, pd.DataFrame] = {}
    for raw_symbol, frame in market_data.items():
        symbol = _normalize_name(raw_symbol, "market symbol")
        if symbol in normalized_market:
            raise CalculationManifestError("market_data contains duplicate normalized symbols")
        normalized_market[symbol] = frame

    missing = [symbol for symbol in symbols if symbol not in normalized_market]
    if missing:
        raise CalculationManifestError(
            "market_data missing required symbols: " + ", ".join(missing)
        )

    projected_symbols = [
        {"symbol": symbol, "rows": _normalize_market_frame(symbol, normalized_market[symbol])}
        for symbol in symbols
    ]
    return {
        "canonicalization_version": MARKET_INPUT_CANONICALIZATION_VERSION,
        "symbols": projected_symbols,
    }


def build_market_inputs_identity(
    market_data: Mapping[str, pd.DataFrame],
    *,
    required_symbols: Iterable[Any] | None = None,
) -> EffectiveMarketInputsIdentity:
    """Build effective market digest plus compact synthetic-row diagnostics."""

    projection = canonical_market_inputs_projection(
        market_data,
        required_symbols=required_symbols,
    )
    synthetic_counts: Counter[str] = Counter()
    row_count = 0
    for symbol in projection["symbols"]:
        for row in symbol["rows"]:
            row_count += 1
            if row["valuation_source"] != "market":
                synthetic_counts[row["valuation_source"]] += 1
    return EffectiveMarketInputsIdentity(
        sha256=canonical_sha256(projection),
        symbol_count=len(projection["symbols"]),
        row_count=row_count,
        synthetic_row_counts=dict(sorted(synthetic_counts.items())),
    )


def canonical_fx_inputs_projection(
    fx_rates_by_currency: Mapping[str, pd.Series],
    *,
    required_currencies: Iterable[Any],
    realtime_fx_rates_by_currency: Mapping[str, Any] | None = None,
    include_realtime: bool = False,
) -> dict[str, Any]:
    """Project effective TWD/native FX series and optional realtime overlay state."""

    if not isinstance(fx_rates_by_currency, Mapping):
        raise CalculationManifestError("fx_rates_by_currency must be a mapping")
    currencies = _normalize_required_names(required_currencies, "FX currency")

    normalized_series: dict[str, pd.Series] = {}
    for raw_currency, series in fx_rates_by_currency.items():
        currency = _normalize_name(raw_currency, "FX currency")
        if currency in normalized_series:
            raise CalculationManifestError("FX history contains duplicate normalized currencies")
        if not isinstance(series, pd.Series):
            raise CalculationManifestError(f"{currency} FX history must be a Series")
        normalized_series[currency] = series

    normalized_realtime: dict[str, Any] = {}
    if realtime_fx_rates_by_currency is not None:
        if not isinstance(realtime_fx_rates_by_currency, Mapping):
            raise CalculationManifestError("realtime FX rates must be a mapping")
        for raw_currency, value in realtime_fx_rates_by_currency.items():
            currency = _normalize_name(raw_currency, "realtime FX currency")
            if currency in normalized_realtime:
                raise CalculationManifestError(
                    "realtime FX rates contain duplicate normalized currencies"
                )
            normalized_realtime[currency] = value

    projected: list[dict[str, Any]] = []
    for currency in currencies:
        if currency == "TWD":
            rows: list[dict[str, Any]] = []
            realtime_rate = 1.0 if include_realtime else None
            projected.append(
                {
                    "currency": "TWD",
                    "constant_rate": 1.0,
                    "historical_rows": rows,
                    "realtime_rate": realtime_rate,
                }
            )
            continue

        if currency not in normalized_series:
            raise CalculationManifestError(f"FX history missing required currency: {currency}")
        series = normalized_series[currency]
        if series.empty:
            raise CalculationManifestError(f"{currency} FX history must not be empty")

        index = pd.to_datetime(series.index, errors="coerce")
        if index.isna().any():
            raise CalculationManifestError(f"{currency} FX history contains an invalid date")
        if index.tz is not None:
            raise CalculationManifestError(f"{currency} FX history must be timezone-naive")
        if any(timestamp != timestamp.normalize() for timestamp in index):
            raise CalculationManifestError(f"{currency} FX history must contain dates only")
        if index.duplicated().any():
            raise CalculationManifestError(f"{currency} FX history contains duplicate dates")

        work = pd.Series(series.to_numpy(copy=True), index=index).sort_index()
        rows = [
            {
                "date": timestamp.date(),
                "rate": _finite_number(
                    value,
                    f"{currency} {timestamp.date()} FX rate",
                    positive=True,
                ),
            }
            for timestamp, value in work.items()
        ]

        realtime_rate = None
        if include_realtime and currency in normalized_realtime:
            realtime_rate = _finite_number(
                normalized_realtime[currency],
                f"{currency} realtime FX rate",
                positive=True,
            )
        projected.append(
            {
                "currency": currency,
                "constant_rate": None,
                "historical_rows": rows,
                "realtime_rate": realtime_rate,
            }
        )

    return {
        "canonicalization_version": FX_INPUT_CANONICALIZATION_VERSION,
        "includes_realtime": bool(include_realtime),
        "currencies": projected,
    }


def build_fx_inputs_identity(
    fx_rates_by_currency: Mapping[str, pd.Series],
    *,
    required_currencies: Iterable[Any],
    realtime_fx_rates_by_currency: Mapping[str, Any] | None = None,
    include_realtime: bool = False,
) -> EffectiveFxInputsIdentity:
    """Build effective FX digest plus compact row/realtime diagnostics."""

    projection = canonical_fx_inputs_projection(
        fx_rates_by_currency,
        required_currencies=required_currencies,
        realtime_fx_rates_by_currency=realtime_fx_rates_by_currency,
        include_realtime=include_realtime,
    )
    historical_row_count = sum(
        len(currency["historical_rows"]) for currency in projection["currencies"]
    )
    realtime_currency_count = sum(
        1 for currency in projection["currencies"] if currency["realtime_rate"] is not None
    )
    return EffectiveFxInputsIdentity(
        sha256=canonical_sha256(projection),
        currency_count=len(projection["currencies"]),
        historical_row_count=historical_row_count,
        includes_realtime=projection["includes_realtime"],
        realtime_currency_count=realtime_currency_count,
    )


def build_provider_provenance_diagnostics(
    *,
    metadata_by_symbol: Mapping[str, Mapping[str, Any]] | None = None,
    realtime_overlay_symbols: Iterable[Any] = (),
) -> ProviderProvenanceDiagnostics:
    """Normalize non-hashed provider diagnostics without raw vendor payloads."""

    price_sources: dict[str, str] = {}
    selection_reasons: dict[str, str] = {}
    if metadata_by_symbol is not None:
        if not isinstance(metadata_by_symbol, Mapping):
            raise CalculationManifestError("provider metadata must be a mapping")
        for raw_symbol, metadata in metadata_by_symbol.items():
            symbol = _normalize_name(raw_symbol, "provider metadata symbol")
            if symbol in price_sources:
                raise CalculationManifestError(
                    "provider metadata contains duplicate normalized symbols"
                )
            if not isinstance(metadata, Mapping):
                raise CalculationManifestError(f"{symbol} provider metadata must be a mapping")
            source = str(metadata.get("price_source", "")).strip()
            reason = str(metadata.get("selection_reason", "")).strip()
            if not source or not reason:
                raise CalculationManifestError(
                    f"{symbol} provider metadata requires price_source and selection_reason"
                )
            price_sources[symbol] = source
            selection_reasons[symbol] = reason

    overlays = _normalize_required_names(realtime_overlay_symbols, "realtime overlay symbol") if tuple(realtime_overlay_symbols) else []
    return ProviderProvenanceDiagnostics(
        price_sources=dict(sorted(price_sources.items())),
        selection_reasons=dict(sorted(selection_reasons.items())),
        realtime_overlay_symbols=tuple(overlays),
    )
