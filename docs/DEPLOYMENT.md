# Deployment

This is the repository's **canonical deployment navigation and production-activation runbook**.

Historical release notes, acceptance records, audit files, and `DEPLOYMENT_FINAL.md` are context only. They must not override current protected-main code, machine-readable contracts, current workflows, tests, or `to_do_update_list.md`.

Current Gate-E rollout authority:

- `to_do_update_list.md`
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

---

## 1. Runtime identity

Use `worker-manifest.json` and current source as authority. Current contract remains:

- service: `journal-backend`;
- runtime service metadata: `trading-journal-api`;
- deployment entry: `worker-entry.js`;
- canonical Worker source: `worker.js`;
- Worker release: `4.07`;
- API version: `2.60`;
- D1 schema: `2`;
- D1 binding: `DB`.

Do not copy version or identity values from old audit/release documents when current code differs.

---

## 2. Current production-activation state

E1a-A compatibility code entered protected `main` at:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

with final-head CI #559, post-main CI #560, and recovery:

`backup-post-gate-e-e1a-a-c312408`

Later documentation/governance descendants may move protected `main`; that does **not** mean the Worker was deployed.

Current control-plane facts must be rechecked before execution. At the 2026-08-10 re-baseline:

- canonical `Deploy Worker` has never run;
- no reviewer-protected live `workflow_dispatch` Production Identity Evidence run has been performed for the current activation exercise;
- `config/deployment-environments.json` still has production D1 identity `unverified` with null reviewed name/fingerprint;
- `config/production-activation-authority.json` remains `blocked` with no authorized runtime SHA.

Therefore:

> **Do not dispatch `Deploy Worker` yet.**

The fail-closed state is intentional and is not an application outage.

---

## 3. Source-of-truth hierarchy

For production deployment use, in order:

1. current GitHub remote state and protected-main SHA;
2. `worker-manifest.json`, current runtime source, `wrangler.toml`, and `config/*.json` machine contracts;
3. current `.github/workflows/*.yml`, verifier tools, and tests;
4. `to_do_update_list.md`;
5. `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`;
6. this runbook;
7. D3D acceptance/audit/evidence for historical rationale;
8. archived/tombstoned material for forensic comparison only.

See `docs/README.md` for repository-wide document authority.

---

## 4. Two-SHA production activation model

Production activation intentionally separates immutable runtime source from the latest protected-main control plane.

- **R — runtime source SHA:** exact deployable commit containing E1a-A compatibility and verified production runtime prerequisites.
- **A — activation-authority SHA:** later protected-main commit containing reviewed evidence and explicitly authorizing `R`.

Expected final shape:

```text
protected main -> A
                 |
                 +-- activation authority authorizes R

R (ancestor/reachable from main)
|
+-- runtime prerequisites pass
+-- Deploy Worker input source_sha = R
```

`A` may be newer than `R`. Do not collapse this into “deploy current HEAD”.

---

## 5. Canonical production Worker workflow

Workflow:

`.github/workflows/deploy-worker.yml`

Input:

`source_sha`

It must be an exact lowercase 40-character Git SHA. The stale input name `expected_main_sha` must not be used.

The requested runtime source must:

- exist and be exact;
- remain reachable from protected `main`;
- pass Recovery Evidence Gate policy;
- contain verified production D1 runtime identity;
- be explicitly authorized by the latest protected-main activation authority.

The workflow performs non-secret preflight **before** the reviewer-protected production Environment, then rechecks authority/source near mutation boundaries, renders reviewed Wrangler configuration, verifies live D1 identity, applies only allowed migration state, deploys `worker-entry.js`, and verifies propagated source/version/health/auth/CORS evidence.

Do not use routine Cloudflare dashboard Quick Edit or source copy/paste for production.

---

## 6. Gate E / E1a-A activation sequence

### A1 — Authoritative read-only production identity evidence

Run:

`.github/workflows/production-identity-evidence.yml`

with:

`source_sha = <exact protected-main HEAD at dispatch time>`

The workflow requires exact-current-main, is protected by the `production` Environment, performs GET-only Cloudflare control-plane/live frontend observations, and produces sanitized evidence.

Required observations include:

- authoritative production D1 database name;
- SHA-256 fingerprint of its UUID, not the raw UUID in the artifact;
- every traffic-bearing Worker version binds canonical `DB` to that D1;
- Pages production branch and explicit production environment values;
- canonical Pages deployment equals the audited source SHA and is successful;
- live production frontend is HTTP 200;
- header/meta CSP allow the production API and reject the staging API.

