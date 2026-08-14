# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 GroupManager batch mutation lifecycle — permanent handoff complete → final docs-bearing CI / merge / post-main closure**

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
| Phase 5 bounded data-read self-recovery | **CLOSED** | PR #236 `80abac173a5b5a5c75c5420af11d92480407180b`; post-main CI #825 + Pages #1519 SUCCESS |

Do not reopen these phases without new material evidence.

---

## 2. ACTIVE — Phase 5 GroupManager batch mutation lifecycle

PR: **#237 — `Phase 5: converge group batch mutation lifecycle`**  
Branch: `feat/phase5-group-batch-lifecycle`  
Base: verified protected main `80abac173a5b5a5c75c5420af11d92480407180b`  
Risk: **R2 Significant**.

Permanent engineering handoff:

`docs/engineering/PHASE5_GROUP_BATCH_MUTATION_LIFECYCLE_2026-08-14.md`

### Root cause

`GroupManager.vue` is the only production record-update path outside `portfolioStore` that directly performs sequential `PUT /api/records` through `groupRecordMutation.js`.

The previous path correctly stopped on partial/ambiguous failure, but it did not establish:

- NOW-1B record-create supersede barrier;
- Phase 2 durable dirty-generation intent.

Calling `portfolioStore.updateRecord()` N times was rejected because it would cause N full record readbacks/toasts.

### Final lifecycle contract

Before the first browser batch PUT:

1. derive owner from the server-issued JWT email claim;
2. inspect same-owner eligible pending record-create intents;
3. if any exist, rotate the existing record mutation barrier;
4. barrier/owner failure stops before any PUT.

For **every verified committed row**:

```text
PUT confirmed
-> verified succeeded count +1
-> rotate Phase 2 dirty generation
-> continue sequentially
```

Every row must rotate the generation because a calculation can start mid-batch. A later row must leave a newer token that an older job cannot falsely settle clean.

For an **outcome-ambiguous row**:

```text
ambiguous PUT
-> rotate dirty generation because row may have committed
-> STOP
-> do not send remaining rows
```

If a verified row commits but the dirty generation cannot be written:

- count the row as committed;
- raise `RECOVERY_STATE_FAILED`;
- stop immediately;
- mutate no later rows without durable recovery state.

GroupManager's existing final `portfolioStore.triggerUpdate()` can then read the latest dirty generation and use the normal Phase 2 job-coverage lifecycle. Deduplicated/mid-batch older jobs cannot claim a newer token.

---

## 3. Code-bearing verification

Latest code-bearing exact head before permanent docs:

`e70e0263bd10f03f7742b564640620ed4ad508c1`

CI #829 / run `31777582194`: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

Code-bearing compare against protected main:

- `behind_by=0`
- exactly 3 files:
  - `src/services/groupRecordMutation.js`
  - `tests/frontend_group_batch_lifecycle.test.mjs`
  - `tests/frontend_group_batch_generation_race.test.mjs`

R2 review: **PASS / 0 BLOCKER**.

Important RCA captured by tests:

- a LIVE create intent is actually superseded, not merely expired by TTL;
- invalid owner/token context fails before PUT;
- dirty-state failure after a committed row stops later writes;
- each committed row creates a distinct dirty token;
- ambiguous row rotates again and stops the batch.

Permanent docs advance the branch head, so CI #829 is **not** the final merge gate.

---

## 4. Exact remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #237 latest docs-bearing head;
2. require fresh full CI on that exact head;
3. compare against protected `main` and require `behind_by=0`;
4. expected final scope is only:
   - `src/services/groupRecordMutation.js`;
   - two targeted frontend regression files;
   - `docs/engineering/PHASE5_GROUP_BATCH_MUTATION_LIFECYCLE_2026-08-14.md`;
   - this file;
5. final R2 review must confirm:
   - signed-owner context before mutation;
   - pending create supersede before first PUT;
   - sequential stop-on-first-failure behavior preserved;
   - every verified row rotates dirty generation;
   - ambiguous row rotates dirty generation;
   - recovery-state persistence failure stops future writes;
   - old/deduplicated jobs cannot falsely clean newer rows;
   - no Worker/D1/Python/finance/validation drift;
6. update PR #237 body with final exact head/CI/scope/review;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.

---

## 5. Residual bounded UX gap after #237

Do not expand #237 for this unless correctness evidence changes.

`GroupManager.vue` still uses standalone `portfolioStore.fetchRecords()` for its immediate post-batch readback. A failure of that narrow read can still ask the user to refresh the page, because the Phase 5 global read self-recovery controller only activates for a full portfolio read episode with `portfolioReadStatus === 'error'`.

After #237 closes, reassess whether this is the next highest-value UX slice. A possible solution is to converge GroupManager readback onto a full lifecycle that can reuse the existing read self-recovery and automatic recalculation, but do not redesign auth/backend or create another queue merely to remove warning copy.

A second conservative limitation: GroupManager captures its auth token at batch start. If that token expires mid-batch, the server rejects the row and the batch stops with partial truth. Safe behavior is already preserved; do not broaden into auth redesign without production evidence.

---

## 6. Repository hygiene

`tmp-do-not-create` is a zero-diff accidental branch with no unique commits or production effect. Remove later when a supported branch-delete path is available; never block product work for it.
