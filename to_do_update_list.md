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
- Current protected `main`: `4dd896e338304c8892bf0a446b6e0c01ae53b056`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: **DONE**
- Gate B / P5C3B: **DONE**
- Gate C / C1: **DONE**
- Gate C / C2: **DONE**
- Gate C / C5a: **DONE**
- Gate C / C5b production audit: **DONE / CLEAR**
- Gate C / C6a blocking prefix enforcement: **DONE / PRODUCTION VERIFIED**
- Gate C / C6a closeout docs PR #155 merged; post-main CI #465 passed.
- Calculator oversell policy remains **`CLAMP`**; C6a intentionally did not change it.
- Production Worker deployment was not part of C6a.
- Current active Batch: **Gate C / C3-rem — VERIFYING in PR #156**.

Current recovery refs:

- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- pre-C3-rem: `backup-pre-gate-c-c3-rem-4dd896e`

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields.
- `PortfolioCalculator` recognizes optional columns named exactly `Timestamp` and `Sequence`; it does **not** recognize `_sequence`.
- Without recognized `Timestamp` / `Sequence`, calculator same-day fallback priority is BUY → DIV → SELL using a stable sort.
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
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | **VERIFYING / PR #156** | corrected regression + CI #467 |
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

Status: **VERIFYING — PR #156**

### Root issue

The historical `tests/test_daily_pnl.py::test_sequence_stabilizes_same_day_order()` is a false-positive regression contract:

1. it supplies `_sequence`, but `PortfolioCalculator` only recognizes `Sequence` and `Timestamp`;
2. its same-day BUY/SELL example is already compatible with fallback BUY → DIV → SELL priority;
3. therefore the test passes even when `_sequence` is completely ignored;
4. production `prepare_transactions()` does not create `Sequence` / `Timestamp`, so the historical test also did not prove the live ingestion path had broker chronology.

### Objective

Supplement the misleading historical regression with an explicit executable contract that distinguishes recognized `Sequence` from unsupported `_sequence`, without changing runtime behavior or introducing hidden note-based ordering.

### In scope

- prove real `Sequence` is applied before fallback type priority;
- prove `_sequence` is not a supported calculator financial-ordering field;
- preserve fallback BUY → DIV → SELL behavior when no recognized chronology columns exist;
- keep `note` metadata outside financial ordering;
- test-only change;
- full CI/coverage and independent review;
- persistent execution evidence.

### Explicitly out of scope

- calculator/runtime changes;
- Schema 3;
- broker execution tables;
- parsing note timestamps/order ids into financial ordering;
- changing production `CLAMP -> ERROR` policy;
- broker import redesign;
- futures/derivatives support;
- unrelated refactors.

### Implementation evidence

Recovery / branch:

- pre-C3-rem recovery: `backup-pre-gate-c-c3-rem-4dd896e`
- branch: `pr-gate-c-c3-rem-sequence-regression`
- PR: **#156 — Draft**

Test-only change:

- file: `tests/test_calculator_sequence_contract.py`
- initial commit: `46e08683de48a1166ad0e3988669be7c1eb6472f`
- corrected fixture commit: `c702878dc4d3a6ed874589c089fad010c59791b3`
- no runtime/source/schema/Worker/D1/workflow change.

Contract now proven by the tests:

1. Prior day establishes 2 shares.
2. On the next day, `Sequence=1` orders SELL 5 before `Sequence=2` BUY 3.
3. With recognized `Sequence`, ERROR-mode oversell must surface because only 2 shares exist when the SELL runs.
4. Replacing `Sequence` with unsupported `_sequence` removes explicit chronology; fallback BUY-before-SELL raises holdings from 2 to 5 before selling 5, so the calculation succeeds and ends flat.
5. This discriminates the two contracts instead of merely asserting a final quantity compatible with both.

### CI evidence

Initial CI #466 / run `31299704165`:

- Frontend: SUCCESS
- Worker/D1: SUCCESS
- Python: **FAILED** — 1 failed / 255 passed
- failure was limited to the first new regression expecting an oversell from a completely empty position.
- captured calculator behavior: an empty-position SELL is logged/ignored (`SELL ignored due to empty position`) before the oversell-policy branch can raise.
- classification: **test-fixture defect**, not runtime regression; runtime was not changed.

