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
- Current protected `main` / C6a base: `aa191738ac6f9243e9b645fb642869ad926d55a8`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: DONE
- Gate B / P5C3B: DONE
- Gate C / C5a read-only audit infrastructure: DONE
- Gate C / C5b production read-only audit: **DONE / CLEAR**
- Gate C / C6a blocking prefix enforcement: **VERIFYING in PR #154**
- Blocking prefix enforcement is not yet on `main` until PR #154 passes final qualification and merge.
- Calculator default oversell policy remains `CLAMP`; C6a does not change it.
- Production Worker deployment is outside Gate C and has not been performed.

Current C6a controls:

- pre-C6a recovery: `backup-pre-gate-c-c6a-aa19173`
- branch: `pr-gate-c-c6a-prefix-enforcement`
- PR: **#154 — Draft**
- runtime commit: `340f1604570e6866ce9dcc6016ff9c65b472b92d`
- tested implementation head before this documentation commit: `ac551e8faad421098bc2852128b8f25087353210`
- fresh CI #461 / run `31298497982`: **SUCCESS** across Python coverage, Frontend and Worker/D1
- independent scope review: **PASS**; only `main.py` + `tests/test_runner_ledger_integrity.py`, no CLAMP/schema/Worker/workflow change

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields.
- Calculator and canonical Daily-P&L share compatible same-day priority/clamp semantics; their agreement cannot prove source-prefix validity.
- Prefix validity is independently evaluated on the split-adjusted source ledger.
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
| Gate C | C6a | blocking pre-calculator prefix enforcement | High | **VERIFYING / PR #154** | C5b clear | final-head CI + review + merge + normal smoke |
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | **NEXT before Gate-C closeout** | independent of C6a | targeted regression CI |
| Gate C | C6b | decide calculator `CLAMP` vs `ERROR` | Medium | **DEFERRED UNTIL C6a EVIDENCE** | C6a | separate decision/tests if warranted |
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

Status: **VERIFYING — PR #154**

### Objective

Promote the already-qualified split-adjusted Schema-2 prefix-integrity contract from read-only audit evidence into a blocking gate that executes before `PortfolioCalculator` and before any snapshot upload.

### In scope

- use merged `journal_engine/core/ledger_integrity.py` contract;
- build the split-adjusted validation ledger before calculator construction;
- run `validate_transaction_prefix_integrity()` before calculator construction;
- reuse the same validation ledger for downstream adjusted-ledger parity;
- fail the affected user calculation before calculator/upload on any integrity violation;
- regression tests proving order and failure isolation;
- persistent execution evidence.

### Explicitly out of scope

- changing calculator `CLAMP -> ERROR`;
- Schema 3;
- parsing free-form note timestamps for financial ordering;
- broker import redesign;
- futures/derivatives support;
- Worker/D1 changes or production Worker deployment;
- market-data provider abstraction;
- unrelated refactors or UX work.

### Expansion trigger

Only a Critical/Data-Integrity/Security finding that prevents safe C6a enforcement may expand this Batch. Other findings are NEXT/BACKLOG/REJECT.

### Implementation evidence

Safety check before restoration:

- current C6a-base `main.py` blob: `2878dfa38c0da3b3da198c3f2016770d46c90a3f`;
- prior tested candidate parent `main.py` blob: same `2878dfa...`;
- therefore no intervening runtime changes existed in `main.py` and the previously tested patch could be reused exactly rather than re-authored.

Runtime change:

- commit `340f1604570e6866ce9dcc6016ff9c65b472b92d`;
- exact prior tested patched `main.py` blob reused: `354657e373349f7b28b872f2d53e3de80ac525a7`;
- adds `validate_transaction_prefix_integrity` import;
- creates split-adjusted `validation_df` before `PortfolioCalculator`;
- runs prefix integrity on that ledger;
- logs only masked user + aggregate rows/scopes/symbol-scopes on success;
- reuses the exact same ledger for adjusted-ledger parity instead of rebuilding it later.

