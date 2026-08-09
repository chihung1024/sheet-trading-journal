# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** This file is the persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. It must remain sufficient for a new AI session to continue without the previous chat.
>
> **Mandatory update rule:** after every material implementation, test/CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or externally introduced main drift, update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

# Session Startup

Every new AI/developer session must:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read this file;
4. inspect current `main`, active branch/PR, recent commits/PRs/workflow runs;
5. identify Current Phase, Current Batch, Next Action, locked decisions and recovery refs;
6. read current-phase evidence docs;
7. only then begin work.

Current-phase references:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`

---

# Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Broad investigation is allowed; implementation must converge to one Current Batch.
- Important changes require recovery → scoped PR → tests/CI → independent review → exact-head merge → post-main verification → recovery → handoff update.
- Never lower validation, coverage, financial-integrity or recovery gates merely to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does **not** authorize production Worker deployment unless explicitly required by the scoped Batch.
- Unknown/user-authored changes must not be overwritten.
- A Batch is not complete if this file is stale.
- `note` metadata must not become an implicit financial-ordering contract.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Current protected `main`: `f6a4c58225bd1dbc943f8a8f08d4d68d2bc05256`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: **DONE**
- Gate B / P5C3B: **DONE**
- Gate C / C1: **DONE**
- Gate C / C2: **DONE**
- Gate C / C5a: **DONE**
- Gate C / C5b production audit: **DONE / CLEAR**
- Gate C / C6a blocking prefix enforcement: **DONE / PRODUCTION VERIFIED**
- Gate C / C3-rem sequence regression correction: **DONE / POST-MAIN VERIFIED**
- Gate C final independent review: **QUALIFIED TO CLOSE**
- C6b decision: **RETAIN `CLAMP`; NO RUNTIME MIGRATION NOW**
- Production Worker deployment was not part of Gate C.
- Current active Batch: **Gate C Final Closeout Docs — PR #158**.

Current recovery refs:

- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- pre-C3-rem: `backup-pre-gate-c-c3-rem-4dd896e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- final qualified baseline: `backup-gate-c-final-qualified-f6a4c58`

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- D1 `records` has no `Timestamp` or `Sequence`; migration 0002 adds calculation jobs only.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields and sorts by `Date -> id`.
- `PortfolioCalculator` recognizes optional columns named exactly `Timestamp` and `Sequence`; it does **not** recognize `_sequence`.
- Without recognized `Timestamp` / `Sequence`, calculator same-day fallback priority is BUY → DIV → SELL using stable sort.
- Calculator and canonical Daily-P&L use compatible same-day priority/clamp semantics; agreement between them cannot prove source-prefix validity.
- Prefix validity is independently enforced on the split-adjusted source ledger **before** `PortfolioCalculator`.
- The same split-adjusted validation ledger is reused for downstream adjusted-ledger parity.
- Normal scheduled/manual production calculation enters through `.github/workflows/update.yml` → `tools/run_portfolio_update.py` → `main.run_update()`; no alternate authoritative production calculator path was found.
- Existing Commission/Tax paths normalize with `abs()`; net-negative commission/rebate is not faithfully representable.
- Futures/derivatives remain outside Stock-journal semantics because asset-class/multiplier fields do not exist.

---

# Master Plan

| Phase | Batch | Objective | Priority | Status | Verification |
|---|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | High | **DONE** | PR #148 + CI + production smoke |
| Gate B | P5C3B | atomic Worker record deletion | High | **DONE** | PR #149 + post-main CI + recovery |
| Gate C | C1 | runtime transaction-consumer audit | High | **DONE** | audit evidence |
| Gate C | C2 | deterministic Schema-2 prefix-integrity core | High | **DONE** | tests + coverage CI |
| Gate C | C5a | read-only production-audit infrastructure | High | **DONE** | PR #150 + post-main CI + recovery |
| Gate C | C5b | production read-only audit | High | **DONE / CLEAR** | Update Portfolio Data #3215 |
| Gate C | C6a | blocking pre-calculator prefix enforcement | High | **DONE / PROD VERIFIED** | PR #154 + CI #462/#463 + smoke #3216 + recovery |
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | **DONE / POST-MAIN VERIFIED** | PR #156 + CI #468/#469 + recovery |
| Gate C | C6b | decide calculator `CLAMP` vs `ERROR` | Medium | **DECIDED — RETAIN CLAMP** | final independent review |
| Gate C | Closeout | final independent review + docs/recovery | High | **QUALIFIED / PR #158 PENDING** | final closeout evidence |
| Gate D | D1 | calculation manifest + deterministic golden replay | Next | **READY AFTER GATE-C CLOSEOUT MERGE** | replay/CI evidence |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | fresh review only |

---

# Current Phase

**Gate C — Final Closeout Documentation**

Independent evidence review is complete. Gate C is qualified to close, but Current Phase does not advance to Gate D until PR #158 is exact-head merged, post-main CI passes, post-Gate-C recovery is created, and this handoff is synchronized.

---

# Current Batch

## Gate C Final Closeout — PR #158

Status: **QUALIFIED / DOCUMENTATION MERGE PENDING**

