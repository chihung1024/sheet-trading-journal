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
6. read the current-phase evidence docs;
7. only then begin work.

Current-phase references:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`

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
- Current protected `main`: `e5df59e998d1de4e1b39e388effc4be700c778a3`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: **DONE**
- Gate B / P5C3B: **DONE**
- Gate C / C1: **DONE**
- Gate C / C2: **DONE**
- Gate C / C5a: **DONE**
- Gate C / C5b production audit: **DONE / CLEAR**
- Gate C / C6a blocking prefix enforcement: **DONE / PRODUCTION VERIFIED**
- Calculator oversell policy remains **`CLAMP`**; C6a intentionally did not change it.
- Production Worker deployment was not part of C6a.
- Current active Batch: **Gate C / C3-rem — correct/supplement historical `_sequence` regression**.

Current recovery refs:

- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields.
- Calculator and canonical Daily-P&L use compatible same-day priority/clamp semantics; agreement between them cannot prove source-prefix validity.
- Prefix validity is independently enforced on the split-adjusted source ledger **before** `PortfolioCalculator`.
- The same split-adjusted validation ledger is reused for downstream adjusted-ledger parity.
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
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | **ACTIVE / NEXT** | targeted regression CI |
| Gate C | C6b | decide calculator `CLAMP` vs `ERROR` | Medium | **DEFERRED** | separate evidence-based decision only |
| Gate C | Closeout | final Gate-C review + recovery + docs | High | BLOCKED on C3-rem | post-main qualification |
| Gate D | D1 | calculation manifest + deterministic golden replay | Next | TODO | replay/CI evidence |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | fresh review only |

---

# Current Phase

**Gate C — Schema-2 transaction integrity preflight**

Gate C distinguishes:

- deterministic Schema-2 **ledger-validity order**: `Date -> record id`;
- true broker execution chronology: **not guaranteed** by current schema.

Gate C does not authorize Schema 3, broker-execution tables, futures support, broad broker-import redesign, provider abstraction, unrelated UX work, or production Worker deployment.

---

# Current Batch

## C3-rem — Correct/supplement historical `_sequence` regression

Status: **ACTIVE / NEXT**

### Root issue

Historical regression coverage around `_sequence` is misleading because the production ingestion path does not currently promote free-form note metadata into calculator `Timestamp` / `Sequence` columns. Normal Schema-2 records therefore use the calculator's effective same-day fallback priority rather than broker-time chronology.

### Objective

Create an accurate regression contract that proves the behavior actually used by the current Schema-2 pipeline without introducing new hidden ordering semantics.

### In scope

- locate the historical `_sequence` regression and current calculator ordering tests;
- determine whether the test should exercise real `Sequence` support directly or explicitly lock the current fallback same-day type-priority behavior;
- ensure tests distinguish persisted validity order from broker chronology;
- keep `note` metadata outside financial ordering;
- run focused tests + full CI/coverage;
- independent review;
- persistent handoff update.

### Explicitly out of scope

- Schema 3;
- broker execution tables;
- parsing note timestamps/order ids into financial ordering;
- changing `CLAMP -> ERROR`;
- broker import redesign;
- futures/derivatives support;
- unrelated refactors.

### Completion criteria

- [ ] historical misleading `_sequence` regression is corrected or supplemented;
- [ ] tests exercise the actual supported contract;
- [ ] no note-to-financial-order coupling is introduced;
- [ ] focused regression passes;
- [ ] full CI/coverage passes;
- [ ] independent review finds no blocker;
- [ ] exact-head merge + post-main CI;
- [ ] recovery created;
- [ ] this file updated;
- [ ] then perform final Gate-C closeout review.

---

# Gate C / C6a — DONE / PRODUCTION VERIFIED

## Purpose

Promote the production-qualified split-adjusted Schema-2 prefix-integrity contract into a blocking gate before `PortfolioCalculator` and before snapshot upload, while preserving downstream calculator `CLAMP` semantics.

## Pre-change controls

- C5b production audit was clear before enforcement.
- pre-C6a recovery: `backup-pre-gate-c-c6a-aa19173`
- C6a base: `aa191738ac6f9243e9b645fb642869ad926d55a8`
- current base `main.py` blob matched the prior tested candidate parent exactly: `2878dfa38c0da3b3da198c3f2016770d46c90a3`
- therefore the previously tested patch could be restored without re-authoring unrelated runtime content.

## Implementation

PR: **#154 — Gate C C6a: block calculations on invalid transaction prefixes**

Runtime commit:

- `340f1604570e6866ce9dcc6016ff9c65b472b92d`
- reused known-good patched `main.py` blob `354657e373349f7b28b872f2d53e3de80ac525a7`

Behavior:

- build split-adjusted validation ledger before calculator construction;
- run `validate_transaction_prefix_integrity()` before calculator construction;
- a prefix failure blocks calculator initialization/run and snapshot upload;
- success path logs only masked user + aggregate row/scope counts;
- reuse the same validation ledger for downstream adjusted-ledger parity;
- no `CLAMP` change.

Regression:

- `tests/test_runner_ledger_integrity.py`
- known-good regression blob `b43267d918512f06324c141861ff2c53485fdfc1`
- proves validation ledger is built once;
- proves prefix preflight precedes calculator initialization;
- proves successful path continues through parity / snapshot validation / upload;
- proves `LedgerIntegrityError` prevents calculator and upload.

## CI / review / merge evidence

- fresh implementation CI #461 / `31298497982`: **SUCCESS**
- final PR head: `4bf0c203266ff787fb0c47fcb9c64f08dd5bbbef`
- final exact-head CI #462 / `31298599973`: **SUCCESS**
- final changed files exactly:
  - `main.py`
  - `tests/test_runner_ledger_integrity.py`
  - `to_do_update_list.md`
- reviews: 0
- unresolved threads: 0
- immediately-before-merge `main` remained `aa191738...`; no drift
- independent scope review: **PASS**
- PR #154 exact-head merge → `e5df59e998d1de4e1b39e388effc4be700c778a3`
- post-main CI #463 / `31298685200`: **SUCCESS**

## Production smoke evidence

Workflow:

- `Update Portfolio Data` **#3216**
- run id: `31299421865`
- event: `workflow_dispatch`
- source/main SHA: `e5df59e998d1de4e1b39e388effc4be700c778a3`
- audit-only path: **SKIPPED**
- normal `Run calculation and upload to API`: **SUCCESS**
- workflow conclusion: **SUCCESS**
- input records: **168**
- users processed: **2**
- final result: **成功 2，失敗 0**

User 1 production path:

- prefix integrity: PASS
- rows: 60
- scopes: 3
- symbol_scopes: 25
- PortfolioCalculator started normally
- Canonical Daily PnL reconciliation completed
- split-adjusted ledger parity verified for 53 BUY/SELL rows
- snapshot upload: SUCCESS

User 2 production path:

- prefix integrity: PASS
- rows: 108
- scopes: 2
- symbol_scopes: 64
- PortfolioCalculator started normally
- Canonical Daily PnL reconciliation completed
- split-adjusted ledger parity verified for 108 BUY/SELL rows
- snapshot upload: SUCCESS

Observed XIRR/reliability and >30% market-move warnings remained warnings only and did not represent C6a integrity failures.

## Closeout

- C6a production behavior is verified.
- post-C6a recovery: `backup-post-gate-c-c6a-e5df59e`
- calculator oversell policy remains `CLAMP`.
- C6a is **DONE**.
- next Batch is **C3-rem**.

---

# Gate C / C5b Production Audit — DONE / CLEAR

- workflow `Update Portfolio Data` #3215 / run `31298163263`
- audited SHA `5942f67dddec2a6b6406221067dea210cf6104c0`
- mode `read_only`
- qualification `clear`
- 2 users / 168 rows / 5 scopes / 89 symbol-scopes
- prefix violations: 0
- users with prefix violations: 0
- all-scope prefix violations: 0
- tag-scope prefix violations: 0
- duplicate import-key groups/rows: 0
- duplicate trade-id groups/rows: 0
- repeated order-id groups/rows: 0
- normal calculation/upload skipped
- calculation-job callbacks skipped
- evidence persisted in `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- evidence PR #153 merged at `aa191738ac6f9243e9b645fb642869ad926d55a8`

