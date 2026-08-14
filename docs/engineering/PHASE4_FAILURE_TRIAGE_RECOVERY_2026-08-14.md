# Phase 4 — Bounded Calculation Failure Triage & Recovery

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant** — browser orchestration may automatically re-trigger an already-proven calculation intent.

## Product objective

When a background calculation fails for a known transient reason, the user should not need to diagnose and manually press update again. Automatic recovery is allowed only when deterministic evidence proves that the same Phase 2 dirty generation still needs calculation.

The system must never use AI inference to reinterpret accounting truth or bypass validation/reconciliation gates.

## Prerequisite closure

Phase 3 is closed on protected `main`:

- PR #233 ordinary merged as `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`;
- post-main CI #807 / run `31772614571` SUCCESS;
- production Pages #1516 / run `31772613629` SUCCESS.

Phase 4 first slice is PR #234 on `feat/phase4-failure-triage-recovery`.

## Existing typed failure evidence

The current Worker / calculation workflow already emits typed failure codes. Phase 4 consumes those codes instead of guessing from free-form messages.

### Retryable policy allowlist

- `GITHUB_DISPATCH_TIMEOUT`
- `GITHUB_DISPATCH_FAILED`
- `RECORDS_API_FAILED`
- `SETTINGS_API_FAILED`
- `MARKET_DATA_FAILED`
- `SNAPSHOT_UPLOAD_FAILED`

### Fail-closed classes

- `RECORD_VALIDATION_FAILED` → user action required;
- `RECONCILIATION_FAILED` → financial/data-integrity stop;
- `SNAPSHOT_VALIDATION_FAILED` → financial/data-integrity stop;
- `CONFIGURATION_FAILED` → operations/configuration stop;
- `CALCULATION_FAILED`, `MULTIPLE_USER_FAILURES`, `UNKNOWN_CALCULATION_FAILED`, unrecognized codes → unknown stop, no automatic retry.

Unknown codes are never promoted into the retry allowlist automatically.

## Current wired scope

The first Phase 4 slice wires **terminal failed calculation jobs observed by the frontend calculation-job lifecycle**.

The pure triage policy understands an ambiguous idempotent trigger outcome and `GITHUB_DISPATCH_*` codes, but the trigger request failure path is **not wired into automatic recovery in this slice**.

Worker dispatch failure currently marks the D1 calculation job failed and returns an API error to the trigger request. The frontend controller described below watches terminal `portfolio.calculationJob`; therefore do not claim complete trigger-dispatch recovery until a later separately reviewed slice explicitly connects that path.

## Durable one-attempt state

Implementation: `src/services/calculationFailureRecovery.js`.

Fixed reviewed key:

`calculation_failure_recovery.v1`

State contains only:

```text
version
normalized owner
dirty generation token
opaque claimId
attempts = 1
typed error code
claimedAt
```

It contains no transaction payload and is not accounting authority.

The key is included in `clearSensitiveProjectStorage()` and the reviewed browser persistence inventory.

## Cross-tab exclusive retry claim

A synchronous localStorage read→write is not sufficient because two tabs can both read “no attempt yet” before either sees the other write.

`claimAutomaticFailureRetry()` therefore uses the repository's existing contention pattern:

1. read current confirmed state;
2. reject an already-confirmed attempt for the same dirty generation;
3. create a secure opaque `claimId`;
4. write one contender record;
5. wait a short settle window (75 ms);
6. read back shared storage;
7. return `true` only if the exact claimId/generation/error/timestamp still owns the record.

Two simultaneous tabs can both contend, but exactly one can confirm ownership and continue into retry backoff.

The executable test deliberately makes both contenders' first reads return empty, then proves only one read-back winner.

## Recovery controller

Implementation: `src/services/calculationFailureRecoveryController.js`.

Installed once from `src/main.js` on the same Pinia `auth` and `portfolio` stores used by the application.

The controller watches terminal failed jobs and applies this sequence:

1. dedupe repeated observation of the same `job id + status + error code`;
2. classify typed error;
3. read signed/normalized owner and Phase 2 automatic-recalculation state;
4. non-retryable failure → notify and stop;
5. no dirty generation → never invent a calculation intent; notify and stop;
6. obtain the cross-tab-exclusive one-attempt claim;
7. wait 5 seconds;
8. before retry, cancel if any of these changed:
   - controller stopped;
   - signed owner changed;
   - dirty generation cleaned or token changed;
   - shared durable pending calculation request exists (another tab/lifecycle already took over);
   - local calculation job is queued/running;
9. otherwise call the existing `portfolio.triggerUpdate(..., { automatic: true })`;
10. any retry failure is terminal for this automatic attempt; no retry loop.

