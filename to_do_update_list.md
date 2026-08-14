# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 dirty standalone record readback recovery — permanent handoff complete → final docs-bearing CI / merge / post-main closure**

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
| Phase 5 GroupManager batch mutation lifecycle | **CLOSED** | PR #237 `98b2f2e1c765d020065a7b0493a304042455bf71`; post-main CI #832 run `31777909568` + Pages #1520 run `31777909024` SUCCESS |

Do not reopen closed phases without new material evidence.

---

## 2. ACTIVE — Phase 5 dirty standalone record readback recovery

PR: **#238 — `Phase 5: recover dirty standalone record readback`**  
Branch: `feat/phase5-dirty-readback-recovery`  
Base: verified protected main `98b2f2e1c765d020065a7b0493a304042455bf71`  
Risk: **R1–R2 boundary; treat as R2 for merge discipline**.

Permanent engineering handoff:

`docs/engineering/PHASE5_DIRTY_RECORD_READBACK_RECOVERY_2026-08-14.md`

### Root cause

The Phase 5 global read-recovery controller originally requires a full portfolio read episode to reach `portfolioReadStatus === 'error'` before it schedules one bounded `fetchAll()` recovery.

A standalone `portfolioStore.fetchRecords()` does not set that full-read status. After GroupManager batch mutation, the immediate standalone `/api/records` readback could therefore fail transiently while the page still appeared to be in a loaded read state, leaving manual refresh as the fallback.

PR #237 now guarantees that confirmed/ambiguous GroupManager mutation rows leave the same owner with a current Phase 2 dirty-generation intent. That dirty state is deterministic evidence that a failed standalone record read belongs to a pending mutation lifecycle.

### Final eligibility contract

Normal full-read behavior is unchanged.

Exact standalone `GET /api/records` receives one additional bounded recovery path only when, **at failure time**:

1. the read error is already in the safe retryable class (timeout, malformed response, network failure or HTTP 5xx);
2. a normalized signed owner and auth token exist;
3. same-owner `readAutomaticRecalculationStatus(...)` reports `dirty === true`.

No dirty mutation intent means no additional standalone recovery authority.

Mutation methods, 4xx, explicit abort, unknown non-network errors, signed-out state and explicit offline state remain fail-closed.

### Why dirty evidence is captured at failure time

A background calculation may settle and clear the dirty key while the 2-second recovery timer waits. That only proves calculation state changed; it does **not** prove the browser successfully reread records.

Therefore `dirtyRecordReadback=true` is captured when the failed read occurs. Later dirty-key settlement alone does not cancel the already-proven readback need.

### Verified full-load cancellation

R2 review found the opposite race: another lifecycle may successfully perform a complete `fetchAll()` before the old readback timer fires.

The controller therefore maintains an in-memory `verifiedLoadGeneration`:

- each observed `portfolioReadStatus === 'loaded'` increments the generation;
- each pending failure captures the generation at failure time;
- timer execution cancels when the generation changed.

This distinguishes:

```text
dirty becomes clean
!= browser readback verified

full read reaches loaded
= browser readback verified; old timer is stale
```

The recovery action remains the existing `portfolio.fetchAll()`, so it reconnects records/settings/snapshot readback, Phase 2 recalculation resume and Phase 3 snapshot integrity without creating a second loader or queue.

---

## 3. Code-bearing verification

Initial implementation CI #833 / run `31778309040`: Frontend / Worker / Python SUCCESS.

Post-#833 adversarial review found the stale-timer-after-verified-load race and added `verifiedLoadGeneration` cancellation plus a regression.

Latest code-bearing exact head before permanent docs:

`61f8906e2c8d902489cdb1fb770cc90527b3a1fb`

CI #835 / run `31778477861`: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

Targeted regressions prove:

- dirty standalone `/api/records` failure can recover while full-read status is still loaded;
- no dirty intent means no widened retry;
- later calculation settlement cannot suppress a still-needed UI reread;
- later verified full load cancels the stale timer;
- original one-attempt, owner, offline, 4xx, abort and mutation exclusions remain intact.

Independent R2 review: **PASS / 0 BLOCKER**.

Permanent docs advance the branch head, so CI #835 is **not** the final merge gate.

---

## 4. Exact remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #238 latest docs-bearing head;
2. require a fresh full CI on that exact head;
3. compare against protected `main` and require `behind_by=0`;
4. expected final scope is exactly:
   - `src/services/dataReadSelfRecovery.js`;
   - `tests/frontend_dirty_record_readback_recovery.test.mjs`;
   - `docs/engineering/PHASE5_DIRTY_RECORD_READBACK_RECOVERY_2026-08-14.md`;
   - this file;
5. final R2 review must confirm:
   - new standalone authority is exact `/api/records` + retryable GET + same-owner dirty evidence only;
   - ordinary full-read recovery remains unchanged;
   - dirty settlement alone does not cancel stale readback;
   - verified full load cancels old timer;
   - one-attempt / owner / token / offline protections remain intact;
   - no mutation retry, Worker, D1, Python, finance or validation drift;
6. update PR #238 body with final exact head / CI / scope / review;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.

---

## 5. Next-line rule after #238

Do not jump into a broad AI-agent rewrite.

After #238 closes, re-scan remaining user-facing manual actions. `GroupManager.vue` may still emit immediate copy telling the user to refresh after standalone readback failure; after this slice the underlying recovery will already be automatic. Treat any wording cleanup as presentation-only unless new functional evidence appears.

The conservative GroupManager token-expiry behavior remains acceptable: if its captured token expires mid-batch, the server rejects that row and the sequential batch stops with explicit partial truth. Do not broaden into auth redesign without production evidence.

---

## 6. Repository hygiene

`tmp-do-not-create` remains a zero-diff accidental branch with no unique commits or production effect. Remove later through a supported branch-delete path; never block product work for this cleanup.
