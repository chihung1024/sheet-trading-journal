# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 4 bounded calculation failure recovery — final docs-bearing CI → merge → post-main CI/Pages**

---

## 0. Operating doctrine

1. Product functionality and user experience are highest priority.
2. Fix generic root causes, not individual symptoms. Parallel investigation must converge.
3. Financial/data correctness is fail-closed and may not be traded for convenience.
4. Keep one primary active batch; do not reopen closed work without new material evidence.
5. Preserve exact-head CI, rollback/recovery and permanent handoff for R2+ work.
6. Prefer invisible automation when deterministic evidence permits it.
7. AI may orchestrate workflow, but accounting/ledger truth remains deterministic rules — **AI 管流程，不管帳**.

---

## 1. Authority map for the next AI

Reconstruct truth in this order:

1. `AI_PROJECT_PLAYBOOK.md`.
2. `README.md`.
3. this file.
4. protected `main`, open PRs, exact-head CI and Pages state.
5. `docs/engineering/PHASE4_FAILURE_TRIAGE_RECOVERY_2026-08-14.md` — active Phase 4 contract and RCAs.
6. `docs/engineering/PHASE3_SELF_HEALING_SNAPSHOT_2026-08-14.md` — closed snapshot self-healing contract.
7. `docs/engineering/PHASE2_AUTOMATIC_RECALCULATION_2026-08-14.md` — closed calculation lifecycle Phase 4 reuses.
8. `docs/engineering/NOW1B_DURABLE_RECORD_CREATE_INTENT_2026-08-14.md` — closed durable-create boundary.
9. Worker/D1/deployment contracts only when backend/deployment work is actually required.

Do not collapse protected-main HEAD, Pages source, Worker runtime source, production authority and immutable evidence into one “current SHA”. Re-fetch before consequential actions.

---

## 2. Product architecture that must remain intact

```text
Vue 3 / Vite SPA (Cloudflare Pages)
  -> Cloudflare Worker API
  -> D1 authoritative transaction DB

transaction/update intent
  -> calculation_jobs
  -> GitHub Actions Python engine
  -> market data / ledger / split / FX / FIFO / dividend / TWR / XIRR
  -> fail-closed validation + reconciliation
  -> deterministic snapshot manifest
  -> browser poll/readback
```

D1 is authoritative for transactions. Browser persistence is bounded recovery/orchestration state only.

---

## 3. Closed work — do not reopen by default

| Area | State | Evidence |
|---|---|---|
| Gate A–D / E0 / E1 lifecycle work | CLOSED | no current product blocker |
| Market-data NaN/event-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| Server record-create idempotency | LIVE | tenant-scoped replay/conflict contract |
| NOW-1B-A rollback-safe create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live |
| NOW-1B-B durable create intent | CLOSED | PR #231 merged `e7c94adc...`; CI #791 + Pages #1514 PASS |
| Phase 2 Automatic Recalculation | CLOSED | PR #232 merged `a458966...`; CI #799 + Pages #1515 PASS |
| Phase 3 Self-healing Snapshot Lifecycle | **CLOSED** | PR #233 merged `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`; post-main CI #807 + Pages #1516 PASS |
| Old dedicated production create-smoke blocker | NOT A PRODUCT BLOCKER | do not hold product work for missing isolated tenant |

Do not restart broad OAuth/provider/Decimal/cash-ledger/stale-PUT/UUID/generalized-idempotency/backend-tombstone/distributed-ordering redesign without new production evidence.

---

## 4. Closed lifecycle Phase 4 must reuse

Phase 2 already provides:

```text
confirmed mutation
-> durable dirty generation
-> debounce/coalesce
-> /api/trigger-update
-> calculation_jobs
-> exact generation coverage
-> polling/recovery
-> fresh snapshot
```

Phase 3 already provides:

```text
successful full read
-> deterministic snapshot/source identity proof
-> missing/stale/benchmark mismatch classification
-> one bounded repair handoff into Phase 2
```

Phase 4 must not create another calculation queue or reinterpret financial truth.

---

## 5. Phase 4 bounded calculation failure recovery — ACTIVE

PR: **#234 — `Phase 4: bounded calculation failure recovery`**  
Branch: `feat/phase4-failure-triage-recovery`  
Base: Phase 3 verified main `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`  
Risk: **R2 Significant**.

Product objective:

> A known transient terminal calculation failure may receive one safe automatic retry only when the same Phase 2 dirty generation still proves pending calculation intent. Integrity/validation/unknown failures stop automatically.

### Typed triage policy

Retryable policy allowlist:

- `GITHUB_DISPATCH_TIMEOUT`
- `GITHUB_DISPATCH_FAILED`
- `RECORDS_API_FAILED`
- `SETTINGS_API_FAILED`
- `MARKET_DATA_FAILED`
- `SNAPSHOT_UPLOAD_FAILED`

Fail closed:

- `RECORD_VALIDATION_FAILED` → user action;
- `RECONCILIATION_FAILED`, `SNAPSHOT_VALIDATION_FAILED` → integrity stop;
- `CONFIGURATION_FAILED` → operations stop;
- generic/multiple/unknown/unrecognized → unknown stop.

