# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 5 bounded data read self-recovery — code complete → Draft PR / exact-head CI**

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

## 1. Current production truth

Protected main currently contains the complete closed automation chain through Phase 4:

- NOW-1B durable record-create intent — CLOSED.
- Phase 2 automatic recalculation — CLOSED.
- Phase 3 snapshot self-healing — CLOSED.
- Phase 4 bounded terminal calculation failure recovery — CLOSED.
- Phase 4 trigger outcome ambiguity replay — CLOSED.

Latest closed Phase 4 trigger ambiguity evidence:

- PR #235 ordinary merged as `b8d412559ef684bfb2b9197480898f140a92bd43`.
- post-main CI #823 SUCCESS.
- production Pages #1518 SUCCESS.
- no Worker deployment or D1 change was required.

Do not reopen these closed phases without new material evidence.

---

## 2. Active Phase 5 slice

Branch: `feat/phase5-read-self-recovery`

Permanent design:

`docs/engineering/PHASE5_BOUNDED_DATA_READ_SELF_RECOVERY_2026-08-14.md`

Product objective:

> When a safe portfolio GET read fails transiently, attempt one invisible reconnect before asking the user to press the existing reliability banner's `重新載入` button.

### Recoverable exact paths

- `GET /api/records`
- `GET /api/portfolio`
- `GET /api/user-settings`

### Retryable evidence

- timeout;
- malformed response/success evidence;
- network `TypeError` / `NetworkError`;
- explicit HTTP 5xx.

### Fail closed

- mutation methods;
- HTTP 4xx/client rejection;
- external/user abort;
- calculation-job polling routes;
- unknown non-network errors;
- signed-out state;
- explicit browser offline state.

### Bounded episode semantics

- auto recovery only runs after `portfolioReadStatus === 'error'`;
- 2-second backoff;
- same signed owner + token + online state required at retry time;
- one `portfolio.fetchAll()` automatic retry per failed episode;
- a verified later `portfolioReadStatus === 'loaded'` resets the allowance;
- failed auto retry leaves the existing DataReliabilityBanner/manual `重新載入` fallback intact;
- no automatic loop.

### Cross-owner correction found during R2 review

Initial implementation used one controller-wide episode flag. During a 2-second backoff, switching accounts could cancel the old timer but accidentally consume the new account's one-attempt allowance.

Correction:

- episode allowance is now owner-aware;
- account change resets the episode allowance and clears old pending evidence;
- old-owner timer cannot run under the new owner;
- a new-owner pending failure can schedule after the old timer releases;
- notification/timer helper failures are contained.

---

## 3. Current implementation files

Expected active diff:

- `src/services/dataReadSelfRecovery.js`
- `src/main.js`
- `tests/frontend_data_read_self_recovery.test.mjs`
- `tests/frontend_data_read_self_recovery_bootstrap.test.mjs`
- `docs/engineering/PHASE5_BOUNDED_DATA_READ_SELF_RECOVERY_2026-08-14.md`
- this file.

No Worker, D1/schema, Python-engine, finance, market-data, validation or reconciliation changes are expected.

---

## 4. Remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. create Draft PR from `feat/phase5-read-self-recovery` to `main`;
2. require exact-head full CI across Frontend, Worker and Python;
3. if CI fails, RCA the single current failure; do not weaken safety gates;
4. adversarial review must confirm:
   - GET-only exact-path scope;
   - one retry per failed episode;
   - successful load resets allowance;
   - 4xx/abort/non-read routes fail closed;
   - owner switch cannot replay old-owner work or consume new-owner quota;
   - offline state cancels retry;
   - helper/notify failures cannot leak globally;
   - no second data loader/cache/queue;
   - existing manual reload remains fallback;
5. final compare against protected `main`, `behind_by=0`;
6. update PR body with exact head/CI/review evidence;
7. mark Ready;
8. ordinary merge with expected head SHA;
9. require post-main CI SUCCESS;
10. require production Pages SUCCESS;
11. no Worker deploy expected;
12. no real-user ledger mutation for smoke testing.

Only then mark this Phase 5 slice CLOSED.

---

## 5. What not to do next

Do not convert Phase 5 into a broad AI-agent rewrite. After this read-self-recovery slice closes, independently identify the next highest-friction manual operation and automate only where deterministic evidence permits it.

Repository hygiene item `tmp-do-not-create` remains zero-diff/nonfunctional and must not block product work.
