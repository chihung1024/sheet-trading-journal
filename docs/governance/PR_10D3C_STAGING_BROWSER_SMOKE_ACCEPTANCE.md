# PR-10D3C — Staging Browser OAuth/CRUD Smoke Acceptance

Status: IMPLEMENTED / FINAL REVIEW PENDING  
Baseline: `479dd6783a645abd8f8df406cc44c70be184af33`  
Recovery branch: `backup-pre-10d3c-479dd67`  
Work branch: `pr-10d3c-staging-browser-smoke`  
Draft PR: `#123`

## Purpose

Prove in a real Chromium browser that the fixed staging frontend and exact-SHA staging Worker operate together with the intended CSP, CORS, Google authentication, record CRUD, logout, and environment isolation. This is the browser-level closeout gate after PR-10D3A and the exact-SHA staging activation.

The infrastructure is implemented in this PR, but **D3C is not closed by merge alone**. A real post-merge staging browser workflow must still run successfully with a dedicated synthetic Google identity before this acceptance can become `CLOSED / PASS`.

## Authoritative staging targets

- Frontend: `https://staging.sheet-trading-journal.pages.dev`
- API: `https://journal-backend-staging.chired.workers.dev`
- Production API (must never receive a smoke write): `https://journal-backend.chired.workers.dev`
- Production frontend (must never be used as the smoke base URL): `https://sheet-trading-journal.pages.dev`

The workflow derives staging identities from `config/deployment-environments.json` and fails closed if caller input or environment state does not match the reviewed fixed staging deployment.

## Authentication design

PR-10D3C adds **no staging authentication bypass**.

The real browser smoke uses a fresh Google-issued ID token for a dedicated synthetic staging Google account. A one-time OAuth authorization-code flow using the staging Web OAuth client grants only `openid email profile` with offline access and yields a refresh token. The GitHub `staging` Environment stores the long-lived bootstrap credentials. Each smoke run exchanges the refresh token at Google's token endpoint for a fresh short-lived ID token.

The mint helper performs a preflight identity check on the refreshed token payload:

- issuer is Google;
- `aud` equals the staging Google client ID;
- `sub` equals the expected synthetic test account subject;
- token is not expired / near expiry;
- optional expected email matches if configured.

This local payload inspection is **not** treated as cryptographic authentication. The live staging Worker remains the authoritative verifier and performs the normal Google ID-token/JWKS verification when the existing LoginOverlay calls `authStore.login(credential)`.

The fresh ID token is written only to a mode-0600 temporary runner file. It is not committed or uploaded as an artifact, and trace/video/screenshots are disabled.

## Browser login path

The Playwright browser installs a page-local Google Identity Services shim before page scripts execute. The external GIS script request is fulfilled with an empty script so it cannot overwrite the shim. The shim only emulates the GIS JavaScript delivery surface (`initialize` / `renderButton`) and invokes the application's existing credential callback with the **real Google-issued ID token**.

No application runtime test hook, accepted fake token, Worker bypass endpoint, or alternate authorization path is introduced.

## Required smoke sequence — implemented

1. Load the fixed staging frontend.
2. Runtime-intercept and fail any browser request to a production frontend/API origin.
3. Complete existing LoginOverlay/authStore login using a fresh Google-issued staging ID token.
4. Verify authenticated browser-origin GET `/api/records`.
5. POST one uniquely tagged minimal synthetic transaction.
6. GET and verify exactly one matching synthetic record.
7. PUT only allowlisted transaction fields plus the record id; do not replay server-owned GET fields.
8. GET and verify the deterministic price update.
9. DELETE the synthetic record and verify it is absent.
10. Execute the real semantic `登出` control, accept its confirmation dialog, and verify the login overlay returns and browser token storage is cleared.
11. Perform read-only production `/api/version` verification through Playwright's non-browser request context; no production write is permitted.
12. In `finally`, retry browser DELETE if a prior step failed after creation; if browser cleanup cannot complete, use the same short-lived Google ID token for a staging-only server-side DELETE fallback.

