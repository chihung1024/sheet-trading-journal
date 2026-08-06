# PR-10C4 Acceptance Contract

## Identity

- Issue: `#76`
- Baseline main SHA: `7ae63a5a2ae9754b92a85cf4ccf9e84e559307df`
- Working branch: `pr10c4-refresh-pause-visibility`
- Pre-change backup ref: `backup-pre-pr10c4-7ae63a5`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

Make the existing pause control stop actual automatic refresh work and prevent hidden pages from starting or continuing automatic calculation triggers.

## Allowed changed paths

- `docs/PR10C4_ACCEPTANCE.md`
- `src/composables/useMarketHoursRefresh.js`
- `src/services/refreshPolicy.js`
- `tests/frontend_refresh_policy.test.mjs`

Any other changed path is a release blocker unless Issue #76 and this contract are amended before review.

## Scheduling contract

An active automatic refresh schedule requires all of:

1. automatic refresh enabled;
2. not paused;
3. document visible;
4. current existing market-hours function returns true;
5. authentication token present;
6. authentication token not expired.

An actual `triggerUpdate()` additionally requires:

7. portfolio store is not loading or polling;
8. another refresh invocation is not already running.

## Timer and lifecycle contract

- Pausing immediately stops the three-minute refresh timer and UI countdown.
- Hiding the document immediately stops the three-minute refresh timer and UI countdown.
- Resuming or restoring visibility evaluates eligibility once and starts at most one schedule.
- Repeated start calls create at most one one-minute eligibility timer and one three-minute refresh timer.
- The visibility listener is added on mount and removed on unmount.
- Logout, disabled refresh, or unmount stops all timers.
- The current Taiwan, US, and DST calculations are unchanged in this PR.

## Required validation

1. `npm run test:frontend`
2. Existing full Python suite.
3. Existing Worker security and deployment tests.
4. Existing Worker config verification.
5. Existing local D1 migration verification.
6. Existing production frontend build.
7. Pure policy tests reject disabled, paused, hidden, outside-market, missing-token, expired-token, busy, and already-running states.
8. Static integration proves both schedule and trigger boundaries call the centralized policy.
9. Static integration proves pause and hidden-page handling stop active timers.
10. Static integration proves visibility listener lifecycle.
11. Static integration proves timer creation is guarded against duplication.
12. Exact diff contains only the allowed paths.
13. No dependency, lockfile, Worker, D1, workflow, or version change.

## Explicit exclusions

- No cross-tab leader election; multiple visible tabs remain a later B02 item.
- No AbortController or cancellation of an already-started request.
- No market holiday, early close, official exchange calendar, or market-hours correction; those remain B08.
- No job coalescing or server-side refresh identity; those remain B07/B13.
- No auth/session, GroupManager, dividend, benchmark, market-data, accounting, or calculation change.
- No Worker deployment or D1 migration.

## Canary and production verification

Because this is frontend-only:

1. Merge only after exact-head CI and independent diff review.
2. Verify main push CI.
3. Confirm the public site still loads.
4. Confirm no Worker source or deployment workflow changed.
5. Retain the previous Pages deployment and Git backup ref as rollback targets.

## Rollback

Restore the prior Pages deployment or revert the merge commit. No Worker, D1, job, snapshot, record, or financial-data rollback is required.
