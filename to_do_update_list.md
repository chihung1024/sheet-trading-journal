# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** This file is the persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. It is intentionally sufficient for a new AI session to continue without the previous chat.
>
> **Mandatory update rule:** after every material implementation, test/CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or externally introduced main drift, update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

# Project Status

## Session startup order

Every new AI/developer session must:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read `to_do_update_list.md`;
4. inspect current `main`, active branch/PR, recent commits/PRs/releases;
5. identify Current Phase, Current Batch, Next Action, locked decisions and recovery refs;
6. read current-phase evidence docs;
7. only then begin work.

Current-phase references:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`

## Locked engineering rules

- Evidence before conclusion; root cause before symptom fix.
- Broad investigation is allowed; implementation must converge to one Current Batch.
- Important changes require recovery → scoped PR → tests/CI → independent review → docs → exact-head merge → post-main verification → recovery.
- Never lower validation, coverage, financial-integrity or recovery gates merely to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does **not** authorize production Worker deployment.
- Unknown/user-authored changes must not be overwritten.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Audited production/main SHA: `5942f67dddec2a6b6406221067dea210cf6104c0`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: DONE
- Gate B / P5C3B: DONE
- Gate C / C5a read-only audit infrastructure: DONE
- Gate C / C5b production read-only audit: **DONE / CLEAR**
- Blocking prefix enforcement is **not yet enabled**.
- Calculator default oversell policy remains `CLAMP`.
- Production Worker deployment was not part of Gate C and was not performed.
- Current next implementation Batch: **Gate C / C6 — scoped blocking pre-calculator prefix enforcement**.

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields.
- Calculator and canonical Daily-P&L share compatible same-day priority/clamp semantics; their agreement cannot prove source-prefix validity.
- Prefix validity must be evaluated independently on the split-adjusted source ledger.
- `note` remains metadata, not a financial-calculation dependency.
- Existing Commission/Tax paths normalize with `abs()`; net-negative commission/rebate is not faithfully representable.
- Futures/derivatives remain outside Stock-journal semantics because asset-class/multiplier fields do not exist.

---

# Master Plan

| Phase | Batch | Objective | Priority | Status | Dependency | Verification |
|---|---|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | High | **DONE** | prior integrity line | PR #148 + CI + production smoke |
| Gate B | P5C3B | atomic Worker record deletion | High | **DONE** | Gate A | PR #149 + post-main CI + recovery |
| Gate C | C1 | runtime transaction-consumer audit | High | **DONE** | Gate B | audit evidence |
| Gate C | C2 | deterministic Schema-2 prefix-integrity core | High | **DONE** | C1 | tests + coverage CI |
| Gate C | C5a | read-only production-audit infrastructure | High | **DONE** | C2 | PR #150 + post-main CI + recovery |
| Gate C | C5b | production read-only audit | High | **DONE / CLEAR** | C5a | Update Portfolio Data #3215 |
| Gate C | C6a | blocking pre-calculator prefix enforcement | High | **READY / NEXT** | C5b clear | scoped PR + exact-head CI + smoke |
| Gate C | C6b | decide calculator `CLAMP` vs `ERROR` | Medium | **DEFERRED UNTIL C6a EVIDENCE** | C6a | separate decision/tests |
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | TODO before Gate C closeout | independent of C6a | targeted regression CI |
| Gate C | Closeout | final Gate-C review + recovery + docs | High | BLOCKED on C6a/C3-rem | C6a + C3-rem | post-main qualification |
| Gate D | D1 | calculation manifest + deterministic golden replay | Next | TODO | Gate C closeout | replay/CI evidence |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | Gate D | fresh review only |

---

# Current Phase

**Gate C — Schema-2 transaction integrity preflight**

Gate C distinguishes:

- deterministic Schema-2 **ledger-validity order**: `Date -> record id`;
- true broker execution chronology: **not guaranteed** by current schema.

Gate C does not authorize Schema 3, broker-execution tables, futures support, broad broker-import redesign, provider abstraction, unrelated UX work, or production Worker deployment.

---

# Current Batch

## C6a — Scoped blocking pre-calculator prefix enforcement

Status: **READY — C5b production qualification is clear**

### Objective

Promote the already-tested split-adjusted Schema-2 prefix check from read-only evidence into a blocking pre-calculator source-integrity gate.

### In scope

- restore the previously tested pre-calculator prefix gate using the merged `ledger_integrity.py` contract;
- build the split-adjusted validation ledger once and reuse it for downstream holdings parity where practical;
- any prefix violation must fail before calculator execution and before snapshot upload;
- add/restore focused regression tests proving calculator/upload are not reached after an integrity failure;
- preserve current public/privacy contracts;
- update persistent docs/evidence.

### Explicitly out of scope

- changing calculator `CLAMP -> ERROR` in the same PR;
- Schema 3;
- parsing free-form note timestamps for financial ordering;
- broker import redesign;
- futures/derivatives support;
- market-data provider abstraction;
- unrelated refactors or UX changes;
- production Worker deployment.

### Expansion trigger

Only a Critical/Data-Integrity/Security finding that prevents safe C6a enforcement may expand this Batch. Other findings are NEXT/BACKLOG/REJECT.

---

# C5b Production Audit Evidence — DONE / CLEAR

Workflow:

- `Update Portfolio Data` run **#3215**
- run id: `31298163263`
- event: `workflow_dispatch`
- source/main SHA: `5942f67dddec2a6b6406221067dea210cf6104c0`
- job: `run-and-upload`
- conclusion: **SUCCESS**
- mode: **read_only**
- qualification: **clear**

Execution-isolation evidence:

- `Run transaction integrity read-only audit`: SUCCESS
- `Run calculation and upload to API`: SKIPPED
- `Mark calculation job running`: SKIPPED
- `Report calculation job result`: SKIPPED
- `Fail workflow when calculation failed`: SKIPPED

Counts-only production result:

| Metric | Result |
|---|---:|
| users | 2 |
| rows | 168 |
| scopes | 5 |
| symbol_scopes | 89 |
| prefix_violations | **0** |
| users_with_prefix_violations | **0** |
| all_scope_prefix_violations | **0** |
| tag_scope_prefix_violations | **0** |
| duplicate_import_key_groups | **0** |
| duplicate_import_key_rows | **0** |
| duplicate_trade_id_groups | **0** |
| duplicate_trade_id_rows | **0** |
| repeated_order_id_groups | **0** |
| repeated_order_id_rows | **0** |
| nonempty_notes | 115 |
| import_key tokens | 108 |
| order_id tokens | 96 |
| executed_at_utc tokens | 52 |
| executed_at_taipei tokens | 96 |

C5b acceptance result:

- [x] run used the intended merged main SHA;
- [x] audit-only path executed;
- [x] all production users read;
- [x] all active audit scopes processed;
- [x] split-data dependency completed without fail-open fallback;
- [x] counts-only machine-readable result emitted;
- [x] zero prefix violations;
- [x] zero duplicate import-key groups;
- [x] zero duplicate trade-id groups;
- [x] zero repeated order-id groups;
- [x] normal calculation/upload skipped;
- [x] calculation-job callbacks skipped;
- [x] qualification = `clear`;
- [x] evidence persisted in repository docs.

**Decision:** C5b is closed. Production Schema-2 data is qualified for a separate C6a enforcement PR. This does **not** automatically authorize changing calculator `CLAMP` to `ERROR`.

---

# Completed Work

## Gate A / P6C — DONE

- PR #148 final head `80d417c125797020fab1b6be401084049f2e25e3`
- merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production smoke #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B — DONE

- PR #149 final head `439e9ed39647ccd5885a2cc02a6850712c30708a`
- final CI #433 / `31296056184`: SUCCESS
- merge `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054`: SUCCESS
- recovery `backup-post-gate-b-03242d0`
- source-record delete + last-record snapshot cleanup now share one D1 `batch()`; malformed result/cardinality fail closed

## Gate C / C1 — DONE

Evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`

