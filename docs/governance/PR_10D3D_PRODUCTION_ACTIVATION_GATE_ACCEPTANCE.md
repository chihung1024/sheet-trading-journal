# PR-10D3D Production Activation Gate Acceptance

Status: **IN PROGRESS — DO NOT DEPLOY PRODUCTION YET**

Baseline: `74fe12010ee3138e07a079a3d45271fddb80b536`  
Pre-change recovery: `backup-pre-10d3d-74fe120`  
Work branch: `pr-10d3d-production-activation-gate`  
Worker/API/Schema baseline: `4.07 / 2.60 / 2`

## Scope

This batch hardens deployment/configuration/audit controls only. It does not introduce Schema 3, change financial calculations, change transaction data, deploy production, or perform a production synthetic write.

## Acceptance matrix

| ID | Contract | Current state |
|---|---|---|
| A | Production Worker config explicitly declares production environment identity | Implemented; final exact-head CI pending |
| B | Production CORS source-of-truth authorizes only reviewed production frontend origins | Implemented; live proof pending first deploy |
| C | Staging and localhost origins are rejected by live production CORS audit | Implemented in audit; live proof pending |
| D | Production Google OAuth client is explicit and tied to reviewed environment contract | Implemented statically; live cross-audience rejection remains N62 |
| E | Required Worker secret is declared and missing secret fails deploy | Implemented; first deploy proof pending |
| F | Wrangler dashboard-var drift cannot silently become verified production configuration | Implemented through explicit vars, `keep_vars=false`, renderer checks, strict deploy |
| G | Protected D1 values are checked against live Cloudflare D1 before migration | Implemented; independent production D1 authority intentionally remains unverified/N64 |
| H | Source identity is exact lowercase 40-character SHA reachable from protected main | Implemented |
| I | Runtime service identity matches `worker-manifest.json` | Implemented; live proof pending |
| J | Release/API/schema expectations derive from manifest, not workflow caller input | Implemented |
| K | Live observed D1 schema must equal expected schema during activation | Implemented |
| L | Recovery Evidence Gate machine-blocks Schema 3+ while status is blocked | Implemented and regression-tested |
| M | Production contract tests execute inside required Worker CI | Implemented |
| N | Formal production audit requires system credential rather than accepting skipped checks | Implemented; live audit pending |
| O | Post-deploy verification checks exact source/service/version/schema, anonymous auth and CORS | Implemented in workflow; live proof pending |
| P | Production frontend served CSP and Cloudflare Pages explicit variables are authoritatively proven | **OPEN — PR-10D3D-B / N58/N61** |
| Q | Schema 3+ Recovery Gate references real structured evidence records, not non-empty strings | Implemented under N63 |
| R | Non-secret production activation preflight finishes before GitHub production reviewer gate | Implemented under N65 |
| S | Production D1 name/UUID authority is derived from read-only external proof rather than a test fixture/convention | **OPEN — PR-10D3D-B / N64; current identity deliberately unverified** |
| T | Production deployment is impossible while frontend/D1 activation authority is incomplete | Implemented: `config/production-activation-authority.json` remains `blocked` |
| U | Runtime source and later protected-main activation authority are independent, avoiding SHA self-reference | Implemented under N66 |
| V | Protected-main activation authority is freshly re-fetched before reviewer/mutation boundaries | Implemented under N67 |
| W | Exact runtime source itself must contain verified production D1 name + UUID fingerprint before reviewer | Implemented under N68; current D3D-A source intentionally fails this deployability check |

## Merge gate for PR-10D3D-A

Before merge:

1. required `Python tests` PASS on the final reviewed head;
2. required `Worker security and deployment tests` PASS on the final reviewed head;
3. required `Frontend contracts and build` PASS on the final reviewed head;
4. dedicated `Production Contract Audit / Verify audit implementation` PASS when triggered;
5. diff/security review confirms no D1 migration, Worker financial/runtime business logic, production frontend runtime, or production deployment occurred;
6. review confirms inferred/unverified external identities are not promoted to authority;
7. review confirms current D3D-A source is intentionally non-deployable and only D3D-B can establish verified production D1 runtime identity;
8. review threads are zero or explicitly resolved;
9. normal protected merge only; no bypass.

## Production deployment gate

Even after this PR merges, production deployment remains forbidden. Two independent gates intentionally remain closed:

1. the exact D3D-A runtime source has `production.d1_identity_status = "unverified"`, so `verify_production_runtime_preconditions.mjs` fails before reviewer approval;
2. `config/production-activation-authority.json` is `blocked`, so the protected-main control plane also refuses activation.

PR-10D3D-B (or an equivalent isolated predeploy-proof batch) must first:

- obtain authoritative production frontend explicit environment configuration evidence;
- obtain authoritative served production frontend contract/CSP evidence;
- obtain authoritative read-only Cloudflare production D1 name/UUID evidence;
- merge the verified production D1 database name and UUID SHA-256 fingerprint into a normally reviewed runtime source SHA;
- pass protected CI for that immutable runtime SHA;
- then append structured protected-main production-activation evidence that explicitly authorizes that already-known runtime SHA.

Only after both the runtime preconditions and protected-main activation authority independently pass may the workflow reach the production reviewer gate.

The eventual production deployment must:

- use the exact source SHA authorized by the reviewed production activation authority;
- use a runtime source whose own production D1 identity is `verified` and matches the externally proven name/UUID fingerprint;
- remain Schema 2 while Recovery Evidence Gate is blocked;
- complete non-secret runtime + control-plane preflight before requesting user approval;
- enter GitHub `production` Environment reviewer approval normally;
- not use admin bypass;
- re-fetch and re-verify protected-main activation authority after reviewer approval and again immediately before each production mutation boundary;
- verify exact D1 UUID/name against both runtime-reviewed authority and live Cloudflare control-plane identity before any remote migration;
- perform only additive/no-op migrations permitted by the current manifest/gate;
- verify exact runtime source/service/release/API/schema/Worker version;
- verify production CORS allowlist and staging/localhost rejection;
- perform no synthetic production write as part of readiness proof;
- archive sanitized machine evidence and exact run/deployment IDs.

## Rollback

Before merge: abandon/revert the work branch; `backup-pre-10d3d-74fe120` is the exact Git recovery point.

After merge but before production deploy: revert PR-10D3D-A through a protected PR. No Worker/D1/data rollback is required because this batch itself does not deploy.

After future production deploy: use the separately documented exact prior production source/version recovery reference; do not infer rollback safety from Git branch names or Cloudflare Time Travel availability alone.
