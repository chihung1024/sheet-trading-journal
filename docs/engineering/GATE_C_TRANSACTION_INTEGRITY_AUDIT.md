# Gate C — Schema-2 Transaction Integrity Audit

Status: **C1 audit evidence / no behavior change**  
Qualification base: `03242d00082067333cf77ffa424094b8936b406c`  
Work branch: `pr-gate-c-transaction-integrity-preflight`  
Pre-change recovery: `backup-pre-gate-c-03242d0`

## Purpose

Gate C must determine whether the current Schema-2 transaction ledger can be made fail-closed for impossible position prefixes before changing calculator oversell behavior. This document records the current runtime truth so later implementation does not confuse internal calculation consistency with source-ledger validity.

The initial audit intentionally does **not** change D1 schema, transaction format, calculator policy, frontend, Worker deployment, or broker import architecture.

---

## 1. Executive conclusion

The current runtime is internally consistent around a **clamped, date-level ledger model**, but it does not currently prove that the source transaction sequence is valid.

Three mechanisms can hide an invalid source prefix:

1. `prepare_transactions()` sorts the normalized source by `Date` and `id`, but the calculator reorders same-day rows by `BUY -> DIV -> SELL` whenever no first-class `Timestamp` / `Sequence` exists.
2. `PortfolioCalculator` defaults to `oversell_policy="CLAMP"`; a SELL larger than available inventory is partially executed rather than rejected.
3. Canonical Daily-P&L reconciliation uses matching clamp semantics, while final holdings validation checks only aggregate `BUY - SELL`, not every running prefix.

Therefore, successful snapshot validation and Daily-P&L reconciliation prove consistency of the **clamped model**, not validity of the original source ledger.

A strict `oversell_policy="ERROR"` switch must not be made in isolation. The earliest trustworthy boundary is a deterministic **prefix-integrity preflight** executed on the independent split-adjusted Schema-2 ledger before the calculator is allowed to run.

---

## 2. Runtime consumer inventory

| Path | Input ordering / sequence | Oversell behavior | Fee / tax | Failure semantics | Current runtime relevance |
|---|---|---|---|---|---|
| `main.prepare_transactions()` | stable `Date`, then `id` when present | none | parses finite numeric values; no sign normalization | raises `PortfolioUpdateError` | authoritative ingest normalization |
| `PortfolioCalculator._calculate_single_portfolio()` | per valuation date: `Timestamp` if present → `Sequence` if present → `BUY/DIV/SELL` priority; stable source order inside ties | default `CLAMP`; optional `ERROR` | negative Commission/Tax warn then `abs()` | calculation exception propagates to per-user failure | authoritative holdings / FIFO / realized P&L / history / TWR / XIRR producer |
| `daily_pnl_reconciler._ordered_transactions()` / `_replay_symbol()` | `Date` → optional `Timestamp` → optional `Sequence` → `BUY/DIV/SELL` priority → `id` | clamps requested SELL to available qty | `abs()` | reconciliation mismatch / invalid values raise and block upload | authoritative published Daily-P&L reconciliation |
| `PortfolioValidator.validate_holdings_consistency()` | no replay order; aggregates BUY and SELL by symbol | cannot detect a negative intermediate prefix | N/A | returns false + ERROR log; runner blocks upload | final-quantity safeguard only |
| `split_ledger.build_split_adjusted_validation_ledger()` | preserves source rows / identity while independently applying split multipliers | no prefix validation | N/A | invalid split / non-finite / invariant failure raises | authoritative independent split-adjusted validation ledger |
| `split_ledger.validate_adjusted_ledger_parity()` | row/index parity | no prefix validation | N/A | false / error causes runner failure | verifies calculator and independent split adjustment agree |
| `TransactionAnalyzer` | `Date` → internal `_sequence` derived from current row order | clamps / warns | `abs()` | catches broad exception and returns zero `PositionSnapshot` | currently appears legacy/non-runtime; import remains but no active constructor call found |
| `transaction_calendar` | transaction dates only | N/A | N/A | fail-closed date/calendar handling | valuation calendar support; not a lot/position consumer |
| performance metrics | consume calculator history / XIRR cash flows rather than raw records directly | inherits upstream semantics | inherits upstream | metric-specific unavailable/undefined handling | downstream; does not independently validate source prefixes |

### Consumer-search result

Repository searches for `transactions_df`, adjusted ledger consumers, SELL handling, and `TransactionAnalyzer` calls found no additional independent lot engine outside the calculator, canonical Daily-P&L reconciler, validator, split ledger, and legacy analyzer listed above.

