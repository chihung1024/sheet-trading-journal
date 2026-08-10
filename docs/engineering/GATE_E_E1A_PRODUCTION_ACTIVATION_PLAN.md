# Gate E / E1a Production Activation & Zero-Downtime Cutover Plan

Status: **ACTIVE OPERATIONAL AUTHORITY**  
Re-baseline: **2026-08-10**  
Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`

## 1. Primary Goal

Safely activate the already-merged E1a-A compatibility capability in production, prove that compatibility boundary is live, then perform the E1a-B email-free privacy cutover without creating a `new workflow -> old Worker -> 403` outage window.

This is a narrow Gate-E dependency chain. It does not reopen broad D3D governance or Schema-3 work.

## 2. Verified starting state

E1a-A compatibility code entered protected `main` at:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

Evidence:

- PR #173 merged;
- final head `ca3fa1f86d21fe660226588063ada98d749d01b6`;
- final-head CI #559: PASS;
- post-main CI #560: PASS;
- recovery `backup-post-gate-e-e1a-a-c312408`;
- temporary compatibility shim is in `worker-entry.js`;
- normal user calculation dispatch still carries tenant email until E1a-B.

Production activation remains fail closed:

- canonical `Deploy Worker` has no runs;
- no live reviewer-protected `workflow_dispatch` Production Identity Evidence run has been completed for this activation;
- production D1 identity is still `unverified` in `config/deployment-environments.json`;
- production activation authority is still `blocked` in `config/production-activation-authority.json`.

Later docs/governance commits may move protected `main`; remote truth must be re-read before every execution step.

## 3. Root Cause

E1a-A repository merge and CI prove the code candidate, not production activation.

The deployment control plane intentionally requires two prerequisites that D3D left fail closed until a real deployment is prepared:

1. authoritative production D1 runtime identity;
2. protected-main activation authority for an exact runtime source.

The earlier handoff simplified the next step to “Deploy Worker” and failed to reconnect Gate E to these existing D3D prerequisites. The correct fix is to complete the dependency chain, not bypass it.

## 4. Scope Lock

### In scope

- current documentation/handoff correction;
- read-only production identity evidence;
- evidence-backed D1 identity pinning;
- exact-runtime re-audit;
- activation authority;
- canonical E1a-A Worker deployment;
- deployment + compatibility proof;
- E1a-A closeout;
- then E1a-B privacy cutover.

### Out of scope

- Schema 3;
- tenant UUID migration;
- broad provider abstraction;
- cash/account ledger;
- Decimal migration;
- derivatives;
- unrelated UI/product work;
- reopening old one-off D3D/PR workflows.

### Stop / expansion triggers

Stop and re-plan if evidence shows production D1 mismatch, mixed traffic-bearing Worker D1 bindings, unexpected Pages production configuration, CSP mismatch, source identity mismatch, material secret/environment-protection drift, Schema-3 migration, data-loss risk, or auth bypass.

## 5. Two-SHA model

- **R — runtime source SHA:** exact deployable commit containing E1a-A compatibility plus verified production runtime prerequisites.
- **A — activation-authority SHA:** later protected-main commit containing reviewed evidence and explicitly authorizing `R`.

`A` may be newer than `R`. `Deploy Worker` receives `source_sha = R` while reading activation authority from latest protected main.

This is intentional TOCTOU/control-plane separation. Do not replace it with “deploy current HEAD”.

## 6. Execution Batches

### E1a-A0 — Repository docs / state stabilization

Objective: make governance, handoff, deployment navigation, and current remote-state descriptions internally consistent before touching production.

Required outcomes:

- complete V3 governance baseline is present and guarded against accidental wholesale replacement;
- `to_do_update_list.md` is current-state-first;
- canonical deployment runbook and this plan agree with machine contracts;
- D3D historical handoff is clearly historical;
- obsolete standalone root plans/audits with no unique value are removed;
- current tracked Actions inventory remains unchanged and machine-enforced;
- no runtime/config/schema/production mutation.

### E1a-A1 — Authoritative read-only production identity evidence

Use `.github/workflows/production-identity-evidence.yml` with:

`source_sha = <exact current protected-main HEAD at dispatch>`

The workflow must prove exact-current-main and run behind the production Environment reviewer gate.

Required evidence:

- authoritative production D1 name;
- SHA-256 fingerprint of D1 UUID;
- all traffic-bearing Worker versions bind canonical `DB` to that D1;
- explicit Pages production branch/environment/API/OAuth values;
- canonical Pages deployment equals audited source and succeeded;
- live production frontend HTTP 200;
- header/meta CSP allow production API and reject staging API.

Any failure => stop/RCA. Never guess production identity.

### E1a-A2 — Evidence-backed runtime D1 identity pinning

Create a protected PR changing only production identity fields in `config/deployment-environments.json` from reviewed A1 evidence.

After merge/post-main CI define:

`R = <exact merge SHA>`

`R` must still contain E1a-A compatibility.

### E1a-A3 — Exact-runtime re-audit

After Pages for `R` propagates successfully, run Production Identity Evidence again with `source_sha = R`.

This A3 artifact, not the earlier discovery artifact, binds activation evidence to the exact runtime candidate.

### E1a-A4 — Protected-main activation authority

Create controlled evidence files under:

`docs/governance/evidence/production-activation/`

for:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

Each must pass `tools/verify_production_activation_authority.mjs`, be bound to exact `R`, and reference the reviewed sanitized A3 artifact/run.

Then set `config/production-activation-authority.json` to `ready`, explicitly authorize `R`, and mark only proven checks passed.

After merge define:

`A = <latest protected-main authority SHA>`

### E1a-A5 — Canonical Worker deployment

Run `.github/workflows/deploy-worker.yml` with:

`source_sha = R`

Do not continue on partial success, unexpected migration, identity/authority drift, wrong source metadata, schema/health degradation, or auth/CORS regression.

### E1a-A6 — Capability-specific production proof

Generic `/version`, `/health`, auth, CORS, and schema evidence are necessary but do not directly prove E1a-A.

Perform a reviewer-protected read-only trusted-system GET to a valid-format intentionally nonexistent opaque `job_...` id:

- E1a-A expected: `404 NOT_FOUND`;
- pre-E1a-A system-principal behavior: `403 FORBIDDEN`.

No production job may be created/updated/deleted and no tenant identity may be returned.

Also confirm the legacy pre-cutover user calculation path remains usable.

### E1a-A7 — Closeout

Close E1a-A only after recording:

- repository/CI evidence;
- runtime `R`;
- exact-runtime activation evidence;
- authority `A` authorizing `R`;
- Deploy Worker success;
- deployed source/version/health/schema identity;
- compatibility-specific proof;
- legacy-path usability;
- post-deploy recovery;
- current handoff.

Then and only then activate E1a-B.

## 7. E1a-B — Privacy cutover

Create a fresh branch from the then-current stable main. Do not merge superseded prototype PR #172.

Required contract:

- canonical Worker supports trusted-system opaque job lookup while preserving tenant user projection;
- normal calculation dispatch sends opaque job id and required non-tenant parameters, never tenant email;
- workflow uses `CALCULATION_JOB_ID`, not tenant email/user id;
- trusted runner resolves owner through Worker before unchanged financial `main.run_update()`;
- temporary E1a-A `worker-entry.js` shim is removed after canonical `worker.js` owns the route;
- audit-only targeting remains separately scoped;
- no schema migration.

Benchmark integrity requirement:

> durable job benchmark is authoritative, or dispatch benchmark must exactly match it and fail closed on mismatch.

Required verification includes fresh CI, privacy/security independent review, exact-head merge/post-main evidence, canonical Worker deployment, and controlled user-triggered production smoke proving opaque targeting end-to-end with no tenant email in normal dispatch/log evidence.

## 8. Later Gate-E sequence

After E1a closes:

- **E1b:** immutable EOD history + separate explicit realtime valuation/provenance;
- **E1c:** lifecycle-based active-job idempotency/recovery semantics, not a simple larger TTL;
- **E1d:** separate cursor-signing secret from system API auth;
- **E2-pre:** only then audit whether the narrow ledger-revision Schema-3 protocol is justified.

No broader Schema-3/cash-ledger/provider/tenant-UUID program enters the active batch without a new evidence-backed scope decision.

## 9. Recovery and rollback

Every material runtime/control-plane step receives a pre-change known-good reference and an explicit rollback path.

A1/A3 evidence failures require no production rollback because they are GET-only. Preserve failed evidence and perform RCA.

Before deployment, identity/authority PRs can be reverted without mutating production runtime. After deployment, a material production regression prioritizes rollback/restore before further patching.

## 10. Next exact action

After E1a-A0 is merged and post-main verified:

> manually dispatch **Production Identity Evidence** against the exact then-current protected-main SHA.

Do **not** dispatch `Deploy Worker` first.
