"""Small production assembly boundary for Gate D calculation manifests.

This module does not download data, mutate the transaction ledger, upload snapshots,
or choose providers.  It projects one user's already-effective calculation inputs into
the D1b/D1c identity contracts and returns the versioned snapshot manifest.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Mapping

import pandas as pd
import pytz

from ..config import BASE_CURRENCY
from ..models import CalculationManifest
from .calculation_manifest import (
    CalculationManifestError,
    build_deterministic_calculation_identity,
    build_runtime_config_identity,
    build_source_records_identity,
)
from .currency_detector import CurrencyDetector
from .input_provenance import (
    build_fx_inputs_identity,
    build_market_inputs_identity,
    build_provider_provenance_diagnostics,
)


TAIPEI_TZ = pytz.timezone("Asia/Taipei")


class ProductionManifestError(RuntimeError):
    """Raised when production evidence cannot be assembled truthfully."""


def resolve_calculation_context(
    now_provider: Callable[[], datetime] | None = None,
) -> datetime:
    """Resolve one timezone-aware Taipei clock for a complete calculation batch."""

    value = now_provider() if now_provider is not None else datetime.now(TAIPEI_TZ)
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ProductionManifestError("calculation context must be timezone-aware")
    return value.astimezone(TAIPEI_TZ)


def _normalize_date(value: Any, label: str) -> pd.Timestamp:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise ProductionManifestError(f"{label} is invalid") from exc
    if pd.isna(timestamp):
        raise ProductionManifestError(f"{label} is empty")
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp.normalize()


def _window_market_frame(
    symbol: str,
    frame: pd.DataFrame,
    *,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
) -> pd.DataFrame:
    if not isinstance(frame, pd.DataFrame) or frame.empty:
        raise ProductionManifestError(f"market provenance missing required symbol: {symbol}")

    work = frame.copy(deep=True)
    index = pd.to_datetime(work.index, errors="coerce")
    if index.isna().any():
        raise ProductionManifestError(f"market provenance has invalid date index: {symbol}")
    if index.tz is not None:
        index = index.tz_localize(None)
    work.index = index.normalize()
    return work.loc[(work.index >= start_date) & (work.index <= end_date)].copy(deep=True)


def _window_fx_series(
    currency: str,
    series: pd.Series,
    *,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
) -> pd.Series:
    if not isinstance(series, pd.Series):
        raise ProductionManifestError(f"FX provenance missing required currency: {currency}")
    work = series.copy(deep=True)
    index = pd.to_datetime(work.index, errors="coerce")
    if index.isna().any():
        raise ProductionManifestError(f"{currency} FX history contains an invalid date")
    if index.tz is not None:
        index = index.tz_localize(None)
    work.index = index.normalize()
    return work.loc[(work.index >= start_date) & (work.index <= end_date)].copy(deep=True)


def _realtime_fx_currencies_used_by_calculation(
    *,
    user_symbols: set[str],
    required_symbols: list[str],
    market_window: Mapping[str, pd.DataFrame],
    calculation_as_of: pd.Timestamp,
) -> set[str]:
    """Return foreign currencies whose realtime FX path can affect this run.

    PortfolioCalculator only has a valuation pass for ``calculation_as_of`` when at
    least one source-transaction symbol contributes that date to the group trading-date
    union.  On that pass a foreign symbol uses realtime FX only when its own effective
    market row is also dated ``calculation_as_of``; otherwise ``get_price_asof`` pads to
    an earlier row and the calculator uses historical FX for that row instead.
    """

    has_asof_valuation = any(
        calculation_as_of in market_window[symbol].index
        for symbol in user_symbols
        if symbol in market_window
    )
    if not has_asof_valuation:
        return set()

    currencies = set()
    for symbol in required_symbols:
        frame = market_window[symbol]
        if calculation_as_of not in frame.index:
            continue
        currency = CurrencyDetector.detect(symbol)
        if currency != BASE_CURRENCY:
            currencies.add(currency)
    return currencies


def build_production_calculation_manifest(
    *,
    raw_user_df: pd.DataFrame,
    market_client: Any,
    benchmark: str,
    calculation_now: datetime,
    engine_source_commit: str,
    oversell_policy: str,
) -> CalculationManifest:
    """Build one user's bounded, deterministic production calculation manifest."""

    if not isinstance(raw_user_df, pd.DataFrame) or raw_user_df.empty:
        raise ProductionManifestError("source records are empty")
    required_columns = {"Date", "Symbol"}
    missing_columns = sorted(required_columns - set(raw_user_df.columns))
    if missing_columns:
        raise ProductionManifestError(
            "source records missing required columns: " + ", ".join(missing_columns)
        )

    calculation_context = resolve_calculation_context(lambda: calculation_now)
    calculation_as_of = pd.Timestamp(calculation_context.date())
    first_transaction_date = _normalize_date(raw_user_df["Date"].min(), "first transaction date")
    if first_transaction_date > calculation_as_of:
        raise ProductionManifestError("first transaction date is after calculation_as_of")

    benchmark_symbol = str(benchmark or "").strip().upper()
    if not benchmark_symbol:
        raise ProductionManifestError("benchmark must be non-empty")

    user_symbols = {
        str(symbol).strip().upper()
        for symbol in raw_user_df["Symbol"].dropna().tolist()
        if str(symbol).strip()
    }
    required_symbols = sorted(user_symbols | {benchmark_symbol})

    get_prev_trading_date = getattr(market_client, "get_prev_trading_date", None)
    if not callable(get_prev_trading_date):
        raise ProductionManifestError("market client does not expose benchmark previous trading date")
    try:
        benchmark_prev_date = _normalize_date(
            get_prev_trading_date(benchmark_symbol, first_transaction_date),
            "benchmark previous trading date",
        )
    except Exception as exc:
        if isinstance(exc, ProductionManifestError):
            raise
        raise ProductionManifestError("benchmark previous trading date is unavailable") from exc
    window_start = min(first_transaction_date, benchmark_prev_date)

    market_data = getattr(market_client, "market_data", None)
    if not isinstance(market_data, Mapping):
        raise ProductionManifestError("market client does not expose market_data")
    market_window = {}
    for symbol in required_symbols:
        frame = market_data.get(symbol)
        market_window[symbol] = _window_market_frame(
            symbol,
            frame,
            start_date=window_start,
            end_date=calculation_as_of,
        )

    required_currencies = sorted(
        {BASE_CURRENCY} | {CurrencyDetector.detect(symbol) for symbol in required_symbols}
    )
    fx_by_currency = getattr(market_client, "fx_rates_by_currency", None)
    if not isinstance(fx_by_currency, Mapping):
        fx_by_currency = {}
    fx_window = {}
    for currency in required_currencies:
        if currency == BASE_CURRENCY:
            continue
        series = fx_by_currency.get(currency)
        fx_window[currency] = _window_fx_series(
            currency,
            series,
            start_date=window_start,
            end_date=calculation_as_of,
        )

    realtime_fx_currencies = _realtime_fx_currencies_used_by_calculation(
        user_symbols=user_symbols,
        required_symbols=required_symbols,
        market_window=market_window,
        calculation_as_of=calculation_as_of,
    )
    realtime_fx = getattr(market_client, "realtime_fx_rates_by_currency", None)
    if not isinstance(realtime_fx, Mapping):
        realtime_fx = {}
    filtered_realtime_fx = {
        currency: realtime_fx[currency]
        for currency in sorted(realtime_fx_currencies)
        if currency in realtime_fx
    }

    metadata_by_symbol = getattr(market_client, "price_metadata_by_symbol", None)
    if not isinstance(metadata_by_symbol, Mapping):
        metadata_by_symbol = {}
    normalized_metadata = {
        str(symbol).strip().upper(): metadata
        for symbol, metadata in metadata_by_symbol.items()
        if str(symbol or "").strip()
    }
    missing_metadata = [symbol for symbol in required_symbols if symbol not in normalized_metadata]
    if missing_metadata:
        raise ProductionManifestError(
            "provider provenance missing required symbols: " + ", ".join(missing_metadata)
        )
    filtered_metadata = {symbol: normalized_metadata[symbol] for symbol in required_symbols}

    raw_overlays = getattr(market_client, "realtime_overlay_symbols", set())
    normalized_overlays = {
        str(symbol).strip().upper()
        for symbol in raw_overlays
        if str(symbol or "").strip()
    }
    filtered_overlays = sorted(normalized_overlays & set(required_symbols))

    try:
        source_identity = build_source_records_identity(raw_user_df)
        runtime_identity = build_runtime_config_identity(
            benchmark_symbol=benchmark_symbol,
            base_currency=BASE_CURRENCY,
            oversell_policy=oversell_policy,
        )
        market_identity = build_market_inputs_identity(
            market_window,
            required_symbols=required_symbols,
        )
        fx_identity = build_fx_inputs_identity(
            fx_window,
            required_currencies=required_currencies,
            realtime_fx_rates_by_currency=filtered_realtime_fx,
            include_realtime=bool(realtime_fx_currencies),
        )
        deterministic_identity = build_deterministic_calculation_identity(
            engine_source_commit=engine_source_commit,
            source_records=source_identity,
            runtime_config=runtime_identity,
            market_inputs_sha256=market_identity.sha256,
            fx_inputs_sha256=fx_identity.sha256,
            calculation_as_of=calculation_context.date(),
        )
        provider_diagnostics = build_provider_provenance_diagnostics(
            metadata_by_symbol=filtered_metadata,
            realtime_overlay_symbols=filtered_overlays,
        )
    except CalculationManifestError as exc:
        raise ProductionManifestError(str(exc)) from exc

    return CalculationManifest(
        deterministic_identity=deterministic_identity,
        market_inputs=market_identity,
        fx_inputs=fx_identity,
        provider_diagnostics=provider_diagnostics,
        calculated_at=calculation_context.isoformat(),
    )
