# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 2 Automatic Recalculation → merge/production Pages verification → Phase 3 Self-healing Snapshot Lifecycle**

---

## 0. Operating doctrine

1. Product functionality and user experience are the highest priority.
2. Debugging, CI, deployment governance, RCA and documentation protect functionality; they are not the roadmap.
3. Fix generic root causes, not individual symptoms. Parallel investigation is allowed only when it converges.
4. Financial/data correctness is fail-closed and may not be traded for convenience.
5. Keep one primary active batch. Do not reopen closed infrastructure or market-data work without new material evidence.
6. Preserve exact-head CI, rollback/recovery paths and permanent handoff for R2+ work.
7. Prefer invisible automation. User intent should drive the system; dedupe, recovery, recalculation and synchronization should be automatic when correctness permits.
8. AI may orchestrate workflows; deterministic ledger/accounting logic remains rules-based — **AI 管流程，不管帳**.

---

## 1. Future-AI bootstrap / authority map

Reconstruct truth in this order:

1. `AI_PROJECT_PLAYBOOK.md` — governance/risk rules.
2. `README.md` — architecture/product orientation.
3. this file — current batch and exact next action.
4. protected `main`, open PRs, CI, Pages and current deployment state.
5. `worker-manifest.json`, Worker/D1/recovery/deployment contracts only if backend/deployment work is actually required.
6. `docs/engineering/PHASE2_AUTOMATIC_RECALCULATION_2026-08-14.md` — active Phase 2 design and reasoning.
7. `docs/engineering/NOW1B_DURABLE_RECORD_CREATE_INTENT_2026-08-14.md` — prior durable-create boundary.
8. older docs/evidence/PR/Git history for provenance only.

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
  -> snapshot upload
  -> browser poll/readback
```

D1 is authoritative for transactions. Browser persistence is only bounded recovery/orchestration state. Do not move accounting truth into browser state or AI inference.

---

## 3. Closed work — do not reopen by default

| Area | State | Evidence / meaning |
|---|---|---|
| Gate A–D / E0 / E1 lifecycle work | CLOSED | no current product blocker |
| Market-data NaN/event-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| Server record-create idempotency | LIVE | tenant-scoped replay/conflict contract |
| NOW-1B-A rollback-safe create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` safe to consume |
| NOW-1B-B durable create intent | **CLOSED** | PR #231 merged `e7c94adc...`; post-main CI #791 + Pages #1514 PASS |
| Old dedicated production create-smoke blocker | NOT A PRODUCT BLOCKER | do not hold product work for missing isolated tenant |

Do not restart broad OAuth, provider, Decimal, cash-ledger, stale-PUT, UUID, generalized idempotency, backend tombstone or distributed-ordering redesign without new concrete production evidence.

---

## 4. NOW-1B closure evidence

Backend compatibility transport:

- production Worker runtime source `a0213f05c64f8b1636711e5e3bfdea650f42f2df`;
- Production Identity Evidence #17 PASS;
- Deploy Worker #6 / run `31759350109` SUCCESS;
- stable 3-pass production contract;
- Worker 4.08 / API 2.61 / Schema 3.

Frontend durable intent:

- PR #231 final head `4de8f6f008d6f872b7ce05eed7ff29d422f995e1`;
- exact-head CI #790 / run `31764192669` SUCCESS;
- merged main `e7c94adc13903676dcf8634d3c119d28976f09b4`;
- post-main CI #791 PASS;
- production Pages #1514 PASS.

NOW-1B is closed. Phase 2 may rely on its mutation outcome truth and durable create recovery.

---

## 5. Phase 2 Automatic Recalculation — ACTIVE

PR: **#232 — `Phase 2: automatic recalculation after committed mutations`**  
Branch: `feat/phase2-automatic-recalculation`  
Risk: **R2 Significant** — browser orchestration/recovery state + transaction-to-calculation lifecycle.  
Base: `e7c94adc13903676dcf8634d3c119d28976f09b4`.

Primary KPI:

> **normal confirmed add/edit/delete transaction → manual “update portfolio” clicks = 0**

### Root cause

Backend active-job dedupe is correct, but blind re-triggering is insufficient. A transaction may commit after an already-running job has captured its input; a new trigger can deduplicate to that old job even though the old job cannot contain the new transaction.

Phase 2 solves this with an exact dirty-generation/coverage contract while reusing the existing `calculation_jobs` queue.

### Durable state

Service: `src/services/automaticRecalculationState.js`

Fixed reviewed keys:

- `automatic_recalculation_dirty.v1`
- `automatic_recalculation_clean.v1`

Dynamic owner-validated coverage prefix:

- `automatic_recalculation_coverage.v1.<jobId>`

All state is non-authoritative and contains no transaction payload.

### Generation semantics

```text
confirmed mutation M1 -> dirty token T1
new job J1 -> coverage(J1)=T1
confirmed mutation M2 while J1 runs -> dirty token T2
J1 succeeds -> clean token T1
T2 != T1 -> still dirty -> one follow-up job required
```

Rules:

