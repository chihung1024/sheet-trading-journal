# Gate C — Final Independent Closeout Review

Date: **2026-08-09**

## Review mandate

Re-review the complete Gate-C transaction-integrity line as an independent third party before advancing to Gate D. The review must determine whether any unresolved correctness blocker remains and explicitly decide whether calculator oversell policy should be changed from `CLAMP` to `ERROR` now.

This closeout does **not** authorize Schema 3, broker-execution schema redesign, derivatives support, free-form note parsing, provider abstraction, unrelated refactoring, or production Worker deployment.

---

## Stable review baseline

- Repository: `chihung1024/sheet-trading-journal`
- Reviewed protected main: `f6a4c58225bd1dbc943f8a8f08d4d68d2bc05256`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Post-C3-rem closeout CI #471 / run `31300087856`: **SUCCESS**
- Final Gate-C recovery: `backup-gate-c-final-qualified-f6a4c58`

---

## Evidence chain reviewed

### C1 — Runtime transaction-consumer audit

Key findings established before implementation:

- persisted Schema-2 validity order is `Date -> record id`;
- record id is a deterministic persistence tie-breaker, not broker-time proof;
- calculator fallback same-day priority is BUY -> DIV -> SELL when no recognized `Timestamp` / `Sequence` exists;
- calculator and canonical Daily-P&L had compatible clamp/type-priority semantics and therefore could agree while still hiding an invalid source prefix;
- aggregate final holdings were insufficient to prove every source prefix valid.

### C2 — Independent prefix-integrity core

`journal_engine/core/ledger_integrity.py` now provides a fail-closed independent source-ledger contract:

- input must have positive unique record ids;
- replay order is stable `Date -> id`;
- BUY adds quantity; SELL subtracts; DIV has no quantity effect;
- audit covers `all` and every active comma/semicolon tag scope;
- split-adjusted quantities are replayed without rounding;
- first negative prefix beyond tolerance fails closed.

Infrastructure qualification CI #438 / `31296710938`: **SUCCESS**.

### C5a — Read-only production-audit infrastructure

PR #150 merged read-only audit tooling/workflow only. Privacy review removed public detail leakage and cross-user duplicate false-positive risk.

- final exact-head CI #455: SUCCESS
- post-main CI #456: SUCCESS
- recovery: `backup-post-gate-c-audit-infra-24fd65c`

### C5b — Production read-only qualification

Update Portfolio Data #3215 / run `31298163263`:

- qualification: **clear**
- 2 users
- 168 records
- 5 scopes
- 89 symbol-scopes
- prefix violations: 0
- users with prefix violations: 0
- all-scope violations: 0
- tag-scope violations: 0
- duplicate import-key groups/rows: 0
- duplicate trade-id groups/rows: 0
- repeated order-id groups/rows: 0
- normal calculation/upload was skipped
- calculation-job callbacks were skipped

Evidence: `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`.

### C6a — Blocking pre-calculator enforcement

PR #154 promoted the qualified prefix contract into the normal production calculation path.

Current production order in `main.run_update()` is:

1. obtain one user's normalized records;
2. build independent split-adjusted validation ledger;
3. run `validate_transaction_prefix_integrity()`;
4. only then construct/run `PortfolioCalculator`;
5. reconcile canonical Daily-P&L;
6. verify calculator/validation split-ledger parity;
7. validate snapshot;
8. upload snapshot.

Runner regression proves a prefix failure prevents calculator construction/run and prevents upload.

Qualification:

- final exact-head CI #462 / `31298599973`: SUCCESS
- merge: `e5df59e998d1de4e1b39e388effc4be700c778a3`
- post-main CI #463 / `31298685200`: SUCCESS
- production normal calculation smoke #3216 / `31299421865`: SUCCESS
- production smoke processed 168 records / 2 users; both prefix gates passed; both snapshots uploaded; final result 2 succeeded / 0 failed
- recovery: `backup-post-gate-c-c6a-e5df59e`

### C3-rem — Sequence regression correction

Historical `test_sequence_stabilizes_same_day_order()` used unsupported `_sequence`, while calculator recognizes `Sequence` / `Timestamp`. Its original data also happened to pass fallback BUY-before-SELL ordering, creating a false-positive regression.

PR #156 added an explicit contract:

- recognized `Sequence` can order same-day SELL before BUY and surface an ERROR-mode oversell;
- unsupported `_sequence` does not alter financial ordering, so fallback BUY -> DIV -> SELL remains effective;
- no runtime, schema, Worker, D1, workflow, or production oversell policy was changed.

Qualification:

- initial CI #466 exposed a test-fixture defect: completely empty-position SELL is logged/ignored before partial-oversell policy handling;
- fixture corrected using a non-zero prior position;
- CI #467: SUCCESS
- final exact-head CI #468 / `31299865954`: SUCCESS
- merge: `5928c52074612444470cabc877098233b15984ea`
- post-main CI #469 / `31299939981`: SUCCESS
- recovery: `backup-post-gate-c-c3-rem-5928c52`

