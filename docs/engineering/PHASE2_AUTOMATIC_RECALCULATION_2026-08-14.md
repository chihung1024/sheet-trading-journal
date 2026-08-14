# Phase 2 Automatic Recalculation

Date: 2026-08-14 Asia/Taipei  
Risk: R2 — browser recovery/orchestration state plus transaction-to-calculation lifecycle behavior.

## Product objective

A normal confirmed add/edit/delete transaction should require **zero manual “update portfolio” clicks**.

```text
confirmed transaction mutation
-> snapshot stale
-> durable dirty generation
-> debounce/coalesce
-> existing /api/trigger-update
-> existing calculation_jobs lifecycle
-> exact generation coverage
-> durable job polling/recovery
-> fresh snapshot readback
-> UI refresh
```

Phase 2 does **not** create another backend queue and does not move financial truth into browser state. D1 remains authoritative for transactions; `calculation_jobs` remains the durable compute lifecycle; the Python financial engine and all validation/reconciliation gates remain unchanged.

## Prerequisite closure

NOW-1B closed before this phase began:

- rollback-safe record-create transport is production verified at Worker runtime `a0213f05c64f8b1636711e5e3bfdea650f42f2df`;
- durable record-create intent PR #231 merged as `e7c94adc13903676dcf8634d3c119d28976f09b4`;
- post-main CI #791 and Pages #1514 passed.

Phase 2 is PR #232, branch `feat/phase2-automatic-recalculation`.

## Root cause addressed

The backend intentionally deduplicates active calculation requests for the same tenant and benchmark. A blind “trigger update after every mutation” is therefore insufficient: if transaction B commits after an existing job A has already read its input, a re-trigger may deduplicate to A even though A cannot contain B.

The frontend therefore needs a small, durable proof of **which mutation generation a newly created calculation job is allowed to cover**.

## Durable generation model

Implementation owner: `src/services/automaticRecalculationState.js`.

### Dirty generation

Fixed key: `automatic_recalculation_dirty.v1`

```text
version
owner
opaque random token
createdAt
benchmark fallback metadata
```

Every confirmed non-reset transaction mutation creates a new token. The fixed key intentionally represents only the latest committed browser-observed generation.

### Clean generation

Fixed key: `automatic_recalculation_clean.v1`

A successful job may advance clean only to the exact dirty token that it previously covered. Token equality, not timestamp guessing, determines whether the current state is clean.

### Per-job coverage

Dynamic prefix: `automatic_recalculation_coverage.v1.<jobId>`

Coverage is recorded only when:

1. a dirty generation was captured immediately before trigger dispatch;
2. the server returned a valid job;
3. the returned job is newly created, not `deduplicated: true`.

A deduplicated active job is never allowed to claim a later dirty generation.

The coverage record is owner-bound and stores the exact dirty token plus the actual job benchmark. Generation benchmark is only reload fallback metadata; a user-selected current benchmark job may validly cover a transaction dirty token created while another benchmark was selected.

## Why late job completion cannot hide a newer mutation

Example:

```text
mutation M1 -> dirty token T1
new job J1 -> coverage(J1)=T1
mutation M2 while J1 runs -> dirty token T2
J1 succeeds -> clean token T1
current dirty token T2 != clean T1
=> still dirty
=> one follow-up calculation is required
```

A late older job cannot overwrite a newer clean generation because settlement also refuses to move the clean generation backward by covered-generation creation time.

## Store lifecycle

Implementation owner: `src/stores/portfolio.js`.

### Confirmed mutation only

- definite rejection: no dirty generation;
- ambiguous mutation: no dirty generation until the mutation truth is resolved by its existing recovery path;
- confirmed add/recovered add: mark dirty unless the server already returned the existing first-trade `auto_update` path;
- confirmed update: mark dirty before follow-up record refresh;
- confirmed normal delete: mark dirty before follow-up record refresh;
- delete-all `RELOAD_UI`: clear automatic-recalculation state rather than schedule a pointless calculation for an empty ledger.

A record-refresh failure after a confirmed mutation does not erase the dirty generation.

### Debounce/coalesce

Debounce window: 1200 ms.

Each new committed mutation replaces the latest dirty token, cancels/restarts the one timer, and resets the in-memory attempt bound. A burst therefore converges on the latest generation rather than dispatching one calculation per click.

### Active calculation lanes

Automatic flush does not dispatch while any of these are active:

1. first-trade legacy snapshot polling (`snapshotPollActive`);
2. an in-flight trigger request;
3. a queued/running `calculationJob`;
4. a persisted pending calculation job ID.

