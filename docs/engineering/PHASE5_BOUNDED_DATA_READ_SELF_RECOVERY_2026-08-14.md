# Phase 5 — Bounded Data Read Self-Recovery

Date: 2026-08-14 Asia/Taipei  
Risk: **R1–R2 boundary; treat as R2 for merge discipline** because browser orchestration may automatically repeat a read operation.

## Product objective

Transient portfolio read failures should not require the user to press the reliability banner's `重新載入` button immediately.

This slice adds one bounded automatic reconnect attempt for safe GET reads while keeping the existing reliability banner and manual reload action as fallback.

## Scope

Recoverable read paths:

- `GET /api/records`
- `GET /api/portfolio`
- `GET /api/user-settings`

Automatic recovery is allowed only for:

- request timeout;
- malformed success/response evidence;
- network `TypeError` / `NetworkError`;
- explicit HTTP 5xx.

Automatic recovery is not allowed for:

- POST/PUT/DELETE;
- explicit 4xx/client rejection;
- external/user abort;
- calculation-job polling routes;
- unknown non-network errors;
- signed-out users;
- browsers explicitly reporting offline state.

## Episode model

A read failure is eligible only when the portfolio store reaches `portfolioReadStatus === 'error'`.

For one failed read episode:

1. capture the signed normalized owner when a recoverable GET failure occurs;
2. wait 2 seconds;
3. require the same signed owner, an auth token, online state and continued read-error state;
4. call existing `portfolio.fetchAll()` exactly once;
5. if it still fails, retain the existing reliability banner/manual reload fallback;
6. do not loop automatically;
7. only a later verified `portfolioReadStatus === 'loaded'` resets the retry allowance for another episode.

## Cross-owner safety

The retry allowance is owner-aware.

If the account changes during the backoff:

- the old owner's timer cannot retry under the new owner;
- the old episode allowance is not inherited by the new owner;
- if the new owner has its own pending recoverable read failure, it can receive its own bounded timer once the old scheduled task releases.

No token, transaction payload, owner identifier or request body is persisted by this feature.

## Failure containment

Notification callback failures and timer/helper failures are contained and cannot escape as unhandled promise rejections or change original request semantics.

## Architecture

The implementation reuses the generic request-failure evidence introduced in Phase 4. `fetchWithDeadline` itself still does not retry.

`dataReadSelfRecovery.js` subscribes to failure evidence, filters exact safe GET paths, and invokes the existing `portfolio.fetchAll()` lifecycle. No second data loader, cache or backend queue is introduced.

## Explicit non-goals

- no Worker/D1/schema changes;
- no financial formula or ledger changes;
- no market-data changes;
- no mutation retry changes;
- no auth redesign;
- no generic AI agent;
- no permanent removal of the manual reload fallback.

## Verification requirements

Before merge require:

- direct retryability classification tests;
- one-attempt-per-episode test;
- successful-load allowance reset test;
- owner-switch isolation test;
- offline/stop behavior test;
- production bootstrap uniqueness test;
- full exact-head Frontend/Worker/Python CI;
- final compare against protected main;
- no Worker/D1/Python-engine/finance drift;
- ordinary merge;
- post-main CI and production Pages success.

No real-user ledger mutation is needed for this frontend-only read recovery slice.
