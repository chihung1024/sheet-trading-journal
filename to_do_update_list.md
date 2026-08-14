# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 same-page record-create ambiguity reconciliation — permanent handoff complete → final docs-bearing CI / merge / post-main closure**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback/recovery, independent review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.

---

## 1. Closed product automation chain

| Area | State | Closure evidence |
|---|---|---|
| Market-data malformed-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| NOW-1B-A rollback-safe record-create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live |
| NOW-1B-B durable record-create intent | CLOSED | PR #231 `e7c94adc...`; CI #791 + Pages #1514 |
| Phase 2 Automatic Recalculation | CLOSED | PR #232 `a458966...`; CI #799 + Pages #1515 |
| Phase 3 Self-healing Snapshot | CLOSED | PR #233 `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`; CI #807 + Pages #1516 |
| Phase 4 terminal calculation failure recovery | CLOSED | PR #234 `3ed4711af539b7d60657adbec177607014b7a0e4`; CI #818 + Pages #1517 |
| Phase 4 trigger outcome ambiguity replay | CLOSED | PR #235 `b8d412559ef684bfb2b9197480898f140a92bd43`; CI #823 + Pages #1518 |
| Phase 5 bounded data-read self-recovery | CLOSED | PR #236 `80abac173a5b5a5c75c5420af11d92480407180b`; CI #825 + Pages #1519 |
| Phase 5 GroupManager batch mutation lifecycle | CLOSED | PR #237 `98b2f2e1c765d020065a7b0493a304042455bf71`; CI #832 + Pages #1520 |
| Phase 5 dirty standalone record readback recovery | **CLOSED** | PR #238 `0cd9353232b26924d509fa75f5bc45ead24cb10c`; post-main CI #838 + Pages #1521 SUCCESS |

Do not reopen closed phases without new material evidence.

---

## 2. ACTIVE — Phase 5 same-page record-create ambiguity reconciliation

PR: **#239 — `Phase 5: reconcile ambiguous record create on same page`**  
Branch: `feat/phase5-record-create-reconciliation`  
Base: verified protected main `0cd9353232b26924d509fa75f5bc45ead24cb10c`  
Risk: **R2 Significant**.

Permanent engineering handoff:

`docs/engineering/PHASE5_RECORD_CREATE_AMBIGUITY_RECONCILIATION_2026-08-14.md`

### Root cause

NOW-1B already persists exact record-create body + idempotency key and can recover it safely during `fetchAll()`/reload. The remaining short window was same-page UI control after an ambiguous POST:

- `TradeForm.vue` receives legacy `false`, keeps the form and re-enables submit;
- `DividendManager.vue` receives an ambiguous outcome, removes local confirmed state, re-enables its confirm action, and warns the user not to submit again.

A second click is a new logical create and therefore gets a new key. If the first ambiguous request actually committed, that second legitimate new intent can create a duplicate row.

Permanent payload/content dedupe is rejected because intentionally identical trades must remain legal.

### Final reconciliation contract

A LIVE durable create intent may carry a bounded:

`reconcilingUntil`

Default window: **60 seconds**.

Exact POST `/api/records/idempotent` outcome ambiguity is observed through the existing request-failure signal. Before caller UI regains control, the controller synchronously marks the current same-owner/current-barrier LIVE intent as reconciling.

Before `beginRecordCreateIntent()` rotates the barrier or creates a new key:

- same exact serialized payload + active `reconcilingUntil` → fail-before-send with `RecordCreateReconciliationInProgressError`;
- different payload → valid new logical create; normal barrier rotation supersedes old recovery;
- same payload after window expiry → valid new logical create;
- same payload when no ambiguous reconciliation exists → existing NOW-1B behavior unchanged, distinct new key allowed.

After 750 ms the controller rechecks owner + exact eligible key. If still current, it calls existing `portfolio.fetchAll()`; `performFetchAll()` begins with `recoverPendingRecordCreateIntent()`, which replays the exact original key/body.

`addRecord()` itself remains one-shot. The controller is external and permits only one same-page recovery handoff per exact key per installed-controller lifetime.

Explicit 4xx does not acquire reconciliation authority. Success removes the intent; explicit rejection makes it terminal; repeated ambiguity leaves the durable intent for later reload/full-read recovery.

---

## 3. Code-bearing verification

Code-bearing exact head before permanent docs:

`edb7c5e26122ccaa7fa6129f8d7505ea52e630ff`

CI #839 / run `31779502756`: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

Code-bearing compare:

- `behind_by=0`;
- exactly five expected frontend/test files;
- no Worker/D1/Python/finance drift.

New regressions prove:

- same payload blocked only during active reconciliation window;
- different payload remains legal and supersedes old recovery;
- same payload becomes legal again after expiry;
- exact ambiguous record-create failure synchronously locks the LIVE intent before UI resubmit;
- one full recovery handoff is performed;
- a newer different create cancels the old timer;
- explicit 409 and non-record-create failures do not lock/recover;
- production controller installed exactly once.

Existing NOW-1B regression suite remains unchanged and passes, including the requirement that intentionally identical trades remain legal outside active reconciliation.

Independent R2 review: **PASS / 0 BLOCKER**.

Permanent docs advance the branch head, so CI #839 is **not** the final merge gate.

---

## 4. Exact remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #239 latest docs-bearing head;
2. require fresh full CI on that exact head;
3. compare against protected `main` and require `behind_by=0`;
4. expected final scope is exactly:
   - `src/main.js`;
   - `src/services/recordCreateAmbiguityRecovery.js`;
   - `src/services/recordCreateIntent.js`;
   - `tests/frontend_record_create_ambiguity_bootstrap.test.mjs`;
   - `tests/frontend_record_create_ambiguity_recovery.test.mjs`;
   - `docs/engineering/PHASE5_RECORD_CREATE_AMBIGUITY_RECONCILIATION_2026-08-14.md`;
   - this file;
5. final R2 review must confirm:
   - no permanent payload dedupe;
   - legal identical trades still allowed outside active reconciliation;
   - sync same-payload lock before caller regains UI;
   - `addRecord()` itself remains one-shot;
   - exact POST `/api/records/idempotent` + outcome ambiguity only;
   - explicit 4xx ignored by controller;
   - exact owner/key/barrier rechecked after delay;
   - different payload/new barrier cancels old recovery;
   - one attempt per key/controller lifetime;
   - helper failures contained;
   - no Worker/D1/Python/finance/validation drift;
6. update PR #239 body with final exact head / CI / scope / review;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.

---

## 5. Next-line rule after #239

Do not jump into broad AI-agent work.

After #239 closes, re-scan remaining functional bypasses and unnecessary manual operations. `DividendManager.vue` still performs an immediate `triggerUpdate()` after a committed `addRecord()`, but this is not currently a duplicate dispatch: it claims the existing Phase 2 dirty generation before the debounce fires. Its warning copy about manually clicking update may be stale if the trigger call fails, because the dirty generation remains recoverable. Treat this as presentation/efficiency work unless new evidence shows a correctness defect.

TradeForm and DividendManager may also retain their current form/button state after the original ambiguous call even when the external controller later recovers it; #239 prevents duplicate same-payload network create during the bounded reconciliation window. Auto-resetting UI after external recovery is presentation-only unless evidence shows material user confusion.

---

## 6. Repository hygiene

`tmp-do-not-create` and any zero-diff exploratory branch are nonfunctional hygiene only. Remove later through a supported branch-delete path; never block product work for them.