---

## 3. Current production ordering semantics

### 3.1 Ingest order

The Worker record API returns deterministic pages ordered by:

`txn_date DESC, created_at DESC, id DESC`

The Python client verifies positive integer record ids and rejects duplicate ids across pages. `prepare_transactions()` then normalizes the complete batch and performs a stable ascending sort:

`Date -> id`

Thus Schema 2 currently has one reliable deterministic source-ledger tie-breaker available to the runner: **record `id`**.

### 3.2 Calculator order

Within each valuation date the calculator sorts by:

`Timestamp? -> Sequence? -> Type priority (BUY=1, DIV=2, SELL=3)`

Production `prepare_transactions()` currently supplies neither `Timestamp` nor `Sequence`. It also does not parse `note` into either field.

Effective production calculator order is therefore:

`Date -> BUY/DIV/SELL priority -> stable id order inside the same type`

This can differ from source insertion order when BUY and SELL occur on the same date.

### 3.3 Canonical Daily-P&L order

The reconciler uses:

`Date -> Timestamp? -> Sequence? -> Type priority -> id`

With current production input this is effectively:

`Date -> BUY/DIV/SELL priority -> id`

This deliberately agrees with the calculator, which is useful for reconciliation but cannot independently prove true source chronology.

### 3.4 Broker execution truth is a different concept

`Date -> id` is deterministic under Schema 2, but it is **not a guarantee of broker execution chronology**. Existing note metadata may contain IBKR order ids or timestamps, but `note` is free-form metadata and is not an authorized financial ordering field.

Gate C therefore distinguishes:

- **Schema-2 ledger validity order:** `Date -> id`;
- **true broker execution order:** not guaranteed without a future first-class execution identity/time contract.

Gate C may validate the first without pretending to solve the second.

---

## 4. Oversell behavior and why current checks are insufficient

### Calculator

For SELL:

- available FIFO inventory is summed;
- executable quantity is `min(requested, available)`;
- empty inventory causes warning + ignored SELL;
- partial oversell warns and continues when policy is `CLAMP`;
- only explicit `oversell_policy="ERROR"` raises.

The production runner currently constructs `PortfolioCalculator(...)` without specifying `oversell_policy`, so `CLAMP` remains active.

### Canonical Daily-P&L

`_replay_symbol()` independently performs the same economic clamp:

`executed_qty = min(max(qty, 0), requested_qty)`

This means calculator and reconciler can agree perfectly on an invalid source ledger because both intentionally ignore the impossible excess SELL quantity.

### Holdings validator

The current holdings consistency check computes only:

`expected final qty = total BUY - total SELL`

This is necessary but not sufficient. It cannot detect a sequence such as:

- SELL 10
- BUY 10

because the final net quantity is zero even though the first prefix is negative.

A prefix audit is therefore required before calculation.

---

## 5. Same-day ordering test gap

Current `tests/test_daily_pnl.py` includes `test_sequence_stabilizes_same_day_order()` and injects a column named `_sequence`.

However:

- `PortfolioCalculator` does **not** read `_sequence`;
- it only reads `Timestamp` and `Sequence`;
- the test passes because calculator type priority moves the same-day BUY before SELL, not because `_sequence` controls execution.

The test name therefore overstates what is actually protected. Gate C must replace or supplement it with explicit tests for:

1. source `Date -> id` prefix order;
2. calculator priority behavior when execution sequence columns are absent;
3. explicit `Sequence` behavior when such a structured column is intentionally supplied in a test fixture;
4. same-day BUY → SELL → BUY → SELL round-trip cases.

---

## 6. TransactionAnalyzer status

`TransactionAnalyzer` constructs an internal `_sequence = range(len(df))`, sorts by `Date, _sequence`, clamps oversells, and catches broad exceptions by returning a fully zero position snapshot.

That failure behavior would be unacceptable for an authoritative financial path because an integrity exception could become apparently valid zero data.

Current repository search found the class imported by `calculator.py` but found no runtime instantiation/call from the main calculation path. It therefore appears to be legacy/test code at this point.

Gate C should not broaden into a rewrite unless a live consumer is found, but the unsafe zero-on-exception behavior must remain documented so it cannot be reintroduced as an authoritative path without fail-closed remediation.

---

## 7. Split-adjustment requirement for prefix validation

Prefix validation must not operate on unadjusted historical share quantities.

Example: a pre-split BUY and post-split SELL may use different historical share units. `build_split_adjusted_validation_ledger()` already converts every BUY/SELL row into current post-split units using the same date-specific multiplier API as the calculator while preserving transaction notional.

