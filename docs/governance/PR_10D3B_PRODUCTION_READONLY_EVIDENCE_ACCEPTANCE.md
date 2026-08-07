# PR-10D3D-B Production Read-Only Evidence Acceptance

Status: **IN PROGRESS — READ-ONLY EVIDENCE ONLY; NO PRODUCTION DEPLOYMENT**

Baseline main: `6bf0f4002ac6ed7fead64d49084ac31c1d33fb39`  
Pre-change recovery: `backup-pre-10d3d-b-6bf0f40`  
Work branch: `pr-10d3d-b-production-readonly-evidence`  
Runtime baseline: Worker `4.07` / API `2.60` / D1 Schema `2`

## Purpose

D3D-B acquires authoritative production truth that D3D-A intentionally refused to guess. It must prove or falsify the remaining predeploy assumptions without changing production runtime, Cloudflare configuration, D1 data/schema, OAuth clients, or frontend content.

The batch addresses existing open findings rather than renumbering them:

- N58 — production frontend can still build through implicit legacy fallback;
- N61 — served production frontend/CSP identity lacks authoritative live proof;
- N64 — production D1 name/UUID identity is deliberately unverified.

N62 (staging-audience token rejection by production) remains a separate later read-only/fail-closed verification because it involves cross-environment OAuth credentials and must not be bundled into the first Cloudflare infrastructure evidence pass.

## Safety invariants

D3D-B evidence acquisition must satisfy all of the following:

1. no HTTP `POST`, `PUT`, `PATCH`, or `DELETE` to Cloudflare or application APIs;
2. no `wrangler deploy`;
3. no D1 migration command;
4. no production synthetic transaction;
5. no Worker secret mutation;
6. no Pages project/env mutation;
7. no OAuth client or secret mutation;
8. production Environment secrets are unavailable during PR execution;
9. the production Environment read-only job can execute only from protected `main` after the PR merges;
10. public production proof must pass before the protected Cloudflare control-plane job can become eligible;
11. only sanitized evidence is uploaded; raw Cloudflare control-plane responses are deleted in an `always()` cleanup step;
12. protected D1 ID/name secrets are not used as the authority for D1 identity.

## Evidence chain

### A. Public served truth — no secrets

Probe the live production Pages origin and production Worker public operational endpoints.

Required proof:

- served page origin is a reviewed production origin;
- response-header CSP exists, authorizes production API, rejects staging API, and has `connect-src`;
- meta CSP independently satisfies the same API-origin contract;
- same-origin served JavaScript contains the reviewed production API origin;
- served JavaScript contains the reviewed production Google client identity;
- served JavaScript does not contain the staging API origin;
- no unresolved `__TRADING_JOURNAL_API_ORIGIN__` token is served;
- production Worker `/api/version` is healthy and reports exact 40-character source SHA, runtime service `trading-journal-api`, Worker release `4.07`, API `2.60`, Schema `2`, and a Worker version ID;
- `/api/health` reports the same source SHA, database/schema checks `ok`, and exact observed Schema `2`.

Only hashes, booleans, asset URLs, runtime identity and non-secret metadata may be archived. Full JavaScript bodies are not archived.

### B. Cloudflare control-plane truth — production Environment, read-only

This job may run only after merge to protected `main` and only after public proof passes.

It uses the existing production Environment reviewer gate because it requires Cloudflare account read credentials. Approval authorizes only read-only evidence acquisition, not deployment.

Required proof:

1. obtain live Worker version ID from public `/api/version`;
2. query that exact Cloudflare Worker version detail;
3. locate the deployed `DB` D1 resource binding on that exact live version;
4. derive the actual bound D1 UUID from the live Worker version, not from a GitHub D1 identity secret;
5. query Cloudflare D1 metadata for that exact bound UUID;
6. verify D1 metadata UUID equals the live Worker binding UUID;
7. prove the D1 name is not the reviewed staging D1 name;
8. query the production Cloudflare Pages project;
9. require production `VITE_API_URL` to be exact reviewed plain text;
10. require production `VITE_GOOGLE_CLIENT_ID` to be exact reviewed plain text;
11. query production Pages deployments and explicitly select the newest production deployment by `created_on`, never by array order;
12. retain production Pages commit/deployment identity for later served-build provenance analysis.

Sanitized D1 evidence stores the database name plus SHA-256 of the UUID, not the raw UUID.

## One-shot trigger

`config/production-predeploy-evidence-request.json` is the reviewed one-shot trigger. The protected Cloudflare job is eligible only on a `push` to `main` in which this request file changes.

Ordinary later main pushes must not repeatedly request production Environment approval.

The request explicitly states:

- `writes_allowed=false`;
- `production_deployment_allowed=false`;
- `d1_migration_allowed=false`;
- `synthetic_production_write_allowed=false`.

## PR merge gate

Before merging D3D-B evidence infrastructure:

1. required `Python tests` PASS on exact final head;
2. required `Worker security and deployment tests` PASS on exact final head;
3. required `Frontend contracts and build` PASS on exact final head;
4. `Production Predeploy Read-Only Evidence / Verify public production served truth` executes on the PR;
5. Cloudflare control-plane job is **SKIPPED** on PR events;
6. any public production mismatch is preserved and root-caused rather than bypassed or tolerance-relaxed;
7. independent diff/security review confirms the workflow contains no mutation path and raw control-plane data cannot become an artifact;
8. normal protected merge only; no bypass.

## Post-merge gate

After merge, the one-shot request-file push may create exactly one main evidence run:

1. public served truth must PASS automatically;
2. only then may `cloudflare-control-plane-proof` enter `Waiting for approval` on the `production` Environment;
3. only at that point is a user approval request appropriate;
4. after approval, the job performs Cloudflare GET/read operations only;
5. a permissions or contract failure is retained as evidence and does not trigger a write-based workaround.

## Result handling

D3D-B evidence does not automatically set production runtime D1 identity to `verified` and does not automatically set production activation authority to `ready`.

If authoritative evidence passes, a later isolated reviewed runtime-identity PR must copy only the proven D1 database name and SHA-256 UUID fingerprint into the runtime contract. Protected-main activation evidence must still separately authorize a known immutable runtime SHA.

If evidence fails, the failed state determines the next root-cause remediation batch. Production deployment remains blocked throughout.

## Schema rule

Recovery Evidence Gate remains `blocked`; Schema 3 remains forbidden regardless of D3D-B outcome.