---

## Current production reachability review

### Production ingestion does not supply explicit chronology fields

Schema-2 `records` contains:

- id
- user_id
- txn_date
- symbol
- txn_type
- qty
- price
- fee
- tax
- tag
- note
- created_at

There is no first-class `Timestamp` or `Sequence` column. Migration `0002_calculation_jobs.sql` adds calculation jobs only and does not alter `records`.

`main.prepare_transactions()` maps the persisted record fields, validates them, and sorts by `Date` then `id`; it does not derive `Timestamp` / `Sequence` from `note` or any broker metadata.

### Normal production workflow enters through the protected runner

`.github/workflows/update.yml` normal calculation step invokes `python tools/run_portfolio_update.py`.

`tools/run_portfolio_update.py` delegates to `main.run_update()` and only classifies failures for GitHub/Worker status reporting. It does not contain an alternate calculation path.

Therefore the current normal/scheduled production workflow is covered by the C6a pre-calculator gate.

---

## C6b decision — retain `CLAMP`; no runtime migration now

### Decision

**Do not open a C6b `CLAMP -> ERROR` runtime PR at this time.**

Keep calculator `CLAMP` as downstream compatibility/defense-in-depth. It is **not** the authoritative transaction-integrity gate.

### Why this is acceptable under current Schema 2

1. The authoritative split-adjusted source ledger is validated first in deterministic `Date -> id` order for `all` plus every active tag scope.
2. A source SELL that would require negative long inventory is blocked before calculator construction and before snapshot upload.
3. Current production records do not contain recognized `Timestamp` / `Sequence`, so calculator uses fallback same-day BUY -> DIV -> SELL priority.
4. Relative to a source ledger whose every prefix is already nonnegative, moving same-day BUY rows earlier and SELL rows later cannot create a new negative quantity prefix; it can only preserve or increase intermediate available quantity.
5. Calculator and independent validation ledgers are then checked for split-adjusted row parity before upload.
6. The normal production workflow has one authoritative calculation runner and that runner passes through the preflight.
7. Production C5b qualification and C6a normal smoke confirm current persisted data passes the strict gate in practice.

### Why changing only `CLAMP -> ERROR` is not justified now

- No currently reachable production source-integrity failure remains that depends on CLAMP for correctness.
- The calculator also has a distinct empty-position SELL compatibility branch that logs/ignores before partial-oversell policy handling; merely changing `CLAMP -> ERROR` would therefore not constitute a complete internal execution-invariant redesign.
- Expanding C6b into a broader calculator semantic rewrite would exceed the evidence-backed Gate-C requirement and add regression risk without a demonstrated production defect.
- Gate D's deterministic replay work is a better next correctness layer because it can detect engine/vendor/input drift systematically before a later canonical-ledger consolidation decision.

### Mandatory reopen conditions

Reopen the C6b decision before production if any of the following occurs:

1. Schema or ingestion begins supplying first-class `Timestamp` or `Sequence` that can reorder same-day execution differently from `Date -> id`.
2. A production calculator entry point is introduced that bypasses `main.run_update()` prefix preflight.
3. Short selling, futures, derivatives, negative position semantics, or contract multipliers become supported.
4. Evidence appears that calculator FIFO/position state can diverge from the validated ledger despite row parity.
5. The canonical lot-ledger architecture is consolidated or execution identity becomes first-class.
6. A production incident demonstrates that downstream CLAMP/empty-position compatibility behavior can mask a reachable error after preflight.

---

## Final finding classification

### BLOCKER

**None found.**

No unresolved Critical / Data-Integrity / Security finding requires another Gate-C runtime change before Gate D.

### ACCEPTED / CONTROLLED CURRENT BEHAVIOR

- Calculator `CLAMP` remains compatibility/defense-in-depth only; source prefix validity is enforced upstream.
- Empty-position SELL compatibility behavior remains present but is not reachable from valid current production source ledgers under the enforced preflight. It is not treated as an integrity gate.
- Record id remains a deterministic ledger-validity tie-breaker, not broker chronology.

### DEFERRED — explicitly not solved by Gate C

- first-class broker execution identity/time/sequence;
- immutable broker-execution table;
- net-negative commission/rebate representation;
- futures/derivatives asset class and multiplier support;
- canonical calculator/analyzer/Daily-P&L lot-ledger consolidation;
- broad market-data provider abstraction;
- legacy TransactionAnalyzer broad zero-on-exception technical debt;
- gross intraday Modified-Dietz timing reconstruction on zero-start days.

These remain documented architecture/debt candidates and must not be represented as completed work.

---

## Gate C closeout decision

**Gate C is QUALIFIED TO CLOSE.**

The project may proceed to **Gate D / D1 — calculation manifest + deterministic golden replay** after this closeout evidence and persistent handoff are merged with exact-head CI and post-main verification.

Gate D must remain scoped to reproducibility/evidence. It does not by itself authorize Schema 3 or the deferred architecture candidates above.