The retry reuses Phase 2's existing idempotency, `calculation_jobs`, coverage, polling and settlement lifecycle. Phase 4 creates no second backend queue.

## Conservative claim consumption

Once a tab has won the one-attempt claim, the attempt is not refunded if the 5-second backoff is later cancelled because a newer generation, owner change or another tab takes over.

This is intentional. It may reduce automation in a rare race, but it prevents a cancelled/abandoned contender from reopening the same generation to multiple automatic actions.

## User-visible behavior

For a retryable terminal failure with a valid dirty generation, the user receives an actionable warning that one safe retry will occur.

For validation/integrity/configuration/unknown failures, the user is told automatic retry stopped.

For a retryable failure without pending dirty intent, the UI explicitly says there is no automatic recalculation state and no retry will be attempted; it never misleadingly says “will retry”.

The existing generic terminal-job toast remains in the portfolio store, so this first slice may show that generic failure plus the Phase 4 actionable recovery/status toast. Avoid broad store refactoring merely to deduplicate toast copy unless UX evidence shows this is materially disruptive.

## Browser persistence governance

`docs/governance/browser-storage-baseline.json` now explicitly reviews `calculation_failure_recovery.v1` as:

- classification: tenant-operation-recovery-state;
- authoritative: false;
- risk IDs: `RISK-020`, `RISK-038`;
- one-attempt-per-dirty-generation retention;
- owners: failure-recovery service + project-storage cleanup.

CI #808 correctly blocked the first version because this key had not yet been added to the inventory. The scanner was not weakened.

## Verification chronology

### CI #808 / run `31773099401`

- Worker: PASS;
- failure-recovery policy/controller/bootstrap behavior tests passed;
- Frontend: 269/270 tests passed;
- only failure: reviewed browser persistence inventory did not yet list `calculation_failure_recovery.v1`.

Correction: add the key to the existing baseline; do not relax the scanner.

### CI #809 / run `31773169153`

Exact head `70cb34d258f986de81cf81f4c07188b6e23a8ebe`: SUCCESS across Frontend, Worker and Python.

### Adversarial review after #809

Two cross-tab correctness issues were found before merge:

1. synchronous retry claim allowed two tabs to believe they each owned the single automatic attempt;
2. a stale failed tab could retry even after another tab had already written a shared durable pending calculation job.

Corrections:

- contender `claimId` + 75 ms settle/read-back exclusive winner;
- 5-second backoff now also reads `readPendingCalculationRequest(storage, owner)` and yields if shared durable intent exists.

### CI #815 / run `31773455151`

Code-bearing exact head `2f21b25205253030f1044e8a117d26ef633652b6`: **SUCCESS** across Frontend, Worker and Python.

This proves the code-bearing candidate only. Permanent handoff documentation advances the branch afterward, so a fresh docs-bearing exact-head CI is mandatory before merge.

## Safety invariants

Before merge, preserve all of these:

1. no Worker/D1/schema/Python-engine changes;
2. no financial formula, ledger, market-data algorithm, validation or reconciliation relaxation;
3. automatic retry requires both retryable typed failure and a current Phase 2 dirty generation;
4. unknown/new failure codes fail closed;
5. validation/reconciliation/snapshot-validation/configuration failures never auto retry;
6. one confirmed automatic retry claim per dirty generation across reload and tabs;
7. storage/random/claim confirmation failure grants no retry authority;
8. owner change, newer/clean generation, local active job, or shared durable pending calculation cancels backoff retry;
9. retry uses existing `portfolio.triggerUpdate(..., {automatic:true})` only;
10. no second queue, retry loop or transaction payload persistence;
11. logout clears recovery state;
12. production bootstrap installs exactly one failure-recovery controller;
13. trigger-request failure recovery remains explicitly out of wired scope.

## Rollback

This slice is frontend-only. Rollback is ordinary revert of PR #234 / redeploy prior Pages source.

No Worker deployment, D1 rollback or financial data mutation is required.

## Merge / closure gate

After this document and `to_do_update_list.md` update:

1. re-fetch protected `main` and exact PR head;
2. require fresh full CI on the exact docs-bearing head;
3. compare final diff against main;
4. final R2 adversarial review;
5. update PR body with exact head/CI/scope;
6. mark Ready;
7. ordinary merge with expected head SHA;
8. require post-main CI SUCCESS;
9. require production Pages SUCCESS;
10. no real-user ledger mutation solely for smoke testing.

Only then may this Phase 4 first slice be marked CLOSED and the next Phase 4/Phase 5 automation slice begin.
