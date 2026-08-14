# Phase 5 — Same-page Record Create Ambiguity Reconciliation

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant** — browser orchestration now temporarily blocks a same-payload new logical create while the previous exact intent is being reconciled.

## Product objective

Close the short same-page duplicate-submit window after an outcome-ambiguous record CREATE without introducing permanent payload deduplication or changing backend idempotency semantics.

NOW-1B already guarantees that one logical create has a durable exact body + idempotency key and can be safely replayed during `fetchAll()` / reload. The remaining UX/correctness gap was that the original `addRecord()` call returns control to its caller after an ambiguous POST before that durable recovery necessarily runs.

Two production callers exposed the same generic risk:

- `TradeForm.vue` receives legacy `false`, leaves the form populated, and re-enables submit;
- `DividendManager.vue` receives a structured ambiguous outcome, removes its local confirmed state, re-enables confirm, and warns the user not to submit again.

A second user click is a new logical create and therefore receives a new idempotency key. If the first ambiguous request actually committed, the second valid new intent could create a duplicate row.

## Why payload dedupe is rejected

The project explicitly supports two intentionally identical legitimate trades. Identical payloads must be allowed to receive distinct idempotency keys when they are separate logical user intents.

Therefore this slice does **not** introduce:

- content-fingerprint dedupe;
- server uniqueness by trade fields;
- a permanent same-payload lock;
- a generalized duplicate-transaction heuristic.

The only additional restriction is a short-lived lock attached to an already-existing **ambiguous LIVE intent** while the system is actively reconciling that exact intent.

## Existing backend safety proof

The frontend continues to use only:

`POST /api/records/idempotent`

with the durable intent's exact:

- `Idempotency-Key`;
- serialized request body.

The Worker already guarantees tenant-scoped idempotent replay:

- same key + same payload -> replay existing result, no second INSERT;
- same key + changed payload -> `409 IDEMPOTENCY_CONFLICT`;
- new key -> new logical create remains allowed.

No Worker or D1 change is required.

## Durable intent extension

Implementation: `src/services/recordCreateIntent.js`.

A LIVE intent may now optionally contain:

`reconcilingUntil`

which is a finite timestamp. Default reconciliation window:

`60 seconds`.

`markRecordCreateIntentReconciling(...)`:

1. reads the exact same-owner intent;
2. requires it to still be LIVE;
3. requires the current record-mutation barrier token to still equal the intent's barrier token;
4. durably writes `reconcilingUntil = now + window`;
5. returns the updated frozen intent.

If the intent has been superseded, is terminal, malformed, or no longer owns the current barrier, no reconciliation lock is granted.

Success removes the intent through `completeRecordCreateIntent()`; explicit rejection rewrites it terminal. Both naturally remove the LIVE reconciliation condition.

## Same-payload resubmit guard

Before `beginRecordCreateIntent()` rotates the mutation barrier or generates a new key, it checks the current eligible LIVE intent.

A new create is rejected before network send only when all are true:

1. current eligible intent exists;
2. exact serialized body equals the new request body;
3. `reconcilingUntil` is finite;
4. the reconciliation window has not expired.

The error is:

`RecordCreateReconciliationInProgressError`

with `outcomeAmbiguous = false`.

This means:

- same payload during active ambiguous reconciliation -> fail before new key / barrier / POST;
- different payload -> valid new logical intent; normal barrier rotation supersedes the old intent;
- same payload after the bounded window -> valid new logical intent;
- same payload when no ambiguous reconciliation exists -> existing NOW-1B behavior is unchanged and a new key is allowed.

## Why the lock is written before caller UI regains control

Implementation: `src/services/recordCreateAmbiguityRecovery.js`.

The controller subscribes to the existing synchronous request-failure signal emitted by `fetchWithDeadline`.

For exact:

`POST /api/records/idempotent`

it applies `markRequestOutcome(..., 'POST')` and proceeds only when `outcomeAmbiguous === true`.

Before its first `await`, it:

1. reads current signed/normalized owner;
2. reads the current eligible LIVE create intent;
3. rejects a key already attempted by this controller lifetime;
4. calls `markRecordCreateIntentReconciling(...)` synchronously;
5. records the exact idempotency key as attempted.

`fetchWithDeadline` publishes the failure before rethrowing to `fetchWithAuth` / `addRecord`. Therefore the durable reconciliation lock is written before the original `addRecord()` promise can finish and before the caller can re-enable a same-payload submit action.

This closes the same-page and same-browser cross-tab rapid-resubmit window without modifying the store's one-shot mutation semantics.

## Recovery action

After a bounded 750 ms delay, the controller rechecks:

- controller not stopped;
- same normalized owner;
- auth token still present;
- same exact idempotency key remains the eligible intent.

If a different user action created a new intent or rotated the barrier, the old key is no longer eligible and reconciliation stops.

Otherwise the controller calls the existing:

`portfolio.fetchAll()`.

`performFetchAll()` already begins with:

