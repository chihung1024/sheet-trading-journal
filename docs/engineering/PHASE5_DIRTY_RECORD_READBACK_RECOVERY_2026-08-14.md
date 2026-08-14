# Phase 5 — Dirty Standalone Record Readback Recovery

Date: 2026-08-14 Asia/Taipei  
Risk: **R1–R2 boundary; treated as R2 for merge discipline**.

## Product objective

A record mutation flow should not require a manual page refresh merely because its immediate standalone `GET /api/records` readback failed transiently.

The existing Phase 5 read-recovery controller originally required the full portfolio read episode to reach `portfolioReadStatus === 'error'`. A standalone `portfolioStore.fetchRecords()` does not change that status, so GroupManager post-batch readback could fall outside automatic recovery even after #237 correctly persisted a Phase 2 dirty mutation generation.

This slice extends the existing controller rather than creating a GroupManager-specific retry path.

## Prerequisite closure

PR #237 — GroupManager batch mutation lifecycle — is closed on protected `main`:

- merge `98b2f2e1c765d020065a7b0493a304042455bf71`;
- post-main CI #832 / run `31777909568`: SUCCESS;
- production Pages #1520 / run `31777909024`: SUCCESS.

The relevant invariant inherited from #237 is that every verified/ambiguous GroupManager row leaves the same owner with a current Phase 2 dirty-generation intent.

## Existing full-read behavior remains unchanged

For normal read failures, automatic recovery still requires the portfolio read episode to reach:

`portfolioReadStatus === 'error'`.

The controller still retries at most once per owner/read episode, after its bounded delay, and still fails closed for:

- mutation methods;
- HTTP 4xx;
- explicit/user abort;
- unknown non-network errors;
- signed-out state;
- explicit offline state.

No generic GET retry authority is added.

## New deterministic eligibility

Exact `GET /api/records` receives one additional recovery path only when, **at failure time**:

1. the request error is already in the existing safe retryable read class;
2. a normalized signed owner exists;
3. auth token exists;
4. same-owner `readAutomaticRecalculationStatus(...)` reports `dirty === true`.

The dirty state is deterministic evidence that this standalone records read belongs to a pending mutation/recalculation lifecycle.

No dirty generation means no new standalone recovery authority.

## Why dirty evidence is captured at failure time

The calculation lifecycle may settle and clear the dirty key during the 2-second readback delay.

That does **not** prove the browser has successfully reread the records. The current screen can still hold stale records even though background calculation is clean.

Therefore the controller captures `dirtyRecordReadback=true` at the moment the read fails. Later dirty-key settlement alone does not cancel the already-proven need to reread.

## Verified full-load cancellation

R2 review found the opposite race:

- standalone records read fails;
- dirty evidence schedules bounded `fetchAll()`;
- another lifecycle successfully performs a full read before the timer fires;
- stale timer should not perform a redundant second full read.

The controller now maintains an in-memory `verifiedLoadGeneration`.

Each observed `portfolioReadStatus === 'loaded'` increments that generation. A pending failure captures the current generation. At timer execution, a generation mismatch cancels the stale recovery attempt.

This deliberately distinguishes:

- **calculation dirty state became clean** → does not prove UI readback; recovery remains eligible;
- **a full portfolio read reached loaded** → UI readback has been verified; old timer is cancelled.

## Recovery action

The recovery action is the existing `portfolio.fetchAll()`.

This means successful recovery reconnects the browser to the complete existing lifecycle:

```text
full authoritative records/settings/snapshot read
-> pending calculation resume
-> Phase 2 dirty-generation resume
-> Phase 3 snapshot integrity reconciliation
-> current UI refresh
```

No second cache, loader, calculation queue or backend API is introduced.

## Scope

Production code:

- `src/services/dataReadSelfRecovery.js`

Targeted regression:

- `tests/frontend_dirty_record_readback_recovery.test.mjs`

No Worker, D1/schema, Python engine, accounting formula, market-data, record mutation, validation/reconciliation or auth-protocol changes.

## Executable regressions

Tests prove:

1. dirty standalone `/api/records` failure can recover while `portfolioReadStatus` is still `loaded`;
2. identical standalone failure with no dirty mutation intent does not broaden retry authority;
3. dirty evidence captured at failure time survives later calculation settlement and still repairs the stale readback;
4. a later verified full load during backoff cancels the stale timer;
5. all original Phase 5 read-recovery tests continue to enforce one attempt per episode, owner isolation, offline stop, 4xx/abort/mutation exclusion.

## Verification chronology

### CI #833

Initial implementation head `178cffe826b29491320983cabdb01cc2f2a2c706`: full Frontend / Worker / Python SUCCESS.

Post-#833 R2 review identified the stale-timer-after-verified-load race.

### CI #835

Exact code-bearing head:

`61f8906e2c8d902489cdb1fb770cc90527b3a1fb`

Run: `31778477861`

Result: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

This proves the code-bearing candidate only. Permanent documentation advances the branch head, so a fresh docs-bearing exact-head CI is mandatory before merge.

## Independent R2 review

Result: **PASS / 0 BLOCKER**.

Reviewed invariants:

- new eligibility is exact `/api/records` + retryable GET + same-owner dirty evidence only;
- no dirty state means no standalone retry;
- calculation settlement cannot incorrectly suppress required UI reread;
- verified successful full load cancels stale timer;
- owner/token/offline/one-attempt semantics remain intact;
- existing full-read error recovery remains backward-compatible;
- no mutation retry or accounting authority is introduced.

## Remaining UX copy

`GroupManager.vue` can still emit an immediate warning telling the user to refresh after its standalone readback failure. With this slice, the underlying failure now has a bounded automatic recovery attempt when the mutation dirty evidence exists.

Do not change that large component in this correctness slice solely to remove the warning. After closure, reassess the wording as a presentation-only cleanup if it remains materially confusing.

## Rollback

Frontend-only revert / previous Pages deployment.

No Worker deploy, D1 migration or real-user ledger smoke mutation is required.

## Merge gates

1. update current handoff;
2. fresh full CI on latest docs-bearing head;
3. compare with protected `main`, require `behind_by=0`;
4. final scope limited to service, targeted test, this handoff and current to-do;
5. update PR #238 final evidence;
6. Ready;
7. ordinary merge with expected head SHA;
8. post-main CI SUCCESS;
9. production Pages SUCCESS.

Only then mark this slice CLOSED.