Regression change:

- commit/head `ac551e8faad421098bc2852128b8f25087353210`;
- exact prior tested runner regression blob reused: `b43267d918512f06324c141861ff2c53485fdfc1`;
- proves validation ledger is built once;
- proves prefix preflight precedes calculator initialization;
- proves successful path reaches parity → snapshot validation → upload;
- proves `LedgerIntegrityError` prevents calculator init/run and upload.

Fresh qualification:

- PR #154 created as Draft;
- CI #461 / `31298497982`: **SUCCESS**;
- independent compare against `main=aa191738...`: only 2 files before this docs commit:
  - `main.py` +17/-4
  - `tests/test_runner_ledger_integrity.py` +132
- no Worker/D1/schema/workflow changes;
- no calculator `CLAMP` change;
- no unrelated refactor;
- C3-rem `_sequence` issue classified **FOLLOW-UP**, not BLOCKER.

### C6a final qualification remaining

- [x] pre-change recovery exists;
- [x] current main.py baseline matched prior candidate parent exactly;
- [x] minimal runtime patch restored;
- [x] focused runner regressions restored;
- [x] fresh current-main CI #461 succeeded;
- [x] independent initial scope/diff review passed;
- [x] C3-rem classified FOLLOW-UP rather than scope creep;
- [x] this persistent handoff updated with implementation/CI/review evidence;
- [ ] exact-head CI after this documentation commit;
- [ ] final changed-file review: expected `main.py`, `tests/test_runner_ledger_integrity.py`, `to_do_update_list.md` only;
- [ ] review submissions / unresolved threads check;
- [ ] re-fetch protected `main` immediately before merge;
- [ ] if main drifts, stop and requalify;
- [ ] mark PR #154 ready for review;
- [ ] exact-head merge;
- [ ] post-main CI;
- [ ] normal production `Update Portfolio Data` smoke from merged main (audit-only **false**);
- [ ] verify prefix-integrity success log and normal snapshot upload;
- [ ] create post-C6a recovery;
- [ ] update this file with merge/smoke/recovery evidence.

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

Execution isolation:

- read-only audit step: SUCCESS
- normal calculation/upload: SKIPPED
- calculation-job running/result callbacks: SKIPPED

Counts-only result:

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

Decision: production Schema-2 data is qualified for C6a. This did **not** automatically authorize changing calculator `CLAMP` to `ERROR`.

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
- source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed

## Gate C / C1 — DONE

Evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`

Key findings:

1. persisted source order is deterministic `Date -> id`;
2. production calculator same-day effective order is BUY→DIV→SELL with default CLAMP when no Timestamp/Sequence;
3. canonical Daily-P&L has compatible priority/clamp semantics;
4. aggregate holdings validation does not validate intermediate prefixes;
5. split-adjusted ledger is required for quantity-prefix validation;
6. record `id` is validity-order tie-breaker, not broker-time proof;
7. historical `_sequence` regression does not exercise the actual calculator `Sequence` contract;
8. legacy TransactionAnalyzer zero-on-exception is unsafe if ever made authoritative.

## Gate C / C2 — DONE

Module: `journal_engine/core/ledger_integrity.py`

- positive unique record id;
- stable `Date -> id` replay;
- BUY adds / SELL subtracts / DIV no quantity effect;
- `all` + active comma/semicolon tag scopes;
- tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`;
- fail-closed input/diagnostic contract;
- CI #438 / `31296710938`: SUCCESS.

Temporary C6 candidate evidence:

- runtime integration `72f96e06d4b2cf449427652e5aac55a80a0f625f`;
- regression head `ec65aef87153c4ffc2b8e173448face00be69af6`;
- CI #441 / `31296798001`: SUCCESS;
- deliberately removed until C5b production data qualification.

## Gate C / C5a — DONE

