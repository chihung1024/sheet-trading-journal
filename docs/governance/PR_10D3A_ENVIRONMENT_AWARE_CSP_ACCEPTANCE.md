# PR-10D3A — Environment-Aware CSP Acceptance

Status: TEST-FIRST / EXPECTED RED  
Baseline: `d78bb3c7aadf1c3e3d9078be304d410d70a96103`  
Recovery branch: `backup-pre-10d3a-csp-d78bb3c`  
Work branch: `pr-10d3a-environment-aware-csp`

## Purpose

Close audit finding N24: the frontend runtime environment can be staging while both CSP enforcement surfaces still hardcode the production Worker origin. Because the browser enforces the intersection of the HTML meta CSP and Cloudflare Pages response-header CSP, successful build/CORS checks do not prove that a staging browser can call the staging Worker.

## Reconfirmed baseline divergence

The machine-readable deployment contract already defines distinct identities:

- production API: `https://journal-backend.chired.workers.dev`;
- staging API: `https://journal-backend-staging.chired.workers.dev`;
- fixed staging Pages branch: `staging`;
- arbitrary Pages preview branches: disabled.

However:

- `index.html` meta CSP `connect-src` hardcodes the production API;
- `public/_headers` CSP `connect-src` hardcodes the production API;
- the Vite environment validator correctly accepts the reviewed staging API but does not render that validated identity into either CSP surface.

Result: a staging bundle can contain `VITE_API_URL=staging` while browser CSP still authorizes only the production Worker.

## Authoritative fix

Use one CSP API-origin token in both source templates and resolve it at Vite build/serve time from the same `config/deployment-environments.json` contract already used by the frontend environment policy.

The Vite CSP plugin must:

1. resolve the API origin from the validated environment context;
2. transform the `index.html` meta CSP;
3. transform the copied build output `_headers` file;
4. fail if the token is missing or survives the build;
5. keep production fallback compatibility for the existing main Pages build;
6. use the fixed staging API for the fixed staging build;
7. preserve arbitrary-preview fail-closed behavior through the existing environment validator.

## Required invariants

- Production build output meta CSP and `_headers` both authorize the reviewed production API.
- Production output does not authorize the staging API.
- Staging build output meta CSP and `_headers` both authorize the fixed staging API.
- Staging output does not authorize the production API.
- No CSP API-origin token remains in build output.
- The same machine-readable deployment contract is the origin authority; do not create a second production/staging API mapping.
- Existing staging branch/API/OAuth fail-closed validation remains intact.
- Arbitrary Pages preview branches remain disabled.

## Explicit non-goals

PR-10D3A must **not**:

- remove or tighten `unsafe-inline` / `unsafe-eval`; that is later B14 CSP hardening;
- re-enable arbitrary PR/feature Pages previews;
- add wildcard frontend/API origins;
- modify Worker CORS behavior;
- modify Worker source or deploy a Worker;
- change D1 schema/data or migrations;
- change authentication/session architecture;
- modify PWA/service-worker lifecycle;
- change financial calculations, market data, dividend semantics, or ledger architecture.

Keeping `unsafe-inline` / `unsafe-eval` in this batch is intentional scope isolation, not a claim that the directives are desirable long term.

## Test-first procedure

1. Add regression tests that build both production-compatible and fixed-staging frontend outputs.
2. On the baseline, retain an expected-red CI showing that staging output still carries production CSP identity and source templates are hardcoded.
3. Implement the CSP renderer/plugin at the deployment-environment boundary.
4. Re-run the same tests plus all protected-main CI checks.
5. Independently review the final diff, especially the two CSP surfaces, environment validator, arbitrary-preview policy, and absence of unrelated hardening.
6. Merge normally without bypass.
7. Verify post-merge main CI/Pages before any staging branch/deployment action.

## Rollback

Revert the eventual PR or restore from `backup-pre-10d3a-csp-d78bb3c`. This batch has no D1/Worker rollback because it changes frontend build-time CSP generation only.
