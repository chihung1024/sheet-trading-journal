# PR-10D3A — Environment-Aware CSP Acceptance

Status: IMPLEMENTED / FINAL REVIEW PENDING  
Baseline: `d78bb3c7aadf1c3e3d9078be304d410d70a96103`  
Recovery branch: `backup-pre-10d3a-csp-d78bb3c`  
Work branch: `pr-10d3a-environment-aware-csp`  
Draft PR: `#120`

## Purpose

Close audit finding N24: the frontend runtime environment can be staging while both CSP enforcement surfaces still hardcode the production Worker origin. Because the browser enforces the intersection of the HTML meta CSP and Cloudflare Pages response-header CSP, successful build/CORS checks do not prove that a staging browser can call the staging Worker.

## Reconfirmed baseline divergence

The machine-readable deployment contract already defines distinct identities:

- production API: `https://journal-backend.chired.workers.dev`;
- staging API: `https://journal-backend-staging.chired.workers.dev`;
- fixed staging Pages branch: `staging`;
- arbitrary Pages preview branches: disabled.

However on the baseline:

- `index.html` meta CSP `connect-src` hardcoded the production API;
- `public/_headers` CSP `connect-src` hardcoded the production API;
- the Vite environment validator correctly accepted the reviewed staging API but did not render that validated identity into either CSP surface.

Result: a staging bundle could contain `VITE_API_URL=staging` while browser CSP still authorized only the production Worker.

## Test-first chronology

### Phase A — expected red

- Test-first head: `519d40a6569dadb091f2d194119a33c8a0daf928`.
- CI run: `31145425753`.
- Python job: PASS.
- Worker/security/D1 job: PASS.
- Frontend job: FAIL only at the new CSP regression guards.
- Frontend summary: `137` tests, `134` pass, `3` fail.

The three expected failures were:

1. source CSP surfaces did not contain the required `__TRADING_JOURNAL_API_ORIGIN__` token because both still hardcoded an environment identity;
2. a real fixed-staging Vite build produced a meta CSP that did **not** authorize `https://journal-backend-staging.chired.workers.dev`, directly reproducing N24;
3. `vite.config.js` had no `createFrontendCspPlugin` wiring.

The production-compatible build regression test already passed on the baseline, proving that the defect was specifically environment isolation rather than a generic production CSP/build failure. Existing arbitrary-preview fail-closed tests also remained green.

### Phase B — authoritative root fix

- Root-fix head: `917ca6a7515cdb6670963e31438eb649bdd23095`.
- CI run: `31145761413`.
- Frontend contracts: `137/137` PASS.
- Production Vite build: PASS.
- Python tests/measured coverage gate: PASS.
- Worker security/deployment/local D1 baseline: PASS.

The four CSP integration guards all passed on the root-fix head:

- source CSP surfaces use exactly one shared API-origin token and no hardcoded production/staging API identity;
- production-compatible build renders the production API into both meta CSP and generated `_headers`, while excluding staging;
- fixed staging build renders the staging API into both meta CSP and generated `_headers`, while excluding production;
- arbitrary preview remains fail-closed through the existing environment validator and the CSP plugin remains wired into that validation path.

## Authoritative fix

Both CSP source templates now contain exactly one shared token:

`__TRADING_JOURNAL_API_ORIGIN__`

`tools/frontend_csp.mjs` is the build-time renderer. It imports `DEPLOYMENT_CONTRACT` and `validateFrontendEnvironment` from the existing `frontend_environment_policy.mjs`; it does not maintain a second production/staging API map.

The renderer/plugin:

1. validates the frontend environment using the existing policy;
2. resolves staging to the reviewed staging API contract and production/local compatibility to the reviewed/explicit API origin;
3. transforms the `index.html` meta CSP;
4. transforms the copied build output `_headers` after Vite writes the bundle;
5. requires the token exactly once per CSP source and fails closed if the token is absent or survives rendering;
6. normalizes rendered CSP API targets to HTTP/HTTPS origins;
7. leaves the existing fixed-staging and arbitrary-preview branch policy untouched.

The existing `frontend_security_contracts.test.mjs` was updated at the same authority boundary: production Worker ownership is now `src/config.js` plus the machine-readable deployment contract, while CSP source templates are required to use the renderer token rather than preserve an obsolete production hardcode.

## Required invariants — implemented

- Production build output meta CSP and `_headers` both authorize the reviewed production API.
- Production output does not authorize the staging API.
- Staging build output meta CSP and `_headers` both authorize the fixed staging API.
- Staging output does not authorize the production API.
- No CSP API-origin token remains in build output.
- The machine-readable deployment contract remains the environment identity authority.
- Existing staging branch/API/OAuth fail-closed validation remains intact.
- Arbitrary Pages preview branches remain disabled.

## Scope actually changed before final evidence update

The root-fix commit changed exactly five files relative to the expected-red head:

1. `index.html` — one CSP API-origin substitution only;
2. `public/_headers` — one CSP API-origin substitution only;
3. `tools/frontend_csp.mjs` — new environment-aware renderer/plugin;
4. `vite.config.js` — imports and wires the CSP plugin while retaining the existing build-time environment validator;
5. `tests/frontend_security_contracts.test.mjs` — updates the old hardcoded-production ownership contract to the deployment-contract/token model.

The expected-red phase had already added:

- `tests/frontend_csp_environment.test.mjs`;
- this acceptance/evidence document.

A final independent PR diff must confirm the complete PR remains within these seven files and does not contain unrelated CSP/security hardening.

## Explicit non-goals

PR-10D3A deliberately does **not**:

- remove or tighten `unsafe-inline` / `unsafe-eval`; that remains later B14 CSP hardening;
- re-enable arbitrary PR/feature Pages previews;
- add wildcard frontend/API origins;
- modify Worker CORS behavior;
- modify Worker source or deploy a Worker;
- change D1 schema/data or migrations;
- change authentication/session architecture;
- modify PWA/service-worker lifecycle;
- change financial calculations, market data, dividend semantics, or ledger architecture.

Keeping `unsafe-inline` / `unsafe-eval` in this batch is intentional scope isolation, not a claim that those directives are desirable long term.

## Final acceptance before merge

PR-10D3A may be marked ready and merged only if:

1. the evidence-updated final head passes all three protected-main required checks;
2. the 137 frontend contracts and production build remain green;
3. the PR is up to date with current `main`;
4. independent diff review confirms both source CSP surfaces differ only in the API-origin token substitution, the renderer derives identity from the existing deployment contract, and `unsafe-inline` / `unsafe-eval` were not removed in this batch;
5. arbitrary preview remains disabled and no wildcard origin is introduced;
6. no Worker/CORS/D1/financial/PWA file is changed;
7. no blocking review thread remains;
8. merge uses the protected normal `merge` path without bypass.

After merge, post-merge main CI and Pages must be green before any staging branch update or staging Worker deployment begins.

## Rollback

Revert the eventual PR or restore from `backup-pre-10d3a-csp-d78bb3c`. This batch has no D1/Worker rollback because it changes frontend build-time CSP generation only.
