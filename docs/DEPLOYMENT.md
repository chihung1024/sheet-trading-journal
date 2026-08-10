# Deployment

This is the repository's **canonical deployment navigation and production-activation runbook**.

Historical release notes, acceptance records, audit files, and `DEPLOYMENT_FINAL.md` are context only. They must not override current protected-main code, machine-readable contracts, current workflows, tests, or `to_do_update_list.md`.

Current Gate-E rollout authority:

- `to_do_update_list.md`
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`
- `docs/engineering/GATE_E_E1A_A7_CLOSEOUT_2026-08-10.md`

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

Current deployed E1a-A runtime source:

`R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`

Observed deployed Worker version:

`245eb37c-0d52-4344-9cc3-f82866434f28`

Do not copy version or identity values from old audit/release documents when current code differs.

---

## 2. Current production-activation state

E1a-A is deployed and live.

Activation authority used for the production deployment:

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

Canonical Deploy Worker run #1 / `31368153511`:

- requested runtime: exact `R`;
- runtime/D1/authority preflight: PASS;
- reviewer-protected production gate: PASS;
- D1 migration step: no pending migrations;
- canonical Worker deploy command: SUCCESS;
- deployed Worker version: `245eb37c-0d52-4344-9cc3-f82866434f28`.

The run's final workflow conclusion was FAILURE because its immediate post-deploy CORS verifier hit a stale pre-deploy edge after the first single readiness observation. PR #183 root-caused this as a stabilization race and changed future deployment verification to require three consecutive full production-contract passes, resetting on any failure.

Runtime `R` was not rolled back or redundantly redeployed merely to repair the failed verification history.

Fresh reviewer-protected Production Contract Audit run #40 / `31386148724` subsequently proved exact `R` live with:

- source/service/release/API/schema identity PASS;
- `/api/version` and `/api/health` PASS;
- anonymous auth rejection PASS;
- production CORS PASS;
- staging/localhost CORS rejection PASS;
- trusted-system opaque-job E1a-A discriminator `404 NOT_FOUND` with no tenant identity.

A post-A5 authenticated normal user calculation smoke also passed through `Update Portfolio Data` run #3222 / `31386988867`, including calculation-job running/succeeded lifecycle and snapshot upload.

Therefore:

> **Do not redeploy `R` merely because protected `main` is newer.**

The next production Worker deployment should occur only when a new reviewed runtime candidate (for example E1a-B) intentionally changes the runtime and passes the applicable identity/authority/deployment gates.

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

For E1a-A:

```text
R = 2d1fc1cd7190651c64b764c58f58d67826d408e8
A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04
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

The workflow performs non-secret preflight **before** the reviewer-protected production Environment, then rechecks authority/source near mutation boundaries, renders reviewed Wrangler configuration, verifies live D1 identity, applies only allowed migration state, deploys `worker-entry.js`, and verifies stable propagated source/version/health/auth/CORS evidence.

Post-PR #183, stable propagation requires three consecutive full production-contract passes; any failed/stale-edge probe resets the consecutive-success count.

Do not use routine Cloudflare dashboard Quick Edit or source copy/paste for production.

---

## 6. Gate E / E1a-A activation sequence — completed evidence

### A1 — Authoritative production identity evidence

Reviewer-protected Production Identity Evidence established authoritative production D1, Worker binding, Pages production configuration/deployment, frontend availability, and CSP contracts.

Successful run: #11 / `31364597982`.

### A2 — Pin production runtime D1 identity

PR #181 created immutable runtime:

`R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`

### A3 — Re-audit exact runtime R

Production Identity Evidence run #12 / `31366644577`: PASS against exact `R`.

### A4 — Authorize R

Protected-main activation authority:

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

explicitly authorized exact `R` from reviewed A3 evidence.

### A5 — Deploy R

Deploy Worker run #1 / `31368153511` deployed exact `R` successfully; the post-deploy verifier race is preserved as historical incident evidence and was corrected by PR #183.

### A6 — Prove E1a-A compatibility is live

Production Contract Audit run #40 / `31386148724` proved generic production contracts plus the read-only 404-vs-403 E1a-A discriminator.

### A7 — Closeout

Post-A5 authenticated legacy user calculation path:

- Update Portfolio Data run #3222 / `31386988867`;
- normal non-audit path;
- calculation job running callback PASS;
- calculation/upload PASS;
- snapshot upload PASS;
- terminal callback `succeeded`;
- workflow SUCCESS.

PR #185 records the final A7 current-state closeout. After its expected-head merge and post-main CI/Pages pass, E1a-A is CLOSED / PRODUCTION VERIFIED and E1a-B becomes active.

---

## 7. E1a-B cutover guard

After A7 closes, E1a-B becomes the current privacy batch.

Its objective is to remove tenant email from the normal public GitHub calculation dispatch and resolve ownership only through the trusted opaque-job boundary.

Required invariants:

- canonical Worker owns the trusted-system opaque-job lookup before the temporary shim is removed;
- normal calculation dispatch contains opaque job id and required non-tenant inputs, never tenant email/user id;
- runner resolves owner through Worker before unchanged financial calculation;
- audit-only targeting remains separately scoped;
- no schema migration;
- durable job benchmark is authoritative, or dispatched benchmark exact-equality validates fail closed.

Do not merge the superseded prototype PR #172.

E1a-B requires a fresh reviewed runtime candidate and a controlled production deployment/smoke. Do not infer that the existing authorization of `R` automatically authorizes a new E1a-B runtime SHA.

---

## 8. Current read-only/audit workflows

### Production Identity Evidence

`.github/workflows/production-identity-evidence.yml`

Purpose: authoritative external identity/config discovery around a production activation. GET-only; no deploy or data mutation.

### Production Contract Audit

`.github/workflows/production-contract-audit.yml`

Purpose: verify an exact deployed/main-reachable Worker source and production API contract, including the E1a-A compatibility-specific read-only proof added by PR #184.

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

For A7 closeout itself no Worker/data mutation is required. Preserve:

- `backup-pre-e1a-a7-closeout-210e004` before the closeout PR;
- a post-A7 recovery ref after protected-main merge/post-main verification.
