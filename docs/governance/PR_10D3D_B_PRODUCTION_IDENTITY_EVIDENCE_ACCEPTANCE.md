# PR-10D3D-B Production Identity Evidence Acceptance

Status: **IN PROGRESS — PRODUCTION ACTIVATION REMAINS BLOCKED**

Original B1 baseline: `3024dde0ea148a3997782614da5ca8100462d010`  
Current synchronized main baseline: `6bf0f4002ac6ed7fead64d49084ac31c1d33fb39`  
Pre-change recovery: `backup-pre-10d3d-b-3024dde`  
Work branch: `pr-10d3d-b-production-identity-evidence`  
Worker/API/Schema: `4.07 / 2.60 / 2`

## Purpose

D3D-B must replace guessed/self-referential production identity assumptions with authoritative read-only evidence before production activation can be unlocked.

This batch is intentionally split:

1. **B1 — evidence collector:** merge and execute a GET-only, reviewer-protected audit. No production runtime, D1, Pages, OAuth, or data mutation is allowed.
2. **B2 — authority commit:** only after B1 returns a sanitized PASS artifact may verified D1 identity and production frontend evidence be committed into immutable runtime/control-plane authority through separate protected PRs.

## B1 evidence requirements

### Production D1 identity — three-way authority check

A protected D1 UUID alone must not prove itself. B1 requires all three independent observations to agree:

1. the protected production D1 UUID is used only as the lookup key;
2. Cloudflare D1 control plane returns that UUID and its database name;
3. the latest Cloudflare Worker deployment actively serving production traffic is enumerated, and **every traffic-bearing Worker version** must bind the canonical manifest D1 binding (`DB`) to that same UUID.

Additional requirements:

- Cloudflare D1 request is `GET /accounts/{account_id}/d1/database/{database_id}` only;
- production Worker deployment request is `GET /accounts/{account_id}/workers/scripts/{script_name}/deployments` only;
- every active version is inspected through `GET /accounts/{account_id}/workers/scripts/{script_name}/versions/{version_id}`;
- database **name authority comes from the Cloudflare D1 response**, never `CLOUDFLARE_D1_DATABASE_NAME`;
- observed database name must be present and must differ from the reviewed staging D1 name;
- mixed gradual deployments fail closed if even one traffic-bearing version binds another D1;
- artifact stores D1 name and SHA-256(UUID), not raw UUID/account/token or Worker version IDs.

### Cloudflare Pages explicit production environment

- Cloudflare request is `GET /accounts/{account_id}/pages/projects/{project_name}` only.
- Project/subdomain and production branch must match the reviewed production frontend and protected `main`.
- Production deployment config must explicitly contain:
  - `VITE_DEPLOY_ENV=production`;
  - exact reviewed `VITE_API_URL`;
  - exact reviewed `VITE_GOOGLE_CLIENT_ID`.
- A missing variable is a failure; legacy production fallback does not count as evidence.

### Canonical deployment and live CSP

- Cloudflare Pages canonical deployment must identify production and protected `main`.
- Its commit hash must equal the **exact audited current-main SHA**, not merely be a valid Git hash.
- Canonical deployment latest stage must be successful.
- Live primary production Pages origin must return HTTP 200 without silently following a redirect to another origin.
- Live response must contain both CSP response header and meta CSP.
- Both CSP surfaces must allow the reviewed production API and reject the staging API.

## Security / no-mutation invariant

The B1 workflow:

- uses `permissions: contents: read`;
- runs production evidence collection under the existing `production` Environment reviewer gate;
- accepts only an exact SHA that still equals current protected-main HEAD after reviewer approval;
- performs no Worker deployment;
- performs no D1 query/migration/export/import/restore;
- performs no Pages update/purge/deploy;
- performs no POST/PATCH/PUT/DELETE Cloudflare API request;
- does not request or output `CLOUDFLARE_D1_DATABASE_NAME`;
- uploads a sanitized JSON artifact only.

The collector sends the Cloudflare bearer token only to fixed `https://api.cloudflare.com/client/v4/accounts/...` GET endpoints. The live Pages request carries no Cloudflare authorization header.

## Failure-history evidence

The B1 PR deliberately retains failed candidate runs instead of rerunning them into apparent success. Machine-readable root-cause history is stored at:

`docs/governance/evidence/PR_10D3D_B1_FAILURE_HISTORY_2026-08-07.json`

Recorded defects include:

- an initial JavaScript parser error;
- missing workflow registration in the fail-closed action-pin inventory;
- a CSP parser bug caused by treating any single/double quote as the closing delimiter rather than matching the opening quote.

All repairs generated new candidate heads and new CI runs.

## Current acceptance matrix

| Check | State |
|---|---|
| Recovery branch created from exact original baseline | PASS |
| Branch synchronized to later governance-only main without history rewrite | PASS |
| B1 collector implemented | PASS / FINAL CI RE-RUN PENDING AFTER EVIDENCE DOC UPDATE |
| D1 secret ↔ D1 API ↔ all active Worker versions triangulation | PASS UNIT CONTRACT / LIVE PENDING |
| Exact Pages canonical deployment SHA contract | PASS UNIT CONTRACT / LIVE PENDING |
| B1 workflow is reviewer-protected and GET-only | PASS UNIT CONTRACT / LIVE PENDING |
| B1 tests included in required Worker CI | PASS |
| Supply-chain workflow inventory updated without weakening policy | PASS |
| Protected PR CI | PREVIOUS TECHNICAL HEAD PASS (`31164854157`); FINAL HEAD PENDING |
| Production Identity Evidence unit workflow | PREVIOUS TECHNICAL HEAD PASS (`31164854124`); FINAL HEAD PENDING |
| Independent exact-head diff/security review | PENDING FINAL HEAD |
| B1 PR merge | PENDING |
| Read-only production workflow dispatch | PENDING MERGE |
| Production reviewer approval for read-only audit | PENDING DISPATCH |
| Sanitized B1 artifact | PENDING |
| Production D1 authoritative identity | PENDING LIVE EVIDENCE |
| Cloudflare Pages explicit variables | PENDING LIVE EVIDENCE |
| Live Pages/CSP contract | PENDING LIVE EVIDENCE |
| B2 immutable runtime identity PR | BLOCKED ON B1 LIVE PASS |
| Production activation authority | BLOCKED |
| Production Worker deployment | FORBIDDEN IN B1 |

## External API authority

Cloudflare API contracts verified during design:

- D1 Get Database: `GET /accounts/{account_id}/d1/database/{database_id}`; accepted permission includes D1 Read.
- Workers List Deployments: `GET /accounts/{account_id}/workers/scripts/{script_name}/deployments`; the first deployment is the latest deployment actively serving traffic.
- Workers Get Version Detail: `GET /accounts/{account_id}/workers/scripts/{script_name}/versions/{version_id}`; version resources include D1 binding `database_id`.
- Pages Get Project: `GET /accounts/{account_id}/pages/projects/{project_name}`; accepted permission includes Pages Read.

## Explicit carry-forward

N62 (valid staging-audience Google token rejected by production) still requires a valid short-lived staging-audience ID token. B1 does not weaken or fabricate that proof. It remains a separate live OAuth evidence item and cannot be satisfied by an invalid synthetic token.

## Rollback

Before B1 workflow dispatch, rollback is a normal protected revert/abandon of this repository-only batch. There is no production data/runtime rollback because B1 is read-only by contract.