---

# Prior Completed Work

## Gate A / P6C

- PR #148 final head `80d417c125797020fab1b6be401084049f2e25e3`
- merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production smoke #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B

- PR #149 final head `439e9ed39647ccd5885a2cc02a6850712c30708a`
- merge `03242d00082067333cf77ffa424094b8936b406c`
- final CI #433 SUCCESS
- post-main CI #434 SUCCESS
- recovery `backup-post-gate-b-03242d0`
- source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed.

## Gate C / C1

Key findings:

1. persisted source order is deterministic `Date -> id`;
2. calculator fallback same-day effective order is BUY→DIV→SELL with default CLAMP when no Timestamp/Sequence;
3. canonical Daily-P&L uses compatible priority/clamp semantics;
4. aggregate holdings validation does not validate intermediate prefixes;
5. split-adjusted ledger is required for source-prefix validation;
6. record `id` is validity-order tie-breaker, not broker-time proof;
7. historical `_sequence` regression does not prove current ingestion supplies `Sequence`;
8. legacy TransactionAnalyzer zero-on-exception is unsafe if ever made authoritative.

## Gate C / C2

Module: `journal_engine/core/ledger_integrity.py`

Contract:

- positive unique record id;
- stable `Date -> id` replay;
- BUY adds / SELL subtracts / DIV no quantity effect;
- `all` + active comma/semicolon tag scopes;
- tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`;
- fail-closed input/diagnostic behavior.

Qualification:

- CI #438 / `31296710938`: SUCCESS
- temporary enforcement candidate CI #441 / `31296798001`: SUCCESS
- candidate deliberately removed until production C5b qualification.

## Gate C / C5a

- audit infrastructure PR #150 merged at `24fd65ca01738604a1eaa64a73673483a7fed79e`
- final exact-head CI #455: SUCCESS
- post-main CI #456: SUCCESS
- recovery `backup-post-gate-c-audit-infra-24fd65c`
- privacy review fixed public-detail leakage and cross-user duplicate false-positive risk.

---

# Decision Log

## D-C-01 — Validate deterministic source ledger before calculator enforcement

**Decision:** split-adjusted `Date -> id` prefix integrity is the Schema-2 source-ledger gate.  
**Status:** LOCKED.

## D-C-02 — Record id is not broker chronology

**Decision:** `id` is a deterministic validity-order tie-breaker only.  
**Status:** LOCKED until first-class execution identity/time exists.

## D-C-03 — Production audit before blocking enforcement

**Decision:** read-only qualification first, then separate blocking enforcement.  
**Status:** SATISFIED by C5b → C6a sequence.

## D-C-04 — Public audit output is counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in public machine-readable audit output.  
**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` is governance baseline

