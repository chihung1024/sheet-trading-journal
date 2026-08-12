# Deployment

This is the repository's **canonical deployment navigation and production-activation runbook**.

Historical release notes, acceptance records, audit files, and `DEPLOYMENT_FINAL.md` are context only. They must not override current protected-main code, machine-readable contracts, current workflows, tests, or `to_do_update_list.md`.

Current project/activation authority:

- current GitHub remote truth and protected `main`;
- `worker-manifest.json` and `config/*.json` machine-readable contracts;
- `.github/workflows/deploy-worker.yml` and deployment verifier tools;
- `to_do_update_list.md`;
- historical Gate-E plans only for rationale and prior evidence.

---

## 1. Runtime identity — repository candidate vs. live production

**Do not use one unqualified “current runtime” label for both repository source and deployed production.** They intentionally diverge between merge and controlled activation.

### Repository candidate state

`worker-manifest.json` on protected main is the authority for the currently reviewed source contract.

After NOW-1A / PR #213 merged:

- protected main/runtime source commit: `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`;
- service: `journal-backend`;
- runtime service metadata: `trading-journal-api`;
- deployment entry: `worker-entry.js`;
- canonical Worker source: `worker.js`;
- Worker release: `4.08`;
- API version: `2.61`;
- D1 schema: `3`;
- D1 binding: `DB`.

This is a **reviewed repository candidate**, not proof that production is already running 4.08 / 2.61 / Schema 3.

### Last verified live production state

The latest successful canonical `Deploy Worker` execution is run #4 / `31475347673`, which deployed exact source:

`P = fe5f091fdb2c92970dff74c1a7c99052084adb95`

That run verified and deployed:

- Worker release: `4.07`;
- API version: `2.60`;
- D1 schema: `2`;
- Worker version ID: `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- three consecutive post-deploy production-contract passes.

No NOW-1A production deployment has been executed yet. Until a newer successful activation proves otherwise, treat the above as the last verified live production contract.

Do not infer live production identity merely from protected-main HEAD or `worker-manifest.json`.

---

## 2. Current production-activation state — NOW-1A pending

NOW-1A server compatibility is merged to protected main and post-main CI has passed, but production activation is intentionally still pending.

Current state:

- PR #213 merge commit: `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`;
- post-main CI #720 / `31621612621`: SUCCESS;
- Recovery Evidence Gate: PASS, backed by the isolated staging D1 recovery drill;
- repository candidate contract: Worker 4.08 / API 2.61 / Schema 3;
- live production last verified contract: Worker 4.07 / API 2.60 / Schema 2.

`config/production-activation-authority.json` currently authorizes the older production source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

It **does not authorize** `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`.

Therefore:

> **Do not dispatch production deployment for the NOW-1A source until a fresh reviewed activation authority explicitly authorizes that exact runtime source.**

The next controlled production activation must preserve the existing order:

```text
reviewed runtime source R
→ fresh production identity/precondition evidence as applicable
→ protected-main activation authority A explicitly authorizes R
→ canonical Deploy Worker workflow with source_sha=R
→ remote additive migration
→ Worker deploy
→ stable post-deploy contract verification
→ product smoke / closeout evidence
```

Do not make NOW-1B frontend stable-key behavior depend on Worker 4.08 until this production activation is verified.

---

## 3. Source-of-truth hierarchy

For production deployment use, in order:

1. current GitHub remote state and protected-main SHA;
2. `worker-manifest.json`, current runtime source, `wrangler.toml`, and `config/*.json` machine contracts;
3. current `.github/workflows/*.yml`, verifier tools, and tests;
4. `to_do_update_list.md`;
5. this runbook;
6. current batch-specific reviewed activation evidence / authority records;
7. historical Gate-E acceptance/audit/evidence for rationale;
8. archived/tombstoned material for forensic comparison only.

See `docs/README.md` for repository-wide document authority.

---

## 4. Two-SHA production activation model

Production activation intentionally separates immutable runtime source from the later protected-main control plane that authorizes it.

- **R — runtime source SHA:** exact deployable commit containing the reviewed runtime candidate.
- **A — activation-authority SHA:** protected-main commit containing reviewed evidence and explicitly authorizing exact `R`.

`A` may be newer than `R`. Do not collapse this into “deploy current HEAD”.

For the next NOW-1A activation, the intended runtime candidate is currently:

```text
R = 6ea86620475cde8ac9a412921cdc8ae6ce11b9bf
```

but it is **not deployable under the current activation-authority record**, because that record still authorizes `fe5f091f...`. A fresh authority decision must explicitly bind to exact `R` before deployment.

Historical E1a-A example:

```text
R = 2d1fc1cd7190651c64b764c58f58d67826d408e8
A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04
```

Those historical SHAs are preserved for provenance only and are not current activation targets.

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

Stable propagation requires three consecutive full production-contract passes; any failed/stale-edge probe resets the consecutive-success count.

Do not use routine Cloudflare dashboard Quick Edit or source copy/paste for production.

### NOW-1A activation boundary

For the current batch, do not call `deploy-worker.yml` with `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf` until `config/production-activation-authority.json` (or its reviewed successor) explicitly authorizes that exact SHA and the applicable evidence is accepted.

When activation becomes authorized, the canonical workflow must apply additive migration `0003_record_create_idempotency.sql` before deploying Worker 4.08 and then verify live Schema 3 / release 4.08 / API 2.61 against exact source identity.

---

## 6. Historical Gate E / E1a-A activation sequence — completed evidence

This section is historical provenance. It must not override the current NOW-1A activation state above.

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

Deploy Worker run #1 / `31368153511` deployed exact `R` successfully; its immediate post-deploy verifier exposed a stale-edge stabilization race that was later corrected by PR #183.

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

PR #185 records the A7 historical closeout.

Later Gate-E runtime deployments superseded E1a-A as the live source. In particular, successful Deploy Worker #4 / `31475347673` deployed `fe5f091fdb2c92970dff74c1a7c99052084adb95` and verified Worker 4.07 / API 2.60 / Schema 2. Therefore the E1a-A `R` above must never again be described as the current deployed source.

---

## 7. Historical E1a-B cutover guard — completed

E1a-B removed tenant email from the normal public GitHub calculation dispatch and resolved ownership through the trusted opaque-job boundary.

The historical invariants remain useful regression constraints:

- canonical Worker owns the trusted-system opaque-job lookup;
- normal calculation dispatch contains opaque job id and required non-tenant inputs, never tenant email/user id;
- runner resolves owner through Worker before financial calculation;
- audit-only targeting remains separately scoped;
- durable job benchmark remains authoritative or dispatched benchmark exact-equality validates fail closed.

E1a-B is no longer the active project batch. Do not reopen it without a new material regression or security finding.

---

## 8. Current read-only/audit workflows

### Production Identity Evidence

`.github/workflows/production-identity-evidence.yml`

Purpose: authoritative external identity/config discovery around a production activation. GET-only; no deploy or data mutation.

### Production Contract Audit

`.github/workflows/production-contract-audit.yml`

Purpose: verify an exact deployed/main-reachable Worker source and production API contract.

### Staging Browser Smoke

`.github/workflows/staging-browser-smoke.yml`

Purpose: staging browser contract verification. Staging evidence is never production D1 authority.

### Staging D1 Recovery Evidence

`.github/workflows/staging-d1-recovery-evidence.yml`

Purpose: destructive recovery rehearsal against the isolated staging D1 only. Its accepted structured evidence currently satisfies the repository Recovery Evidence Gate for the reviewed Schema 3 strategy. It is not permission to mutate production outside the canonical production activation path.

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

For NOW-1A specifically:

- migration 0003 is additive, but do not claim production Schema 3 until remote activation verifies it;
- if migration succeeds but Worker activation fails, stop and use the reviewed additive-schema compatibility/rollback strategy rather than improvising destructive SQL;
- if Worker 4.08 activates but produces a material production regression, prioritize rollback to the last known good compatible Worker while preserving evidence and re-evaluating the exact schema/runtime state;
- NOW-1B frontend stable-key behavior must remain disabled until server activation and rollback compatibility are explicitly closed.
