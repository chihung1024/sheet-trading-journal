# PR-10C3 Acceptance Contract

## Identity

- Issue: `#74`
- Baseline main SHA: `b817dba5a7865a07b4db08a7c764cd02efd37322`
- Working branch: `pr10c3-groupmanager-mutations`
- Pre-change backup ref: `backup-pre-pr10c3-b817dba`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

Make GroupManager record-tag mutations fail closed, remove forbidden server-owned fields from browser update payloads, and expose non-atomic partial progress accurately.

## Allowed changed paths

- `docs/PR10C3_ACCEPTANCE.md`
- `src/components/GroupManager.vue`
- `src/services/groupRecordMutation.js`
- `tests/frontend_group_record_mutation.test.mjs`

Any other changed path is a release blocker unless Issue #74 and this contract are amended before review.

## Payload contract

Every GroupManager PUT payload contains exactly:

1. `id`
2. `txn_date`
3. `symbol`
4. `txn_type`
5. `qty`
6. `price`
7. `fee`
8. `tax`
9. `tag`
10. `note`

It must never forward `user_id`, `target_user_id`, `email`, `owner`, `owner_id`, `role`, `created_at`, `total_amount`, or any unreviewed server-returned field.

## Mutation contract

- Every PUT requires both `response.ok` and JSON `success === true`.
- A success counter increments only after both checks pass.
- The batch stops at the first failed PUT.
- A partial error records successful count, total count, failed record ID, and underlying error class.
- Records are re-fetched after a complete success or any failure.
- Recalculation is triggered only after the complete mutation batch succeeds.
- A recalculation-trigger failure is reported separately and does not relabel already committed record updates as failed.
- Rename, selection, and checkbox controls are disabled while a batch is active.

## Compatibility contract

- Uses the existing `PUT /api/records` endpoint and existing record fields.
- Does not alter tag semantics or make sequential updates atomic.
- Existing strategy calculations and snapshots are unchanged until the normal successful recalculation completes.
- Existing records require no migration.

## Required validation

1. `npm run test:frontend`
2. Existing full Python suite.
3. Existing Worker security and deployment tests.
4. Existing Worker config verification.
5. Existing local D1 migration verification.
6. Existing production frontend build.
7. Exact payload allowlist test.
8. Forbidden-field exclusion test.
9. HTTP failure test.
10. Application-level failure test.
11. Network failure test.
12. Missing-token test.
13. Complete sequential batch test.
14. Partial-batch count and failed-record test.
15. Static GroupManager test proving there is no direct `fetch()` or raw object-spread payload.
16. Static failure-path test proving refresh occurs but recalculation does not.
17. Exact diff contains only the allowed paths.
18. No dependency, lockfile, Worker, schema, workflow, or version change.

## Explicit exclusions

- No atomic bulk endpoint.
- No rollback of already committed rows after partial failure.
- No record revision, optimistic locking, or mutation idempotency; those remain B06.
- No strategy allocation or additive group accounting; those remain B10.
- No auth/session, market-data, dividend, benchmark, refresh, accounting, or calculation change.
- No Worker deployment or D1 migration.

## Canary and production verification

Because this is frontend-only:

1. Merge only after exact-head CI and independent diff review.
2. Verify main push CI.
3. Confirm the public site still loads.
4. Confirm no Worker source or deployment workflow changed.
5. Retain the previous Pages deployment and Git backup ref as rollback targets.

## Rollback

Restore the prior Pages deployment or revert the merge commit. No Worker, D1, snapshot, record, or calculation rollback is required. Rows committed before a partial failure remain authoritative and are reloaded by the UI.
