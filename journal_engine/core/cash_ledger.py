"""Deterministic shadow cash-ledger derivation.

R2.4A deliberately stops before production account-value activation.  The module
accepts already-authoritative transaction rows plus explicit cash events and
builds a currency-separated audit report.  It never fetches data, never mutates
portfolio snapshots, never converts FX, and never claims intra-day chronology.

An opening balance is a baseline state, not a movement.  Earlier movements are
retained as audit evidence but are absorbed by the baseline.  A movement on the
same calendar date as the opening balance is intentionally ambiguous because
R2.3 stores only ``event_date`` and R2.2 transaction chronology is not activated.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
import math
from numbers import Number
import re
from typing import Any, Iterable, Mapping, Optional, Tuple

import pandas as pd


SUPPORTED_TRANSACTION_TYPES = frozenset({"BUY", "SELL", "DIV"})
SUPPORTED_CASH_EVENT_TYPES = frozenset({
    "OPENING_BALANCE",
    "DEPOSIT",
    "WITHDRAWAL",
})
CASH_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ShadowCashLedgerError(RuntimeError):
    """Base error for shadow cash-ledger derivation."""


class ShadowCashLedgerInputError(ShadowCashLedgerError):
    """Raised when supplied authoritative facts are structurally invalid."""


@dataclass(frozen=True)
class ShadowCashLedgerEntry:
    """One normalized cash fact in its native cash denomination."""

    date: str
    currency: str
    source: str
    source_id: int
    event_type: str
    amount: Decimal
    baseline: bool = False


@dataclass(frozen=True)
class ShadowCashLedgerIssue:
    """A fact gap that prevents an authoritative cash-balance conclusion."""

    code: str
    source: str
    source_id: int
    date: Optional[str]
    currency: Optional[str]
    detail: str


@dataclass(frozen=True)
class ShadowCashCurrencySummary:
    """Currency-local shadow balance and coverage evidence."""

    currency: str
    opening_date: Optional[str]
    opening_balance: Optional[Decimal]
    net_movement_all: Decimal
    movement_since_opening: Decimal
    balance: Optional[Decimal]
    pre_opening_movement_count: int
    opening_date_movement_count: int
    status: str


@dataclass(frozen=True)
class ShadowCashLedgerReport:
    """Read-only R2.4A shadow result; never a production NAV authority."""

    entries: Tuple[ShadowCashLedgerEntry, ...]
    currencies: Tuple[ShadowCashCurrencySummary, ...]
    issues: Tuple[ShadowCashLedgerIssue, ...]
    transaction_rows: int
    resolved_transaction_rows: int
    cash_event_rows: int
    resolved_cash_event_rows: int

    @property
    def complete(self) -> bool:
        return (
            not self.issues
            and self.transaction_rows == self.resolved_transaction_rows
            and self.cash_event_rows == self.resolved_cash_event_rows
            and bool(self.currencies)
            and all(summary.status == "complete" for summary in self.currencies)
        )

    def summary_for(self, currency: str) -> ShadowCashCurrencySummary:
        for summary in self.currencies:
            if summary.currency == currency:
                return summary
        raise KeyError(currency)


def build_shadow_cash_ledger(
    transactions_df: pd.DataFrame,
    cash_events: Iterable[Mapping[str, Any]] | None,
) -> ShadowCashLedgerReport:
    """Build a deterministic currency-separated shadow cash ledger.

    Transaction currency must be explicitly persisted.  Symbol-based currency
    inference is intentionally forbidden.  The R2.2 special quote unit ``GBp``
    is also unresolved here because a quote unit is not itself an account cash
    denomination and R2.4A has no reviewed settlement-normalization rule.
    """

    tx_entries, tx_issues, tx_rows, resolved_tx_rows = _normalize_transactions(
        transactions_df
    )
    cash_entries, cash_rows = _normalize_cash_events(cash_events)

    entries = tuple(sorted(
        (*tx_entries, *cash_entries),
        key=_entry_sort_key,
    ))
    issues = list(tx_issues)

    if not entries and not issues:
        issues.append(ShadowCashLedgerIssue(
            code="NO_CASH_FACTS",
            source="LEDGER",
            source_id=0,
            date=None,
            currency=None,
            detail="No authoritative cash facts are available; cash cannot be assumed to be zero.",
        ))

    summaries, coverage_issues = _summarize_currencies(entries)
    issues.extend(coverage_issues)
    issues.sort(key=_issue_sort_key)

    return ShadowCashLedgerReport(
        entries=entries,
        currencies=tuple(summaries),
        issues=tuple(issues),
        transaction_rows=tx_rows,
        resolved_transaction_rows=resolved_tx_rows,
        cash_event_rows=cash_rows,
        resolved_cash_event_rows=cash_rows,
    )


def _normalize_transactions(
    transactions_df: pd.DataFrame,
) -> tuple[list[ShadowCashLedgerEntry], list[ShadowCashLedgerIssue], int, int]:
    if not isinstance(transactions_df, pd.DataFrame):
        raise ShadowCashLedgerInputError("transaction ledger must be a DataFrame")

    required = {
        "id", "Date", "Type", "Qty", "Price", "Commission", "Tax", "currency"
    }
    missing = sorted(required - set(transactions_df.columns))
    if missing:
        raise ShadowCashLedgerInputError(
            f"transaction ledger is missing required columns: {', '.join(missing)}"
        )

    if transactions_df.empty:
        return [], [], 0, 0

    ids = _normalize_unique_ids(transactions_df["id"], "transaction")
    entries: list[ShadowCashLedgerEntry] = []
    issues: list[ShadowCashLedgerIssue] = []
    resolved = 0

    for position, (_, row) in enumerate(transactions_df.iterrows()):
        source_id = ids[position]
        date = _normalize_dataframe_date(row["Date"], "transaction date")
        raw_type = row["Type"]
        txn_type = "" if raw_type is None or _is_na(raw_type) else str(raw_type).strip().upper()
        if txn_type not in SUPPORTED_TRANSACTION_TYPES:
            raise ShadowCashLedgerInputError(
                f"transaction {source_id} has unsupported type: {txn_type or '<empty>'}"
            )

        qty = _decimal(row["Qty"], f"transaction {source_id} quantity")
        price = _decimal(row["Price"], f"transaction {source_id} price")
        commission = abs(_decimal(
            row["Commission"], f"transaction {source_id} commission"
        ))
        tax = abs(_decimal(row["Tax"], f"transaction {source_id} tax"))
        if qty <= 0:
            raise ShadowCashLedgerInputError(
                f"transaction {source_id} quantity must be positive"
            )
        if price < 0:
            raise ShadowCashLedgerInputError(
                f"transaction {source_id} price must not be negative"
            )

        raw_currency = row["currency"]
        currency_issue = _transaction_currency_issue(
            raw_currency,
            source_id=source_id,
            date=date,
        )
        if currency_issue is not None:
            issues.append(currency_issue)
            continue
        currency = str(raw_currency).strip()

        if txn_type == "DIV" and (commission != 0 or tax != 0):
            issues.append(ShadowCashLedgerIssue(
                code="DIVIDEND_ECONOMICS_UNRESOLVED",
                source="TRANSACTION",
                source_id=source_id,
                date=date,
                currency=currency,
                detail=(
                    "DIV cash is only authoritative when Price already represents the "
                    "net cash amount and Commission/Tax are zero."
                ),
            ))
            continue

        if txn_type == "BUY":
            amount = -(qty * price + commission + tax)
        elif txn_type == "SELL":
            # Cash follows the persisted trade economics, not the holdings engine's
            # compatibility oversell clamp.  A recorded SELL is an actual cash fact.
            amount = qty * price - commission - tax
        else:  # confirmed DIV record
            amount = qty * price

        entries.append(ShadowCashLedgerEntry(
            date=date,
            currency=currency,
            source="TRANSACTION",
            source_id=source_id,
            event_type=txn_type,
            amount=amount,
            baseline=False,
        ))
        resolved += 1

    return entries, issues, len(transactions_df), resolved


def _normalize_cash_events(
    cash_events: Iterable[Mapping[str, Any]] | None,
) -> tuple[list[ShadowCashLedgerEntry], int]:
    if cash_events is None:
        rows: list[Mapping[str, Any]] = []
    else:
        try:
            rows = list(cash_events)
        except TypeError as exc:
            raise ShadowCashLedgerInputError("cash events must be iterable") from exc

    for row in rows:
        if not isinstance(row, Mapping):
            raise ShadowCashLedgerInputError("each cash event must be a mapping")

    ids = _normalize_unique_ids(
        [row.get("id") for row in rows],
        "cash event",
    )
    entries: list[ShadowCashLedgerEntry] = []
    opening_by_currency: dict[str, int] = {}

    for position, row in enumerate(rows):
        source_id = ids[position]
        date = _normalize_cash_event_date(
            row.get("event_date"), f"cash event {source_id} date"
        )
        raw_event_type = row.get("event_type")
        event_type = (
            "" if raw_event_type is None or _is_na(raw_event_type)
            else str(raw_event_type).strip().upper()
        )
        if event_type not in SUPPORTED_CASH_EVENT_TYPES:
            raise ShadowCashLedgerInputError(
                f"cash event {source_id} has unsupported type: {event_type or '<empty>'}"
            )

        raw_cash_currency = row.get("currency")
        currency = (
            "" if raw_cash_currency is None or _is_na(raw_cash_currency)
            else str(raw_cash_currency).strip()
        )
        if not CASH_CURRENCY_RE.fullmatch(currency):
            raise ShadowCashLedgerInputError(
                f"cash event {source_id} currency must be exactly three uppercase letters"
            )

        amount = _decimal(row.get("amount"), f"cash event {source_id} amount")
        baseline = event_type == "OPENING_BALANCE"
        if baseline:
            if currency in opening_by_currency:
                raise ShadowCashLedgerInputError(
                    f"multiple opening balances exist for {currency}: "
                    f"{opening_by_currency[currency]} and {source_id}"
                )
            opening_by_currency[currency] = source_id
            signed_amount = amount
        else:
            if amount <= 0:
                raise ShadowCashLedgerInputError(
                    f"cash event {source_id} {event_type} amount must be positive"
                )
            signed_amount = amount if event_type == "DEPOSIT" else -amount

        entries.append(ShadowCashLedgerEntry(
            date=date,
            currency=currency,
            source="CASH_EVENT",
            source_id=source_id,
            event_type=event_type,
            amount=signed_amount,
            baseline=baseline,
        ))

    return entries, len(rows)


def _summarize_currencies(
    entries: tuple[ShadowCashLedgerEntry, ...],
) -> tuple[list[ShadowCashCurrencySummary], list[ShadowCashLedgerIssue]]:
    summaries: list[ShadowCashCurrencySummary] = []
    issues: list[ShadowCashLedgerIssue] = []
    currencies = sorted({entry.currency for entry in entries})

    for currency in currencies:
        currency_entries = [entry for entry in entries if entry.currency == currency]
        openings = [entry for entry in currency_entries if entry.baseline]
        if len(openings) > 1:
            # Normally prevented while normalizing cash events, retained as an invariant.
            raise ShadowCashLedgerInputError(
                f"multiple opening balances exist for {currency}"
            )
        movements = [entry for entry in currency_entries if not entry.baseline]
        net_all = sum((entry.amount for entry in movements), Decimal("0"))

        if not openings:
            earliest = min((entry.date for entry in movements), default=None)
            issues.append(ShadowCashLedgerIssue(
                code="MISSING_OPENING_BALANCE",
                source="CURRENCY",
                source_id=0,
                date=earliest,
                currency=currency,
                detail=(
                    f"{currency} has cash movement but no explicit opening balance; "
                    "only net movement can be reported."
                ),
            ))
            summaries.append(ShadowCashCurrencySummary(
                currency=currency,
                opening_date=None,
                opening_balance=None,
                net_movement_all=net_all,
                movement_since_opening=net_all,
                balance=None,
                pre_opening_movement_count=0,
                opening_date_movement_count=0,
                status="missing_opening",
            ))
            continue

        opening = openings[0]
        before = [entry for entry in movements if entry.date < opening.date]
        same_day = [entry for entry in movements if entry.date == opening.date]
        after = [entry for entry in movements if entry.date > opening.date]
        movement_since = sum((entry.amount for entry in after), Decimal("0"))

        if same_day:
            issues.append(ShadowCashLedgerIssue(
                code="OPENING_DATE_ACTIVITY_AMBIGUOUS",
                source="CASH_EVENT",
                source_id=opening.source_id,
                date=opening.date,
                currency=currency,
                detail=(
                    f"{currency} opening balance shares its calendar date with "
                    f"{len(same_day)} cash movement(s); no authoritative intra-day "
                    "ordering is available."
                ),
            ))
            status = "opening_date_ambiguous"
            balance: Optional[Decimal] = None
        else:
            status = "complete"
            balance = opening.amount + movement_since

        summaries.append(ShadowCashCurrencySummary(
            currency=currency,
            opening_date=opening.date,
            opening_balance=opening.amount,
            net_movement_all=net_all,
            movement_since_opening=movement_since,
            balance=balance,
            pre_opening_movement_count=len(before),
            opening_date_movement_count=len(same_day),
            status=status,
        ))

    return summaries, issues


def _transaction_currency_issue(
    raw_currency: Any,
    *,
    source_id: int,
    date: str,
) -> Optional[ShadowCashLedgerIssue]:
    if raw_currency is None or _is_na(raw_currency):
        value = ""
    else:
        value = str(raw_currency).strip()

    if not value:
        return ShadowCashLedgerIssue(
            code="TRANSACTION_CURRENCY_MISSING",
            source="TRANSACTION",
            source_id=source_id,
            date=date,
            currency=None,
            detail=(
                "Transaction cash currency is not explicitly stored; symbol-based "
                "currency inference is forbidden for shadow cash accounting."
            ),
        )
    if value == "GBp":
        return ShadowCashLedgerIssue(
            code="TRANSACTION_QUOTE_UNIT_UNRESOLVED",
            source="TRANSACTION",
            source_id=source_id,
            date=date,
            currency=value,
            detail=(
                "GBp is a quote unit, not an account cash denomination; R2.4A has no "
                "reviewed settlement normalization to GBP."
            ),
        )
    if not CASH_CURRENCY_RE.fullmatch(value):
        return ShadowCashLedgerIssue(
            code="TRANSACTION_CURRENCY_INVALID",
            source="TRANSACTION",
            source_id=source_id,
            date=date,
            currency=value or None,
            detail="Transaction currency is not a canonical three-letter cash currency.",
        )
    return None


def _normalize_unique_ids(values: Iterable[Any], label: str) -> list[int]:
    ids = []
    for raw in values:
        if isinstance(raw, bool):
            raise ShadowCashLedgerInputError(f"{label} id must be a positive integer")
        try:
            numeric = int(raw)
            numeric_float = float(raw)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ShadowCashLedgerInputError(
                f"{label} id must be a positive integer"
            ) from exc
        if not math.isfinite(numeric_float) or numeric <= 0 or numeric_float != numeric:
            raise ShadowCashLedgerInputError(f"{label} id must be a positive integer")
        ids.append(numeric)
    if len(ids) != len(set(ids)):
        raise ShadowCashLedgerInputError(f"{label} ids must be unique")
    return ids


def _decimal(value: Any, label: str) -> Decimal:
    if isinstance(value, bool) or value is None or _is_na(value):
        raise ShadowCashLedgerInputError(f"{label} must be a finite number")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ShadowCashLedgerInputError(f"{label} must be a finite number") from exc
    if not result.is_finite():
        raise ShadowCashLedgerInputError(f"{label} must be a finite number")
    return result


def _normalize_dataframe_date(value: Any, label: str) -> str:
    if value is None or _is_na(value):
        raise ShadowCashLedgerInputError(f"{label} is required")
    if isinstance(value, (Number, Decimal)):
        raise ShadowCashLedgerInputError(f"{label} must be a calendar date, not a number")
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as exc:
        raise ShadowCashLedgerInputError(f"{label} is invalid") from exc
    if pd.isna(timestamp):
        raise ShadowCashLedgerInputError(f"{label} is invalid")
    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_localize(None)
    return timestamp.normalize().strftime("%Y-%m-%d")


def _normalize_cash_event_date(value: Any, label: str) -> str:
    text = "" if value is None or _is_na(value) else str(value).strip()
    if not DATE_RE.fullmatch(text):
        raise ShadowCashLedgerInputError(f"{label} must be YYYY-MM-DD")
    try:
        parsed = datetime.strptime(text, "%Y-%m-%d")
    except ValueError as exc:
        raise ShadowCashLedgerInputError(f"{label} is not a real calendar date") from exc
    return parsed.strftime("%Y-%m-%d")


def _is_na(value: Any) -> bool:
    """Return scalar pandas/NumPy missingness without accepting array truth values."""
    try:
        result = pd.isna(value)
    except (TypeError, ValueError):
        return False
    try:
        return bool(result)
    except (TypeError, ValueError):
        return False


def _entry_sort_key(entry: ShadowCashLedgerEntry) -> tuple[Any, ...]:
    # Presentation/replay stability only.  This order is never execution chronology.
    return (
        entry.date,
        entry.currency,
        0 if entry.baseline else 1,
        entry.source,
        entry.source_id,
        entry.event_type,
    )


def _issue_sort_key(issue: ShadowCashLedgerIssue) -> tuple[Any, ...]:
    return (
        issue.date or "",
        issue.currency or "",
        issue.source,
        issue.source_id,
        issue.code,
    )