## Synthetic data safety

- Unique marker derives from workflow run id plus random suffix.
- Synthetic transaction uses a benign supported `AAPL` BUY shape, minimal quantity, zero fees/tax, and a historical date.
- PUT payload is constructed from the known synthetic input plus id; server-owned fields are not reflected back.
- Dedicated Google identity / D1 tenant must be staging-only and contain no real user data.
- Synthetic cleanup is attempted on every post-create failure path.
- The synthetic record is never treated as portfolio/accounting truth.

## Credential scope

Required GitHub `staging` Environment secrets for the real smoke:

- existing `STAGING_GOOGLE_CLIENT_ID`;
- new `STAGING_E2E_GOOGLE_CLIENT_SECRET`;
- new `STAGING_E2E_GOOGLE_REFRESH_TOKEN`;
- new `STAGING_E2E_EXPECTED_GOOGLE_SUB`;
- optional `STAGING_E2E_EXPECTED_GOOGLE_EMAIL`.

No Google password is stored in GitHub.

Long-lived OAuth credentials are **not job-level environment variables**. The client secret, refresh token, expected subject, and optional expected email are exposed only to the single token-mint step. Subsequent npm/Playwright/Chromium/browser steps receive only fixed staging identities plus the temporary ID-token file path; they do not receive the refresh token or client secret.

## Workflow safety — implemented

- `workflow_dispatch` only; authenticated external smoke does not execute arbitrary PR code.
- caller supplies an exact 40-character source SHA.
- workflow checks out exactly that SHA, verifies it is reachable from protected `main`, and requires current `origin/staging` to equal it.
- job uses GitHub `environment: staging` protection.
- fixed staging frontend/API identities are derived from the reviewed deployment contract.
- staging Google client is rejected if it is the known production client.
- `actions/checkout` and `actions/setup-node` use the repository's existing full-SHA pins.
- new workflow is registered in the existing GitHub Actions supply-chain evidence inventory; the policy itself was not weakened.
- Playwright test package is exact version `1.62.0`; the runtime verifies `@playwright/test`, `playwright`, and `playwright-core` all resolve to `1.62.0`.
- npm lifecycle scripts are disabled during the isolated E2E install.
- trace/video/screenshots are disabled.
- temporary Google ID-token file is removed in an `always()` step.

### Supply-chain caveat retained

The isolated E2E package currently uses an exact package version plus runtime version verification but does **not** yet commit a generated npm lockfile/integrity graph. This is not hidden or treated as equivalent to full transitive integrity pinning. It remains a B01 supply-chain-hardening follow-up; PR-10D3C does not weaken the repository's existing GitHub Action full-SHA policy.

## Test-first chronology

### Phase A — clean expected red

- Expected-red head: `b98b8aac4e15e14870d95bef6250514e5d7287df`.
- CI run: `31150050600`.
- Python: PASS.
- Worker/security/local-D1: PASS.
- Frontend: intentional FAIL at the new staging-browser contract guards because the workflow, Playwright package/config/spec, and token helper did not yet exist.

This established that the new tests reproduced the missing D3C capability without uncovering an unrelated baseline regression.

### Phase B — first implementation and two divergences

- First implementation head: `ddb825805676429879c8a53acf1737b7a251a279`.
- CI run: `31150295992`.

Two failures appeared:

1. Frontend had `140/141` passing tests. The only failure was a brittle new contract assertion looking for literal `method: 'POST'/'PUT'/'DELETE'`, while the smoke correctly centralizes transport in `browserApi(page, method, ...)`. The guard was corrected to assert real `browserApi(page, 'POST'/'PUT'/'DELETE')` call sites; the smoke was not rewritten to satisfy test spelling.
2. Python stopped at the existing workflow supply-chain policy because the new workflow was not yet listed in `docs/governance/github-actions-pins.json`. The new workflow path was added to the inventory; `tests/test_workflow_supply_chain.py` and its policy were not weakened.

