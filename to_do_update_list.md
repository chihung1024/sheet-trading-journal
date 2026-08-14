# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state overrides prose. Closed work is provenance, not an instruction to restart it.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 4 trigger outcome ambiguity replay — final docs-bearing CI → merge → post-main CI/Pages**

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback, independent review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.

## 1. Authority map

Read in order:

1. `AI_PROJECT_PLAYBOOK.md`.
2. `README.md`.
3. this file.
4. protected `main`, open PRs, exact-head CI, Pages/deployment state.
5. `docs/engineering/PHASE4_TRIGGER_AMBIGUITY_REPLAY_2026-08-14.md` — active slice.
6. `docs/engineering/PHASE4_FAILURE_TRIAGE_RECOVERY_2026-08-14.md` — closed terminal-failure recovery.
7. Phase 3/Phase 2/NOW-1B engineering docs for inherited contracts.

Do not collapse main SHA, Pages source, Worker runtime and deployment authority into one “current SHA”.

## 2. Closed product work

| Area | State | Closure evidence |
|---|---|---|
| Market-data malformed-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| NOW-1B-A rollback-safe record-create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live |
| NOW-1B-B durable record-create intent | CLOSED | PR #231 `e7c94adc...`; CI #791 + Pages #1514 |
| Phase 2 Automatic Recalculation | CLOSED | PR #232 `a458966...`; CI #799 + Pages #1515 |
| Phase 3 Self-healing Snapshot | CLOSED | PR #233 `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`; CI #807 + Pages #1516 |
| Phase 4 terminal calculation failure recovery | **CLOSED** | PR #234 `3ed4711af539b7d60657adbec177607014b7a0e4`; CI #818 + Pages #1517 |

Do not reopen broad OAuth/provider/Decimal/cash-ledger/stale-PUT/UUID/generalized-idempotency/backend-tombstone/distributed-ordering work without new production evidence.

## 3. Inherited calculation lifecycle

```text
confirmed mutation
-> durable dirty generation
-> debounce/coalesce
-> /api/trigger-update with stable idempotency key
-> calculation_jobs
-> exact generation coverage
-> polling/recovery
-> deterministic snapshot
```

Phase 3 can create one bounded dirty-generation repair handoff after proving snapshot staleness.

Phase 4 terminal recovery can perform one cross-tab-exclusive new dispatch retry only for typed transient terminal job failures while the same dirty generation remains pending. Validation/reconciliation/configuration/unknown failures stop.

## 4. ACTIVE — Phase 4 trigger outcome ambiguity replay

PR: **#235 — `Phase 4: recover ambiguous calculation triggers`**  
Branch: `feat/phase4-trigger-ambiguity-replay`  
Base: verified main `3ed4711af539b7d60657adbec177607014b7a0e4`  
Risk: **R2 Significant**.

Objective:

> If `/api/trigger-update` may have succeeded but its response is ambiguous, automatically confirm the original intent once with the **same existing Idempotency-Key and benchmark** instead of requiring reload/manual retry.

### Backend safety proof

Worker `calculationJobsRepository.createOrGet(...)` is already owner/key idempotent. Existing key replay returns the existing job with `deduplicated: true` and does not dispatch GitHub Actions again.

Therefore:

- original never reached Worker → replay creates the one intended job;
- queued/running response was lost → replay returns existing job;
- dispatch failed after job creation → replay returns same failed job; closed Phase 4 terminal recovery may later decide whether one new-key retry is safe;
- already succeeded → replay returns succeeded job.

### Generic request failure evidence

`src/services/fetchDeadline.js` publishes generic failure evidence through `src/services/requestFailureSignal.js`:

- pathname;
- method;
- normalized error object.

No token, Idempotency-Key, request body, owner or transaction payload is published. Subscriber failure cannot alter request semantics. External abort does not publish recovery evidence.

### Trigger-specific recovery controller

`src/services/calculationTriggerAmbiguityRecovery.js` filters exact POST `/api/trigger-update` only.

Flow:

1. classify failure using typed Phase 4 policy;
2. require current signed owner and owner-bound pending calculation request;
3. capture exact pending key + benchmark;
4. one replay attempt per key per controller lifetime;
5. wait 1.5 seconds;
6. re-read owner, selected benchmark and shared pending generation;
7. any drift/missing state → stop;
8. otherwise call existing `portfolio.triggerUpdate(benchmark, {automatic:true, ambiguityReplay:true})`;
9. store `getOrCreateIdempotencyKey()` reuses the existing key;
10. second ambiguity cannot loop because the key is already marked attempted.

Non-trigger POSTs, including `/api/records/idempotent`, never enter this controller.

### Trigger error policy refinement

Same-intent reconciliation allowed:

- outcome ambiguous with no explicit API code (timeout/network/malformed response evidence);
- explicit `GITHUB_DISPATCH_TIMEOUT`;
- explicit `GITHUB_DISPATCH_FAILED`.

Explicit operations stop:

- `GITHUB_DISPATCH_NOT_CONFIGURED`;
- `GITHUB_DISPATCH_INVALID_RESPONSE`;
- `GITHUB_AUTH_FAILED`;
- `GITHUB_PERMISSION_DENIED`;
- `GITHUB_WORKFLOW_NOT_FOUND`;
- `GITHUB_DISPATCH_REJECTED`.

Explicit unknown API codes fail closed. HTTP 5xx alone cannot promote them into replayable status.

### Conservative coverage rule

A same-key replay that returns `deduplicated: true` does not claim Phase 2 dirty-generation coverage. A later redundant follow-up calculation is acceptable; falsely declaring a newer transaction generation clean is not.

## 5. Verification chronology

### CI #819 / run `31774399891`

Initial code-bearing head `21ab3b9bb8295d49fdec00551255b0f1fb5f7d5a`: Frontend / Worker / Python SUCCESS.

Tests cover transport/malformed-response evidence, external-abort suppression, same-key timeout replay, explicit allowlisted dispatch failure, explicit config/auth/workflow/unknown fail-closed behavior, owner/benchmark/pending drift, no-pending/no-new-key behavior, record-create isolation and bootstrap uniqueness.

### Post-#819 adversarial refinement

Controller classification/timer/subscriber failures were contained so no recovery helper can leak an unhandled promise rejection or change original request semantics.

### CI #820 / run `31774482169`

Code-bearing exact head `5527a60727413f40297bfa1a6c6f2a23378173f5`: **SUCCESS** across Frontend, Worker and Python.

CI #820 proves code only. Permanent docs advance the branch, so a fresh docs-bearing exact-head CI is mandatory.

## 6. Exact remaining gates

Do autonomously unless GitHub/platform genuinely requires owner action:

1. re-fetch PR #235 exact docs-bearing head;
2. require fresh full CI on that exact head — do not merge using #820;
3. compare against protected main; expected scope is trigger ambiguity services, narrow `fetchDeadline`/triage/bootstrap changes, tests, handoff docs and this file only;
4. final R2 review must confirm:
   - no Worker/D1/Python/finance drift;
   - no new idempotency key generated by ambiguity recovery;
   - exact owner/key/benchmark intent required before and after backoff;
   - selected benchmark/pending generation drift cancels;
   - one replay per key per controller lifetime;
   - explicit non-allowlisted API codes fail closed;
   - external abort is ignored;
   - record-create/non-trigger routes are isolated;
   - backend same-key replay cannot duplicate dispatch;
   - deduplicated replay cannot falsely claim Phase 2 coverage;
   - listener/controller failure cannot alter original request semantics;
5. update PR #235 body with final head/CI/review;
6. mark Ready;
7. ordinary merge with expected head SHA;
8. require post-main CI SUCCESS;
9. require production Pages SUCCESS;
10. no Worker deploy expected;
11. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.

## 7. Next-line rule

After #235 closure, independently reassess remaining user friction before starting Phase 5. Do not create a broad AI-agent layer by default. Any future AI/Ops automation may triage and orchestrate deterministic evidence, but must not infer or rewrite accounting truth.

## 8. Repository hygiene

`tmp-do-not-create` is a zero-diff accidental branch with no unique commits or production effect. The current connector has no branch-delete action. Remove it later through GitHub UI when convenient; never block product work for this cleanup.
