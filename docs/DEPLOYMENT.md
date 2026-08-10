# Deployment

This document is the **current deployment navigation point** for the repository.

Historical runbooks, acceptance records and audit evidence are retained for rationale/forensics and must not override current machine-readable contracts, workflows, tests or the current execution handoff.

Current execution state:

- `to_do_update_list.md`
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — current Gate E / E1a rollout authority

---

## 1. Runtime identity

Canonical runtime identity is defined by `worker-manifest.json`:

- service: `journal-backend`;
- runtime service metadata: `trading-journal-api`;
- deployment entry: `worker-entry.js`;
- canonical Worker source: `worker.js`;
- Worker release: `4.07`;
- API version: `2.60`;
- D1 schema version: `2`;
- D1 binding: `DB`.

If these values change, use the current manifest/code rather than copying version numbers from old audit, release or recovery documents.

---

## 2. Current production activation state

Production activation remains intentionally fail closed.

At the 2026-08-10 Gate-E re-baseline:

- E1a-A compatibility code is merged to protected `main` at `c312408fec7a27a7b713ad5da79bf93bce62481f`;
- post-main CI #560 passed;
- canonical `Deploy Worker` workflow has not yet run for E1a-A;
- canonical `Production Identity Evidence` workflow has not yet had a live `workflow_dispatch` run;
- production D1 identity in `config/deployment-environments.json` is still `unverified` with null name/fingerprint;
- `config/production-activation-authority.json` is still `blocked`.

Therefore **do not dispatch `Deploy Worker` merely because E1a-A is merged**. The workflow is expected to reject the current state during non-secret preflight.

This is a safe control-plane state, not an application incident.

---

## 3. Production source-of-truth hierarchy

When deployment-related documents disagree, use this order:

1. current protected `main` and current GitHub Actions state;
2. `worker-manifest.json`, `config/deployment-environments.json`, `config/production-activation-authority.json`, `wrangler.toml` and current runtime source;
3. current deployment/evidence workflows, verifier tools and tests;
4. `to_do_update_list.md` for current execution state;
5. `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` for current E1a sequencing;
6. this document for deployment navigation;
7. D3D acceptance/audit/evidence for historical rationale;
8. superseded/archived runbooks only for forensic context.

`docs/governance/V5_CURRENT_HANDOFF.md` is a historical D3D closeout/navigation artifact while Gate E is active; it must not override the current Gate-E handoff.

---

## 4. Production activation model: runtime SHA vs authority SHA

The production workflow intentionally separates immutable runtime source from the latest protected-main control plane.

Define:

- **R — runtime source SHA:** exact deployable commit containing the Worker runtime/config contract to activate;
- **A — activation-authority SHA:** later protected-main commit containing reviewed evidence that explicitly authorizes `R`.

The valid final state can be:

```text
protected main -> A
                 |
                 +-- activation authority authorizes R

R (ancestor/reachable from main)
|
+-- runtime prerequisites pass
+-- Deploy Worker input source_sha = R
```

`R` does **not** have to equal latest protected-main HEAD after the authority PR merges.

This is deliberate. The deployment workflow repeatedly fetches latest protected `main` as the control plane while checking out the immutable requested runtime source separately.

---

## 5. Production Worker deployment workflow

Canonical workflow:

`.github/workflows/deploy-worker.yml`

### Input

The workflow input is:

`source_sha`

It is an exact lowercase 40-character Git commit SHA.

Do **not** use the stale name `expected_main_sha`.

### Required properties of `source_sha`

The requested runtime source must:

- exist;
- be exact/full SHA;
- remain reachable from protected `main`;
- pass Recovery Evidence Gate policy;
- contain a verified production D1 runtime identity;
- be explicitly authorized by the current protected-main activation authority.

### Current workflow sequence

1. validate exact SHA syntax;
2. checkout exact requested runtime source;
3. prove source is main-reachable;
4. verify Recovery Evidence Gate;
5. verify deployable production runtime prerequisites;
6. fetch latest protected main and verify production activation authority;
7. only then enter reviewer-protected `production` Environment;
8. repeat exact source and authority checks after approval;
9. verify protected production secrets/config exist;
10. render production Wrangler config with exact source metadata;
11. verify exact live Cloudflare D1 control-plane identity;
12. re-check activation authority before remote D1 mutation;
13. apply allowed additive/no-op D1 migrations;
14. re-check activation authority before Worker deployment;
15. deploy through canonical `worker-entry.js`;
16. wait for propagated `/api/version` + `/api/health` identity;
17. verify exact source/service/release/API/schema metadata;
18. verify public auth/CORS contract;
19. upload sanitized post-deploy evidence.

Routine Cloudflare dashboard Quick Edit, source copy/paste or bypass deployment is not a supported production path.

---

## 6. Required pre-deployment activation sequence

For the current E1a-A rollout, use the following sequence. Do not skip directly to deployment.

### Step 1 — Fresh read-only production identity evidence

Workflow:

`.github/workflows/production-identity-evidence.yml`

Input:

`source_sha = <exact current protected-main HEAD>`

The workflow itself requires that the supplied SHA still equals current protected-main HEAD.

It is reviewer-protected and GET-only. It collects a sanitized artifact proving:

- authoritative Cloudflare D1 name and UUID fingerprint;
- every traffic-bearing Worker version binds canonical `DB` to that D1;
- Pages production branch/environment/API/OAuth values are explicit and reviewed;
- canonical Pages production deployment equals audited source SHA;
- live production frontend/CSP contract is correct.

On any failure: stop and perform RCA. Never guess production D1 identity from staging, repository values or secret names.