### Independent finding

**No unresolved Critical / Data-Integrity / Security blocker requires another Gate-C runtime change.**

Evidence is persisted in `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`.

### C6b decision

**Retain calculator `CLAMP`; do not open a `CLAMP -> ERROR` runtime PR now.**

`CLAMP` is downstream compatibility/defense-in-depth, not the authoritative source-integrity gate.

Why this is acceptable under current Schema 2:

1. split-adjusted source prefixes are validated first in deterministic `Date -> id` order;
2. validation covers `all` plus every active tag scope;
3. invalid SELL prefixes fail before calculator construction and before upload;
4. current production Schema 2 does not supply recognized `Timestamp` / `Sequence`;
5. fallback same-day BUY-before-SELL ordering cannot create a new negative prefix from an already-valid source ledger because it only moves inventory additions earlier and removals later;
6. calculator/validation split-ledger row parity is checked before upload;
7. the normal production workflow reaches calculator only through the preflighted runner;
8. C5b production audit was clear and C6a normal production smoke passed for both users.

Changing only `CLAMP -> ERROR` is not justified as a current Gate-C requirement because the calculator also has a distinct empty-position SELL compatibility branch that is processed before partial-oversell policy handling. A true internal execution-invariant redesign would therefore be broader than a one-line policy switch and is unsupported by a demonstrated production defect.

### Mandatory C6b reopen conditions

Reopen before production if any occurs:

- first-class `Timestamp` / `Sequence` becomes part of Schema/ingestion and can reorder execution differently from `Date -> id`;
- a production calculator entry point bypasses `main.run_update()` preflight;
- shorting, futures, derivatives, negative positions or contract multipliers are supported;
- evidence shows FIFO/position state can diverge from the validated ledger despite row parity;
- canonical lot-ledger architecture is consolidated or execution identity becomes first-class;
- an incident proves downstream CLAMP/empty-position behavior can mask a reachable error after preflight.

### Closeout completion criteria

- [x] independent C1/C2/C5a/C5b/C6a/C3-rem evidence review completed;
- [x] current production reachability reviewed;
- [x] C6b decision explicitly recorded;
- [x] no unresolved Gate-C blocker found;
- [x] final qualified recovery `backup-gate-c-final-qualified-f6a4c58` created;
- [x] final evidence doc created;
- [x] PR #158 opened;
- [ ] PR #158 exact-head CI passes;
- [ ] final changed-file/review-thread/main-drift qualification passes;
- [ ] PR #158 exact-head merged;
- [ ] post-main CI passes;
- [ ] post-Gate-C recovery created at merged closeout main;
- [ ] handoff synchronized to Gate D / D1;

---

# Gate C / C3-rem — DONE / POST-MAIN VERIFIED

Historical `tests/test_daily_pnl.py::test_sequence_stabilizes_same_day_order()` was a false-positive regression because it used unsupported `_sequence` and data that also passed fallback BUY-before-SELL ordering.

PR #156 added explicit test-only coverage proving:

- recognized `Sequence` affects explicit same-day ordering;
- unsupported `_sequence` does not;
- current no-chronology fallback remains BUY → DIV → SELL;
- no note parsing or runtime behavior was introduced.

Evidence:

- pre-recovery `backup-pre-gate-c-c3-rem-4dd896e`
- initial CI #466 exposed a fixture defect: empty-position SELL is logged/ignored before partial-oversell policy handling
- corrected fixture CI #467: SUCCESS
- final exact-head CI #468 / `31299865954`: SUCCESS
- PR #156 merge → `5928c52074612444470cabc877098233b15984ea`
- post-main CI #469 / `31299939981`: SUCCESS
- post-recovery `backup-post-gate-c-c3-rem-5928c52`

Status: **DONE**.

---

# Gate C / C6a — DONE / PRODUCTION VERIFIED

PR #154 promoted the qualified split-adjusted source prefix contract into the normal production runner before calculator/upload.

Evidence:

- pre-recovery `backup-pre-gate-c-c6a-aa19173`
- final exact-head CI #462 / `31298599973`: SUCCESS
- merge → `e5df59e998d1de4e1b39e388effc4be700c778a3`
- post-main CI #463 / `31298685200`: SUCCESS
- normal production Update Portfolio Data #3216 / `31299421865`: SUCCESS
- 168 records / 2 users / final 2 succeeded, 0 failed
- both users passed prefix integrity before calculator
- both calculator/reconciliation/parity paths completed
- both snapshots uploaded
- post-recovery `backup-post-gate-c-c6a-e5df59e`
- closeout docs PR #155 merge → `4dd896e338304c8892bf0a446b6e0c01ae53b056`
- post-closeout CI #465: SUCCESS

Status: **DONE**.

---

# Gate C / C5b — DONE / CLEAR

Update Portfolio Data #3215 / run `31298163263`:

- qualification `clear`
- 2 users / 168 rows / 5 scopes / 89 symbol-scopes
- all prefix violation counts: 0
- duplicate import-key groups/rows: 0
- duplicate trade-id groups/rows: 0
- repeated order-id groups/rows: 0
- normal calculation/upload skipped
- calculation-job callbacks skipped