Key findings:

1. source order is deterministic `Date -> id`;
2. production calculator same-day effective order is BUY→DIV→SELL, default CLAMP;
3. canonical Daily-P&L has compatible priority/clamp semantics;
4. holdings validator does not validate intermediate prefixes;
5. split-adjusted ledger is required for prefix validation;
6. record `id` is a validity-order tie-breaker, not broker-time proof;
7. historical `_sequence` regression does not exercise the actual calculator `Sequence` contract;
8. legacy TransactionAnalyzer zero-on-exception is unsafe if ever made authoritative.

## Gate C / C2 — DONE

Module: `journal_engine/core/ledger_integrity.py`

- positive unique record id;
- stable `Date -> id` replay;
- BUY adds / SELL subtracts / DIV no quantity effect;
- `all` + active comma/semicolon tag scopes;
- tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`;
- fail-closed input and diagnostic contract.

Qualification:

- CI #435: functional tests passed; coverage source inventory correctly blocked unregistered source;
- inventory fixed without lowering gates;
- CI #436: missing-branch gate correctly blocked;
- fail-closed branches expanded;
- CI #438 / `31296710938`: SUCCESS.

Temporary enforcement candidate:

- integration `72f96e06d4b2cf449427652e5aac55a80a0f625f`;
- tested head `ec65aef87153c4ffc2b8e173448face00be69af6`;
- CI #441 / `31296798001`: SUCCESS;
- demonstrated preflight-before-calculator and violation-blocks-upload behavior;
- deliberately removed pending production audit evidence.

## Gate C / C5a — DONE

- PR #150 read-only audit infrastructure merged at `24fd65ca01738604a1eaa64a73673483a7fed79e`;
- final exact-head CI #455 / `31297580094`: SUCCESS;
- post-main CI #456 / `31297681016`: SUCCESS;
- recovery `backup-post-gate-c-audit-infra-24fd65c`;
- privacy review fixed public-detail leakage and cross-user duplicate false-positive risk;
- normal calculation behavior remained unchanged;
- blocking enforcement remained excluded.

## Gate C / C5b — DONE / CLEAR

- production read-only audit #3215 / `31298163263`: SUCCESS;
- audited SHA `5942f67dddec2a6b6406221067dea210cf6104c0`;
- 2 users / 168 rows / 5 scopes / 89 symbol-scopes;
- zero prefix violations;
- zero duplicate import-key/trade-id groups;
- zero repeated order-id groups;
- calculation/upload and job callbacks skipped;
- qualification `clear`.

---

# Change Log

### 2026-08-09 — Gate A closeout
Production smoke succeeded on merged Gate-A main; Gate A closed.

### 2026-08-09 — Gate B closeout
Atomic DELETE merged and post-main CI passed; recovery created.

### 2026-08-09 — Gate C C1/C2
Runtime consumer audit identified missing prefix validation; independent Schema-2 prefix-integrity core implemented and coverage-qualified.

### 2026-08-09 — Gate C temporary enforcement candidate
Blocking runner preflight was implemented/tested, then deliberately removed because production data had not yet been qualified.

### 2026-08-09 — Gate C C5a
Read-only audit infrastructure merged after privacy review, exact-head qualification, post-main CI and recovery.

### 2026-08-09 — Gate C C5b
Production audit #3215 completed from `5942f67...`; qualification `clear`; all source-prefix and duplicate-provenance defect counts were zero. C6a is now READY.

---

# Decision Log

## D-C-01 — Split-adjusted Date/id prefix audit is the Schema-2 source-integrity gate

**Decision:** use the independent split-adjusted `Date -> id` replay as the earliest trustworthy Schema-2 source-ledger validity check.  
**Status:** LOCKED.  
**Reopen condition:** schema/order contract changes or new evidence invalidates deterministic persisted-record validity order.

## D-C-02 — Record id is not broker chronology

**Decision:** `Date -> id` is ledger-validity order only.  
**Status:** LOCKED.  
**Reopen condition:** first-class execution identity/time is introduced and verified.

## D-C-03 — Production audit precedes blocking enforcement

**Decision:** completed. C5b returned `qualification=clear`; C6a may proceed.  
**Status:** SATISFIED.

## D-C-04 — Public audit evidence remains counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in machine-readable public audit result; duplicate provenance remains user-scoped.  
**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` is the governance baseline

