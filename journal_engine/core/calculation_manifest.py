"""Pure deterministic calculation identity primitives for Gate D.

This module deliberately has no production runner, persistence, Worker, market
client, or clock integration. It defines versioned canonicalization and identity
contracts that later Gate-D batches can compose with effective market/FX inputs.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime
import hashlib
import json
import math
import os
import re
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, field_validator


CANONICAL_JSON_VERSION = 1
TRANSACTION_CANONICALIZATION_VERSION = 1
RUNTIME_CONFIG_CANONICALIZATION_VERSION = 1
CALCULATION_IDENTITY_VERSION = 1

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
GIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
TRANSACTION_FIELDS = (
    "id",
    "Date",
    "Symbol",
    "Type",
    "Qty",
    "Price",
    "Commission",
    "Tax",
    "Tag",
)
SUPPORTED_TRANSACTION_TYPES = {"BUY", "SELL", "DIV"}
SUPPORTED_OVERSELL_POLICIES = {"CLAMP", "ERROR"}


class CalculationManifestError(ValueError):
    """Raised when deterministic identity inputs are invalid or ambiguous."""


def _validate_sha256(value: str, label: str) -> str:
    if not isinstance(value, str) or not SHA256_RE.fullmatch(value):
        raise ValueError(f"{label} must be a lowercase SHA-256 hex digest")
    return value


def _validate_git_sha(value: str, label: str = "engine_source_commit") -> str:
    if not isinstance(value, str) or not GIT_SHA_RE.fullmatch(value):
        raise ValueError(f"{label} must be an exact lowercase 40-character Git SHA")
    return value


class SourceRecordsIdentity(BaseModel):
    """Deterministic identity of one user's normalized source transaction rows."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    canonicalization_version: int = Field(
        default=TRANSACTION_CANONICALIZATION_VERSION,
        ge=1,
    )
    sha256: str
    record_count: int = Field(ge=1)
    max_record_id: int = Field(ge=1)

    @field_validator("sha256")
    @classmethod
    def validate_digest(cls, value: str) -> str:
        return _validate_sha256(value, "source_records.sha256")


class RuntimeConfigIdentity(BaseModel):
    """Deterministic identity of independently variable calculation settings."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    canonicalization_version: int = Field(
        default=RUNTIME_CONFIG_CANONICALIZATION_VERSION,
        ge=1,
    )
    sha256: str
    benchmark_symbol: str
    base_currency: str
    oversell_policy: Literal["CLAMP", "ERROR"]

    @field_validator("sha256")
    @classmethod
    def validate_digest(cls, value: str) -> str:
        return _validate_sha256(value, "runtime_config.sha256")


class DeterministicCalculationIdentity(BaseModel):
    """Combined deterministic identity seed for the eventual production manifest.

    `calculated_at` is intentionally absent. Run-instance timestamps are not part
    of deterministic calculation identity.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    identity_version: int = Field(default=CALCULATION_IDENTITY_VERSION, ge=1)
    engine_source_commit: str
    source_records: SourceRecordsIdentity
    runtime_config: RuntimeConfigIdentity
    market_inputs_sha256: str
    fx_inputs_sha256: str
    calculation_as_of: date
    combined_sha256: str

    @field_validator("engine_source_commit")
    @classmethod
    def validate_source_commit(cls, value: str) -> str:
        return _validate_git_sha(value)

    @field_validator("market_inputs_sha256", "fx_inputs_sha256", "combined_sha256")
    @classmethod
    def validate_component_digest(cls, value: str) -> str:
        return _validate_sha256(value, "calculation identity digest")