Evidence: `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`.

---

# Earlier Completed Work

## Gate A / P6C

- PR #148 merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production smoke #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B

- PR #149 merge `03242d00082067333cf77ffa424094b8936b406c`
- final CI #433 SUCCESS
- post-main CI #434 SUCCESS
- recovery `backup-post-gate-b-03242d0`
- source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed.

## Gate C / C1

Established that final holdings plus calculator/reconciler agreement cannot certify every persisted source prefix; deterministic `Date -> id` source validity needed an independent gate.

## Gate C / C2

`journal_engine/core/ledger_integrity.py` added deterministic split-adjusted source-prefix validation for `all` + active tag scopes. CI #438 passed.

## Gate C / C5a

Read-only audit infrastructure PR #150 merged; privacy review fixed public-detail leakage and cross-user duplicate false positives; final CI #455 and post-main CI #456 passed; recovery `backup-post-gate-c-audit-infra-24fd65c`.

---

# Decision Log

## D-C-01 — Source ledger first

**Decision:** split-adjusted `Date -> id` prefix integrity is the Schema-2 source-ledger gate.  
**Status:** LOCKED.

## D-C-02 — Record id is not broker chronology

**Decision:** `id` is a deterministic validity-order tie-breaker only.  
**Status:** LOCKED until first-class execution identity/time exists.

## D-C-03 — Audit before enforcement

**Decision:** read-only production qualification precedes blocking enforcement.  
**Status:** SATISFIED by C5b → C6a.

## D-C-04 — Public audit output counts-only

**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` governance baseline

**Status:** LOCKED while current on main.

## D-C-06 — C6b final decision

**Decision:** retain calculator `CLAMP` under current Schema-2 protected production path; no C6b runtime migration now.  
**Reason:** strict source preflight is authoritative and current production cannot supply alternative explicit chronology; a one-line policy switch would not constitute a complete internal execution-invariant redesign.  
**Status:** LOCKED subject to listed reopen conditions.

## D-C-07 — Do not parse free-form notes as financial chronology

**Status:** LOCKED pending explicit structured schema redesign.

## D-C-08 — `Sequence` and `_sequence` are distinct contracts

**Decision:** only recognized `Sequence` / `Timestamp` may alter explicit calculator same-day ordering; `_sequence` has no financial-ordering semantics.  
**Status:** LOCKED for Schema 2.

---

# Root Cause Log

## RC-C-01 — Invalid source prefixes could be hidden

**Fix:** split-adjusted prefix validation before calculator/upload.  
**Status:** FIXED by C6a; production verified.

## RC-C-02 — Historical `_sequence` test was a false positive

**Fix:** explicit `Sequence` versus `_sequence` regression with order-sensitive quantities.  
**Status:** FIXED by C3-rem; post-main verified.

---

# Remaining Known Issues / Technical Debt

These are **not** solved by Gate C and are not blockers for Gate D:

- Schema 2 lacks first-class immutable external execution identity/time/sequence.
- Net-negative commission/rebate is not faithfully representable because Commission/Tax paths normalize with `abs()`.
- Futures/derivatives lack first-class asset class / multiplier support.
- Legacy TransactionAnalyzer broad zero-on-exception behavior remains technical debt; no authoritative live consumer currently identified.
- Execution provenance remains optional free-form note metadata rather than enforced schema fields.
- Calculator/analyzer/Daily-P&L lot semantics are not consolidated into one canonical ledger engine.
- P4B net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.

---

# Deferred Architecture Candidates

## Schema-3 execution identity

Candidate fields include broker/source, immutable external execution id, order id, executed_at, currency, asset class and multiplier.  
**Revisit:** after Gate D closeout + fresh architecture review.

## Immutable `broker_executions` table

**Revisit:** post-Gate-D review only.

## Canonical lot-ledger consolidation

**Revisit:** post-Gate-D evidence.

## Broad provider abstraction / cleanup / typing refactor

**Revisit:** only after higher-value correctness phases converge.

---

# Next Actions

## Immediate — Finish Gate C PR #158

1. run final exact-head CI after this handoff commit;
2. verify changed files are only `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` + this handoff;
3. verify reviews / unresolved threads;
4. re-fetch protected `main`; stop/requalify on drift;
5. mark PR #158 ready;
6. exact-head merge;
7. verify post-main CI;
8. create post-Gate-C recovery;
9. synchronize this handoff and activate Gate D / D1.

## Gate D / D1 — only after Gate C is fully closed

Primary objective: **calculation manifest + deterministic golden replay**.

Planned scope:

- calculation manifest containing engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count and calculation timestamp;
- frozen golden replay fixtures for transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR and XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- fail closed on manifest/replay ambiguity;
- scoped recovery → branch/PR → tests/coverage → independent review → exact-head merge → post-main verification → recovery.

Explicit Gate-D non-goals unless new evidence proves a dependency:

- Schema 3;
- broker-execution table;
- futures support;
- broad provider abstraction;
- unrelated UX/refactor work.