### Step 2 — Pin production runtime D1 identity

Only from a successful reviewed identity artifact, create a protected PR updating production identity fields in:

`config/deployment-environments.json`

Required result:

- `d1_identity_status = "verified"`;
- exact authoritative database name;
- SHA-256 fingerprint of authoritative database UUID.

Never commit raw D1 UUID/account/token/API secret.

The protected merge after this step becomes candidate runtime source `R`.

### Step 3 — Re-audit exact runtime `R`

After Pages deployment for `R` is successful/propagated, rerun `Production Identity Evidence` using:

`source_sha = R`

This binds activation evidence to the exact runtime source that may later be deployed.

### Step 4 — Activate protected-main authority for `R`

Create controlled evidence files under:

`docs/governance/evidence/production-activation/`

Required check names:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

Each evidence file must satisfy `tools/verify_production_activation_authority.mjs` and be bound to exact `source_sha = R`.

Then update:

`config/production-activation-authority.json`

so the latest protected-main control plane:

- has `status = "ready"`;
- has `authorized_source_sha = R`;
- marks every required check `passed`;
- references only controlled evidence files;
- uses a reviewed approval timestamp consistent with evidence observation times.

The resulting latest-main authority commit is `A`.

### Step 5 — Deploy runtime `R`

Only now run:

`Deploy Worker`

with:

`source_sha = R`

The workflow reads runtime prerequisites from `R` and activation authority from latest protected main `A`.

---

## 7. E1a-A deployment acceptance

A green deployment workflow is necessary but the current E1a-A batch also needs capability-specific evidence.

### Generic deployment acceptance

Must pass:

- exact source metadata = `R`;
- runtime service/release/API/schema identity;
- D1 database/schema health;
- public anonymous-auth contract;
- reviewed production CORS contract;
- sanitized deployment artifact.

### E1a-A compatibility-specific proof

Before E1a-B, prove the system-only opaque calculation-job GET boundary is actually live.

A safe read-only proof is:

- authenticate as trusted system;
- request a syntactically valid but intentionally nonexistent opaque `job_...` id;
- E1a-A expected behavior: **404 NOT_FOUND**;
- pre-E1a-A canonical system-principal behavior: **403 FORBIDDEN**;
- response must not reveal tenant identity;
- request must not mutate/create a production calculation job.

The current generic production contract verifier does not directly test this route. At execution time, add/use a narrowly scoped reviewer-protected compatibility audit rather than inferring success from `/health` alone.

Also confirm the legacy pre-cutover user calculation path remains usable because E1a-A intentionally leaves email dispatch/workflow/runner behavior unchanged.

---

## 8. Production read-only workflows

### Production Identity Evidence

`.github/workflows/production-identity-evidence.yml`

Purpose: external production identity discovery/verification before activation.

Properties:

- exact current-main SHA at dispatch;
- production Environment reviewer gate;
- Cloudflare control-plane GET only;
- no Worker deployment;
- no D1 migration/query mutation;
- no Pages mutation;
- sanitized artifact only.

### Production Contract Audit

`.github/workflows/production-contract-audit.yml`

Purpose: audit an exact deployed/main-reachable Worker source with system checks.

Input:

`expected_sha`

It validates exact runtime identity, health, anonymous auth, CORS and existing system record/settings contracts. It is not the production deployment workflow and does not replace E1a-specific opaque-route proof.

---

## 9. Production control-plane safety invariants

- production credentials/API secrets/D1 raw identifiers stay in protected control plane;
- no secret values in documentation or artifacts;
- production D1 identity must be externally observed and reviewed;
- Schema 3+ remains blocked until the Recovery Evidence Gate has genuine structured recovery/export/restore proof;
- deployment must use normal production Environment review without bypass;
- failed evidence/deployment runs are retained for RCA rather than rerun into apparent success;
- never lower tests, recovery, activation or identity gates just to reach deployment.

---

## 10. Staging

Use:

- `.github/workflows/deploy-worker-staging.yml`;
- `docs/STAGING_WORKER_CONTRACT.md`;
- `docs/STAGING_FRONTEND_CONTRACT.md`.

Fixed staging identities are defined in `config/deployment-environments.json`:

- Pages branch: `staging`;
- frontend origin: `https://staging.sheet-trading-journal.pages.dev`;
- API origin: `https://journal-backend-staging.chired.workers.dev`;
- D1 database name: `trading-journal-staging`.

Arbitrary Cloudflare Pages preview branches are intentionally disabled. There is no generic `.env.preview.example`; non-production deployment must use the fixed staging contract.

Production D1 identity must never be inferred from staging values.

---

## 11. Local frontend verification

`.env.example` is a production-value example, not a staging or preview file.

Ordinary local/CI builds may run without deployment variables according to the current frontend environment policy.

Typical verification:

```bash
npm ci --no-audit --no-fund
npm run check
```

Interactive local frontend:

```bash
npm run dev
```

---

## 12. Rollback guidance

### Before production Worker deployment

Evidence/config/authority changes are repository/control-plane state only. Use normal protected revert and recovery refs; no production Worker rollback is needed if runtime has not changed.

### After Worker deployment

If source identity, health, schema, auth/CORS or E1a compatibility verification fails:

1. stop the privacy cutover;
2. preserve failed run/artifacts;
3. identify last known good production Worker source/version from deployment evidence;
4. restore through the canonical controlled deployment path;
5. do not mutate D1 identity/secrets ad hoc to make checks pass;
6. perform RCA before any new activation attempt.

The root `DEPLOYMENT_FINAL.md` is an archived tombstone and is not a current deployment runbook.