This is important for the existing first-record `auto_update`: a later mutation that occurs while first-trade snapshot polling is active remains dirty, then `fetchAllFresh()` after that poll safely resumes one follow-up.

### Dispatch and coverage

`performTriggerUpdate()` captures the current dirty generation immediately before the existing `/api/trigger-update` POST. After response:

- newly created job -> may record coverage for the captured token;
- deduplicated job -> never records coverage for that token;
- manual trigger remains API-compatible and can satisfy a dirty generation;
- actual current selected benchmark is respected.

### Settlement

On job terminal state:

- success + exact coverage -> advance clean to covered token;
- failure -> remove coverage but never declare clean;
- 404 -> treat coverage as unsuccessful and leave dirty recoverable;
- after successful settlement, if current dirty token still differs from clean, schedule one follow-up.

### Bounded retry

Automatic dispatch is bounded once per dirty token per store lifetime. Trigger failure does not enter a retry loop. The exact dirty state remains durable, so reload or a later committed mutation creates the next safe recovery opportunity.

This intentionally favors redundant recalculation over silently losing a required recalculation, but still prevents tight loops.

## Timer / fresh-read race proof

`completeCalculationJob()` can schedule a follow-up before `fetchAllFresh()` finishes. This does not create a double dispatch:

- if `fetchAllFresh()` finishes first, `resumeAutomaticRecalculation()` uses the same scheduler and cancels/resets the prior timer;
- if the timer fires first, the new trigger/job/pending state makes the later `resumeAutomaticRecalculation()` fail closed;
- if the follow-up finishes extremely quickly, its covered token becomes clean before the fresh-read resume check.

The result may be a small delay, but not duplicate coverage or lost dirtiness.

## Cross-tab boundary

The latest dirty generation is shared through `localStorage`. Two tabs may race to trigger, but the existing backend active-job invariant remains authoritative:

- first newly created job may claim the captured token;
- another request that resolves to the active job is deduplicated and cannot claim a later token;
- calculation poll claiming and backend idempotency continue to limit duplicated work.

No new distributed transaction protocol is introduced.

## Browser storage governance

Fixed reviewed keys:

- `automatic_recalculation_dirty.v1`
- `automatic_recalculation_clean.v1`

Dynamic coverage prefix is intentionally **not** represented as a fixed-key item in `browser-storage-baseline.json`; it is governed by `SENSITIVE_PROJECT_STORAGE_PREFIXES`, owner validation, executable service tests, and logout cleanup.

All Phase 2 state is non-authoritative and contains no transaction payload.

## Regression coverage

Executable service tests prove:

- owner-bound dirty generation;
- exact coverage/clean token;
- current benchmark job may cover an older dirty token;
- mutation during running job survives old-job success;
- deduplicated job cannot claim dirty token;
- failed job never cleans;
- later new job may cover after failure;
- owner isolation;
- explicit and logout cleanup.

Store source-contract regressions prove:

- only confirmed mutations reach dirty path;
- dirty is persisted before UI refresh;
- delete-all clears state;
- fetchAll resumes durable dirty work;
- trigger captures generation before POST;
- only non-deduplicated jobs record coverage;
- manual trigger API compatibility;
- current selected benchmark use;
- snapshot polling is an active calculation lane;
- single-flight / once-per-token / no retry loop;
- success settles before fresh read;
- residual dirty schedules follow-up;
- 404 does not pretend success;
- burst mutations restart one debounce timer.

## Verification status

The last code-bearing candidate `da07db39a64ee3f8970bbac779467b40ee4adeb2` passed exact-head CI #796 / run `31765526505`:

- Frontend contracts and build: PASS;
- Worker security and deployment tests: PASS;
- Python tests and coverage baseline: PASS.

Documentation commits after that candidate advance the PR head, so a fresh exact-head full CI is required before merge.

## R2 review result on code-bearing candidate

PASS / 0 BLOCKER.

Reviewed boundaries:

- no Worker source change;
- no D1/schema/data change;
- no financial formula or market-data change;
- no auth protocol change;
- no second backend queue;
- no calculation declared clean without exact successful coverage;
- rejected/ambiguous transaction mutation never marks dirty;
- late old job cannot clean a new token;
- deduplicated job cannot claim a later token;
- no automatic retry loop.

## Completion rule

Close Phase 2 after:

1. exact final-head CI succeeds;
2. independent R2 review remains PASS;
3. PR #232 merges to protected main;
4. post-main CI succeeds;
5. production Pages build/deploy for that merge succeeds.

No Worker deployment is expected because this phase is frontend orchestration only.

After closure, proceed to Phase 3 — Self-healing Snapshot Lifecycle, staying product-first and avoiding infrastructure expansion without user-visible evidence.