**Decision:** follow its startup, scope, recovery, review, documentation and Definition-of-Done rules.  
**Status:** LOCKED while the Playbook remains current on main.

## D-C-06 — C6a enforcement and `CLAMP -> ERROR` are separate decisions

**Decision:** C6a will add the blocking pre-calculator prefix gate only. Calculator oversell policy remains `CLAMP` unless a later dedicated evidence/review step authorizes changing it.  
**Reason:** source-integrity enforcement is already sufficient to reject impossible persisted prefixes; changing downstream defensive semantics simultaneously would enlarge regression scope without necessity.  
**Status:** LOCKED for C6a.  
**Reopen condition:** C6a tests/production evidence show CLAMP still masks a reachable integrity defect after preflight.

---

# Root Cause Log

## RC-C-01 — Source prefix invalidity can be hidden

**Symptom:** final holdings / Daily-P&L may be internally consistent even if persisted transaction order temporarily goes negative.  
**Failure point:** no source-prefix validation before calculator; calculator/reconciler clamp oversells and apply same-day priority.  
**Root cause:** the pipeline validates aggregate/output consistency but not every deterministic persisted source prefix.  
**Systemic cause:** source validity order and calculation execution semantics were not separated into an explicit preflight contract.  
**Fix:** independent split-adjusted read-only audit qualified production data; next C6a promotes that contract to a blocking pre-calculator gate.  
**Regression protection:** `ledger_integrity.py`, dedicated tests, audit-only workflow/tests; C6a runner regression pending.