Therefore the proposed preflight order is:

1. normalize raw records with `prepare_transactions()`;
2. download/validate market data and split multipliers;
3. for each user, build the independent split-adjusted validation ledger;
4. run prefix-integrity audit on that adjusted ledger in `Date -> id` order;
5. only after prefix integrity passes, run `PortfolioCalculator`;
6. retain the existing post-calculation split-ledger parity check.

This catches invalid inventory before calculator type-priority reordering or CLAMP can mask it.

---

## 8. Proposed minimal Schema-2 prefix-integrity contract

This is the C1 audit proposal. It is not yet implementation.

### Canonical audit sequence

For each user and each audit scope:

1. require a valid positive integer `id`;
2. sort stably by `Date`, then `id` ascending;
3. evaluate BUY and SELL only for position quantity; DIV does not change quantity;
4. BUY adds adjusted quantity;
5. SELL subtracts adjusted quantity;
6. after every row, running quantity must be `>= -tolerance`;
7. a small residual inside tolerance is normalized to zero for the next comparison;
8. first violation fails the user before calculator execution and reports deterministic non-secret diagnostics.

### Audit scopes

Run the same prefix replay for:

- `all` transactions;
- every active tag group using the same comma/semicolon parsing semantics as the calculator.

A row belonging to multiple tags participates independently in each matching group.

### Provisional quantity tolerance

Use a high-precision tolerance aligned with the existing calculator oversell threshold, not the much wider serialized-holding tolerance.

Proposed provisional formula:

`max(1e-9, cumulative_abs_buy_qty * 1e-12)`

Rationale:

- `1e-9` matches the calculator's current oversell comparison scale;
- the tiny relative component absorbs ordinary floating-point error after split multiplication;
- it remains far below the `0.011` final-holding tolerance, which exists because holdings are serialized to two decimals and is unsuitable for ledger integrity.

The tolerance must be tested against current production data before it becomes an enforcement constant.

### Diagnostic contract

A violation should identify only what is needed for remediation:

- masked user id;
- scope (`all` or tag name);
- symbol;
- transaction date;
- record id;
- transaction type;
- requested adjusted quantity;
- pre-row quantity;
- post-row quantity;
- active tolerance.

Do not log note contents, broker tokens, or raw account secrets.

---

## 9. Required production qualification before strict enforcement

Before changing calculator production policy from `CLAMP` to `ERROR`:

1. run the new preflight in **audit/report mode** over all current production users;
2. audit both `all` and active tag scopes;
3. record total rows, symbols, scopes, and violation count;
4. classify each violation as:
   - floating residue within accepted tolerance;
   - data-entry/import ordering issue;
   - split-unit issue;
   - genuine unsupported short/oversell;
   - unknown;
5. do not enable strict ERROR if any unexplained violation remains;
6. preserve an anonymized evidence artifact in Git history / CI output.

A zero-violation result is qualification evidence, not proof of broker chronology.

---

## 10. C1 decisions

### Accepted

- Schema 2 has enough deterministic identity (`Date + id`) to implement a conservative source-ledger prefix-integrity gate.
- Prefix validation should use the independent split-adjusted ledger and run before the calculator.
- `all` and each active tag scope must be validated.
- Existing aggregate holdings validation remains useful but cannot substitute for prefix validation.
- Existing canonical Daily-P&L reconciliation remains useful but cannot substitute for source-ledger validation.

### Rejected for Gate C initial slice

- parsing free-form `note` to reconstruct execution time;
- adding Schema-3 execution fields;
- assuming `id` equals true broker execution time;
- switching to strict calculator ERROR before production preflight evidence;
- rewriting legacy `TransactionAnalyzer` without evidence that it is a live authoritative path;
- adding futures/derivative support.

---

## 11. Next exact action — C2

Implement a small, standalone Schema-2 ledger-integrity module and tests with no calculator behavior switch yet.

Expected initial API shape:

- tag parser shared or exactly aligned with calculator semantics;
- prefix audit over split-adjusted DataFrame;
- structured violation/result type;
- fail-closed validation wrapper suitable for the runner;
- unit tests for:
  - exact-zero closeout;
  - fractional quantities;
  - same-day source-order round trip;
  - first-row SELL;
  - partial oversell;
  - tolerance-edge floating residue;
  - split-adjusted quantities;
  - multi-tag scopes;
  - deterministic record-id tie breaking.

After implementation tests pass, run a read-only production audit before authorizing any `CLAMP -> ERROR` change.
