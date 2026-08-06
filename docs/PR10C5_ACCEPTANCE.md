# PR-10C5 Acceptance — Bounded Frontend Request Lifecycles and Ambiguous Mutation Outcomes

## Purpose

This B02 frontend-only batch prevents the portfolio client from waiting indefinitely during any phase of an API request and prevents transport/protocol failures from being misreported as definite mutation failures.

Tracking issue: #78  
Pull request: #86

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

## Root-cause analysis

### Symptom 1 — Node ESM import failure

Initial CI run `31078154546` failed before the new tests executed because two new service-to-service imports omitted `.js`. Vite resolves those imports, but direct Node ESM execution does not.

This was corrected without weakening any test or runtime contract. The failure is retained as environment-compatibility evidence.

### Root cause 1 — request deadline ownership ended too early

The first implementation placed the timeout around `fetch()`. That bounded connection and response-header arrival, but `fetch()` resolves before `response.json()` finishes. A server or network path could therefore return headers and then stall the response body indefinitely.

The durable correction makes one deadline owner responsible for the complete request lifecycle:

1. start the timer;
2. dispatch `fetch()` with an internal `AbortController`;
3. wait for response headers;
4. run an injected response handler;
5. consume and validate the JSON body inside that handler;
6. return the final parsed result or the special 401 response;
7. clear the timer and external abort listener on every exit path.

A deterministic test resolves headers immediately, starts a response handler that never settles, fires the deadline, and verifies that the underlying signal is aborted and `RequestTimeoutError` is returned.

### Root cause 2 — mutation uncertainty was classified too narrowly

The first implementation treated only timeout as outcome-ambiguous. That was incomplete. Once a mutation is dispatched, the client also cannot prove that the server did not commit when it later receives:

- an external abort;
- an ordinary network failure;
- a malformed or truncated successful response;
- a non-`Error` rejection from an integration boundary.

The final policy is based on evidence, not a single error class:

- explicit HTTP rejection is definite;
- explicit JSON `success:false` application rejection is definite;
- every other failure after a POST/PUT/DELETE path is classified conservatively as outcome-ambiguous.

Non-`Error` thrown values are normalized into `Error` objects before classification so the error pipeline cannot fail while handling an abnormal rejection.

### Parallel same-class inventory

Repository-wide raw-fetch scanning found a separate authenticated-login request in `src/stores/auth.js` and an independent Google refresh promise/timer lifecycle. Those are recorded as the next auth-lifecycle batch rather than being mixed into this PR, because changing Google OAuth and token-refresh behavior requires its own compatibility and rollback evidence.

Worker-side fetches, service-worker fetch events, tests, and archived Worker files are different trust/runtime boundaries and are not silently migrated by this frontend-store PR.

## Complete request deadline contract

All API requests issued by `src/stores/portfolio.js` now pass through one authenticated request path and one dependency-free deadline service.

- Default deadline: 30,000 ms.
- Covered phases: dispatch, headers, JSON body consumption, response validation.
- Mechanism: internal `AbortController` plus `Promise.race`.
- Optional external `AbortSignal` is supported.
- Optional `responseHandler` executes inside the deadline.
- Timer and external-listener cleanup occurs on success, timeout, abort, body-parse failure, application failure, HTTP failure, and ordinary network failure.
- An already-aborted external signal rejects before a timer or fetch is started.
- Invalid timeout, fetch, timer, or response-handler configuration fails immediately.
- No automatic network retry loop is added.

## One-time 401 compatibility

The only retained retry is the existing response to an explicit HTTP 401:

1. the response handler does not consume the 401 body;
2. refresh the Google token once;
3. repeat the same request once with `retryAfterRefresh=false`;
4. on another 401 or failed refresh, set connection state to error and log out.

A timeout, abort, network error, malformed body, HTTP error other than the handled 401, or application failure does not enter that retry path.

## Typed failure model

The frontend distinguishes:

- `RequestTimeoutError` — the complete request lifecycle exceeded its deadline;
- `RequestAbortedError` — external cancellation;
- `ApiHttpError` — server returned a non-2xx status;
- `ApiApplicationError` — JSON explicitly returned `success:false`;
- `MalformedApiResponseError` — invalid response object, invalid JSON, array, primitive, or null successful payload;
- ordinary transport errors — retained as their original `Error` type;
- non-`Error` thrown values — normalized to `Error`.

HTTP errors retain only a safe message, status, and optional machine code. The response parser does not retain or publish complete response payloads.

## Mutation outcome semantics

POST, PUT, and DELETE handling is intentionally conservative.

A client-side transport or protocol failure does not prove whether the Worker committed the operation. Therefore:

- no mutation is automatically resent;
- every non-explicit rejection is marked `outcomeAmbiguous=true`;
- the message states that the result is uncertain and the server may already have completed the operation;
- the user is instructed to refresh and verify before retrying.

This applies to:

- add record;
- update record;
- delete record;
- benchmark save;
- calculation trigger.

Read failures are never marked mutation-ambiguous. A read timeout receives an ordinary retry-later message.

Explicit HTTP and `success:false` application rejections remain definite and preserve the server’s safe message.

## Calculation trigger and idempotency compatibility

The existing calculation idempotency and recovery state remains intact.

- The existing `Idempotency-Key` is still sent.
- A successful response with a job ID stores the same key/job recovery data and starts the same polling path.
- A successful legacy response without a job ID clears pending state and starts the same snapshot polling path.
- An explicit HTTP or application rejection clears the pending trigger state.
- Timeout, abort, network failure, malformed response, or other non-explicit failure preserves the pending idempotency key because the outcome is ambiguous.
- No second trigger request is generated automatically.

## Portfolio-store integration

All portfolio-store API traffic uses the bounded authenticated path:

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

- successful request and timer cleanup;
- success with external-listener cleanup;
- fetch-stage timeout and underlying abort;
- response-body-stage timeout and underlying abort;
- external abort typing, reason, underlying abort, and listener cleanup;
- already-aborted input;
- ordinary network failure cleanup;
- invalid timeout/fetch/timer/response-handler configuration;
- successful JSON parsing;
- HTTP error status/code classification;
- malformed HTTP body fallback;
- `success:false` application errors;
- malformed successful JSON and invalid response objects;
- read timeout as non-ambiguous;
- timeout, abort, malformed response, network error, string rejection, and null rejection as ambiguous mutations;
- explicit HTTP/application rejection as definite;
- Traditional Chinese refresh-before-retry guidance;
- static proof that all portfolio API calls and JSON parsing use the bounded path;
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
- Google OAuth login or token-refresh protocol;
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
2. The complete deadline includes response-body consumption.
3. Every non-explicit mutation failure is outcome-ambiguous and is not retried.
4. Existing frontend security and correctness tests pass.
5. Frontend production build passes.
6. Complete Python coverage gates remain non-regressed.
7. Worker/security/config/local-D1 tests pass.
8. Exact diff is limited to the six paths listed above.
9. Independent exact-head review confirms no retry loop and no idempotency-state loss on ambiguous trigger outcomes.
10. Merge uses expected-head locking.
11. A post-merge backup is created from the exact merge SHA.
12. Main exact-SHA CI passes.

## Rollback

Restore the prior Pages deployment or revert the PR merge. The current pre-change reference is `backup-pre-pr10c5-f896f42`; the older abandoned-start reference remains `backup-pre-pr10c5-7c4545f`.

No Worker deployment, D1 migration, record repair, snapshot rollback, OAuth change, IBKR action, or external-service rollback is required.