Unknown codes are never auto-promoted to retryable.

### Actual wired scope

This first slice wires **terminal failed calculation jobs observed through `portfolio.calculationJob`**.

The pure policy understands ambiguous idempotent trigger outcomes and `GITHUB_DISPATCH_*`, but trigger-request failure recovery is **not wired in this slice**. Do not claim it as completed functionality.

### Durable recovery state

Fixed key: `calculation_failure_recovery.v1`.

Contains only:

- normalized owner;
- opaque Phase 2 dirty-generation token;
- opaque contender `claimId`;
- attempt count = 1;
- typed error code;
- claim timestamp.

No transaction payload; non-authoritative. Logout cleanup removes it. Browser persistence inventory explicitly reviews it.

### Cross-tab exclusive claim

`claimAutomaticFailureRetry()` uses contender write + 75 ms settle + shared read-back. Two tabs may contend, but only the tab whose exact `claimId` still owns the record can proceed.

This was added after R2 review found synchronous read→write could let two tabs believe they both owned the single retry.

### 5-second recovery backoff

The winning tab waits 5 seconds and cancels retry if:

- controller stopped;
- signed owner changed;
- dirty generation cleaned or token changed;
- shared durable `pendingCalculationRequest` exists because another tab/lifecycle already took over;
- local calculation job is queued/running.

Otherwise it calls the existing:

`portfolio.triggerUpdate(..., { automatic: true })`

No second queue/retry loop is introduced.

A won claim is intentionally not refunded if later cancelled. This is conservative: it may reduce automation in a race but cannot create multiple automatic retries for one generation.

---

## 6. Phase 4 verification chronology

### CI #808 / run `31773099401`

- new recovery behavior tests passed;
- Worker PASS;
- Frontend 269/270 PASS;
- only failure: new fixed localStorage key was not yet in reviewed persistence inventory.

Correction: add `calculation_failure_recovery.v1` to existing baseline. Scanner was not weakened.

### CI #809 / run `31773169153`

Exact head `70cb34d258f986de81cf81f4c07188b6e23a8ebe`: SUCCESS across Frontend, Worker and Python.

### Post-#809 R2 adversarial review

Found two real cross-tab races:

1. retry claim was not exclusive across tabs;
2. stale failed tab could retry after another tab already wrote a durable pending calculation job.

Corrections:

- opaque claimId + settle/read-back exclusive winner;
- backoff now yields to shared `readPendingCalculationRequest`.

### CI #815 / run `31773455151`

Code-bearing exact head `2f21b25205253030f1044e8a117d26ef633652b6`: **SUCCESS** across Frontend, Worker and Python.

CI #815 proves the code-bearing candidate only. This handoff/documentation advances the branch head, so a fresh docs-bearing exact-head CI is mandatory before merge.

---

## 7. Exact remaining Phase 4 gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #234 exact current docs-bearing head;
2. require a fresh full CI on that exact head — do not merge using CI #815;
3. compare against protected `main`;
4. expected final scope is only the Phase 4 service/controller/bootstrap/tests/storage-governance/handoff files; no Worker/D1/Python-engine/finance drift;
5. final R2 review must confirm:
   - typed allowlist only;
   - validation/reconciliation/snapshot-validation/config/unknown fail closed;
   - dirty generation required;
   - exactly one confirmed retry claim per generation across tabs/reloads;
   - failed storage/random/claim confirmation grants no retry;
   - newer/clean generation, owner change, local active job and shared pending job cancel backoff;
   - no second queue or retry loop;
   - existing triggerUpdate/Phase2 lifecycle remains authoritative;
   - no transaction payload in recovery storage;
   - logout cleanup and persistence inventory coverage;
   - exactly one production bootstrap controller;
   - trigger-request failure recovery remains out of wired scope;
6. update PR #234 body with final head/CI/scope/review;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation solely for smoke testing.

Only then mark this Phase 4 first slice **CLOSED**.

---

## 8. Next line after closure

Do not automatically jump into a broad “AI agent” rewrite.

After #234 post-main CI + Pages closure, independently review whether the next highest-value Phase 4 slice is:

1. safe trigger-request ambiguity recovery using the already-typed policy, or
2. richer deterministic failure presentation/triage, or
3. Phase 5 Ops Autopilot.

Choose based on actual remaining user friction and production evidence. Any AI layer remains orchestration only and cannot infer/rewrite accounting truth.

---

## 9. Repository hygiene note

A zero-diff branch named `tmp-do-not-create` was accidentally created earlier pointing at historical main. It has no unique commits and no production effect. Current connector lacks a branch-delete action. Do **not** let this nonfunctional cleanup block product work; remove it later through repository UI when convenient.

---

## 10. Historical provenance

Closed details remain in Git history, merged PRs, engineering docs, governance evidence and workflow artifacts. This file is intentionally converged to answer one operational question accurately: **what should the next AI do now without breaking the product?**