### Phase C — first all-green infrastructure head

- Head: `8bedf76d5844dc2e04a3ce2169d9fee426518eba`.
- CI run: `31150496204`.
- Frontend contracts/build: PASS.
- Python functional/coverage + workflow supply-chain policy: PASS.
- Worker/security/local-D1: PASS.

### Phase D — independent pre-merge security sweep and hardening

The green implementation was not merged immediately. A sibling-path security review found that the first workflow revision placed the Google client secret and refresh token at job-level `env`, unnecessarily exposing long-lived credentials to later npm/Playwright/Chromium/browser processes.

The authoritative fix moved long-lived OAuth credentials to the single token-mint step. Additional test-harness hardening removed reflection of server-owned GET fields into PUT and added a staging-only cleanup fallback using the short-lived ID token.

New static guards prevent regression of these properties.

- Hardened head: `ea1971af6d81af831576fa3770f5af6d47b49c3e`.
- CI run: `31150814710`.
- Frontend contracts/build: PASS.
- Python functional/coverage + workflow supply-chain policy: PASS.
- Worker/security/local-D1: PASS.

## Files in scope before final evidence update

The complete PR currently changes exactly eight files:

1. `.github/workflows/staging-browser-smoke.yml`
2. `docs/governance/PR_10D3C_STAGING_BROWSER_SMOKE_ACCEPTANCE.md`
3. `docs/governance/github-actions-pins.json`
4. `e2e/package.json`
5. `e2e/playwright.config.mjs`
6. `e2e/staging-smoke.spec.mjs`
7. `tests/frontend_staging_browser_smoke_contract.test.mjs`
8. `tools/mint_staging_e2e_id_token.mjs`

No application runtime, Worker source, D1 migration/schema, Python financial engine, market-data engine, dividend logic, PWA/service-worker, or production deployment file is in scope.

## Final pre-merge acceptance

PR-10D3C infrastructure may be marked Ready and merged only if:

1. this evidence-updated final head passes all three protected-main required checks;
2. final diff still contains only the documented D3C infrastructure/governance files;
3. no app/Worker/D1/financial runtime code appears in the diff;
4. long-lived OAuth credentials remain step-scoped and absent from npm/Playwright/Chromium/browser environment scope;
5. production origins cannot receive browser traffic from the smoke;
6. production activity remains read-only `/api/version` outside the browser;
7. synthetic cleanup has browser retry + staging-only fallback;
8. no blocking review thread remains;
9. `main` remains the reviewed PR base or the PR is explicitly synchronized and re-tested;
10. merge uses the protected normal `merge` path without bypass.

## Post-merge activation gate

Merge does **not** close D3C. After merge:

1. post-merge main CI and Pages must pass;
2. fixed `staging` must be fast-forwarded to the reviewed merge SHA without force;
3. Cloudflare fixed-staging Pages build must succeed;
4. the dedicated synthetic Google account and required staging Environment secrets must be provisioned out of band; secret values must not be pasted into chat or committed;
5. `Staging Browser Smoke` must be manually dispatched from `main` using the exact current staging SHA;
6. the real workflow log must prove fresh Google token mint, exact-source validation, Chromium execution, login, GET/POST/PUT/DELETE, cleanup, logout, and production-write exclusion;
7. only then may this document be finalized as `CLOSED / PASS`.

## Explicit non-goals

PR-10D3C does **not**:

- modify Worker authentication semantics;
- add a test-only auth endpoint or accepted fake token;
- use the production OAuth client for authentication;
- use production user data;
- change D1 schema/migrations;
- change canonical financial calculations;
- redesign sessions (B05);
- fix ledger/snapshot consistency (B06/B07);
- harden the remaining CSP directives (B14).

## Rollback

Before merge, abandon the work branch or compare against `backup-pre-10d3c-479dd67`. After merge, revert the infrastructure PR. The browser-smoke infrastructure performs no production deployment and no schema migration.
