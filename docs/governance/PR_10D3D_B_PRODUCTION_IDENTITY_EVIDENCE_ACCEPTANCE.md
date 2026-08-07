# PR-10D3D-B Production Identity Evidence Acceptance

Status: **IN PROGRESS — PRODUCTION ACTIVATION REMAINS BLOCKED**

Baseline: `3024dde0ea148a3997782614da5ca8100462d010`  
Pre-change recovery: `backup-pre-10d3d-b-3024dde`  
Work branch: `pr-10d3d-b-production-identity-evidence`  
Worker/API/Schema: `4.07 / 2.60 / 2`

## Purpose

D3D-B must replace guessed/self-referential production identity assumptions with authoritative read-only evidence before production activation can be unlocked.

This batch is intentionally split:

1. **B1 — evidence collector:** merge and execute a GET-only, reviewer-protected audit. No production runtime, D1, Pages, OAuth, or data mutation is allowed.
2. **B2 — authority commit:** only after B1 returns a sanitized PASS artifact may verified D1 identity and production frontend evidence be committed into immutable runtime/control-plane authority through a separate protected PR.

## B1 evidence requirements

### Production D1 identity

- Cloudflare API request must be `GET /accounts/{account_id}/d1/database/{database_id}` only.
- The requested UUID comes from the protected production D1 ID; the database **name authority must come from the Cloudflare response**, not `CLOUDFLARE_D1_DATABASE_NAME`.
- Observed UUID must equal the protected ID.
- Observed database name must be present and must differ from reviewed staging D1 name.
- Artifact stores the D1 name and SHA-256(UUID), not the raw UUID/account/token.

### Cloudflare Pages explicit production environment

- Cloudflare API request must be `GET /accounts/{account_id}/pages/projects/{project_name}` only.
- Project/subdomain and production branch must match the reviewed production frontend and protected `main`.
- Production deployment config must explicitly contain:
  - `VITE_DEPLOY_ENV=production`;
  - exact reviewed `VITE_API_URL`;
  - exact reviewed `VITE_GOOGLE_CLIENT_ID`.
- A missing variable is a failure; legacy production fallback does not count as evidence.

### Canonical deployment and live CSP

- Cloudflare Pages canonical deployment must identify production, main branch, a valid Git commit hash, and successful latest stage.
- Live primary production Pages origin must return HTTP 200.
- Live response must contain both CSP response header and meta CSP.
- Both CSP surfaces must allow the reviewed production API and reject the staging API.

## Security / no-mutation invariant

The B1 workflow:

- uses `permissions: contents: read`;
- runs production evidence collection under the existing `production` Environment reviewer gate;
- accepts only an exact current protected-main SHA;
- performs no Worker deploy;
- performs no D1 query/migration/export/import/restore;
- performs no Pages update/purge/deploy;
- performs no POST/PATCH/PUT/DELETE Cloudflare API request;
- does not request or output `CLOUDFLARE_D1_DATABASE_NAME`;
- uploads a sanitized JSON artifact only.

## Current acceptance matrix

| Check | State |
|---|---|
| Recovery branch created from exact baseline | PASS |
| B1 collector implemented | IMPLEMENTED / CI PENDING |
| B1 workflow is reviewer-protected and GET-only | IMPLEMENTED / CI PENDING |
| B1 tests are included in required Worker CI | IMPLEMENTED / CI PENDING |
| Protected PR CI | PENDING |
| Independent diff/security review | PENDING |
| B1 PR merge | PENDING |
| Read-only production workflow dispatch | PENDING |
| Production reviewer approval for read-only audit | PENDING |
| Sanitized B1 artifact | PENDING |
| Production D1 authoritative identity | PENDING |
| Cloudflare Pages explicit variables | PENDING |
| Live Pages/CSP contract | PENDING |
| B2 immutable runtime identity PR | BLOCKED ON B1 |
| Production activation authority | BLOCKED |
| Production Worker deployment | FORBIDDEN IN B1 |

## External API authority

Cloudflare API contracts verified during design:

- D1 Get Database: `GET /accounts/{account_id}/d1/database/{database_id}`; accepted permission includes D1 Read.
- Pages Get Project: `GET /accounts/{account_id}/pages/projects/{project_name}`; accepted permission includes Pages Read.

## Explicit carry-forward

N62 (valid staging-audience Google token rejected by production) still requires a valid short-lived staging-audience ID token. B1 does not weaken or fabricate that proof. It remains a separate live OAuth evidence item and cannot be satisfied by an invalid synthetic token.

## Rollback

Before B1 workflow dispatch, rollback is a normal protected revert/abandon of this repository-only batch. There is no production data/runtime rollback because B1 is read-only by contract.