- PR #150 audit infrastructure merged at `24fd65ca01738604a1eaa64a73673483a7fed79e`;
- final exact-head CI #455 / `31297580094`: SUCCESS;
- post-main CI #456 / `31297681016`: SUCCESS;
- recovery `backup-post-gate-c-audit-infra-24fd65c`;
- privacy review fixed public-detail leakage and cross-user duplicate false-positive risk;
- normal calculation behavior remained unchanged.

## Gate C / C5b — DONE / CLEAR

- production audit #3215 / `31298163263`: SUCCESS;
- audited SHA `5942f67dddec2a6b6406221067dea210cf6104c0`;
- 2 users / 168 rows / 5 scopes / 89 symbol-scopes;
- zero prefix violations;
- zero duplicate import-key/trade-id groups;
- zero repeated order-id groups;
- calculation/upload and job callbacks skipped;
- qualification `clear`;
- evidence persisted through PR #153;
- evidence merge `aa191738ac6f9243e9b645fb642869ad926d55a8`;
- post-main CI #460 / `31298366483`: SUCCESS.

---

# Change Log

### 2026-08-09 — Gate A
Generation-safe pending calculation recovery completed and production-smoked.

### 2026-08-09 — Gate B
Atomic Worker DELETE completed, post-main verified, recovery created.

### 2026-08-09 — Gate C C1/C2
Missing source-prefix validation root cause identified; independent split-adjusted Schema-2 prefix core implemented and coverage-qualified.

### 2026-08-09 — Gate C C5a
Read-only production audit infrastructure merged after privacy review and exact-head qualification.

### 2026-08-09 — Gate C C5b
Production audit #3215 returned `qualification=clear`; all prefix and duplicate-provenance defect counts were zero. Evidence persisted in PR #153 and post-main CI #460 passed.

### 2026-08-09 — Gate C C6a started
Pre-change recovery `backup-pre-gate-c-c6a-aa19173` created. Previously proven minimal runtime patch and focused runner regression were restored exactly because current `main.py` matched the candidate baseline blob. Draft PR #154 opened; fresh CI #461 passed; initial independent scope review passed. Calculator `CLAMP` remains unchanged.

---

# Decision Log

## D-C-01 — Split-adjusted Date/id prefix audit is the Schema-2 source-integrity gate

**Decision:** use independent split-adjusted `Date -> id` replay as the earliest trustworthy Schema-2 persisted-ledger validity check.  
**Status:** LOCKED.  
**Reopen condition:** schema/order contract changes or new evidence invalidates deterministic persisted-record validity order.

## D-C-02 — Record id is not broker chronology

**Decision:** `Date -> id` is ledger-validity order only.  
**Status:** LOCKED.  
**Reopen condition:** first-class execution identity/time is introduced and verified.

## D-C-03 — Production audit precedes blocking enforcement

**Decision:** SATISFIED. C5b returned `qualification=clear`; C6a may proceed.

