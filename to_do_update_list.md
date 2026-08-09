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
- Current protected `main`: `5928c52074612444470cabc877098233b15984ea`
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
- Calculator oversell policy remains **`CLAMP`**; no Gate-C work has changed it.
- Production Worker deployment was not part of Gate C.
- Current active Batch: **Gate C / Final Closeout — independent architecture and C6b decision review**.

Current recovery refs:

- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- pre-C3-rem: `backup-pre-gate-c-c3-rem-4dd896e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields.
- `PortfolioCalculator` recognizes optional columns named exactly `Timestamp` and `Sequence`; it does **not** recognize `_sequence`.
- Without recognized `Timestamp` / `Sequence`, calculator same-day fallback priority is BUY → DIV → SELL using stable sort.
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
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | **DONE / POST-MAIN VERIFIED** | PR #156 + CI #468/#469 + recovery |
| Gate C | C6b | decide calculator `CLAMP` vs `ERROR` | Medium | **UNDER FINAL REVIEW** | explicit decision required before Gate-C close |
| Gate C | Closeout | final independent Gate-C review + recovery + docs | High | **ACTIVE** | final evidence/decision PR |
| Gate D | D1 | calculation manifest + deterministic golden replay | Next | TODO | replay/CI evidence |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | fresh review only |

---

# Current Phase

**Gate C — Final Closeout Review**

Gate C distinguishes:

- deterministic Schema-2 **ledger-validity order**: `Date -> record id`;
- true broker execution chronology: **not guaranteed** by current schema.

Gate C does not authorize Schema 3, broker-execution tables, futures support, broad broker-import redesign, provider abstraction, unrelated UX work, or production Worker deployment.

---

# Current Batch

## Gate C Final Closeout — Independent architecture + C6b decision review

Status: **ACTIVE**

### Objective

Re-review the completed Gate-C line as an independent third party and decide whether any unresolved blocker remains before Gate D. In particular, decide whether downstream calculator `CLAMP` should remain defense-in-depth or whether a separate C6b `ERROR` migration is necessary now.

### Required review questions

1. Does production prefix enforcement now block impossible deterministic source-ledger prefixes before calculator/upload?
2. Did production C5b qualification and C6a smoke prove current data passes the new source gate?
3. Are calculator / Daily-P&L ordering semantics now accurately documented and regression-protected?
4. Does keeping calculator `CLAMP` create a remaining reachable integrity hole after the independent preflight, or is it acceptable downstream defense-in-depth?
5. Does any unresolved finding require runtime change before Gate D?
6. Are remaining Schema-2 limitations explicitly deferred rather than silently treated as solved?
7. Is rollback/recovery evidence complete?

### Scope

- evidence review;
- architecture/decision review;
- C6b decision;
- Gate-C closeout documentation/recovery if qualified.

### Explicitly out of scope unless a new BLOCKER is proven

- Schema 3;
- broker import redesign;
- broker-execution table;
- futures/derivatives;
- note parsing;
- provider abstraction;
- unrelated runtime cleanup or UX work.

### Completion criteria

- [ ] independent Gate-C evidence review completed;
- [ ] explicit C6b decision recorded;
- [ ] no unresolved Critical/Data-Integrity/Security blocker, or blocker remediated in separate scoped Batch;
- [ ] Gate-C final recovery created;
- [ ] closeout evidence persisted through scoped docs PR;
- [ ] exact-head CI / merge / post-main CI completed;
- [ ] Current Phase advanced to Gate D only after all above are satisfied.

---

# Gate C / C3-rem — DONE / POST-MAIN VERIFIED

## Root cause

The historical `tests/test_daily_pnl.py::test_sequence_stabilizes_same_day_order()` was a false-positive regression:

1. it supplied `_sequence`, but `PortfolioCalculator` recognizes only `Sequence` / `Timestamp`;
2. its same-day BUY/SELL data was already compatible with fallback BUY → DIV → SELL;
3. therefore the test passed even when `_sequence` was ignored;
4. production `prepare_transactions()` does not create `Sequence` / `Timestamp`, so the historical test did not prove broker chronology in the live Schema-2 path.

## Fix

PR #156 added `tests/test_calculator_sequence_contract.py` only, plus handoff documentation.

The new contract proves:

- prior day establishes 2 shares;
- next day `Sequence=1` SELL 5 before `Sequence=2` BUY 3 triggers ERROR-mode oversell;
- replacing `Sequence` with unsupported `_sequence` removes explicit chronology, so fallback BUY → SELL makes the same quantities legal and ends flat;
- `_sequence` has no financial-ordering semantics;
- no runtime/note/schema/Worker/D1/workflow behavior was changed.

## CI history

Initial test commit: `46e08683de48a1166ad0e3988669be7c1eb6472f`

CI #466 / `31299704165`:

- Frontend: SUCCESS
- Worker/D1: SUCCESS
- Python: FAILED only because the first fixture began from empty holdings.
- observed existing behavior: SELL against completely empty position is logged/ignored before ERROR oversell handling.
- classification: test-fixture defect, not runtime regression.

Fixture correction commit: `c702878dc4d3a6ed874589c089fad010c59791b3`

CI #467 / `31299780012`: **SUCCESS** across Python coverage, Frontend and Worker/D1.

Final PR head: `2e1161f919dee6e0ab09531208aad8fc3c0282f4`

- final changed files: `tests/test_calculator_sequence_contract.py`, `to_do_update_list.md`
- reviews: 0
- unresolved threads: 0
- protected main had no drift immediately before merge
- final exact-head CI #468 / `31299865954`: **SUCCESS**
- independent scope review: **PASS**
- PR #156 exact-head merge → `5928c52074612444470cabc877098233b15984ea`
- post-main CI #469 / `31299939981`: **SUCCESS**
- post-C3-rem recovery: `backup-post-gate-c-c3-rem-5928c52`

Status: **DONE**.

---

# Gate C / C6a — DONE / PRODUCTION VERIFIED

## Purpose

Promote the production-qualified split-adjusted Schema-2 prefix-integrity contract into a blocking gate before `PortfolioCalculator` and before snapshot upload, while preserving downstream calculator `CLAMP` semantics.

## Evidence

- pre-C6a recovery: `backup-pre-gate-c-c6a-aa19173`
- PR #154 runtime commit `340f1604570e6866ce9dcc6016ff9c65b472b92d`
- final PR head `4bf0c203266ff787fb0c47fcb9c64f08dd5bbbef`
- final exact-head CI #462 / `31298599973`: SUCCESS
- independent scope review: PASS
- PR #154 merge → `e5df59e998d1de4e1b39e388effc4be700c778a3`
- post-main CI #463 / `31298685200`: SUCCESS
- normal production Update Portfolio Data #3216 / `31299421865`: SUCCESS
- 168 records / 2 users / final 2 succeeded, 0 failed
- both users passed prefix integrity before calculator
- both calculator/reconciliation/parity paths completed
- both snapshots uploaded successfully
- post-C6a recovery: `backup-post-gate-c-c6a-e5df59e`
- closeout docs PR #155 merge → `4dd896e338304c8892bf0a446b6e0c01ae53b056`
- post-closeout CI #465 / `31299568841`: SUCCESS

Behavior now enforced:

- split-adjusted validation ledger is built before calculator construction;
- `validate_transaction_prefix_integrity()` executes before calculator;
- prefix failure blocks calculator and upload;
- same validation ledger is reused for downstream parity;
- calculator `CLAMP` remains unchanged.

Status: **DONE**.

---

# Gate C / C5b — DONE / CLEAR

- Update Portfolio Data #3215 / run `31298163263`
- audited SHA `5942f67dddec2a6b6406221067dea210cf6104c0`
- mode `read_only`
- qualification `clear`
- 2 users / 168 rows / 5 scopes / 89 symbol-scopes
- all prefix violation counts: 0
- duplicate import-key groups/rows: 0
- duplicate trade-id groups/rows: 0
- repeated order-id groups/rows: 0
- normal calculation/upload skipped
- calculation-job callbacks skipped
- evidence persisted in `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- evidence PR #153 merged.

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
7. historical `_sequence` regression did not prove current ingestion supplies `Sequence`;
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
**Status:** SATISFIED by C5b → C6a.

