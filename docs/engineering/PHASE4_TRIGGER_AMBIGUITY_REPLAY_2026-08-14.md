# Phase 4 — Trigger Outcome Ambiguity Replay

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant** — one automatic same-intent replay may occur after an outcome-ambiguous calculation trigger.

## Product objective

A user should not need to reload or manually press update when `/api/trigger-update` may have succeeded but its response was lost, timed out, or could not be parsed.

The recovery action is **not a new calculation intent**. It reuses the exact existing durable idempotency key and benchmark to ask the backend what happened to the original intent.

## Prerequisite closure

The first Phase 4 terminal-failure slice is closed on protected `main`:

- PR #234 merged as `3ed4711af539b7d60657adbec177607014b7a0e4`;
- post-main CI #818 SUCCESS;
- production Pages #1517 SUCCESS.

This follow-up is PR #235 on branch `feat/phase4-trigger-ambiguity-replay`.

## Backend safety proof already present

`handleGitHubTrigger()` already persists an owner-scoped idempotency key before GitHub dispatch through `calculationJobsRepository.createOrGet(...)`.

For an existing key the Worker returns the existing calculation job with `deduplicated: true` and does **not** dispatch GitHub Actions again.

Therefore an exact-key replay has these semantics:

1. original request never reached Worker → replay creates the single intended job;
2. original request created a queued/running job but response was lost → replay returns that existing job and reconnects polling;
3. original request created a job and dispatch then failed → replay returns the same failed job; existing Phase 4 terminal-failure recovery may subsequently decide whether one new-key dispatch retry is allowed;
4. original job already succeeded → replay returns the succeeded job and normal readback completes.

The ambiguity replay itself cannot create a second dispatch for an already-recorded idempotency key.

## Why record-create behavior is unchanged

This implementation deliberately does not add generic automatic retry to POST requests.

`fetchWithDeadline` only publishes generic failure evidence. `calculationTriggerAmbiguityRecovery.js` filters **exact POST `/api/trigger-update`**.

`/api/records/idempotent` remains governed by NOW-1B durable create-intent recovery and never enters this immediate replay controller.

## Generic failure evidence

Implementation: `src/services/requestFailureSignal.js` plus a narrow hook in `src/services/fetchDeadline.js`.

The deadline layer publishes only:

```text
pathname
HTTP method
original normalized error object
```

It does not publish tokens, Idempotency-Key, request body, owner identity or transaction data.

Listener failures are isolated and cannot alter request semantics.

Externally aborted requests do not publish recovery evidence. Internal deadline timeouts, network failures and response-handler failures may publish evidence for a route-specific subscriber to classify.

## Trigger-specific controller

Implementation: `src/services/calculationTriggerAmbiguityRecovery.js`.

Installed once from `src/main.js` on the same Pinia auth/portfolio stores.

Sequence:

1. receive generic request-failure evidence;
2. ignore every route except exact POST `/api/trigger-update`;
3. classify the error with existing Phase 4 typed failure policy;
4. read signed/normalized owner and owner-bound pending calculation request;
5. capture exact pending key + benchmark;
6. allow at most one ambiguity replay per key per installed controller lifetime;
7. wait 1.5 seconds so the original store promise and any other tab can settle;
8. re-check owner, selected benchmark and shared pending generation;
9. if key/benchmark/owner changed or pending disappeared, stop;
10. otherwise call existing `portfolio.triggerUpdate(benchmark, { automatic: true, ambiguityReplay: true })`;
11. the existing store reuses the pending key through `getOrCreateIdempotencyKey()`;
12. if this confirmation is also ambiguous, the same key is already marked attempted and no replay loop is created.

If another tab has already attached a `jobId` to the same pending generation, the replay still uses the same key and therefore safely receives the existing backend job; it does not dispatch another calculation.

## Error classification refinement

Before wiring trigger ambiguity recovery, the Phase 4 triage policy was tightened.

