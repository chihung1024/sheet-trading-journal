# Deployment

This is the repository's **canonical deployment navigation and production-activation runbook**.

Historical release notes, acceptance records, audit files, completed Gate plans, and `DEPLOYMENT_FINAL.md` are context only. They must not override current protected-main code, machine-readable contracts, current workflows, tests, or `to_do_update_list.md`.

Current project/activation authority:

- current GitHub remote truth and protected `main`;
- `worker-manifest.json` and `config/*.json` machine-readable contracts;
- `.github/workflows/deploy-worker.yml`, `.github/workflows/production-identity-evidence.yml`, and verifier tools;
- `to_do_update_list.md`;
- historical Gate-E plans/evidence only for rationale and provenance.

---

## 1. Runtime identity — repository source contract vs. live production

**Do not use one unqualified “current runtime” label for both repository source and deployed production.** They intentionally diverge between merge and controlled activation.

### Repository source contract

`worker-manifest.json` on protected main is the authority for the currently reviewed Worker/D1 source contract.

NOW-1A / PR #213 introduced the Worker/D1 runtime-changing source at merge commit:

`6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`

Its contract is:

- service: `journal-backend`;
- runtime service metadata: `trading-journal-api`;
- deployment entry: `worker-entry.js`;
- canonical Worker source: `worker.js`;
- Worker release: `4.08`;
- API version: `2.61`;
- D1 schema: `3`;
- D1 binding: `DB`.

Protected main has legitimately advanced after that merge. A later repository commit may contain Python calculation fixes or documentation changes without changing the deployable Worker/D1 tree. Therefore **the PR #213 merge SHA is provenance, not a permanently hard-coded production deployment target, and “main advanced” by itself is not proof that an already-evidenced Worker/D1 R became invalid**.

Before changing or discarding an accepted `R`, inspect the exact diff and decide whether any Worker/D1/manifest/migration/deploy-path contract changed. Do not infer that production is already running 4.08 / 2.61 / Schema 3 merely because protected main contains that source contract.

### Last verified live production state

The latest successful canonical `Deploy Worker` execution remains run #4 / `31475347673`, which deployed exact source:

`P = fe5f091fdb2c92970dff74c1a7c99052084adb95`

That run verified and deployed:

- Worker release: `4.07`;
- API version: `2.60`;
- D1 schema: `2`;
- Worker version ID: `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- three consecutive post-deploy production-contract passes.

No NOW-1A production Worker/D1 activation has been executed yet. Until a newer successful canonical activation proves otherwise, treat the above as the last verified live production contract.

Do not infer live production identity merely from protected-main HEAD or `worker-manifest.json`.

---

## 2. Current production-activation state — NOW-1A pending

NOW-1A server compatibility is merged and validated, but production activation is intentionally still pending.

Current durable facts:

- PR #213 Worker/D1 runtime-changing merge: `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`;
- Recovery Evidence Gate: PASS, backed by the isolated staging D1 recovery drill;
- repository Worker/D1 source contract: Worker 4.08 / API 2.61 / Schema 3;
- live production last verified Worker/D1 contract: Worker 4.07 / API 2.60 / Schema 2;
- an exact NOW-1A runtime source `R = 842e5667b6ae3e75ea947f9ed08d7a8344337f9d` completed same-SHA CI, Pages, and read-only Production Identity Evidence #16;
- no NOW-1A activation authority and no Worker/D1 production deploy has followed yet.

`config/production-activation-authority.json` still authorizes the older production source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

It does **not** yet authorize NOW-1A `R`.

The next controlled production activation must preserve this order:

```text
accepted exact R + PASS Production Identity Evidence
→ re-check R remains main-reachable
→ review all commits after R for Worker/D1/manifest/migration/deploy-path drift
→ if no deployment-affecting drift: preserve R and its exact-R evidence
→ transform/retain reviewed evidence under the controlled production-activation evidence root
→ protected-main activation authority A explicitly authorizes exact R
→ canonical Deploy Worker workflow with source_sha=R
→ remote additive migration 0003
→ Worker 4.08 deploy
→ stable post-deploy contract verification
→ authenticated product smoke / closeout evidence
```

If the drift review finds a Worker/D1/deployment-affecting change after `R`, then the old evidence cannot authorize that changed deployable runtime: select a new current-main `R`, require same-SHA CI + Pages, and recollect Production Identity Evidence.

If later commits change only unrelated Python calculation code, tests, documentation, or other non-deployed material, do **not** automatically discard an already accepted R. The canonical deploy workflow intentionally supports the two-SHA model: `R` need only remain reachable from protected main, while the latest main control plane contains authority `A` for exact `R`.

A PASS artifact is **not transferable authorization to a different source SHA**. It remains exact-source evidence for `R`; later `A` may authorize that same immutable `R` only after drift/relevance review.

Do not make NOW-1B frontend stable-key behavior depend on Worker 4.08 until this production activation is verified.

---

## 3. Source-of-truth hierarchy

For production deployment use, in order:

1. current GitHub remote state and protected-main SHA;
2. `worker-manifest.json`, runtime source, `wrangler.toml`, and `config/*.json` machine contracts;
3. current `.github/workflows/*.yml`, verifier tools, and tests;
4. `to_do_update_list.md`;
5. this runbook;
6. current batch-specific reviewed activation evidence / authority records;
7. historical Gate-E acceptance/audit/evidence for rationale;
8. archived/tombstoned material for forensic comparison only.

See `docs/README.md` for repository-wide document authority and future-AI bootstrap order.

---

## 4. Two-SHA production activation model and source-selection rule

Production activation intentionally separates immutable runtime source from the later protected-main control plane that authorizes it.

- **R — runtime source SHA:** exact deployable Worker/D1 commit selected while it was protected-main HEAD, after same-SHA CI/Pages were stable and fresh production identity evidence was collected.
- **A — activation-authority SHA:** later protected-main commit containing reviewed controlled evidence and explicitly authorizing exact `R`.

`A` may be newer than `R`. Do not collapse this into “deploy current HEAD”.

### Selecting a new R

For a new evidence cycle, Production Identity Evidence requires both:

```text
inputs.source_sha == current protected-main HEAD
canonical Pages production deployment commit == inputs.source_sha
```

Therefore a new `R` is selected by:

```text
complete intended pre-R changes
→ wait same-SHA post-main CI SUCCESS
→ wait same-SHA Pages production deployment SUCCESS
→ re-fetch protected main unchanged
→ R = current protected-main HEAD
→ collect Production Identity Evidence for exact R
```

Do not dispatch the evidence collector before Pages has propagated the same SHA. If main changes before evidence collection completes, re-evaluate the candidate.

### Preserving an already-evidenced R while main advances

Once exact-source evidence for `R` has passed, later main advancement does **not** automatically invalidate `R`. Before authority/deploy:

1. confirm `R` is still reachable from current protected main;
2. compare `R` to current main;
3. inspect specifically Worker source/entry, manifest/Wrangler, D1 migrations/schema, deployment/recovery/authority verifiers, and canonical deploy workflow;
4. if any relevant deployable contract changed, select/re-evidence a new R;
5. if only unrelated/non-deployed files changed, retain exact `R` and continue to authority `A`.

This review is the bridge between exact-R evidence and the two-SHA control plane. Do not replace it with either extreme: “any main commit invalidates R” or “evidence for R authorizes every descendant”.

### Current NOW-1A R and evidence

Selected/evidenced runtime source:

`R = 842e5667b6ae3e75ea947f9ed08d7a8344337f9d`

Evidence chain:

- post-main CI #727 / `31624183902`: SUCCESS;
- Pages #1501 / `31624182324`: final attempt 2 SUCCESS after attempt 1 was normally cancelled from a prolonged no-runner queue state;
- Production Identity Evidence #16 / `31658614001`: SUCCESS;
- artifact id `9165344610`, name `production-identity-evidence-842e5667b6ae3e75ea947f9ed08d7a8344337f9d`;
- artifact ZIP/GitHub digest: `sha256:b3273cf207d0a84fdbdaef298c4794d4f955cadd1059ac437eab456bc86cce9a`;
- artifact document: `status=passed`, `evidence_source_sha=842e566...`, canonical Pages deployment exact `842e566...`, production D1/Worker binding checks PASS, live frontend/CSP checks PASS, errors empty.

Whole-project recheck evidence on 2026-08-13:

- `842e566... → 0f4676...` changed only Python market-data/calculation wiring, related tests, and Python coverage scope;
- `0f4676... → c3b578...` changed only market-data closeout documentation;
- no Worker source/entry, `worker-manifest.json`, Wrangler/deployment config, migration 0003, deploy workflow, Recovery Gate, or production activation verifier change was present in those compare results.

Therefore PR #217's product calculation fix **does not by itself invalidate the already-evidenced Worker/D1 R**. The current documentation revalidation branch is also docs-only. After this docs batch reaches main, perform one final focused deployment-drift compare from `R` to the resulting main. If the same no-relevant-drift condition still holds, keep `R=842e566...` and proceed to controlled evidence/authority `A` without manufacturing a redundant Production Identity Evidence rerun.

If that final compare reveals a relevant deployment change, stop and start a new R/evidence cycle instead.

### Historical E1a-A example

```text
R = 2d1fc1cd7190651c64b764c58f58d67826d408e8
A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04
```

Those historical SHAs are provenance only and are not current activation targets.

---

## 5. Canonical production Worker workflow

Workflow: `.github/workflows/deploy-worker.yml`

Input: `source_sha`

It must be an exact lowercase 40-character Git SHA. The stale input name `expected_main_sha` must not be used.

The requested runtime source must:

- exist and be exact;
- remain reachable from protected `main`;
- pass Recovery Evidence Gate policy;
- contain verified production D1 runtime identity;
- be explicitly authorized by the latest protected-main activation authority.

The workflow checks out exact `R`, verifies it remains main-reachable, then reads the **latest protected-main control plane** to validate activation authority. This is direct executable evidence that `A` may be newer than `R`; the workflow does not require `source_sha == current main HEAD` at deploy time.

It performs non-secret preflight before the reviewer-protected production Environment, rechecks authority/source near mutation boundaries, renders reviewed Wrangler configuration, verifies live D1 identity, applies allowed migrations, deploys `worker-entry.js`, and verifies stable propagated source/version/health/auth/CORS evidence.

Stable propagation requires three consecutive full production-contract passes; a failed/stale-edge probe resets the consecutive-success count.

Do not use routine Cloudflare dashboard Quick Edit or source copy/paste for production.

### NOW-1A activation boundary

Do not call `deploy-worker.yml` until controlled evidence for exact `R` is persisted/reviewed and `config/production-activation-authority.json` (or reviewed successor) explicitly authorizes the same `R`.

When activated, the canonical workflow must apply additive migration `0003_record_create_idempotency.sql` before deploying Worker 4.08 and verify live Schema 3 / release 4.08 / API 2.61 against exact source identity.

---

## 6. Historical Gate E / E1a-A activation sequence — completed evidence

This section is historical provenance. It must not override the current NOW-1A activation state above.

### A1 — Authoritative production identity evidence

Successful run: #11 / `31364597982` established production D1, Worker binding, Pages production configuration/deployment, frontend availability, and CSP contracts.

### A2 — Pin production runtime D1 identity

PR #181 created `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`.

### A3 — Re-audit exact runtime R

Production Identity Evidence #12 / `31366644577`: PASS against exact R.

### A4 — Authorize R

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04` explicitly authorized R from reviewed evidence.

### A5 — Deploy R

Deploy Worker #1 / `31368153511` deployed exact R; immediate verifier exposed a stale-edge stabilization race later fixed by PR #183.

### A6 — Prove compatibility live

Production Contract Audit #40 / `31386148724`: PASS.

### A7 — Closeout

Authenticated update #3222 / `31386988867`: calculation/upload/snapshot/terminal callback/workflow SUCCESS. PR #185 records historical closeout.

Later Gate-E deployments superseded that historical live source. Deploy Worker #4 / `31475347673` deployed `fe5f091fdb2c92970dff74c1a7c99052084adb95` and verified Worker 4.07 / API 2.60 / Schema 2.

---

## 7. Historical E1a-B cutover guard — completed

E1a-B removed tenant email from normal public GitHub calculation dispatch and resolved ownership through trusted opaque-job boundaries.

Retained regression invariants:

- canonical Worker owns trusted-system opaque-job lookup;
- normal dispatch carries opaque job id/non-tenant inputs, never tenant email/user id;
- runner resolves owner through Worker before financial calculation;
- audit-only targeting remains separately scoped;
- durable job benchmark is authoritative or exact equality fails closed.

E1a-B is no longer active. Reopen only on new material regression/security evidence.

---

## 8. Current read-only/audit workflows

### Production Identity Evidence

`.github/workflows/production-identity-evidence.yml`

Purpose: authoritative external identity/config discovery around production activation. GET-only; no deploy/data mutation.

Collection-time constraints:

- `source_sha` must equal current protected-main HEAD;
- canonical Pages production deployment commit must equal the same audited SHA.

After a successful collection, the artifact remains exact-R evidence. Later main commits require relevance/drift review, not automatic transfer to a different source and not automatic invalidation of the same R.

### Production Contract Audit

`.github/workflows/production-contract-audit.yml` — verifies an exact deployed/main-reachable Worker source and production API contract.

### Staging Browser Smoke

`.github/workflows/staging-browser-smoke.yml` — staging browser contract verification; never production D1 authority.

### Staging D1 Recovery Evidence

`.github/workflows/staging-d1-recovery-evidence.yml` — destructive recovery rehearsal against isolated staging D1 only. Accepted structured evidence satisfies Recovery Evidence Gate for the reviewed Schema 3 strategy; it is not permission for non-canonical production mutation.

---

## 9. Actions hygiene

Tracked workflow inventory is machine-enforced by:

- `docs/governance/github-actions-pins.json`;
- `tests/test_workflow_supply_chain.py`.

Historical UI registrations for deleted workflows are not current repository workflows. Do not recreate them.

Pages #1501 diagnostic precedent: attempt 1 remained queued with no runner/steps until normally cancelled; job-level attempt 2 acquired a runner and succeeded. No approval blocker or repository workflow defect was proven, and GitHub backend cause is unobservable. Do not turn cancel/retry into a routine fix; reopen only if the same no-runner signature recurs and collect fresh evidence first.

---

## 10. Recovery / failure rule

On production activation failure:

1. stop further mutation;
2. preserve logs/artifacts;
3. classify failure and perform RCA;
4. rollback/restore first for material production regression;
5. create a new exact candidate when a material deployable fix is required;
6. re-run applicable evidence/review gates.

Never weaken runtime, identity, authority, schema, security, or recovery checks merely to make a deployment pass.

For NOW-1A specifically:

- migration 0003 is additive, but do not claim production Schema 3 until remote activation verifies it;
- if exact R is no longer main-reachable, stop;
- if Worker/D1/manifest/migration/deploy-path drift exists after R evidence, select/re-evidence a new R;
- unrelated/non-deployed main changes require documented drift review, not automatic evidence invalidation;
- if migration succeeds but Worker activation fails, use the reviewed additive-schema compatibility/rollback strategy rather than destructive improvisation;
- if Worker 4.08 activates but causes material production regression, prioritize rollback to the last known-good compatible Worker while preserving exact schema/runtime evidence;
- NOW-1B frontend stable-key behavior remains disabled until server activation and rollback compatibility are explicitly closed.
