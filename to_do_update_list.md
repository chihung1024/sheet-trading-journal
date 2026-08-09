# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE after repository startup documents.** This file is the persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. It exists so execution can continue even when the previous chat/session is unavailable.
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

## Locked engineering rules

- Evidence before conclusion; root cause before symptom fix.
- Broad investigation is allowed; implementation must converge to the current Batch.
- Important changes require recovery → scoped PR → tests/CI → independent review → docs → exact-head merge → post-main verification → recovery.
- Never lower validation, coverage, financial-integrity or recovery gates merely to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does **not** authorize production Worker deployment.
- Unknown/user-authored changes must not be overwritten.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Current protected `main`: `24fd65ca01738604a1eaa64a73673483a7fed79e`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate C C5a read-only audit infrastructure is merged.
- Normal calculation runner remains unchanged by C5a; blocking prefix enforcement is **not** enabled.
- Calculator default oversell policy remains `CLAMP`.
- Production Worker deployment was not performed.
- Post-C5a main CI #456 / run `31297681016`: **SUCCESS**.
- Post-C5a recovery: `backup-post-gate-c-audit-infra-24fd65c`.
- Current active Batch: **Gate C / C5b — production read-only transaction-integrity audit**.

---

# Architecture Notes

- Schema 2 provides deterministic persisted-record order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- `prepare_transactions()` does not promote note metadata into financial ordering fields.
- Calculator and canonical Daily-P&L use compatible same-day type priority and clamp semantics; their agreement cannot prove source-prefix validity.
- Prefix validity must be evaluated on the independent split-adjusted ledger.
- `note` remains metadata, not a financial-calculation dependency.
- Existing Commission/Tax paths normalize values with `abs()`; net-negative commission/rebate is not faithfully representable.
- Futures/derivatives remain outside Stock-journal semantics because asset-class/multiplier fields do not exist.

---

# Master Plan

| Phase | Batch | Objective | Priority | Status | Dependency | Verification |
|---|---|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | High | **DONE** | prior product-integrity line | PR #148 + CI + production smoke |
| Gate B | P5C3B | atomic Worker record deletion | High | **DONE** | Gate A | PR #149 + post-main CI + recovery |
| Gate C | C1 | runtime transaction-consumer audit | High | **DONE** | Gate B | audit evidence document |
| Gate C | C2 | deterministic Schema-2 prefix-integrity core | High | **DONE / infrastructure qualified** | C1 | tests + coverage CI |
| Gate C | C5a | read-only production-audit infrastructure | High | **DONE** | C2 | PR #150 + CI #455 + post-main CI #456 + recovery |
| Gate C | C5b | production read-only audit | High | **ACTIVE / human dispatch required** | C5a | merged-main audit-only workflow result |
| Gate C | C3-rem | correct/supplement historical `_sequence` regression | Medium | TODO before Gate C closeout | C5b/C6 may proceed independently | targeted regression CI |
| Gate C | C6 | blocking enforcement decision | High | BLOCKED on C5b evidence | C5b | separate scoped enforcement PR |
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

## C5b — Production read-only transaction-integrity audit

Status: **ACTIVE — waiting for one manual GitHub workflow dispatch**

Merged infrastructure main: `24fd65ca01738604a1eaa64a73673483a7fed79e`  
Audit infrastructure PR: **#150**  
Post-main CI: **#456 / `31297681016` SUCCESS**  
Recovery: `backup-post-gate-c-audit-infra-24fd65c`

### Exact manual action required

In GitHub UI:

1. open **Actions**;
2. select **Update Portfolio Data**;
3. click **Run workflow**;
4. branch: `main`;
5. set `transaction_integrity_audit_only = true`;
6. leave `target_user_id` blank;
7. leave `calculation_job_id` blank;
8. benchmark value is irrelevant in audit mode;
9. run once.

ChatGPT's currently connected GitHub action set has no workflow-dispatch mutation, so this one step requires manual UI execution unless a new connected dispatch capability appears.

### C5b acceptance criteria