- rejected/ambiguous transaction mutation never creates dirty state;
- every confirmed non-reset mutation creates a new random dirty token;
- only a **new**, non-deduplicated job may claim the generation captured immediately before its dispatch;
- deduplicated active job never claims a later dirty token;
- success cleans only exact covered token;
- failure/404 never declares dirty work clean;
- late old job cannot move clean backward over a newer covered generation;
- generation benchmark is fallback metadata only; actual current selected benchmark job may cover the dirty token.

### Debounce / active-lane behavior

- debounce: 1200 ms;
- burst committed mutations cancel/restart one timer and converge on latest token;
- automatic flush is single-flight and bounded once per token per store lifetime;
- no automatic retry loop after trigger failure; durable dirty state allows reload/new-mutation recovery.

Automatic dispatch is blocked while any existing calculation lane is active:

1. first-trade legacy `snapshotPollActive`;
2. in-flight trigger request;
3. queued/running `calculationJob`;
4. persisted pending calculation job ID.

This prevents Phase 2 from running a second calculation while the existing first-trade server `auto_update` is still propagating.

### Mutation wiring

- confirmed add / recovered add: dirty unless server already returned first-trade `auto_update`;
- confirmed update: dirty before record refresh;
- confirmed normal delete: dirty before record refresh;
- delete-all `RELOAD_UI`: clear Phase 2 state;
- record-refresh failure after commit does not erase dirtiness.

### Existing trigger lifecycle reuse

`performTriggerUpdate()` captures dirty generation immediately before the existing `/api/trigger-update` POST. A returned newly created job may receive coverage; a deduplicated job may not. Manual trigger callers remain compatible and can satisfy pending dirty work.

No Worker, D1, financial formula, market-data, auth protocol or second backend queue change is part of Phase 2.

---

## 6. Phase 2 verification chronology

- CI #792: Worker + Python PASS; frontend failed because dynamic coverage **prefix** was mistakenly inserted into the fixed-key browser-storage inventory.
- Root cause correction: fixed-key baseline now contains only dirty/clean keys; dynamic coverage remains governed by `projectStorage` prefix cleanup + executable service tests. Safety inventory was not weakened.
- Additional review refinements:
  - current benchmark job may cover a dirty token created under an older benchmark;
  - `snapshotPollActive` is treated as an active calculation lane.
- Code-bearing candidate `da07db39a64ee3f8970bbac779467b40ee4adeb2`: exact-head **CI #796 / run `31765526505` SUCCESS** across Frontend, Worker and Python.
- R2 code review on that candidate: PASS / 0 BLOCKER.

Permanent handoff/document commits after `da07db39...` advance the PR head. Therefore **do not merge based only on CI #796**; re-fetch current PR head and require a fresh exact-head full CI.

---

## 7. Phase 2 remaining gates

Execute autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #232, protected `main` and exact current head;
2. require full exact-current-head CI after handoff docs;
3. final R2 adversarial review must still confirm:
   - rejected/ambiguous transaction mutation never dirty;
   - confirmed mutation persists dirty before UI record refresh;
   - burst mutations coalesce;
   - first-trade snapshot polling blocks second calculation;
   - mutation during running job survives old-job success;
   - deduplicated job cannot claim later dirty token;
   - generation captured pre-dispatch handles mutation race;
   - current benchmark can cover old dirty token;
   - job failure/404 never clean;
   - owner isolation/logout cleanup;
   - follow-up timer vs `fetchAllFresh()` cannot double-dispatch;
   - no tight retry loop;
   - no Worker/D1/finance/market-data drift;
4. update PR #232 body with exact final head, CI and review result;
5. mark Ready and ordinary merge if all gates pass;
6. verify post-main CI;
7. verify production Pages build/deploy for merge SHA;
8. no Worker deployment expected;
9. do not create/delete a real-user transaction solely for smoke testing.

Close Phase 2 only after post-main CI + Pages are green.

---

## 8. Next product phase

After Phase 2 closure, proceed to **Phase 3 — Self-healing Snapshot Lifecycle**.

The next design should begin from user-visible failure modes and the now-automatic mutation→calculation path. Do not pre-emptively build generalized infrastructure. Expected focus:

```text
calculation/snapshot lifecycle state
-> detect stale/missing/inconsistent snapshot
-> prove whether safe self-repair exists
-> automatically repair or surface one actionable state
-> preserve financial reconciliation and fail-closed boundaries
```

---

## 9. Later roadmap

1. Phase 3 — Self-healing Snapshot Lifecycle.
2. Phase 4 — AI failure triage/recovery.
3. Phase 5 — AI Ops Autopilot.
4. Phase 6 — AI UX.

Each phase begins only after the prior user-visible flow is functionally closed.

---

## 10. Historical provenance

The handoff is intentionally converged rather than append-only. Closed Gate-E/NOW-1A/NOW-1B detail remains available in Git history, merged PRs, engineering docs, governance evidence and workflow artifacts.

This file exists to answer one operational question accurately: **what should the next AI do now without breaking the product?**
