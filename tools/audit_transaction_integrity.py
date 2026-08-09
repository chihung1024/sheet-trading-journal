"""Read-only Gate C production transaction-integrity audit.

This tool fetches source records, downloads market/split data, constructs the
independent split-adjusted ledger, and audits deterministic Schema-2 Date/id
position prefixes. It never calculates or uploads portfolio snapshots and never
mutates records/settings.

The machine-readable output contains counts only. It never emits free-form
notes, user identifiers, symbols, record ids, quantities, prices, or raw/hashed
broker identifiers. Structured provenance duplicates are evaluated within each
user so unrelated tenants cannot create cross-user false positives.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import sys
from collections import defaultdict
from datetime import timedelta
from pathlib import Path
from typing import Any

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import main as runner
from journal_engine.clients.api_client import CloudflareClient
from journal_engine.clients.market_data import MarketDataClient
from journal_engine.config import API_KEY
from journal_engine.core.ledger_integrity import audit_transaction_prefix_integrity
from journal_engine.core.split_ledger import build_split_adjusted_validation_ledger


RESULT_PREFIX = "GATE_C_TRANSACTION_INTEGRITY_AUDIT="
STRUCTURED_NOTE_TOKEN_RE = re.compile(
    r"(?:^|[\s|;,])"
    r"(?P<key>import_key|order_id|trade_id|executed_at_utc|executed_at_taipei|executed_at|trade_time)"
    r"\s*[:=]\s*(?P<value>[^\s|;,]+)",
    re.IGNORECASE,
)


class ProductionAuditError(RuntimeError):
    """Raised when read-only production evidence cannot be trusted."""


def _normalized_market_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(frame, pd.DataFrame) or frame.empty:
        raise ProductionAuditError("split market data is unavailable")
    if "Split_Factor" not in frame.columns:
        raise ProductionAuditError("split market data has no Split_Factor")

    normalized = frame.copy(deep=True)
    try:
        index = pd.to_datetime(normalized.index, errors="raise")
    except (TypeError, ValueError) as exc:
        raise ProductionAuditError("market dates are invalid") from exc
    if getattr(index, "tz", None) is not None:
        index = index.tz_localize(None)
    normalized.index = index.normalize()
    normalized = normalized.sort_index(kind="stable")
    normalized["Split_Factor"] = pd.to_numeric(
        normalized["Split_Factor"], errors="coerce"
    )
    return normalized


def validate_split_multiplier_coverage(
    transactions_df: pd.DataFrame,
    market_client: Any,
) -> None:
    """Fail closed before split adjustment can silently fall back to factor 1."""
    market_data = getattr(market_client, "market_data", None)
    if not isinstance(market_data, dict):
        raise ProductionAuditError("market client has no auditable market_data")

    position_rows = transactions_df[
        transactions_df["Type"].astype(str).str.strip().str.upper().isin({"BUY", "SELL"})
    ]
    for symbol, symbol_df in position_rows.groupby("Symbol", sort=True):
        symbol_key = str(symbol).strip().upper()
        frame = _normalized_market_frame(market_data.get(symbol_key))
        factors = frame["Split_Factor"].dropna()
        if factors.empty:
            raise ProductionAuditError("split history has no usable factors")

        for raw_date in symbol_df["Date"]:
            transaction_date = pd.Timestamp(raw_date)
            if transaction_date.tzinfo is not None:
                transaction_date = transaction_date.tz_localize(None)
            transaction_date = transaction_date.normalize()

            eligible = factors.loc[factors.index <= transaction_date]
            if eligible.empty:
                raise ProductionAuditError("split history starts after a transaction date")
            expected = float(eligible.iloc[-1])
            if not math.isfinite(expected) or expected <= 0:
                raise ProductionAuditError("split factor is not positive and finite")

            observed = float(
                market_client.get_transaction_multiplier(symbol_key, transaction_date)
            )
            if not math.isfinite(observed) or observed <= 0:
                raise ProductionAuditError("split multiplier API returned an invalid factor")
            if not math.isclose(observed, expected, rel_tol=1e-12, abs_tol=1e-12):
                raise ProductionAuditError("split multiplier API diverges from market data")


def _duplicate_group_summary(
    values_by_user: dict[str, dict[str, set[int]]],
) -> dict[str, int]:
    groups = 0
    rows = 0
    for values_by_identifier in values_by_user.values():
        for record_ids in values_by_identifier.values():
            unique_ids = set(int(record_id) for record_id in record_ids)
            if len(unique_ids) < 2:
                continue
            groups += 1
            rows += len(unique_ids)
    return {"groups": groups, "rows": rows}


def audit_structured_note_provenance(records_df: pd.DataFrame) -> dict[str, Any]:
    """Count explicit note metadata without exposing identifiers or note text."""
    notes_total = len(records_df)
    notes_nonempty = 0
    token_counts: dict[str, int] = defaultdict(int)
    values: dict[str, dict[str, dict[str, set[int]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(set))
    )

    if "note" not in records_df.columns:
        return {
            "rows": notes_total,
            "nonempty_notes": 0,
            "token_counts": {},
            "duplicate_import_key": {"groups": 0, "rows": 0},
            "duplicate_trade_id": {"groups": 0, "rows": 0},
            "repeated_order_id": {"groups": 0, "rows": 0},
        }

    for _, row in records_df.iterrows():
        note = str(row.get("note") or "").strip()
        if not note:
            continue
        notes_nonempty += 1
        record_id = int(row["id"])
        user_id = str(row.get("user_id") or "").strip().casefold()
        if not user_id:
            raise ProductionAuditError("structured provenance row has no user identity")
        for match in STRUCTURED_NOTE_TOKEN_RE.finditer(note):
            key = match.group("key").lower()
            value = match.group("value").strip()
            if not value:
                continue
            token_counts[key] += 1
            values[key][user_id][value].add(record_id)

    return {
        "rows": notes_total,
        "nonempty_notes": notes_nonempty,
        "token_counts": dict(sorted(token_counts.items())),
        "duplicate_import_key": _duplicate_group_summary(values.get("import_key", {})),
        "duplicate_trade_id": _duplicate_group_summary(values.get("trade_id", {})),
        # Repeated order ids are evidence only: one broker order may legitimately
        # contain multiple fills/rows, so these are not automatically violations.
        "repeated_order_id": _duplicate_group_summary(values.get("order_id", {})),
    }


def build_audit_result(
    transactions_df: pd.DataFrame,
    user_list: list[str],
    market_client: Any,
) -> dict[str, Any]:
    validate_split_multiplier_coverage(transactions_df, market_client)

    total_scope_count = 0
    total_symbol_scope_count = 0
    total_prefix_violations = 0
    all_scope_violations = 0
    tag_scope_violations = 0
    users_with_violations = 0

    # Split adjustment can log transaction symbols when a non-1 factor is used.
    # Audit runs on a public-repository Actions runner, so suppress those details.
    split_logger = logging.getLogger("journal_engine.core.split_ledger")
    previous_split_level = split_logger.level
    split_logger.setLevel(logging.CRITICAL)
    try:
        for user_id in user_list:
            raw_user_df = transactions_df[
                transactions_df["user_id"] == user_id
            ].copy(deep=True)
            if raw_user_df.empty:
                raise ProductionAuditError("normalized user ledger unexpectedly became empty")

            validation_df = build_split_adjusted_validation_ledger(
                raw_user_df,
                market_client,
            )
            audit = audit_transaction_prefix_integrity(validation_df)
            total_scope_count += audit.scope_count
            total_symbol_scope_count += audit.symbol_scope_count
            violation_count = len(audit.violations)
            total_prefix_violations += violation_count
            if violation_count:
                users_with_violations += 1
            all_scope_violations += sum(
                violation.scope == "all" for violation in audit.violations
            )
            tag_scope_violations += sum(
                violation.scope != "all" for violation in audit.violations
            )
    finally:
        split_logger.setLevel(previous_split_level)

    provenance = audit_structured_note_provenance(transactions_df)
    duplicate_imports = provenance["duplicate_import_key"]["groups"]
    duplicate_trade_ids = provenance["duplicate_trade_id"]["groups"]

    return {
        "schema_version": 1,
        "mode": "read_only",
        "source_commit": os.environ.get("GITHUB_SHA", "local"),
        "qualification": (
            "clear"
            if total_prefix_violations == 0
            and duplicate_imports == 0
            and duplicate_trade_ids == 0
            else "blocked"
        ),
        "summary": {
            "users": len(user_list),
            "rows": len(transactions_df),
            "scopes": total_scope_count,
            "symbol_scopes": total_symbol_scope_count,
            "prefix_violations": total_prefix_violations,
            "users_with_prefix_violations": users_with_violations,
            "all_scope_prefix_violations": all_scope_violations,
            "tag_scope_prefix_violations": tag_scope_violations,
            "duplicate_import_key_groups": duplicate_imports,
            "duplicate_import_key_rows": provenance["duplicate_import_key"]["rows"],
            "duplicate_trade_id_groups": duplicate_trade_ids,
            "duplicate_trade_id_rows": provenance["duplicate_trade_id"]["rows"],
            "repeated_order_id_groups": provenance["repeated_order_id"]["groups"],
            "repeated_order_id_rows": provenance["repeated_order_id"]["rows"],
        },
        "provenance": {
            "rows": provenance["rows"],
            "nonempty_notes": provenance["nonempty_notes"],
            "token_counts": provenance["token_counts"],
        },
    }


def run_audit() -> dict[str, Any]:
    if not API_KEY:
        raise ProductionAuditError("API_KEY is unavailable")

    target_user_id = os.environ.get("TARGET_USER_ID", "").strip()
    api_client = CloudflareClient()
    market_client = MarketDataClient()

    records = api_client.fetch_records(target_user_id=target_user_id or None)
    transactions_df, user_list = runner.prepare_transactions(records, target_user_id)

    symbols = sorted(set(transactions_df["Symbol"].astype(str).str.strip().str.upper()))
    earliest_date = transactions_df["Date"].min()

    # Avoid symbol-bearing INFO/WARNING output from market acquisition during a
    # public Actions audit. The audit emits its own non-sensitive status line.
    market_logger = logging.getLogger("journal_engine.clients.market_data")
    previous_market_level = market_logger.level
    market_logger.setLevel(logging.CRITICAL)
    try:
        market_client.download_data(symbols, earliest_date - timedelta(days=90))
    finally:
        market_logger.setLevel(previous_market_level)

    return build_audit_result(transactions_df, user_list, market_client)


def main() -> int:
    runner.setup_logging()
    logger = logging.getLogger("gate_c_transaction_integrity_audit")
    try:
        result = run_audit()
    except Exception as exc:
        logger.error(
            "Gate C read-only audit execution failed [error=%s]",
            exc.__class__.__name__,
        )
        return 1

    print(RESULT_PREFIX + json.dumps(result, sort_keys=True, separators=(",", ":")))
    logger.info(
        "Gate C read-only audit completed: qualification=%s users=%s rows=%s "
        "prefix_violations=%s duplicate_import_keys=%s duplicate_trade_ids=%s",
        result["qualification"],
        result["summary"]["users"],
        result["summary"]["rows"],
        result["summary"]["prefix_violations"],
        result["summary"]["duplicate_import_key_groups"],
        result["summary"]["duplicate_trade_id_groups"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