def _canonicalize(value: Any) -> Any:
    """Return a JSON-safe, type-explicit deterministic representation."""

    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise CalculationManifestError("canonical float must be finite")
        return {"$float_hex": value.hex()}
    if isinstance(value, datetime):
        raise CalculationManifestError(
            "datetime is ambiguous; serialize date/as-of and run timestamp explicitly"
        )
    if isinstance(value, date):
        return {"$date": value.isoformat()}
    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise CalculationManifestError("canonical mapping keys must be strings")
        return {key: _canonicalize(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]
    raise CalculationManifestError(
        f"unsupported canonical value type: {type(value).__name__}"
    )


def canonical_json_bytes(value: Any) -> bytes:
    """Serialize a supported value to version-1 canonical UTF-8 JSON bytes."""

    envelope = {
        "canonical_json_version": CANONICAL_JSON_VERSION,
        "value": _canonicalize(value),
    }
    return json.dumps(
        envelope,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    """Return SHA-256 of the versioned canonical JSON representation."""

    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def _record_id(value: Any) -> int:
    if isinstance(value, bool):
        raise CalculationManifestError("record id must be a positive integer")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError("record id must be a positive integer") from exc
    if not math.isfinite(numeric) or not numeric.is_integer() or numeric <= 0:
        raise CalculationManifestError("record id must be a positive integer")
    return int(numeric)


def _record_date(value: Any) -> date:
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError("transaction Date is invalid") from exc
    if pd.isna(timestamp) or timestamp.tzinfo is not None:
        raise CalculationManifestError("transaction Date must be a timezone-naive date")
    if timestamp != timestamp.normalize():
        raise CalculationManifestError("transaction Date must not contain time-of-day")
    return timestamp.date()


def _finite_float(value: Any, label: str) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise CalculationManifestError(f"{label} must be numeric") from exc
    if not math.isfinite(numeric):
        raise CalculationManifestError(f"{label} must be finite")
    return numeric


def canonical_source_records_projection(records: pd.DataFrame) -> dict[str, Any]:
    """Project normalized Schema-2 source records onto calculation-relevant fields."""

    if not isinstance(records, pd.DataFrame):
        raise CalculationManifestError("source records must be a pandas DataFrame")
    missing = [field for field in TRANSACTION_FIELDS if field not in records.columns]
    if missing:
        raise CalculationManifestError(
            "source records missing required fields: " + ", ".join(missing)
        )
    if records.empty:
        raise CalculationManifestError("source records must not be empty")

    rows: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for _, raw in records.iterrows():
        record_id = _record_id(raw["id"])
        if record_id in seen_ids:
            raise CalculationManifestError("source record ids must be unique")
        seen_ids.add(record_id)

        txn_date = _record_date(raw["Date"])
        symbol = str(raw["Symbol"] or "").strip().upper()
        txn_type = str(raw["Type"] or "").strip().upper()
        if not symbol:
            raise CalculationManifestError("transaction Symbol must be non-empty")
        if txn_type not in SUPPORTED_TRANSACTION_TYPES:
            raise CalculationManifestError(
                f"unsupported transaction Type: {txn_type or '<empty>'}"
            )

        qty = _finite_float(raw["Qty"], "Qty")
        price = _finite_float(raw["Price"], "Price")
        commission = _finite_float(raw["Commission"], "Commission")
        tax = _finite_float(raw["Tax"], "Tax")
        if qty <= 0:
            raise CalculationManifestError("Qty must be positive")
        if price < 0:
            raise CalculationManifestError("Price must be non-negative")

        raw_tag = raw["Tag"]
        tag = "" if pd.isna(raw_tag) else str(raw_tag)
        rows.append(
            {
                "id": record_id,
                "Date": txn_date,
                "Symbol": symbol,
                "Type": txn_type,
                "Qty": qty,
                "Price": price,
                "Commission": commission,
                "Tax": tax,
                "Tag": tag,
            }
        )

    rows.sort(key=lambda row: (row["Date"], row["id"]))
    return {
        "canonicalization_version": TRANSACTION_CANONICALIZATION_VERSION,
        "fields": list(TRANSACTION_FIELDS),
        "rows": rows,
    }


def build_source_records_identity(records: pd.DataFrame) -> SourceRecordsIdentity:
    """Build deterministic source-record identity plus diagnostic count/max id."""

    projection = canonical_source_records_projection(records)
    rows = projection["rows"]
    return SourceRecordsIdentity(
        sha256=canonical_sha256(projection),
        record_count=len(rows),
        max_record_id=max(row["id"] for row in rows),
    )


def canonical_runtime_config_projection(
    *,
    benchmark_symbol: str,
    base_currency: str,
    oversell_policy: str,
) -> dict[str, Any]:
    """Project independently variable material runtime settings."""

    benchmark = str(benchmark_symbol or "").strip().upper()
    currency = str(base_currency or "").strip().upper()
    policy = str(oversell_policy or "").strip().upper()
    if not benchmark:
        raise CalculationManifestError("benchmark_symbol must be non-empty")
    if not currency:
        raise CalculationManifestError("base_currency must be non-empty")
    if policy not in SUPPORTED_OVERSELL_POLICIES:
        raise CalculationManifestError("oversell_policy must be CLAMP or ERROR")
    return {
        "canonicalization_version": RUNTIME_CONFIG_CANONICALIZATION_VERSION,
        "benchmark_symbol": benchmark,
        "base_currency": currency,
        "oversell_policy": policy,
    }


def build_runtime_config_identity(
    *,
    benchmark_symbol: str,
    base_currency: str,
    oversell_policy: str,
) -> RuntimeConfigIdentity:
    """Build deterministic runtime-config identity."""

    projection = canonical_runtime_config_projection(
        benchmark_symbol=benchmark_symbol,
        base_currency=base_currency,
        oversell_policy=oversell_policy,
    )
    return RuntimeConfigIdentity(
        sha256=canonical_sha256(projection),
        benchmark_symbol=projection["benchmark_symbol"],
        base_currency=projection["base_currency"],
        oversell_policy=projection["oversell_policy"],
    )


def resolve_engine_source_commit(
    source_commit: str | None = None,
    *,
    environ: Mapping[str, str] | None = None,
) -> str:
    """Resolve and validate exact calculation-engine Git identity.

    An explicit value wins. Otherwise use GitHub Actions' `GITHUB_SHA`. The
    function intentionally does not fall back to branch names or abbreviated SHAs.
    """

    environment = os.environ if environ is None else environ
    candidate = source_commit if source_commit is not None else environment.get("GITHUB_SHA", "")
    try:
        return _validate_git_sha(candidate)
    except ValueError as exc:
        raise CalculationManifestError(str(exc)) from exc


def build_deterministic_calculation_identity(
    *,
    engine_source_commit: str,
    source_records: SourceRecordsIdentity,
    runtime_config: RuntimeConfigIdentity,
    market_inputs_sha256: str,
    fx_inputs_sha256: str,
    calculation_as_of: date,
) -> DeterministicCalculationIdentity:
    """Combine deterministic component identities into one versioned digest."""

    try:
        source_commit = _validate_git_sha(engine_source_commit)
        market_digest = _validate_sha256(market_inputs_sha256, "market_inputs_sha256")
        fx_digest = _validate_sha256(fx_inputs_sha256, "fx_inputs_sha256")
    except ValueError as exc:
        raise CalculationManifestError(str(exc)) from exc
    if not isinstance(calculation_as_of, date) or isinstance(calculation_as_of, datetime):
        raise CalculationManifestError("calculation_as_of must be a date")

    deterministic_payload = {
        "identity_version": CALCULATION_IDENTITY_VERSION,
        "engine_source_commit": source_commit,
        "source_records": source_records.model_dump(),
        "runtime_config": runtime_config.model_dump(),
        "market_inputs_sha256": market_digest,
        "fx_inputs_sha256": fx_digest,
        "calculation_as_of": calculation_as_of,
    }
    combined_digest = canonical_sha256(deterministic_payload)
    return DeterministicCalculationIdentity(
        engine_source_commit=source_commit,
        source_records=source_records,
        runtime_config=runtime_config,
        market_inputs_sha256=market_digest,
        fx_inputs_sha256=fx_digest,
        calculation_as_of=calculation_as_of,
        combined_sha256=combined_digest,
    )
