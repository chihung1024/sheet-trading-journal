# PR-10C1 Acceptance Contract

## Identity

- Issue: `#70`
- Baseline main SHA: `c5b608bbbde1c13105f9dcb7d5ae8f789b9f4bae`
- Working branch: `pr10c1-frontend-record-safety`
- Pre-change backup ref: `backup-pre-pr10c1-c5b608b`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

Complete browser retrieval of every records page and remove cross-tenant leakage from full-record caching and global localStorage clearing, without changing the Worker contract or financial calculations.

## Allowed changed paths

- `docs/PR10C1_ACCEPTANCE.md`
- `docs/governance/browser-storage-baseline.json`
- `package.json`
- `src/services/projectStorage.js`
- `src/services/recordPagination.js`
- `src/stores/auth.js`
- `src/stores/portfolio.js`
- `tests/frontend_data_services.test.mjs`
- `tests/frontend_security_contracts.test.mjs`

Any other changed path is a release blocker unless Issue #70 and this contract are amended before review.

## Compatibility contract

- The frontend continues to call the existing `GET /api/records` endpoint.
- The first request explicitly uses `limit=1000`.
- Signed `next_cursor` values are treated as opaque and URL encoded.
- A response without `page` metadata is accepted as the complete legacy response.
- A paginated response must have matching `limit`, `count`, `has_more`, and `next_cursor` metadata.
- Partial records are never committed to Pinia state after a pagination failure.
- Worker, D1, snapshots, jobs, service worker, and calculation engine are unchanged.

## Data safety contract

- `cached_records` is cleanup-only and never written.
- Logout removes only the reviewed sensitive project keys:
  - token
  - name
  - email
  - pending calculation request
  - legacy records cache
  - confirmed-dividend local state
  - benchmark cache
- Logout preserves `theme`, active view, and unrelated origin data.
- Existing token storage remains an open B05 risk and is not declared remediated.
- Existing confirmed-dividend local state remains an open B11 risk and is not declared remediated.

## Required validation

1. `npm run test:frontend`
2. Existing full Python suite.
3. Existing Worker security and deployment tests.
4. Existing Worker config verification.
5. Existing local D1 migration verification.
6. Existing production frontend build.
7. More than 1,000 records are assembled from multiple pages.
8. Legacy single-response compatibility is tested.
9. Malformed page metadata fails closed.
10. Missing or repeated cursors fail closed.
11. Duplicate record IDs fail closed.
12. Maximum page and record bounds fail closed.
13. Browser-storage inventory and public-evidence tests remain green.
14. No dependency or package-lock change.
15. Exact diff contains only the allowed paths.

## Explicit exclusions

- No local-date or TradeForm event correction.
- No GroupManager correction.
- No API timeout or AbortController change.
- No token refresh or session redesign.
- No automatic refresh, market-hours, benchmark, dividend, group, market-data, or accounting change.
- No Worker deployment or D1 migration.

## Canary and production verification

Because this is a frontend-only change:

1. Merge only after exact-head CI and independent diff review.
2. Verify the main push CI.
3. Verify the public site loads and the Worker version endpoint remains unchanged.
4. Existing users with fewer than 1,000 records must retain the same displayed record count.
5. The previous Pages deployment and Git backup ref remain the rollback targets.

## Rollback

Restore the prior Pages deployment or revert the merge commit. No Worker, D1, calculation-job, snapshot, or record rollback is required.
