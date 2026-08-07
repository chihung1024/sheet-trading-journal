# PR-10D3A — Environment-Aware CSP Acceptance

Status: CLOSED / PASS  
Baseline: `d78bb3c7aadf1c3e3d9078be304d410d70a96103`  
Pre-change recovery branch: `backup-pre-10d3a-csp-d78bb3c`  
Work branch: `pr-10d3a-environment-aware-csp`  
PR: `#120`  
Final reviewed head: `c0bfc64cd0083452272bdc8ea21364b277579b5f`  
Merge SHA: `61839eff4eae7102b4b4be32eb606008fdd246c8`  
Post-change recovery branch: `backup-post-10d3a-61839ef`  
Machine-readable closeout: `docs/governance/evidence/PR_10D3A_CLOSEOUT_2026-08-07.json`

## Purpose

Close audit finding N24: the frontend runtime environment could be staging while both CSP enforcement surfaces still hardcoded the production Worker origin. Because browsers enforce the intersection of the HTML meta CSP and Pages response-header CSP, a staging bundle could be valid at build/CORS level yet fail in the browser.

## Reconfirmed baseline divergence

The reviewed deployment contract already defined:

- production API: `https://journal-backend.chired.workers.dev`;
- staging API: `https://journal-backend-staging.chired.workers.dev`;
- fixed staging Pages branch: `staging`;
- arbitrary Pages preview branches: disabled.

On the baseline, however, `index.html` and `public/_headers` both hardcoded the production API in `connect-src` while the existing frontend environment validator correctly accepted the fixed staging API.

## Test-first chronology

### Phase A — expected red

- Head: `519d40a6569dadb091f2d194119a33c8a0daf928`.
- CI: `31145425753`.
- Python: PASS.
- Worker/security/D1: PASS.
- Frontend: `134/137` PASS, three intentional CSP failures.

Expected failures proved:

1. source CSP surfaces had no shared API-origin token because they still hardcoded an environment identity;
2. a real fixed-staging Vite build produced a meta CSP that did not authorize the staging Worker, directly reproducing N24;
3. Vite had no environment-aware CSP plugin wiring.

The production-compatible build already passed on the baseline, isolating the defect to environment separation rather than generic production build failure.

### Phase B — authoritative root fix

- Root-fix head: `917ca6a7515cdb6670963e31438eb649bdd23095`.
- CI: `31145761413`.
- Frontend: `137/137` PASS plus production Vite build PASS.
- Python: PASS.
- Worker/security/D1: PASS.

The CSP integration tests proved:

- production output meta CSP + generated `_headers` authorize production and exclude staging;
- fixed staging output meta CSP + generated `_headers` authorize staging and exclude production;
- no token survives build output;
- arbitrary preview remains fail-closed.

### Phase C — final evidence head and independent review

- Final reviewed head: `c0bfc64cd0083452272bdc8ea21364b277579b5f`.
- Final PR CI: `31145840067`, all three protected-main required checks PASS.
- Independent AI review id: `4879839767`.
- Changed files: exactly seven.
- Review threads: zero.
- `main` was unchanged from the PR base at final review.

Independent review verified:

- `index.html` changed exactly one CSP `connect-src` item: production Worker URL → `__TRADING_JOURNAL_API_ORIGIN__`;
- `public/_headers` made the same one-item substitution;
- `unsafe-inline` and `unsafe-eval` remained intentionally unchanged for later B14 hardening;
- no wildcard origin was introduced;
- `config/deployment-environments.json` and `tools/frontend_environment_policy.mjs` were not modified;
- the renderer imports the existing `DEPLOYMENT_CONTRACT` and `validateFrontendEnvironment` rather than maintaining a second environment map;
- no Worker/CORS, D1/migration, auth-session, PWA/service-worker, market-data, ledger, dividend or financial-calculation file changed.

## Authoritative fix

Both CSP source templates now contain exactly one token:

`__TRADING_JOURNAL_API_ORIGIN__`

`tools/frontend_csp.mjs` resolves the token from the existing reviewed environment contract/policy. The Vite plugin:

1. validates environment identity through `validateFrontendEnvironment`;
2. resolves staging to the fixed staging API and production to a reviewed production API origin;
3. renders the HTML meta CSP;
4. renders the generated Pages `_headers` after bundle output;
5. requires exactly one token per source and fails closed if it is missing or survives rendering;
6. normalizes the API target to an HTTP/HTTPS origin;
7. leaves the existing fixed-staging/arbitrary-preview policy intact.

The old frontend security contract was updated at the same authority boundary: CSP source templates must use the token rather than preserve an obsolete hardcoded production endpoint.

## Merge and post-merge acceptance

PR `#120` merged through the normal protected path using merge method `merge` and no bypass.

Merge SHA:

`61839eff4eae7102b4b4be32eb606008fdd246c8`

Post-merge verification:

- main CI `31146068529`: Frontend PASS, Python PASS, Worker/D1 PASS;
- production Pages build/deployment `31146067097`: PASS;
- post-change checkpoint: `backup-post-10d3a-61839ef`.

No staging branch update or staging Worker deployment occurred before these production-main checks passed.

## Explicit non-goals / carried-forward work

PR-10D3A deliberately did **not**:

- remove/tighten `unsafe-inline` or `unsafe-eval` — later B14;
- re-enable arbitrary PR/feature Pages previews;
- add wildcard frontend/API origins;
- modify Worker CORS or Worker source;
- modify D1 schema/data/migrations;
- redesign authentication/session architecture;
- modify PWA/service-worker lifecycle;
- modify financial calculations, market data, dividend semantics or ledger architecture.

N24 is closed at the build-contract layer. Browser-level staging OAuth/CRUD verification remains the later PR-10D3C acceptance gate after the fixed staging frontend and Worker are activated on an exact reviewed SHA.

## Recovery

To roll back PR-10D3A repository behavior, revert PR `#120` or restore/compare against `backup-pre-10d3a-csp-d78bb3c`. The exact accepted post-change repository state is preserved at `backup-post-10d3a-61839ef`. No D1 or Worker rollback is required for PR-10D3A itself.

## Closeout result

**PR-10D3A is CLOSED / PASS.** Expected-red reproduction, real production/staging build proof, independent review, protected merge, post-merge CI/Pages verification, and rollback checkpoints are retained. The next step is fixed-staging activation and exact-SHA staging Worker deployment; production Worker deployment remains later PR-10D4.
