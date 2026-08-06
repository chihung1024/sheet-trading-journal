# PR-10C5 Acceptance — Bounded Frontend API Requests and Ambiguous Mutation Timeouts

## Purpose

This B02 frontend-only batch prevents the portfolio client from waiting indefinitely on API calls and distinguishes a definite server rejection from a mutation timeout whose server-side outcome is unknown.

Tracking issue: #78

## Exact baseline and recovery chain

- Repository: `chihung1024/sheet-trading-journal`
- Current main before change: `f896f428eb125c582cec8802a0f5a9f3d1237464`
- Current main tree: `8d437cffab714339d1d3aaa92244c8ef54074e49`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Historical abandoned baseline: `7c4545f4e822af37452cc62e0b594e9d21a0c653`
- Historical backup: `backup-pre-pr10c5-7c4545f`
- Current pre-change backup: `backup-pre-pr10c5-f896f42`
- Work branch: `pr10c5-api-deadlines`
- Runtime scope: frontend only
- Cost policy: free-only

The work branch contained no implementation from the historical attempt. It was fast-forwarded from the old baseline to the current main before new code was written. Both backup points are retained so future review can distinguish the abandoned start from the actual implementation baseline.

## Request deadline contract

All API requests issued by `src/stores/portfolio.js` now pass through one authenticated request path and one dependency-free deadline service.

- Default deadline: 30,000 ms.
- Mechanism: internal `AbortController` plus `Promise.race`.
- Optional external `AbortSignal` is supported.
- Timer and external listener cleanup occurs on success, timeout, abort, and ordinary network failure.
- An already-aborted external signal rejects before a timer or fetch is started.
- No automatic network retry loop is added.

The only retained retry is the existing one-time response to an explicit HTTP 401:

1. refresh the Google token once;
2. repeat the same request once with `retryAfterRefresh=false`;
3. on another 401 or failed refresh, set connection state to error and log out.

A timeout, network error, malformed response, or application failure does not enter that 401 retry path.

## Typed failure model

The frontend now distinguishes:

- `RequestTimeoutError` — local deadline expired;
- `RequestAbortedError` — external cancellation;
- `ApiHttpError` — server returned a non-2xx status;
- `ApiApplicationError` — JSON explicitly returned `success:false`;
- `MalformedApiResponseError` — invalid response object, invalid JSON, array, primitive, or null successful payload.

HTTP errors retain only a safe message, status, and optional machine code. The response parser does not retain or publish full response payloads.

## Mutation outcome semantics

POST, PUT, and DELETE timeout handling is intentionally conservative.

A timeout means the browser stopped waiting; it does not prove whether the Worker committed the operation. Therefore:

- the request is never automatically resent;
- the error is marked `outcomeAmbiguous=true`;
- the user message says the server may already have completed the operation;
- the user is instructed to refresh and verify before retrying.

This policy applies to:

- add record;
- update record;
- delete record;
- benchmark save;
- calculation trigger.

Read timeouts are not marked outcome-ambiguous and receive a normal retry-later message.

## Calculation trigger and idempotency compatibility

The existing calculation idempotency and recovery state remains intact.

- The existing `Idempotency-Key` is still sent.
- A successful response with a job ID stores the same key/job recovery data and starts the same polling path.
- A successful legacy response without a job ID clears pending state and starts the same snapshot polling path.
- An explicit HTTP or `success:false` rejection clears the pending trigger state, matching a definite server rejection.
- Timeout, abort, ordinary network failure, or malformed response preserves the pending idempotency key because the result is ambiguous.
- No second trigger request is generated automatically.

## Portfolio-store integration

All portfolio-store API traffic now uses the bounded authenticated path:

- paginated records reads;
- portfolio snapshot reads;
- user settings reads;
- calculation job status reads;
- smart polling reads;
- record POST/PUT/DELETE;
- benchmark POST;
- calculation-trigger POST.

There is no remaining raw `fetch()` call in `src/stores/portfolio.js`.

The following remain unchanged:

- endpoint paths;
- payloads;
- authorization and content-type headers;
- public Pinia actions and refs;
- polling intervals and maximum polling windows;
- job recovery format;
- calculation idempotency-key generation;
- record pagination;
- snapshot, benchmark, and calculation response contracts;
- user-visible success flows.

## Deterministic tests

The dependency-free Node suite covers:

- success and timer cleanup;
- success with external-listener cleanup;
- timeout typing and underlying abort;
- external abort typing, reason, underlying abort, and listener cleanup;
- already-aborted input;
- ordinary network failure cleanup;
- invalid timeout/fetch/timer configuration;
- successful JSON parsing;
- HTTP error status/code classification;
- malformed HTTP body fallback;
- `success:false` application errors;
- malformed successful JSON and invalid response objects;
- mutation-only outcome ambiguity;
- Traditional Chinese refresh-before-retry guidance;
- definite server-rejection classification;
- static proof that all portfolio API calls use the bounded path;
- static proof that the 401 retry remains one-time and the request helper contains no retry loop;
- fixed 30-second default.

## Changed paths

- `src/services/requestErrors.js`
- `src/services/fetchDeadline.js`
- `src/services/apiResponse.js`
- `src/stores/portfolio.js`
- `tests/frontend_api_deadline.test.mjs`
- `docs/PR10C5_ACCEPTANCE.md`

## Explicit exclusions

No change to:

- Worker source, routes, CORS, token verification, deployment, or secrets;
- D1 schema, migrations, records, jobs, or snapshots;
- financial calculations, market data, benchmarks, splits, dividends, PnL, TWR, or XIRR;
- Google OAuth or session protocol;
- GroupManager mutation flow;
- latest-response-wins, component-unmount cancellation, or cross-tab leadership;
- dependencies, workflows, release, API, or schema versions;
- Cloudflare, Google Cloud, IBKR, hosted scanners, paid services, or potentially metered integrations.

## Compatibility dimensions

- Old frontend → current Worker: unchanged.
- New frontend → current Worker: unchanged request and response contracts.
- Queued calculation jobs: unchanged IDs, status reads, and recovery state.
- Existing snapshots: unchanged.
- Legacy service workers: no service-worker or asset-routing change in this batch.

## Acceptance gates

1. All new dependency-free frontend tests pass.
2. Existing frontend security and correctness tests pass.
3. Frontend production build passes.
4. Complete Python coverage gates remain non-regressed.
5. Worker/security/config/local-D1 tests pass.
6. Exact diff is limited to the six paths listed above.
7. Independent exact-head review confirms no mutation timeout retry and no idempotency-state loss on ambiguous trigger outcomes.
8. Merge uses expected-head locking.
9. A post-merge backup is created from the exact merge SHA.
10. Main exact-SHA CI passes.

## Rollback

Restore the prior Pages deployment or revert the PR merge. The current pre-change reference is `backup-pre-pr10c5-f896f42`; the older abandoned-start reference remains `backup-pre-pr10c5-7c4545f`.

No Worker deployment, D1 migration, record repair, snapshot rollback, OAuth change, IBKR action, or external-service rollback is required.