If any check fails, stop and perform RCA. Never guess production D1 identity from staging, repository names, or secret names.

### A2 — Pin production runtime D1 identity

Only from a successful reviewed A1 artifact, create a protected PR updating the production identity fields in:

`config/deployment-environments.json`

Required result:

- `d1_identity_status = "verified"`;
- authoritative production database name;
- SHA-256 fingerprint of authoritative D1 UUID.

Never commit raw D1 UUID/account/token/API secret.

The verified protected merge becomes candidate runtime source **R**.

### A3 — Re-audit exact runtime R

After the Pages production deployment for `R` is successful and propagated, run Production Identity Evidence again with:

`source_sha = R`

This binds activation evidence to the exact runtime source that may be deployed.

### A4 — Authorize R from latest protected main

Create controlled machine-readable evidence under:

`docs/governance/evidence/production-activation/`

Required checks:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

Each file must be bound to `source_sha = R`, be passed, and reference the reviewed sanitized A3 artifact/run in the schema required by `tools/verify_production_activation_authority.mjs`.

Then update:

`config/production-activation-authority.json`

so latest protected main:

- has `status = "ready"`;
- explicitly authorizes `R`;
- marks all required checks passed;
- references only controlled evidence;
- has a reviewed approval timestamp consistent with evidence observation.

The resulting protected-main authority commit is **A**.

### A5 — Deploy R

Only after A2/A3/A4 pass, run:

`Deploy Worker`

with:

`source_sha = R`

The workflow must consume runtime prerequisites from `R` and activation authority from latest protected main `A`.

### A6 — Prove E1a-A compatibility is actually live

Generic health/version success is necessary but insufficient.

Before E1a-B, perform a reviewer-protected **read-only** trusted-system GET to a syntactically valid but intentionally nonexistent opaque `job_...` id.

Expected discriminator:

- E1a-A compatibility Worker: **404 NOT_FOUND**;
- pre-E1a-A canonical system-principal behavior: **403 FORBIDDEN**.

The request must not create/update/delete a production job and the response must not reveal tenant identity.

Also confirm the legacy pre-cutover user calculation path remains usable; E1a-A intentionally did not change the normal email-bearing dispatch/workflow/runner path.

### A7 — Closeout

E1a-A is `CLOSED` only after repository evidence, post-main CI, `R`, activation evidence, authority `A`, successful deployment, exact deployed source/health/schema identity, compatibility-specific proof, legacy-path usability, recovery, and handoff are recorded.

Only then activate E1a-B.

---

## 7. E1a-B cutover guard

E1a-B must remain blocked until A7 closes.

Its privacy objective is to remove tenant email from the normal public GitHub calculation dispatch and resolve ownership only through the trusted opaque-job boundary.

The durable job's benchmark must be authoritative, or dispatched benchmark must be equality-validated fail closed. Never allow job metadata and dispatched benchmark to diverge silently.

Do not merge the superseded prototype PR #172.

---

## 8. Current read-only/audit workflows

### Production Identity Evidence

`.github/workflows/production-identity-evidence.yml`

Purpose: authoritative external identity/config discovery before activation. GET-only; no deploy or data mutation.

### Production Contract Audit

`.github/workflows/production-contract-audit.yml`

Purpose: verify an exact deployed/main-reachable Worker source and production API contract. This does not replace the A1/A3 identity evidence requirement.

### Staging Browser Smoke

`.github/workflows/staging-browser-smoke.yml`

Purpose: staging browser contract verification. Staging evidence is never production D1 authority.

---

## 9. Actions hygiene

Current tracked workflow inventory is intentionally machine-enforced by:

- `docs/governance/github-actions-pins.json`;
- `tests/test_workflow_supply_chain.py`.

GitHub may still show historical registrations for deleted one-off PR/release workflows. Their presence in the Actions UI does not make them current repository workflows. Do not recreate them. The repository's tracked workflow files are the authority.

---

## 10. Recovery / failure rule

On production activation failure:

1. stop further mutation;
2. preserve logs/artifacts;
3. classify failure and perform RCA;
4. rollback/restore first for material production regression;
5. create a new exact candidate when a material fix is required;
6. re-run the applicable evidence/review gates.

Never weaken runtime, identity, authority, schema, security, or recovery checks to make a deployment pass.