## D-C-04 — Public audit evidence remains counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in machine-readable public audit result; duplicate provenance remains user-scoped.  
**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` is governance baseline

**Decision:** follow its startup, scope, recovery, review, documentation and Definition-of-Done rules.  
**Status:** LOCKED while Playbook remains current on main.

## D-C-06 — C6a enforcement and `CLAMP -> ERROR` are separate decisions

**Decision:** C6a adds only the blocking pre-calculator prefix gate. Calculator oversell policy remains `CLAMP`.  
**Reason:** source-integrity enforcement rejects impossible persisted prefixes; simultaneous downstream policy change would widen regression scope without current evidence of necessity.  
**Status:** LOCKED for C6a.  
**Reopen condition:** C6a evidence demonstrates reachable post-preflight risk still masked by CLAMP.

---

# Root Cause Log

## RC-C-01 — Source prefix invalidity can be hidden

**Symptom:** final holdings / Daily-P&L may be internally consistent even if persisted transaction order temporarily goes negative.  
**Failure point:** no source-prefix validation before calculator; calculator/reconciler clamp oversells and apply same-day priority.  
**Root cause:** pipeline validated aggregate/output consistency but not every deterministic persisted source prefix.  
**Systemic cause:** source validity order and calculation execution semantics were not separated into an explicit preflight contract.  
**Fix path:** independent split-adjusted audit → C5b production qualification → C6a blocking pre-calculator gate.  
**Regression protection:** `ledger_integrity.py`, audit-only workflow/tests, `tests/test_runner_ledger_integrity.py`.

---

# Known Issues

- Historical `_sequence` test remains misleading and must be corrected/supplemented in C3-rem before Gate C closeout.
- Schema 2 lacks first-class immutable external execution identity/time/sequence.
- Net-negative commission/rebate is not faithfully representable because existing paths use `abs()`.
- Futures/derivatives lack first-class asset class / multiplier support.
- P4B net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.

---

# Technical Debt

- Legacy TransactionAnalyzer broad zero-on-exception behavior; no authoritative live consumer currently found.
- Execution provenance lives in optional note metadata rather than enforced schema fields.
- Calculator/analyzer/Daily-P&L lot semantics are not consolidated into one canonical ledger engine.
- Broad market-data provider abstraction remains deferred until reproducibility evidence exists.

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

**Why rejected for C6a:** mixes source-ledger enforcement with downstream defensive-policy change and increases regression radius without evidence of necessity.  
**Reopen condition:** C6a evidence demonstrates reachable defect remains after the prefix gate.

## Schema 3 during Gate C

**Why rejected:** current production Schema-2 data passed the dedicated audit; migration is not required to close the identified Gate-C root cause.  
**Reopen condition:** post-Gate-D architecture review or new critical evidence.

---

# Risks

- C6a must execute before `PortfolioCalculator` and before snapshot upload.
- Prefix validation must use split-adjusted quantities and fail closed on missing/ambiguous split coverage.
- C6a must not depend on free-form note timestamps.
- Calculator `CLAMP` intentionally remains unchanged in C6a; this is a bounded defense-in-depth decision.
- Any main drift before C6a merge requires stop + requalification.
- Normal production smoke after merge must use audit-only=false and prove existing calculation/upload path still succeeds.
- Production Worker deployment remains separately governed.

---

# Next Actions

## Immediate — finish C6a qualification

1. Wait for exact-head PR CI triggered by this handoff update.
2. Confirm final PR #154 changed-file list is exactly:
   - `main.py`
   - `tests/test_runner_ledger_integrity.py`
   - `to_do_update_list.md`
3. Perform final independent review focused only on known C6a blockers.
4. Check review submissions and unresolved threads.
5. Re-fetch protected `main`; if it differs from `aa191738...`, stop and integrate/requalify.
6. Mark PR #154 ready and exact-head merge only after all gates pass.
7. Confirm post-main CI.
8. Run one **normal** production `Update Portfolio Data` smoke from merged main with `transaction_integrity_audit_only=false`; verify prefix success log and normal upload.
9. Create `backup-post-gate-c-c6a-<sha>` recovery.
10. Update this file with merge/CI/smoke/recovery evidence.

## C3-rem — next before Gate C closeout

- correct/supplement the historical `_sequence` regression to exercise the calculator's actual `Sequence` contract or explicitly lock current type-priority behavior;
- keep note metadata outside financial ordering;
- use a narrow test-only/behavior-documentation PR unless evidence proves runtime change is required.

## C6b decision — after C6a evidence

- assess whether any reachable risk remains that requires changing calculator `CLAMP` to `ERROR`;
- default decision is **keep CLAMP as defense-in-depth** unless new evidence demonstrates necessity;
- if a policy change is justified, use a separate scoped PR with strict-policy regressions.

## Gate C closeout

- confirm C6a production smoke and recovery;
- complete C3-rem;
- resolve C6b decision explicitly (keep CLAMP or separate change);
- update current evidence/handoff;
- create stable checkpoint/recovery;
- close Gate C.

## Gate D — only after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR/CI/review/recovery.