- [ ] exact run is from merged main `24fd65c...` or a later explicitly requalified main;
- [ ] audit mode is `true`;
- [ ] all production users are read;
- [ ] all active tag scopes are audited;
- [ ] split-factor coverage passes or fails closed;
- [ ] machine-readable line `GATE_C_TRANSACTION_INTEGRITY_AUDIT=<json>` is produced;
- [ ] output remains counts-only/non-sensitive;
- [ ] prefix violation count recorded;
- [ ] users-with-prefix-violation count recorded;
- [ ] all-scope/tag-scope violation counts recorded;
- [ ] duplicate `import_key` group/row counts recorded;
- [ ] duplicate `trade_id` group/row counts recorded;
- [ ] repeated `order_id` group/row counts recorded as evidence only;
- [ ] no portfolio snapshot upload occurs;
- [ ] no record/settings/D1 mutation occurs;
- [ ] results are persisted in this file + Gate-C evidence docs;
- [ ] unexplained violations block C6 enforcement.

### C5b outcome routing

If `qualification = clear`:

- proceed to a separate C6 enforcement design/review;
- do **not** automatically switch `CLAMP -> ERROR`;
- first restore/test the already-proven pre-calculator gate in a new scoped branch/PR;
- separately decide whether CLAMP remains defense-in-depth or becomes ERROR.

If `qualification = blocked`:

- do not enable enforcement;
- classify source-prefix/provenance findings;
- determine whether causes are import ordering, split coverage, unsupported short/oversell, duplicate provenance, or unknown;
- remediate data/process root cause before C6.

---

# Completed Work

## Gate A / P6C — DONE

- PR #148 final head `80d417c125797020fab1b6be401084049f2e25e3`
- merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production Update Portfolio Data #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B — DONE

- PR #149 final head `439e9ed39647ccd5885a2cc02a6850712c30708a`
- final exact-head CI #433 / `31296056184`: SUCCESS
- merge `03242d00082067333cf77ffa424094b8936b406c`
- post-main CI #434 / `31296121054`: SUCCESS
- recovery `backup-post-gate-b-03242d0`
- result: source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed

## Gate C / C1 — DONE

Evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`  
Initial evidence commit: `2e535982e460045fb8235d99307c9ba1e31ffa2e`

Findings:

1. source order is deterministic `Date -> id`;
2. calculator production effective same-day order is BUY→DIV→SELL, default CLAMP;
3. canonical Daily-P&L uses compatible priority/clamp semantics;
4. holdings validator does not check intermediate prefixes;
5. split-adjusted ledger is required for quantity-prefix validation;
6. `id` is validity-order tie-breaker, not broker-time proof;
7. historical `_sequence` test does not exercise actual calculator `Sequence` support;
8. legacy TransactionAnalyzer zero-on-exception is unsafe if ever made authoritative.

## Gate C / C2 — DONE / INFRASTRUCTURE QUALIFIED

Module: `journal_engine/core/ledger_integrity.py`

Contract:

- positive unique record id;
- stable `Date -> id` replay;
- BUY adds / SELL subtracts / DIV no quantity effect;
- `all` + active comma/semicolon tag scopes;
- provisional tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)`;
- fail-closed input and diagnostics.

CI history:

- CI #435: functional tests passed; coverage source inventory correctly blocked unregistered source;
- coverage inventory updated without lowering gates;
- CI #436: tests passed; missing-branch gate correctly blocked;
- fail-closed branches expanded;
- CI #438 / `31296710938`: SUCCESS.

Temporary blocking enforcement candidate:

- integration commit `72f96e06d4b2cf449427652e5aac55a80a0f625f`;
- regression head `ec65aef87153c4ffc2b8e173448face00be69af6`;
- CI #441 / `31296798001`: SUCCESS;
- proved preflight-before-calculator and violation-blocks-upload behavior;
- then deliberately removed pending production audit via `71c086a...` + `b666e36...`.

## Gate C / C5a — DONE

Purpose: merge **read-only audit infrastructure only**, excluding blocking enforcement.

Implementation/evidence:

- audit tool commit `e986e17b2180658bddd1bd0ebfb11dca9853c29f`;
- audit-only workflow commit `d93a058ca015a53c535d9ccdfc8532ae4c260431`;
- initial audit tests `0d34e7dae3332d1c50dddcc849336fb45059d919`;
- workflow test head `f83e5721ad5ccd32db6ef5ed3712544413ac37fa`;
- CI #449 / `31297087680`: SUCCESS;
- handoff CI #450 / `31297190520`: SUCCESS;
- independent privacy review found public-detail leakage + cross-user duplicate false-positive risk;
- privacy fix `9a598b7f4a018edd8247238592fafded964c0c22`;
- privacy regression head `2cbf2804bc34267468fbcde8d9422fa26ede04fb`;
- CI #452 / `31297308611`: SUCCESS;
- handoff head `c55620c5191927b7e400a987d9215d65c5247729`;
- CI #453 / `31297396944`: SUCCESS;
- protected main drift detected before merge; merge correctly stopped;
- drift source PR #151 added `AI_PROJECT_PLAYBOOK.md`;
- integration recovery `backup-gate-c-pre-main-drift-integration-c55620c`;
- latest main `0683a751156bef86dc1b0e7158b4379f2e62ef79` integrated by `131889a026f9732fe29bb2dbe4aacb8a7b3eb86b`;
- final PR head `2f606d032d2d3d781eeca49164ba3d3f563477d5`;
- final exact-head CI #455 / `31297580094`: SUCCESS;
- final diff relative current main: 10 audit/docs/tests files only; no `main.py`, no blocking runner regression, no Playbook diff;
- reviews 0 / unresolved threads 0;
- exact-head merge PR #150 → `24fd65ca01738604a1eaa64a73673483a7fed79e`;
- post-main CI #456 / `31297681016`: **SUCCESS**;
- post-C5a recovery `backup-post-gate-c-audit-infra-24fd65c`;
- production Worker deploy: not performed;
- normal portfolio calculation behavior: unchanged.

### C5a privacy/read-only contract now merged

- machine-readable public result is counts-only;
- no user id, ticker, tag, record id, quantity, price, note content, raw or hashed broker identifier in result JSON;
- duplicate provenance is grouped within user only;
- duplicate `import_key` / `trade_id` groups block qualification;
- repeated `order_id` groups are evidence only;
- audit-only workflow rejects calculation-job callback binding;
- audit mode skips normal calculation/upload and job callbacks;
- missing/ambiguous split coverage fails closed.

---

# Change Log

### 2026-08-09 — Gate A closeout

Production smoke succeeded on merged Gate-A main; Gate A closed.

### 2026-08-09 — Gate B closeout

Atomic DELETE merged and post-main CI passed; recovery created.

### 2026-08-09 — Gate C C1

Runtime consumer audit proved clamp/type-priority consistency cannot certify source-prefix validity.

### 2026-08-09 — Gate C C2

Prefix-integrity module/tests added; coverage gates preserved and all green.

### 2026-08-09 — Gate C temporary enforcement candidate

Blocking runner preflight was implemented/tested, then deliberately removed because production data had not yet been qualified.

### 2026-08-09 — Gate C C5a audit infrastructure

Read-only audit tool/workflow/tests added. Privacy review found and fixed public-detail leakage plus cross-user duplicate false-positive risk. Main drift was detected and requalified against the new Playbook baseline. PR #150 merged at `24fd65c...`; post-main CI #456 succeeded; recovery created. C5a closed.

### 2026-08-09 — Gate C C5b activated

Next action is one production read-only audit from merged main. No enforcement change is authorized until its result is persisted and classified.

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

**Decision:** read-only audit infrastructure merged first; blocking runner integration and CLAMP→ERROR are separate post-audit decisions.  
**Evidence:** temporary enforcement candidate passed CI #441 but was removed from PR #150.  
**Status:** LOCKED until C5b result.  
**Reopen condition:** Critical evidence shows audit cannot be safely separated.

## D-C-04 — Public production audit output is counts-only