Fixture correction:

- establish 2 prior-day shares;
- same-day SELL 5 then BUY 3 under `Sequence`;
- same rows under `_sequence` rely on fallback BUY → SELL and end flat.

Corrected CI #467 / run `31299780012`:

- Python tests + branch coverage: **SUCCESS**
- Frontend contracts/build: **SUCCESS**
- Worker security/deployment + D1 baseline: **SUCCESS**
- result confirms the new regression meaningfully distinguishes `Sequence` from `_sequence`.

Independent initial scope review:

- compare `main=4dd896e...` → `c702878d...` shows exactly one added file: `tests/test_calculator_sequence_contract.py` (+137);
- no runtime changes;
- no note parsing;
- no CLAMP policy change;
- no Schema/Worker/D1/workflow changes;
- conclusion: **PASS for C3-rem scope**.

### Completion criteria

- [x] misleading `_sequence` behavior is supplemented with an explicit contract;
- [x] recognized `Sequence` behavior is directly exercised;
- [x] unsupported `_sequence` behavior is directly exercised;
- [x] no note-to-financial-order coupling introduced;
- [x] corrected regression passes in full CI;
- [x] full CI/coverage #467 passes;
- [x] independent initial scope review finds no blocker;
- [x] this handoff records #466 root cause and #467 correction evidence;
- [ ] final exact-head CI after this handoff commit;
- [ ] final changed-file/review-thread/main-drift qualification;
- [ ] mark PR #156 ready;
- [ ] exact-head merge;
- [ ] post-main CI;
- [ ] post-C3-rem recovery;
- [ ] final handoff closeout;
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
- closeout docs PR #155 merged → `4dd896e338304c8892bf0a446b6e0c01ae53b056`.
- post-closeout main CI #465 / `31299568841`: **SUCCESS**.

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

## D-C-08 — `Sequence` and `_sequence` are distinct contracts

**Decision:** only the calculator's recognized `Sequence` / `Timestamp` columns may alter its explicit same-day ordering; `_sequence` has no financial-ordering semantics.  
**Reason:** current code explicitly checks `Sequence` / `Timestamp`, while production ingestion does not create them and the historical `_sequence` test was a false positive.  
**Status:** LOCKED for Schema 2 unless the ingestion/schema contract is explicitly redesigned.

---

# Root Cause Log

## RC-C-01 — Invalid source prefixes could be hidden

**Failure mode:** final holdings / Daily-P&L could appear consistent even if persisted source sequence temporarily went negative because downstream calculation/reconciliation uses compatible clamp/type-priority semantics.  
**Systemic cause:** source-prefix validity was not a separate pre-calculator contract.  
**Fix:** split-adjusted prefix validation before calculator.  
**Status:** FIXED by C6a; production verified in #3216.

## RC-C-02 — Historical `_sequence` test was a false positive

**Failure mode:** test name implied sequence ordering was protected even though supplied `_sequence` was ignored.  
**Root cause:** test used an unsupported private column and data whose expected result was also produced by fallback BUY-before-SELL priority.  
**Additional discovery:** an initial replacement fixture started from zero holdings; calculator intentionally ignores a SELL against a completely empty position before ERROR-mode oversell handling, so that fixture could not discriminate ordering.  
**Fix:** dedicated regression with a non-zero prior position and order-sensitive same-day SELL/BUY quantities; test both `Sequence` and `_sequence` explicitly.  
**Status:** FIX IMPLEMENTED / CI #467 GREEN; awaiting PR #156 final qualification.

---

# Known Issues / Technical Debt

- Historical `_sequence` regression is being explicitly supplemented by C3-rem PR #156; merge/closeout pending.
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

## Immediate — Finish C3-rem PR #156

1. run final exact-head CI after this handoff commit;
2. verify final changed files are only the sequence regression + this handoff;
3. verify review submissions / unresolved threads;
4. re-fetch protected `main`; if it drifted from `4dd896e...`, stop and requalify;
5. mark PR #156 ready;
6. exact-head merge;
7. verify post-main CI;
8. create post-C3-rem recovery;
9. persist closeout evidence and then begin Gate C final closeout review.

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