**Status:** LOCKED while current on main.

## D-C-06 — C6a does not authorize `CLAMP -> ERROR`

**Decision:** source-prefix enforcement and downstream oversell policy are separate decisions.  
**Status:** LOCKED. C6b remains deferred.

## D-C-07 — Do not parse free-form notes as financial chronology

**Reason:** optional metadata is not a stable calculation contract.  
**Status:** LOCKED pending explicit structured schema redesign.

---

# Root Cause Log

## RC-C-01 — Invalid source prefixes could be hidden

**Failure mode:** final holdings / Daily-P&L could appear consistent even if persisted source sequence temporarily went negative because downstream calculation/reconciliation uses compatible clamp/type-priority semantics.  
**Systemic cause:** source-prefix validity was not a separate pre-calculator contract.  
**Fix:** split-adjusted prefix validation before calculator.  
**Status:** FIXED by C6a; production verified in #3216.

---

# Known Issues / Technical Debt

- Historical `_sequence` regression remains misleading: **ACTIVE C3-rem**.
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

Would improve fill-level auditability and derivatives readiness.  
**Revisit:** post-Gate-D review only.

## Canonical lot-ledger consolidation

Would reduce duplicated semantics between calculator/analyzer/reconciler.  
**Revisit:** post-Gate-D evidence.

## Broad provider abstraction / cleanup / typing refactor

**Revisit:** only after higher-value correctness phases converge.

---

# Next Actions

## Immediate — C3-rem

1. identify the historical `_sequence` regression and exact production ordering path;
2. determine the minimum correct regression contract;
3. implement only the required test correction/supplement;
4. do not parse note timestamps/order ids into financial ordering;
5. focused tests;
6. full CI/coverage;
7. independent review;
8. exact-head merge + post-main CI + recovery;
9. update this file.

## Then — Gate C final closeout

- re-review Gate C architecture and all remaining findings;
- confirm no unresolved source-prefix blocker;
- explicitly decide whether C6b (`CLAMP` vs `ERROR`) is required now or should remain deferred;
- create final Gate-C recovery / docs evidence;
- only then advance to Gate D.

## Gate D — after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR / CI / review / recovery.
