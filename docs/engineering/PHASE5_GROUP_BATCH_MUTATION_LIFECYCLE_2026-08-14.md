# Phase 5 — Group Batch Mutation Lifecycle Convergence

Date: 2026-08-14 Asia/Taipei  
Risk: **R2 Significant** — batch record updates now participate in durable mutation/recalculation recovery state.

## Product objective

Close the only production record-update path that bypassed the shared record-mutation recovery lifecycle, without introducing a bulk backend endpoint, parallel writes, or N full record reloads.

The affected path is `GroupManager.vue` → `groupRecordMutation.js` → sequential `PUT /api/records`.

Before this slice, those PUTs preserved partial/ambiguous batch truth but did not establish the same record-create supersede barrier or Phase 2 dirty-generation contract used by normal store mutations.

## Why the batch does not simply call `portfolioStore.updateRecord()` N times

`portfolioStore.updateRecord()` is the authoritative single-record mutation path and already provides:

- record-create recovery supersede barrier;
- typed committed / rejected / ambiguous mutation truth;
- snapshot stale marking;
- Phase 2 dirty generation;
- follow-up record refresh.

Calling it for every row of a large GroupManager batch would also perform a full record refresh and user toast for every row. That would replace one lifecycle bypass with N redundant network reloads and degraded UX.

This slice therefore keeps the existing safe sequential PUT transport and attaches the missing durable orchestration invariants around it.

## Scope

Changed production code:

- `src/services/groupRecordMutation.js`

Targeted regressions:

- `tests/frontend_group_batch_lifecycle.test.mjs`
- `tests/frontend_group_batch_generation_race.test.mjs`

No Worker, D1/schema, Python engine, accounting formula, market-data, validation/reconciliation, record payload schema, or auth protocol change.

## Tenant identity

Browser lifecycle state is owner-scoped from the email claim in the server-issued JWT using the repository's existing `decodeJwtClaims()` model.

The browser does not claim to cryptographically verify the JWT signature itself; every PUT remains authenticated by the Worker. The client-side claim is used only to bind non-authoritative browser recovery state to the same tenant identity model already used by the auth/store lifecycle.

If the token cannot produce a valid owner claim, the browser batch fails before sending the first PUT.

## Record-create supersede barrier

Before the first browser batch PUT:

1. enumerate eligible same-owner durable record-create intents;
2. if any exist, rotate the existing record mutation barrier;
3. only then allow the batch transport to begin.

This preserves the NOW-1B rule that a later explicit UPDATE intent supersedes an older pending CREATE replay, so an older ambiguous create cannot later be auto-replayed after the user has explicitly changed records.

If the barrier cannot be established, the batch fails before the first PUT.

## Dirty-generation contract

A key R2 finding is that one dirty token for the whole batch is **not sufficient**.

A calculation job can begin while a long sequential batch is still running. If later rows reused the dirty token that existed before the job started, that job could incorrectly settle the token clean even though it did not include the later rows.

Therefore the final contract is:

> **Every verified committed row rotates the Phase 2 dirty generation.**

For each successful PUT:

```text
PUT confirmed
-> increment verified succeeded count
-> markAutomaticRecalculationDirty(...)
-> newest dirty token becomes authoritative browser recovery intent
-> continue to next row
```

A job that starts after row N may at most cover row N's token. Row N+1 creates a newer token, so the older job cannot settle the later mutation clean.

This deliberately favors a possible follow-up calculation over false-clean state.

## Ambiguous failed row

An outcome-ambiguous failed PUT may have committed after the last verified row.

Therefore ambiguity also rotates the dirty generation once before the batch stops:

```text
previous verified rows
-> ambiguous PUT
-> rotate dirty token because this row may have committed
-> STOP batch
-> never send later rows blindly
```

This preserves the existing GroupManager rule: do not retry/resend the remaining batch after an ambiguous mutation position.

## Recovery-state persistence failure

If a row is confirmed committed but the new dirty generation cannot be durably written:

1. the row remains counted as verified committed;
2. the batch throws `PartialRecordTagBatchError` with `RECOVERY_STATE_FAILED`;
3. the batch stops immediately;
4. no later row is mutated without durable recovery state.

