# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE after repository startup documents.** This file is the persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. It exists so execution can continue even when the previous chat/session is unavailable.
>
> **Mandatory update rule:** after every material implementation, test/CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or externally introduced main drift, update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

# Project Status

## Session startup order

Per repository `AI_PROJECT_PLAYBOOK.md`, every new AI/developer session must:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read `to_do_update_list.md`;
4. inspect Git/current `main` and active branch/PR;
5. inspect recent commits/PRs/releases;
6. identify Current Phase, Current Batch, Next Action, and locked decisions;
7. then begin work.

Additional current-phase references:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- while Gate C is active: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`

## Engineering rules currently locked

- Evidence before conclusion; root cause before symptom fix.
- Broad investigation is allowed; implementation must converge to the current Batch.
- Important changes require recovery, scoped PR, tests, independent review, documentation, exact-head verification, and rollback path.
- Never lower validation/coverage/financial-integrity gates just to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does **not** authorize production Worker deployment.
- Unknown/user-authored changes are potential user work and must not be overwritten.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Current protected `main`: `0683a751156bef86dc1b0e7158b4379f2e62ef79`
- Previous Gate-C qualification base: `03242d00082067333cf77ffa424094b8936b406c`
- Main drift source: PR #151, which added `AI_PROJECT_PLAYBOOK.md`; no Gate-C product-code overlap.
- Latest-main integration recovery: `backup-gate-c-pre-main-drift-integration-c55620c`
- Gate-C branch merge commit integrating latest main: `131889a026f9732fe29bb2dbe4aacb8a7b3eb86b`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Production Worker deployment is **not** part of current Gate C.
- Production calculation remained last verified by Gate-A smoke #3213; Gate-C audit infrastructure does not change normal calculation behavior.

---

# Architecture Notes

- Schema 2 has deterministic record identity/order available as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- Production `prepare_transactions()` does not parse `note` into ordering fields.
- Calculator and canonical Daily-P&L use compatible same-day type-priority/clamp semantics, so their agreement cannot prove source-prefix validity.
- Prefix validity must be evaluated on the independent split-adjusted ledger.
- `note` remains metadata, not a financial-calculation dependency.
- Current Commission/Tax paths normalize with `abs()`; net-negative commission/rebate is not faithfully representable.
- Futures/derivatives remain outside Stock-journal semantics because asset-class/multiplier fields do not exist.

---

# Master Plan

| Phase | Batch | Objective | Priority | Status | Dependency | Verification |
|---|---|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | High | DONE | prior product-integrity line | PR #148 + CI + production smoke |
| Gate B | P5C3B | atomic Worker record deletion | High | DONE | Gate A | PR #149 + post-main CI |
| Gate C | C1 | runtime transaction-consumer audit | High | DONE | Gate B | audit evidence document |
| Gate C | C2 | deterministic Schema-2 prefix-integrity core | High | DONE / infrastructure qualified | C1 | module tests + coverage CI |
| Gate C | C5a | read-only production-audit infrastructure | High | VERIFYING | C2 | PR #150 exact-head CI/review/merge |
| Gate C | C5b | production read-only audit | High | BLOCKED on C5a merge/manual dispatch | C5a | merged-main workflow result |
| Gate C | C6 | enforcement decision | High | BLOCKED on C5b evidence | C5b | separate scoped enforcement PR |
| Gate D | D1 | calculation manifest + deterministic golden replay | Next | TODO | Gate C closeout | replay/CI evidence |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | Gate D | fresh review only |

---

# Current Phase

**Gate C — Schema-2 transaction integrity preflight**

Gate C distinguishes:

- deterministic Schema-2 **ledger-validity order**: `Date -> record id`;
- true broker execution chronology: **not guaranteed** by current schema.

Gate C does not authorize Schema 3, broker-execution tables, futures support, broad import redesign, provider abstraction, unrelated UX work, or production Worker deployment.

---

# Current Batch

## Primary Batch: C5a — merge read-only production-audit infrastructure

Status: **VERIFYING**

Active PR: **#150**  
Title: `Gate C: add read-only transaction integrity audit infrastructure`  
Branch: `pr-gate-c-transaction-integrity-preflight`  
Original pre-Gate-C recovery: `backup-pre-gate-c-03242d0`  
Latest-main integration recovery: `backup-gate-c-pre-main-drift-integration-c55620c`  
Latest main integrated: `0683a751156bef86dc1b0e7158b4379f2e62ef79`  
Integration commit: `131889a026f9732fe29bb2dbe4aacb8a7b3eb86b`

### In scope

- standalone Schema-2 prefix-integrity audit core;
- tests/coverage governance for that core;
- read-only production audit runner;
- explicit audit-only workflow-dispatch mode;
- counts-only, non-sensitive public audit result;
- C1 evidence + handoff/execution docs.

### Out of scope

- blocking prefix enforcement in normal calculation runner;
- calculator `CLAMP -> ERROR` switch;
- Schema 3;
- broker ingestion redesign;
- production Worker deploy;
- futures support;
- unrelated refactors.

### Expansion trigger

Only a Critical/Data-Integrity/Security finding that prevents safe audit infrastructure merge may interrupt this Batch. Other discoveries go NEXT/BACKLOG/REJECT.

---

# Active Work

## C5a final qualification checklist

- [x] C1 audit evidence written.
- [x] Prefix-integrity module implemented/tested.
- [x] Coverage source inventory updated without lowering gates.
- [x] Temporary blocking runner candidate tested successfully.
- [x] Blocking runner candidate deliberately removed pending production evidence.
- [x] Read-only audit runner implemented.
- [x] Audit-only workflow mode implemented with normal scheduled/manual path unchanged when false.
- [x] Audit/workflow regression tests implemented.
- [x] Public-log privacy review performed.
- [x] User-scoped duplicate detection implemented.
- [x] Machine-readable production result changed to counts-only: no user id, ticker, tag, record id, quantity, price, raw/hashed broker id.
- [x] CI #452 succeeded on privacy-fixed code.
- [x] CI #453 succeeded on handoff head `c55620c...` before latest-main integration.
- [x] Main drift discovered before merge; merge correctly stopped.
- [x] New repository `AI_PROJECT_PLAYBOOK.md` read and accepted as current governance baseline.
- [x] Latest main integrated through merge commit `131889a...` without overwriting user work.
- [ ] Exact-head CI on latest-main-integrated branch.
- [ ] Final diff review after latest-main integration.
- [ ] Confirm `main.py` and `tests/test_runner_ledger_integrity.py` remain absent from PR diff.
- [ ] Review submissions / unresolved threads check.
- [ ] Re-check protected `main` immediately before merge.
- [ ] Mark PR ready and exact-head merge.
- [ ] Post-main CI.
- [ ] Create post-audit-infrastructure recovery ref.
- [ ] Update this file with merge/post-main evidence.

## C5b production read-only audit — next Batch after C5a merge

Run once from merged `main`:

- workflow: `Update Portfolio Data` → `Run workflow`;
- `transaction_integrity_audit_only = true`;
- `target_user_id =` blank;
- `calculation_job_id =` blank;
- benchmark irrelevant in audit mode.

ChatGPT currently has no connected workflow-dispatch action, so this one production audit must be manually triggered in GitHub UI unless a new connected dispatch capability appears.

Acceptance evidence:

- [ ] all users audited;
- [ ] all active tag scopes audited;
- [ ] split-factor coverage valid;
- [ ] prefix violation counts recorded;
- [ ] duplicate `import_key` / `trade_id` group counts recorded;
- [ ] repeated order-id group counts recorded as evidence only;
- [ ] result remains read-only and counts-only;
- [ ] evidence persisted here + Gate-C audit document;
- [ ] no enforcement decision until unexplained violations are resolved.

---

# Completed Work

## Gate A / P6C

- PR #148 final head `80d417c125797020fab1b6be401084049f2e25e3`
- merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production Update Portfolio Data #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B

- PR #149 final head `439e9ed39647ccd5885a2cc02a6850712c30708a`
- final CI #433 / `31296056184` SUCCESS
- merge `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054` SUCCESS
- recovery `backup-post-gate-b-03242d0`
- result: source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed

## Gate C / C1

Evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`  
Commit: `2e535982e460045fb8235d99307c9ba1e31ffa2e`