`await recoverPendingRecordCreateIntent()`.

That existing NOW-1B recovery path replays the exact durable original key/body through `/api/records/idempotent` and handles:

- confirmed replay success -> complete/remove intent, snapshot stale, dirty recalculation if required;
- explicit server rejection -> terminal intent, no retry loop;
- repeated ambiguity -> leave LIVE durable intent for later reload/full-read recovery.

No new create key is generated by reconciliation.

## One-shot store contract remains intact

`portfolio.addRecord()` itself remains one-shot.

This slice deliberately does not add a retry loop inside `addRecord()` because the existing mutation-outcome contract and tests require the store call itself to issue one POST and retain an ambiguous durable intent for recovery.

The new same-page automation is an external controller around the existing durable recovery path, analogous to the Phase 4 trigger-ambiguity controller.

## Failure classes

Automatic same-page reconciliation is allowed only for mutation-outcome ambiguity from exact record-create transport, such as timeout/network/malformed/5xx cases where the server may have committed.

Definite 4xx / application rejections do not acquire a reconciliation lock and continue to the existing terminal behavior.

Non-record-create request failures are ignored.

## Cross-tab and cross-device boundary

`reconcilingUntil` is persisted in shared browser `localStorage`. Other tabs for the same browser/tenant attempting the exact same serialized payload during the window observe the lock and fail before creating a new key.

A different payload is allowed and supersedes the old intent through the existing shared barrier.

Cross-device coordination cannot be solved by browser-local state alone. This slice does not add a backend distributed ordering/tombstone system without production evidence requiring it.

## Scope

Production code:

- `src/services/recordCreateIntent.js`
- `src/services/recordCreateAmbiguityRecovery.js`
- `src/main.js`

Targeted regressions:

- `tests/frontend_record_create_ambiguity_recovery.test.mjs`
- `tests/frontend_record_create_ambiguity_bootstrap.test.mjs`

No Worker, D1/schema, Python engine, record payload schema, financial formula, market-data, validation/reconciliation or auth-protocol change.

## Executable regressions

New tests prove:

1. same payload is blocked only during the active reconciliation window;
2. different payload remains a valid new logical create and supersedes old recovery;
3. the lock expires and later same-payload create becomes legal again;
4. an ambiguous exact create failure synchronously locks the current LIVE intent before UI resubmit;
5. the controller performs one full recovery handoff;
6. a newer different create cancels the old scheduled reconciliation;
7. explicit 409 and non-record-create failures do not acquire reconciliation authority;
8. production bootstrap installs the controller exactly once with shared portfolio/auth/storage.

Existing NOW-1B tests remain unchanged and continue to prove:

- `addRecord()` persists intent before its one POST;
- ambiguous POST remains one-shot at store level;
- explicit 4xx becomes terminal;
- token-refresh recursion reuses exact key/body options;
- later update/delete supersede old create;
- `fetchAll()` performs pending create recovery before reading records;
- intentionally identical legitimate trades remain allowed outside an active ambiguity reconciliation lock.

## Verification

### CI #839

Run: `31779502756`  
Exact code-bearing head: `edb7c5e26122ccaa7fa6129f8d7505ea52e630ff`

Result: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

Code-bearing compare against protected main:

- `behind_by=0`;
- exactly five expected frontend/test files;
- no Worker/D1/Python/finance drift.

This proves the code-bearing candidate only. This permanent handoff and current-to-do update advance the branch head, so a fresh docs-bearing exact-head CI is mandatory before merge.

## Independent R2 review

Result: **PASS / 0 BLOCKER**.

Reviewed invariants:

- no permanent payload dedupe;
- legal identical trades remain possible outside active reconciliation;
- same-payload lock is bounded and attached only to an ambiguous LIVE intent;
- lock is durably written before caller UI regains control;
- `addRecord()` remains one-shot;
- controller filters exact `/api/records/idempotent` POST only;
- only outcome-ambiguous failures qualify;
- explicit 4xx does not reconcile;
- exact owner/key/barrier eligibility is rechecked after delay;
- different payload/new barrier cancels old recovery;
- one automatic handoff per exact key per controller lifetime;
- helper failures are contained;
- backend idempotency/accounting truth remains authoritative.

## Rollback

Frontend-only revert / previous Pages deployment.

No Worker deploy, D1 migration, backend rollback or real-user ledger smoke mutation is required.

## Merge gates

Before closure:

1. update `to_do_update_list.md`;
2. require fresh full CI on latest docs-bearing head;
3. re-compare against protected `main`, require `behind_by=0`;
4. final scope limited to the three production frontend files, two targeted tests, this handoff and current to-do;
5. update PR #239 with final exact head / CI / scope / review;
6. mark Ready;
7. ordinary merge with expected head SHA;
8. require post-main CI SUCCESS;
9. require production Pages SUCCESS;
10. no Worker deploy expected;
11. no real-user ledger mutation solely for smoke testing.

Only then mark this slice CLOSED.