### Same-intent reconciliation is allowed for

- outcome-ambiguous trigger failure with **no explicit API error code** (for example timeout/network/malformed-success evidence);
- explicit `GITHUB_DISPATCH_TIMEOUT`;
- explicit `GITHUB_DISPATCH_FAILED`.

### Explicit operational failures stop

- `GITHUB_DISPATCH_NOT_CONFIGURED`;
- `GITHUB_DISPATCH_INVALID_RESPONSE`;
- `GITHUB_AUTH_FAILED`;
- `GITHUB_PERMISSION_DENIED`;
- `GITHUB_WORKFLOW_NOT_FOUND`;
- `GITHUB_DISPATCH_REJECTED`.

Explicit unknown API codes also stop. HTTP 5xx by itself no longer promotes an explicit unknown/configuration error into automatic trigger replay.

## Conservative coverage behavior

When the original request created a job but the response was lost, the replay returns `deduplicated: true`.

Phase 2 intentionally does not let a deduplicated job claim a dirty generation it did not explicitly prove it covers. Therefore an ambiguity-recovered calculation can conservatively leave the dirty generation pending and cause one later follow-up calculation.

This is acceptable: **redundant calculation is safer than falsely declaring a newer transaction generation clean.**

## Verification

### CI #819

Initial code-bearing head `21ab3b9bb8295d49fdec00551255b0f1fb5f7d5a`: full Frontend / Worker / Python SUCCESS.

Executable regressions cover:

- transport failure evidence publication;
- malformed response evidence;
- external-abort suppression;
- timeout same-intent replay;
- malformed-success same-intent replay;
- allowlisted dispatch failure;
- explicit configuration/auth/workflow/unknown API fail-closed behavior;
- owner/benchmark/pending generation drift cancellation;
- no pending intent → no new key/intent;
- record-create/non-trigger POST isolation;
- production bootstrap uniqueness.

### Post-#819 adversarial review

The controller was hardened so classification/timer/listener failures cannot leak an unhandled promise rejection or alter original request semantics.

### CI #820

Code-bearing exact head `5527a60727413f40297bfa1a6c6f2a23378173f5`: **SUCCESS** across Frontend, Worker and Python.

This proves the code-bearing candidate only. This document and `to_do_update_list.md` advance the branch head, so a fresh docs-bearing exact-head CI is mandatory before merge.

## Safety invariants

Before merge preserve all of these:

1. no Worker/D1/schema/Python-engine changes;
2. no financial formula, market-data, validation or reconciliation changes;
3. no new idempotency key generated by ambiguity recovery;
4. exact owner-bound pending key and benchmark required both before and after backoff;
5. selected benchmark change cancels old replay;
6. one ambiguity replay per key per controller lifetime;
7. explicit non-allowlisted API error code fails closed;
8. externally aborted request never triggers recovery;
9. non-trigger routes including record create never enter this controller;
10. same-key backend replay does not duplicate GitHub dispatch;
11. deduplicated replay does not falsely claim Phase 2 coverage;
12. controller/listener failures cannot change original request failure semantics;
13. no token, request body, Idempotency-Key or transaction payload is published through the failure signal.

## Rollback

Frontend-only rollback: revert PR #235 / redeploy prior Pages source.

No Worker deployment, D1 rollback or financial data mutation is required.

## Merge / closure gate

After permanent handoff changes:

1. re-fetch protected `main` and PR exact head;
2. require fresh full CI on exact docs-bearing head;
3. compare final diff and confirm no backend/finance drift;
4. final R2 adversarial review;
5. update PR body with final SHA/CI/scope;
6. mark Ready;
7. ordinary merge with expected head SHA;
8. require post-main CI SUCCESS;
9. require production Pages SUCCESS;
10. no real-user ledger mutation solely for smoke testing.

Only then mark trigger ambiguity recovery CLOSED.
