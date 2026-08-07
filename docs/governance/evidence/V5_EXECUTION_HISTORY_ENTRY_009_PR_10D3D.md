# V5 Execution History Entry 009 — PR-10D3D Production Activation Gate

Status: **IN PROGRESS**  
Local date: `2026-08-07` (UTC+8)

## Frozen baseline

- Authoritative pre-change `main`: `74fe12010ee3138e07a079a3d45271fddb80b536`.
- GitHub Release/tag checkpoint retained: `4.07.3` points to the same SHA.
- Runtime remains Worker `4.07`, API `2.60`, D1 Schema `2`.
- Open PRs at freeze: none.
- Canonical `.github/workflows/deploy-worker.yml` production runs before this batch: `0`.
- Recovery branch: `backup-pre-10d3d-74fe120`.
- Work branch: `pr-10d3d-production-activation-gate`.

No production deployment or data mutation was performed while opening this batch.

## Deep audit expansion

A new append-only audit supplements N01–N50 at:

`docs/audits/2026-08-07-production-activation-deep-audit.md`

New findings are N51–N62. The first implementation batch addresses the production activation control-plane root causes N51–N57 and deliberately carries N58–N62 forward rather than widening this PR into frontend configuration, governance-account changes, or OAuth synthetic production testing.

## Root-cause changes in D3D-A

1. Production Wrangler configuration becomes an explicit source of truth for environment identity, reviewed frontend origins, production Google OAuth client, required API secret, disabled preview URLs, and deliberate `keep_vars=false` semantics.
2. The production renderer and config checker bind those values to `config/deployment-environments.json` rather than duplicating unverified deployment truth.
3. Wrangler deployment uses `--strict`; conflicting unmanaged remote settings must fail closed instead of being silently overwritten.
4. Recovery Evidence Gate becomes executable CI/deployment policy. Schema 3+ is machine-blocked while the gate is `blocked`; Schema 2 remains deployable.
5. Deployment readiness changes from `observed_schema >= expected` to exact schema identity and adds exact runtime-service and health-source checks.
6. Remote D1 UUID and name are verified with the Cloudflare control plane before any remote migration/deploy step.
7. Production contract tests are included in the protected Worker CI check instead of depending only on a narrowly triggered auxiliary workflow.
8. The formal production audit derives service/release/API/schema from the checked-out manifest, requires system checks, and verifies production CORS allow plus staging/localhost rejection.
9. The deploy workflow performs a sanitized read-only public post-deploy contract audit after exact source propagation.

## Intentionally unchanged in D3D-A

- no migration files;
- no D1 schema or records;
- no canonical `worker.js` business/auth/financial behavior;
- no Python financial calculation engine;
- no frontend runtime or CSP templates;
- no Google OAuth secret rotation;
- no production Worker deployment;
- no production synthetic CRUD.

The current production frontend implicit fallback remains online until N58/N61 can be removed with authoritative Cloudflare Pages configuration evidence. This preserves zero-downtime behavior rather than deleting fallback first and discovering a missing Pages variable after deployment.

## Machine evidence

Pre-PR evidence:

`docs/governance/evidence/PR_10D3D_PREDEPLOY_AUDIT_2026-08-07.json`

Acceptance authority:

`docs/governance/PR_10D3D_PRODUCTION_ACTIVATION_GATE_ACCEPTANCE.md`

## Next evidence to append

After the PR exists, this entry must be supplemented by later evidence rather than rewritten to predict success:

- PR number and exact final reviewed head;
- required CI run IDs and conclusions;
- dedicated production-contract unit-workflow result;
- independent diff/security review result;
- merge SHA if and only if all gates pass;
- post-merge CI/Pages results;
- post-change recovery branch;
- remaining N58–N62 status.

Production deployment remains a later D3D-C action and must not be conflated with merging this control-plane batch.
