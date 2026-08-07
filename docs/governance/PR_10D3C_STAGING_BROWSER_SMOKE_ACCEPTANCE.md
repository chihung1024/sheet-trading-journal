# PR-10D3C — Staging Browser OAuth/CRUD Smoke Acceptance

Status: TEST-FIRST / EXPECTED RED  
Baseline: `479dd6783a645abd8f8df406cc44c70be184af33`  
Recovery branch: `backup-pre-10d3c-479dd67`  
Work branch: `pr-10d3c-staging-browser-smoke`

## Purpose

Prove in a real Chromium browser that the fixed staging frontend and exact-SHA staging Worker operate together with the intended CSP, CORS, Google authentication, record CRUD, logout, and environment isolation. This is the browser-level closeout gate after PR-10D3A and the exact-SHA staging activation.

## Authoritative staging targets

- Frontend: `https://staging.sheet-trading-journal.pages.dev`
- API: `https://journal-backend-staging.chired.workers.dev`
- Production API (must never receive a smoke write): `https://journal-backend.chired.workers.dev`
- Production frontend (must never be used as the smoke base URL): `https://sheet-trading-journal.pages.dev`

The workflow must fail closed if these identities drift from `config/deployment-environments.json`.

## Authentication design

Do **not** add a staging authentication bypass.

The browser smoke must use a fresh Google-issued ID token for a dedicated synthetic staging Google account. A one-time OAuth authorization-code flow using the staging Web OAuth client grants only `openid email profile` with offline access and yields a refresh token. GitHub Environment secrets then allow the manual staging smoke workflow to exchange that refresh token at Google's token endpoint for a fresh ID token on each run.

The helper must validate the refreshed token claims before browser use:

- issuer is Google;
- `aud` equals the reviewed staging Google client ID;
- `sub` equals the expected synthetic test account subject;
- token is not expired;
- optional expected email matches if configured.

The ID token itself must never be printed, uploaded as an artifact, or committed.

## Browser login path

The Playwright browser may install a page-local Google Identity Services test shim before page scripts execute. The shim may only emulate the GIS JavaScript delivery surface (`initialize` / `renderButton`) and then invoke the application's existing credential callback with the **real Google-issued ID token**.

This is acceptable because it does not bypass backend authentication: `LoginOverlay` still calls `authStore.login(credential)`, and the live staging Worker still performs the real Google ID-token verification. No application runtime test hook or bypass endpoint is permitted.

## Required smoke sequence

1. Load the fixed staging frontend.
2. Assert no request is made to a production API origin.
3. Complete application login through the existing LoginOverlay credential callback using the fresh Google ID token.
4. Verify authenticated GET `/api/records` succeeds from the browser origin.
5. POST one uniquely marked synthetic transaction record.
6. GET records and find exactly that synthetic record.
7. PUT the same record with a deterministic field change and verify it by GET.
8. DELETE the synthetic record and verify it is absent by GET.
9. Execute application logout and verify browser token/auth state is cleared.
10. In `finally`, attempt cleanup of the synthetic record if any previous step failed after creation.
11. Perform read-only production health/version verification only; no production write request is permitted.

## Synthetic data safety

- Use a unique marker derived from the workflow run id / timestamp.
- Use a benign supported transaction shape and minimal quantity.
- Never rely on the synthetic record for portfolio truth.
- Cleanup is mandatory even on failure.
- The dedicated Google account / D1 tenant must be staging-only and contain no real user data.

## Required GitHub Environment secrets

The manual workflow must use `environment: staging` and fail if any required credential is absent:

- existing `STAGING_GOOGLE_CLIENT_ID`;
- new `STAGING_E2E_GOOGLE_CLIENT_SECRET`;
- new `STAGING_E2E_GOOGLE_REFRESH_TOKEN`;
- new `STAGING_E2E_EXPECTED_GOOGLE_SUB`;
- optional `STAGING_E2E_EXPECTED_GOOGLE_EMAIL`.

No Google password is stored in GitHub.

## Workflow safety

- `workflow_dispatch` only; do not run authenticated external smoke on arbitrary PR code.
- checkout must be an exact 40-character SHA reachable from protected `main`.
- use GitHub `staging` environment protection.
- fixed staging frontend/API identities only.
- production writes forbidden by both static contract and runtime request interception.
- browser trace/video/screenshots disabled by default because they could capture sensitive token-bearing state.
- token temp file must be removed in an `always()` cleanup step.

## Test-first procedure

1. Add contract tests describing the required files and fail-closed invariants while the implementation is absent; retain expected-red CI.
2. Add the OAuth refresh helper, pinned Playwright harness, browser smoke, and manual staging workflow.
3. Make repository CI green without requiring staging secrets on ordinary PR CI.
4. Merge the infrastructure PR through protected `main` after independent review.
5. Fast-forward fixed `staging` to the reviewed merge SHA if the frontend build remains runtime-equivalent/safe.
6. Provision the dedicated staging E2E secrets out of band.
7. Manually dispatch the staging browser smoke from `main` with the exact reviewed staging source SHA.
8. Require a fully green real-browser run before D3C closes.

## Explicit non-goals

PR-10D3C must not:

- modify Worker authentication semantics;
- add a test-only auth endpoint or accepted fake token;
- use the production OAuth client;
- use production user data;
- change D1 schema/migrations;
- change canonical financial calculations;
- redesign sessions (B05);
- fix ledger/snapshot consistency (B06/B07);
- harden the remaining CSP directives (B14).

## Rollback

Before merge, abandon the work branch or compare against `backup-pre-10d3c-479dd67`. After merge, revert the infrastructure PR. The browser-smoke infrastructure itself performs no production deployment and no schema migration.