Findings:

1. source order is deterministic `Date -> id`;
2. calculator production effective same-day order is BUY→DIV→SELL, default CLAMP;
3. canonical Daily-P&L uses compatible priority/clamp semantics;
4. holdings validator does not check intermediate prefixes;
5. split-adjusted ledger is required for quantity-prefix validation;
6. `id` is validity-order tie-breaker, not broker-time proof;
7. historical `_sequence` test does not exercise actual calculator `Sequence` support;
8. legacy TransactionAnalyzer zero-on-exception is unsafe if ever made authoritative.

## Gate C / C2

Module: `journal_engine/core/ledger_integrity.py`

- stable Date/id replay;
- BUY/SELL/DIV quantity semantics;
- all + active tag scopes;
- provisional tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`;
- fail-closed input/diagnostic contract.

CI history:

- #435: functional tests passed; coverage inventory correctly blocked unregistered source;
- coverage inventory updated without lowering gates;
- #436: tests passed; missing-branch gate blocked;
- fail-closed branches expanded;
- #438 / `31296710938`: SUCCESS.

Temporary enforcement candidate:

- integration `72f96e06d4b2cf449427652e5aac55a80a0f625f`;
- tested head `ec65aef87153c4ffc2b8e173448face00be69af6`;
- CI #441 / `31296798001`: SUCCESS;
- removed pending production audit via `71c086a...` + `b666e36...`.

## Gate C / C5a audit infrastructure

- audit tool `e986e17b2180658bddd1bd0ebfb11dca9853c29f`;
- audit-only workflow `d93a058ca015a53c535d9ccdfc8532ae4c260431`;
- initial audit tests `0d34e7dae3332d1c50dddcc849336fb45059d919`;
- workflow test head `f83e5721ad5ccd32db6ef5ed3712544413ac37fa`;
- CI #449 / `31297087680`: SUCCESS;
- handoff CI #450 / `31297190520`: SUCCESS;
- privacy fix `9a598b7f4a018edd8247238592fafded964c0c22`;
- privacy regression head `2cbf2804bc34267468fbcde8d9422fa26ede04fb`;
- CI #452 / `31297308611`: SUCCESS;
- handoff head `c55620c5191927b7e400a987d9215d65c5247729`;
- CI #453 / `31297396944`: SUCCESS;
- main drift then detected before merge and integration correctly required.

---

# Change Log

### 2026-08-09 — Gate A closeout

Production smoke succeeded on merged Gate-A main; Gate A closed.

### 2026-08-09 — Gate B closeout

Atomic DELETE merged and post-main CI passed; recovery created.

### 2026-08-09 — Gate C C1

Runtime consumer audit proved clamp/type-priority consistency cannot certify source-prefix validity.

### 2026-08-09 — Gate C C2

Prefix-integrity module/tests added; coverage gates were preserved and eventually all green.

### 2026-08-09 — Gate C temporary enforcement candidate

Blocking runner preflight was implemented/tested, then removed because production data had not yet been qualified.

### 2026-08-09 — Gate C C5a audit infrastructure

Read-only audit tool/workflow/tests added. Privacy review found and fixed public-detail leakage plus cross-user duplicate false-positive risk. CI #452/#453 green.

### 2026-08-09 — External main drift / governance integration

- protected main changed from `03242d0...` to `0683a751...` through PR #151;
- compare showed only newly added `AI_PROJECT_PLAYBOOK.md` relative to Gate-B main;
- user work was not overwritten;
- recovery `backup-gate-c-pre-main-drift-integration-c55620c` created;
- new playbook read and treated as repository governance baseline;
- latest main integrated into Gate-C branch with merge commit `131889a026f9732fe29bb2dbe4aacb8a7b3eb86b`;
- final qualification must be repeated on this new combined head.

---

# Decision Log

## D-C-01 — Validate deterministic source ledger before strict calculator enforcement

**Decision:** use split-adjusted Date/id prefix audit as the earliest trustworthy Schema-2 source-ledger gate.  
**Reason:** calculator/reconciler clamp and same-day priority can mask impossible prefixes.  
**Status:** LOCKED.  
**Reopen condition:** new evidence shows Date/id cannot safely represent persisted Schema-2 validity order or schema changes.

## D-C-02 — Do not equate record id with broker chronology

**Decision:** Date/id is ledger-validity order only.  
**Status:** LOCKED.  
**Reopen condition:** first-class execution identity/time is introduced and verified.

## D-C-03 — Production audit before blocking enforcement

**Decision:** merge audit infrastructure first; blocking runner integration and CLAMP→ERROR are separate post-audit decisions.  
**Evidence:** temporary enforcement candidate already passed CI #441.  
**Status:** LOCKED until C5b result.  
**Reopen condition:** Critical evidence shows audit itself cannot be safely separated.

## D-C-04 — Public production audit output is counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in machine-readable public result; duplicate provenance grouped within user only.  
**Reason:** public Actions privacy + cross-tenant false-positive prevention.  
**Status:** LOCKED.  
**Reopen condition:** a separately protected/private evidence channel is introduced and reviewed.

## D-C-05 — New AI_PROJECT_PLAYBOOK is governance baseline

**Decision:** follow Session Startup, Controlled Divergence, recovery, review, documentation, and Definition-of-Done rules from `AI_PROJECT_PLAYBOOK.md`.  
**Status:** LOCKED while file remains current on main.  
**Reopen condition:** user/repository explicitly revises the playbook.

---

# Root Cause Log

## RC-C-01 — Source prefix invalidity can be hidden

**Symptom:** final holdings / Daily-P&L can appear internally consistent even if persisted transaction sequence temporarily goes negative.  
**Failure point:** no source-prefix validation before calculator; calculator + reconciler both clamp oversells and reorder same-day types.  
**Root cause:** Schema-2 calculation pipeline validates outputs/aggregate quantity but not every deterministic source-ledger prefix.  
**Systemic cause:** source identity/order and execution semantics were never separated into an explicit preflight contract.  
**Fix direction:** split-adjusted Date/id read-only audit → production qualification → separate enforcement decision.  
**Regression protection:** `ledger_integrity.py`, dedicated tests, audit-only workflow/tests.  
**Status:** audit infrastructure VERIFYING; enforcement not yet merged.

---

# Known Issues

- Historical `_sequence` test remains misleading and must be corrected/supplemented before Gate C closeout.
- Production prefix/provenance counts are not yet known; C5b pending.
- Schema 2 lacks first-class immutable external execution identity/time/sequence.
- Net-negative commission/rebate is not faithfully representable because existing paths use `abs()`.
- Futures/derivatives lack first-class asset class / multiplier support.
- P4B net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.

---

# Technical Debt

- Legacy TransactionAnalyzer broad zero-on-exception behavior; no authoritative live consumer currently found.
- Execution provenance currently lives in optional free-form note metadata rather than enforced schema fields.
- Calculator/analyzer/Daily-P&L lot semantics are not yet consolidated into one canonical ledger engine.
- Broad market-data provider abstraction remains intentionally deferred until reproducibility evidence exists.

---

# Deferred Candidates

## Schema-3 execution identity

**Value:** first-class broker source/external id/order id/executed_at/currency/asset class/multiplier.  
**Reason deferred:** Gate C/D must prove current needs and recovery requirements first.  
**Dependency:** Gate D closeout + fresh architecture review + Schema-3 recovery gate.  
**Revisit condition:** post-Gate-D review.

## Immutable `broker_executions` table

**Value:** immutable fill-level auditability and derivatives-ready provenance.  
**Reason deferred:** architecture migration not needed to complete current Schema-2 audit.  
**Revisit condition:** post-Gate-D review.

## Canonical lot-ledger consolidation

**Reason deferred:** current priority is source integrity then reproducibility.  
**Revisit condition:** post-Gate-D evidence.

## Broad provider abstraction / cleanup / typing refactor

**Reason deferred:** not required for current correctness gate.  
**Revisit condition:** after higher-value correctness phases converge.

---

# Rejected Candidates

## Parse free-form `note` as financial execution order

**Why considered:** notes may contain IBKR timestamps/order ids.  
**Why rejected:** free-form metadata is not a stable calculation contract and would create fragile implicit semantics.  
**Reopen condition:** only after a structured, reviewed execution-identity contract exists.

## Merge blocking preflight before production audit

**Why considered:** candidate implementation already passed CI #441.  
**Why rejected now:** technical correctness does not prove current production data can pass strict source-prefix semantics safely.  
**Reopen condition:** C5b production audit qualifies data.

## Switch calculator `CLAMP -> ERROR` inside audit-infrastructure PR

**Why rejected:** mixes evidence collection with enforcement and increases regression risk.  
**Reopen condition:** C5b evidence + dedicated C6 review/tests.

---

# Risks

- Production audit must remain strictly read-only; no snapshot upload or D1 mutation.
- Audit log is on a public repository; output must remain counts-only/non-sensitive.
- Missing split data must fail closed rather than silently use factor 1.
- Main drift must be requalified; stale CI cannot authorize merge.
- Production audit could reveal real invalid prefixes or duplicate provenance; enforcement must remain blocked until classified.
- Manual audit dispatch is currently a human dependency because connected GitHub tooling exposes no workflow-dispatch mutation.

---

# Next Actions

## Immediate — finish C5a

1. Run exact-head CI on branch after latest-main integration + this handoff update.
2. Confirm PR #150 final diff contains only audit infrastructure/docs/tests and not `main.py` or `tests/test_runner_ledger_integrity.py`.
3. Perform independent final review under `AI_PROJECT_PLAYBOOK.md` requirements.
4. Check reviews/threads.
5. Re-fetch `main`; if it drifts again, stop and requalify.
6. Mark PR #150 ready and merge with exact expected head SHA.
7. Confirm post-main CI.
8. Create `backup-post-gate-c-audit-infra-<sha>` recovery.
9. Update this file with merge/post-main results.

## Next Batch — C5b production audit

1. User manually triggers `Update Portfolio Data` with audit-only=true, blank target user, blank calculation-job id.
2. Fetch exact run/jobs/logs.
3. Parse `GATE_C_TRANSACTION_INTEGRITY_AUDIT=...` counts-only JSON.
4. Record prefix/provenance counts and qualification.
5. If blocked, classify before any enforcement.
6. If clear, prepare separate C6 enforcement proposal; do not automatically switch CLAMP→ERROR.

## Gate D — only after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR/CI/review/recovery.