---

# Known Issues

- Historical `_sequence` test remains misleading and must be corrected/supplemented before Gate C closeout.
- Schema 2 lacks first-class immutable external execution identity/time/sequence.
- Net-negative commission/rebate is not faithfully representable because existing paths use `abs()`.
- Futures/derivatives lack first-class asset class / multiplier support.
- P4B net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.

---

# Technical Debt

- Legacy TransactionAnalyzer broad zero-on-exception behavior; no authoritative live consumer currently found.
- Execution provenance lives in optional note metadata rather than enforced schema fields.
- Calculator/analyzer/Daily-P&L lot semantics are not consolidated into one canonical ledger engine.
- Broad market-data provider abstraction remains intentionally deferred until reproducibility evidence exists.

---

# Deferred Candidates

## Schema-3 execution identity

**Value:** first-class broker source/external id/order id/executed_at/currency/asset class/multiplier.  
**Reason deferred:** Gate C/D must prove migration need and recovery requirements first.  
**Revisit condition:** post-Gate-D architecture review.

## Immutable `broker_executions` table

**Value:** immutable fill-level auditability and derivatives-ready provenance.  
**Reason deferred:** not needed to finish current Schema-2 integrity/reproducibility work.  
**Revisit condition:** post-Gate-D architecture review.

## Canonical lot-ledger consolidation

**Reason deferred:** current priority is source integrity then reproducibility.  
**Revisit condition:** post-Gate-D evidence demonstrates material semantic duplication/inconsistency.

## Broad provider abstraction / cleanup / typing refactor

**Reason deferred:** not required for current correctness gates.  
**Revisit condition:** after higher-value correctness phases converge.

---

# Rejected Candidates

## Parse free-form `note` as financial execution order

**Why rejected:** optional free-form metadata is not a stable financial contract.  
**Reopen condition:** only after structured execution identity/time exists.

## Change calculator `CLAMP -> ERROR` inside C6a

**Why rejected for C6a:** it mixes source-ledger enforcement with downstream defensive-policy change and increases regression radius without evidence of necessity.  
**Reopen condition:** C6a evidence demonstrates a reachable defect remains after the prefix gate.

## Schema 3 during Gate C

**Why rejected:** current production Schema-2 data passed the dedicated audit; migration is not required to close the identified Gate-C root cause.  
**Reopen condition:** post-Gate-D architecture review or new critical evidence.

---

# Risks

- C6a must run before PortfolioCalculator and before any snapshot upload.
- Prefix validation must use split-adjusted quantities and fail closed on missing/ambiguous split coverage.
- C6a must not start depending on free-form note timestamps.
- Calculator `CLAMP` is intentionally unchanged during C6a; this is a bounded defense-in-depth decision, not an omission.
- Any main drift before C6a merge requires requalification.
- Production Worker deployment remains separately governed.

---

# Next Actions

## Immediate — persist C5b evidence

1. Merge the docs-only C5b evidence PR after CI/review/main-drift qualification.
2. Confirm post-main CI for the docs merge.

## C6a — next implementation Batch

1. Re-fetch current `main`; create pre-C6a recovery.
2. Create a fresh scoped C6a branch/PR.
3. Restore the previously proven blocking pre-calculator prefix gate against current main, using the merged `ledger_integrity.py` contract.
4. Add/restore runner regressions proving integrity failure blocks calculator and upload.
5. Keep calculator default `CLAMP` unchanged.
6. Run full CI/coverage.
7. Perform Independent Third-Party Review; classify findings BLOCKER/FOLLOW-UP/BACKLOG/REJECT.
8. Re-fetch main immediately before merge; requalify any drift.
9. Exact-head merge only if all blockers resolved.
10. Post-main CI and a normal production calculation smoke.
11. Create post-C6a recovery and update this file.

## C3-rem — before Gate C closeout

- correct/supplement the historical `_sequence` regression to exercise the actual calculator `Sequence` contract or explicitly lock current type-priority behavior;
- keep note metadata outside financial ordering.

## C6b decision — after C6a evidence

- decide whether calculator `CLAMP` remains defense-in-depth or changes to `ERROR`;
- do not change it unless reachable post-preflight risk is demonstrated;
- if a change is justified, use a separate scoped PR with strict-policy regressions.

## Gate D — only after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR/CI/review/recovery.