## D-C-04 — Public audit output is counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in public machine-readable audit output.  
**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` is governance baseline

**Status:** LOCKED while current on main.

## D-C-06 — C6a does not automatically authorize `CLAMP -> ERROR`

**Decision:** source-prefix enforcement and downstream oversell policy are separate decisions.  
**Status:** LOCKED pending final C6b decision.

## D-C-07 — Do not parse free-form notes as financial chronology

**Reason:** optional metadata is not a stable calculation contract.  
**Status:** LOCKED pending explicit structured schema redesign.

## D-C-08 — `Sequence` and `_sequence` are distinct contracts

**Decision:** only recognized `Sequence` / `Timestamp` columns may alter explicit calculator same-day ordering; `_sequence` has no financial-ordering semantics.  
**Status:** LOCKED for Schema 2 unless ingestion/schema contract is explicitly redesigned.

---

# Root Cause Log

## RC-C-01 — Invalid source prefixes could be hidden

**Failure mode:** final holdings / Daily-P&L could appear consistent even if persisted source sequence temporarily went negative because downstream calculation/reconciliation uses compatible clamp/type-priority semantics.  
**Fix:** split-adjusted prefix validation before calculator.  
**Status:** FIXED by C6a; production verified in #3216.

## RC-C-02 — Historical `_sequence` test was a false positive

**Failure mode:** test name implied sequence ordering was protected even though supplied `_sequence` was ignored.  
**Root cause:** unsupported private column + data whose expected result was also produced by fallback BUY-before-SELL priority.  
**Fix:** dedicated `Sequence` versus `_sequence` regression with a non-zero prior position and order-sensitive same-day quantities.  
**Status:** FIXED by C3-rem; post-main CI #469 passed.

---

# Known Issues / Technical Debt

These are **not** silently treated as solved by Gate C:

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

## Immediate — Gate C final closeout review

1. independently re-review C1/C2/C5a/C5b/C6a/C3-rem evidence against current `main`;
2. classify remaining issues as BLOCKER / DEFERRED / ACCEPTED RISK;
3. explicitly decide C6b: retain `CLAMP` defense-in-depth or open a separate `ERROR` migration Batch;
4. if no blocker requires code, create final Gate-C recovery and a docs-only closeout PR;
5. run exact-head CI / independent review / merge / post-main CI;
6. update this file and advance Current Phase to Gate D.

## Gate D — only after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR / CI / review / recovery.