This is fail-closed orchestration. It never rewrites or guesses transaction truth.

If an ambiguous PUT occurs and dirty-state persistence also fails, the batch still stops and exposes the recovery-state failure evidence; no later row is sent.

## Existing GroupManager integration

`GroupManager.vue` remains sequential and still performs its existing post-batch readback and `portfolioStore.triggerUpdate()` behavior.

The important change is that the browser batch has already created the latest Phase 2 dirty generation before `triggerUpdate()` runs. The existing trigger lifecycle can therefore record normal calculation-job coverage for that exact latest generation.

If a calculation already started mid-batch and the final trigger is deduplicated, the deduplicated job cannot falsely claim the newer token. Phase 2 leaves the newest token dirty and schedules a safe follow-up calculation.

No second calculation queue is introduced.

## Pure transport compatibility

`updateRecordTagsSequentially()` still supports pure unit/transport callers that deliberately provide no browser Storage surface.

Those callers retain the legacy result shape:

```text
{succeeded, total}
```

The durable browser lifecycle is engaged only when a Storage-compatible surface is available, as it is in production.

## Verification

### Targeted executable regressions

The new tests prove:

- a genuinely LIVE eligible create intent is superseded before batch mutation;
- tenant owner comes from the JWT claim and invalid token context fails before PUT;
- first verified commit creates durable dirty state;
- dirty-state persistence failure stops immediately after the committed row;
- ambiguous first PUT creates dirty recovery intent and stops before the next row;
- every verified row rotates to a distinct dirty token;
- an ambiguous row after a successful row rotates the token again and does not send later rows;
- legacy pure-transport batch behavior remains compatible with existing tests.

### CI #829

Run: `31777582194`  
Exact code-bearing head: `e70e0263bd10f03f7742b564640620ed4ad508c1`

Result: **SUCCESS**

- Frontend contracts/build: SUCCESS
- Worker security/deployment/local D1: SUCCESS
- Python tests/coverage: SUCCESS

This proves the code-bearing candidate only. This documentation commit and the current-handoff update advance the branch head, so a fresh docs-bearing exact-head CI is mandatory before merge.

## Independent R2 review

Result: **PASS / 0 BLOCKER**.

Reviewed invariants:

- browser tenant state is owner-bound before mutation;
- pending create recovery is superseded before first PUT;
- sequential stop-on-first-failure semantics are preserved;
- every committed row rotates dirty generation;
- ambiguous row rotates dirty generation;
- recovery-state failure cannot allow later writes;
- old/deduplicated calculation jobs cannot falsely clean later batch rows;
- pure transport callers remain backward-compatible;
- no Worker/D1/accounting/validation drift.

## Residual bounded UX gap — not part of this correctness slice

`GroupManager.vue` still uses standalone `portfolioStore.fetchRecords()` for post-batch readback. If that standalone read fails, the Phase 5 global read self-recovery controller does not currently retry it because that controller requires the full portfolio read episode to reach `portfolioReadStatus === 'error'`.

The UI can therefore still ask the user to refresh the page after this narrow readback failure.

This is a UX recovery gap, not an accounting-correctness blocker for this slice. Reassess it independently after this PR closes; do not expand this PR merely to remove warning copy.

A second conservative limitation remains: GroupManager captures the current auth token for the sequential batch and does not use the portfolio store's token-refresh recursion between rows. If the token expires mid-batch, the server rejects the row and the batch stops with partial truth. This is safe; do not broaden into auth redesign without evidence.

## Rollback

Frontend-only revert / previous Pages deployment.

No Worker deploy, D1 migration, financial rollback, or production ledger mutation is required.

## Merge gates

Before closure:

1. update permanent current handoff;
2. require fresh full CI on the latest docs-bearing head;
3. re-compare against protected `main` and require `behind_by=0`;
4. final scope must remain this service, targeted tests, engineering handoff and current to-do only;
5. update PR #237 body with final exact head / CI / review;
6. Ready for review;
7. ordinary merge with expected head SHA;
8. require post-main CI SUCCESS;
9. require production Pages SUCCESS;
10. no Worker deploy expected;
11. no real-user ledger mutation solely for smoke testing.

Only then mark this Phase 5 slice CLOSED.
