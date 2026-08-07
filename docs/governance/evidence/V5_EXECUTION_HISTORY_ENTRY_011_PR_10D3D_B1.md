# V5 Execution History — Entry 011 — PR-10D3D-B1 Read-only Production Identity Evidence

- Start time: `2026-08-07T16:50:00+08:00`
- Baseline main: `3024dde0ea148a3997782614da5ca8100462d010`
- Baseline post-merge CI: `31163229884` / CI #303 / SUCCESS
- Baseline post-merge Pages: `31163228909` / Pages #1417 / SUCCESS
- Pre-change recovery: `backup-pre-10d3d-b-3024dde`
- Work branch: `pr-10d3d-b-production-identity-evidence`
- Runtime: Worker `4.07`, API `2.60`, Schema `2`
- Runtime/data/schema mutation in this entry: **none**

## Why B1 exists

D3D-A intentionally closed with production activation still blocked because production D1 identity and Cloudflare Pages explicit production configuration had not been proven by an authoritative read-only source. Repository values and protected secrets must not be allowed to prove themselves.

## Design decisions

B1 introduces a reviewer-protected, GET-only evidence workflow. It obtains:

1. production D1 name/UUID from Cloudflare D1 control plane using the protected UUID only as a lookup key;
2. production Pages project/deployment configuration from Cloudflare Pages control plane;
3. live primary Pages HTML and CSP response surfaces from the deployed frontend.

The D1 name secret is deliberately excluded from evidence collection. The resulting artifact stores only the observed D1 name and SHA-256(UUID), plus non-secret pass/fail metadata.

## Safety boundary

B1 is forbidden from:

- Worker deployment;
- D1 query, migration, export, import, restore or write;
- Cloudflare Pages update, purge, deploy or variable mutation;
- POST/PATCH/PUT/DELETE Cloudflare API methods;
- Schema 3;
- financial calculation changes;
- production synthetic CRUD.

The production workflow job still uses the existing GitHub `production` Environment reviewer gate because the required Cloudflare credentials live there. Reviewer approval authorizes **read-only evidence collection only**, not deployment.

## Repository changes prepared before PR

- `tools/collect_production_identity_evidence.mjs`
- `.github/workflows/production-identity-evidence.yml`
- `tests/production_identity_evidence.test.mjs`
- `package.json` required Worker CI wiring
- `docs/governance/PR_10D3D_B_PRODUCTION_IDENTITY_EVIDENCE_ACCEPTANCE.md`
- `docs/governance/evidence/PR_10D3D_B1_PREAUDIT_2026-08-07.json`
- this append-only entry

## Current state

- protected PR CI: pending;
- independent diff/security review: pending;
- B1 merge: pending;
- production read-only workflow dispatch: pending;
- production reviewer approval: pending;
- authoritative production artifact: pending;
- B2 activation authority update: blocked on B1 PASS;
- production deployment: still forbidden.

Earlier D3D-A evidence and failures are not edited or replaced by this entry.