**Decision:** no user/ticker/tag/record/quantity/price/raw-or-hashed broker identifier in machine-readable public result; duplicate provenance grouped within user only.  
**Reason:** public Actions privacy + cross-tenant false-positive prevention.  
**Status:** LOCKED.  
**Reopen condition:** separately protected/private evidence channel is introduced and reviewed.

## D-C-05 — AI_PROJECT_PLAYBOOK is governance baseline

**Decision:** follow Session Startup, Controlled Divergence, recovery, review, documentation and Definition-of-Done rules from `AI_PROJECT_PLAYBOOK.md`.  
**Status:** LOCKED while file remains current on main.  
**Reopen condition:** user/repository explicitly revises the Playbook.

## D-C-06 — C5a and C5b are separate Batches

**Decision:** merge/read-verify audit infrastructure first, then run production audit as a separate Batch requiring explicit evidence persistence.  
**Reason:** prevents evidence collection and enforcement from becoming one irreversible step.  
**Status:** LOCKED.

---

# Root Cause Log

## RC-C-01 — Source prefix invalidity can be hidden

**Symptom:** final holdings / Daily-P&L can appear internally consistent even if persisted transaction sequence temporarily goes negative.  
**Failure point:** no source-prefix validation before calculator; calculator + reconciler both clamp oversells and reorder same-day types.  
**Root cause:** Schema-2 calculation pipeline validates outputs/aggregate quantity but not every deterministic source-ledger prefix.  
**Systemic cause:** source identity/order and execution semantics were never separated into an explicit preflight contract.  
**Fix direction:** split-adjusted Date/id read-only audit → production qualification → separate enforcement decision.  
**Regression protection:** `ledger_integrity.py`, dedicated tests, audit-only workflow/tests.  
**Status:** audit infrastructure DONE; production qualification ACTIVE; enforcement blocked.

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
- Calculator/analyzer/Daily-P&L lot semantics are not consolidated into one canonical ledger engine.
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
**Why rejected:** free-form metadata is not a stable calculation contract and creates fragile implicit semantics.  
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
- Audit runs from a public repository; machine-readable output must remain counts-only/non-sensitive.
- Missing split data must fail closed rather than silently use factor 1.
- Production audit may reveal invalid prefixes or duplicate provenance; enforcement remains blocked until classified.
- Manual audit dispatch is currently a human dependency because connected GitHub tooling exposes no workflow-dispatch mutation.
- Any main drift before the audit should be checked so the exact audited SHA is recorded.

---

# Next Actions

## Immediate — C5b production audit

1. User manually triggers `Update Portfolio Data` from `main` with `transaction_integrity_audit_only=true`, blank target user, blank calculation-job id.
2. Fetch exact workflow run, jobs and logs.
3. Verify run `head_sha` and audit mode.
4. Parse counts-only `GATE_C_TRANSACTION_INTEGRITY_AUDIT=...` JSON.
5. Confirm no normal calculation/upload step executed.
6. Record counts and qualification in this file + Gate-C evidence doc via scoped documentation PR.
7. If blocked, classify root causes before any enforcement.
8. If clear, proceed to C6 design; do not automatically switch CLAMP→ERROR.

## C3 remaining regression before Gate C closeout

- correct/supplement historical `_sequence` test to exercise actual `Sequence` contract or explicitly lock type-priority behavior;
- keep note metadata outside financial ordering.

## C6 — only after C5b evidence

- restore the already-proven blocking pre-calculator prefix gate in a fresh scoped branch/PR;
- independently decide whether calculator CLAMP remains defense-in-depth or changes to ERROR;
- add strict-policy regressions before any CLAMP→ERROR change;
- exact-head CI / independent review / main-drift check / merge / post-main CI / recovery;
- update this file and close Gate C.

## Gate D — only after Gate C closeout

- calculation manifest: engine SHA, record count/max id/input hash, config/benchmark hash, market/FX provenance, synthetic valuation source/count, calculation timestamp;
- frozen golden replay: transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR, XIRR;
- distinguish record/vendor/FX/engine/synthetic-valuation changes;
- scoped PR/CI/review/recovery.
