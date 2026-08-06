# PR-10C2 Acceptance Contract

## Identity

- Issue: `#72`
- Baseline main SHA: `3b6d4aa9f1c3e69cb76e9d4397adc8a1f98b0a78`
- Working branch: `pr10c2-tradeform-date-event`
- Pre-change backup ref: `backup-pre-pr10c2-3b6d4aa`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

Correct the browser-local trade date and complete the already-declared TradeForm submission event without changing transaction payloads, backend behavior, or financial calculations.

## Allowed changed paths

- `docs/PR10C2_ACCEPTANCE.md`
- `src/components/TradeForm.vue`
- `src/services/calendarDate.js`
- `tests/frontend_trade_form.test.mjs`

Any other changed path is a release blocker unless Issue #72 and this contract are amended before review.

## Runtime contract

- New forms use the browser's resolved IANA time zone to derive `YYYY-MM-DD`.
- The implementation does not derive a trade date through UTC `toISOString()`.
- An explicit reset or successful submission refreshes the date to the current local calendar date.
- Editing loads the record's existing `txn_date` and does not replace it with today's date.
- `submitted` is emitted once only after `store.addRecord()` or `store.updateRecord()` returns success.
- Validation failures, expired authentication, thrown exceptions, and false mutation results do not emit `submitted`.
- Existing add and update payload fields are unchanged.

## Required validation

1. `npm run test:frontend`
2. Existing full Python suite.
3. Existing Worker security and deployment tests.
4. Existing Worker config verification.
5. Existing local D1 migration verification.
6. Existing production frontend build.
7. Asia/Taipei UTC-boundary date tests pass.
8. Invalid date and time-zone input tests pass.
9. Static TradeForm contract proves UTC serialization is absent.
10. Static TradeForm contract proves reset restores local date.
11. Static TradeForm contract proves exactly one success-only `submitted` emit.
12. Static contract proves `App.vue` retains the existing listener.
13. Static contract proves editing preserves the source record date.
14. Exact diff contains only the allowed paths.
15. No dependency, lockfile, Worker, schema, workflow, or version change.

## Explicit exclusions

- No transaction validation, amount, currency, group, or sell-allocation change.
- No API timeout or cancellation change.
- No auth/session redesign.
- No market-hours refresh or cross-tab coordination change.
- No GroupManager, dividend, benchmark, market-data, accounting, or calculation change.
- No production Worker deployment or D1 migration.

## Canary and production verification

Because this is a frontend-only change:

1. Merge only after exact-head CI and independent diff review.
2. Verify the main push CI.
3. Confirm the public site still loads.
4. Confirm no Worker source or deployment workflow changed.
5. Use the prior Pages deployment and Git backup ref as rollback targets.

## Rollback

Restore the prior Pages deployment or revert the merge commit. No Worker, D1, record, snapshot, calculation-job, or market-data rollback is required.
