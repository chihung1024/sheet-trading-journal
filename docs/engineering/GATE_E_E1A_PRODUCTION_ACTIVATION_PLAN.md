# Gate E / E1a Production Activation & Zero-Downtime Cutover Plan

Status: **ACTIVE OPERATIONAL AUTHORITY — E1a-A CLOSEOUT / E1a-B NEXT**  
Re-baseline: **2026-08-10**  
Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`

## 1. Primary Goal

Safely activate the E1a-A compatibility capability in production, prove that compatibility boundary and the existing user path remain live, then perform the E1a-B email-free privacy cutover without creating a `new workflow -> old Worker -> 403` outage window.

E1a-A production activation and compatibility/user-path evidence are now complete. PR #185 is the closeout transition; after its protected-main merge/post-main verification, E1a-B becomes the single active Gate-E batch.

This remains a narrow Gate-E dependency chain. It does not reopen broad D3D governance or Schema-3 work.

## 2. Verified current state

E1a-A compatibility code entered protected `main` at:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

Production runtime is now intentionally pinned to:

`R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`

Activation authority used for the deployment:

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

Production evidence now proves:

- A1 Production Identity Evidence run #11 / `31364597982`: PASS;
- A2 production D1 identity pinned in runtime `R`;
- A3 exact-runtime Production Identity Evidence run #12 / `31366644577`: PASS;
- A4 protected-main authority `A` explicitly authorizes `R`;
- A5 Deploy Worker run #1 / `31368153511`: Worker deploy succeeded; final workflow failed only because of a post-deploy stale-edge verification race later root-caused/fixed;
- deployed Worker version `245eb37c-0d52-4344-9cc3-f82866434f28`;
- A6 Production Contract Audit run #40 / `31386148724`: PASS against exact `R`;
- capability discriminator: trusted-system valid nonexistent opaque job => `404 NOT_FOUND`, no tenant identity;
- A7 post-A5 normal authenticated user calculation smoke: Update Portfolio Data run #3222 / `31386988867`: PASS through running -> calculation/upload -> succeeded callback.

Current protected-main baseline immediately before A7 closeout is:

`210e004528b725ed7847ed17fd1aad4a7390df0d`

Normal user calculation dispatch still carries tenant email until E1a-B. That is now the next intended privacy change, not an unresolved E1a-A activation blocker.

Later docs/governance commits may move protected `main`; remote truth must still be re-read before every material execution step.

## 3. Root Cause / Why the A0-A7 sequence existed

E1a-A repository merge and CI proved the code candidate, not production activation.

The deployment control plane intentionally required two prerequisites that D3D left fail closed until a real deployment was prepared:

1. authoritative production D1 runtime identity;
2. protected-main activation authority for an exact runtime source.

The earlier handoff simplified the next step to “Deploy Worker” and failed to reconnect Gate E to these existing D3D prerequisites. A0-A7 corrected that by completing the dependency chain instead of bypassing it.

The A5 incident then exposed a separate verifier race: a single readiness hit did not prove stable edge convergence. PR #183 corrected the verifier without weakening CORS or redeploying the already-live runtime merely to repair evidence history.

## 4. Scope Lock

### In scope

- current documentation/handoff correction;
- read-only production identity evidence;
- evidence-backed D1 identity pinning;
- exact-runtime re-audit;
- activation authority;
- canonical E1a-A Worker deployment;
- deployment + compatibility proof;
- legacy pre-cutover user-path proof;
- E1a-A closeout;
- E1a-B privacy cutover.

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

For the completed E1a-A activation:

- `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`
- `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

`A` may be newer than `R`. `Deploy Worker` received `source_sha = R` while reading activation authority from protected main.

This is intentional TOCTOU/control-plane separation. Do not replace it with “deploy current HEAD”.

## 6. Execution Batches

### E1a-A0 — Repository docs / state stabilization

Objective: make governance, handoff, deployment navigation, and current remote-state descriptions internally consistent before touching production.

Status: **CLOSED / POST-MAIN VERIFIED**.

### E1a-A1 — Authoritative read-only production identity evidence

Workflow:

`.github/workflows/production-identity-evidence.yml`

Required evidence included authoritative production D1 identity, Worker DB binding consistency, explicit Pages production configuration, exact Pages deployment identity, frontend HTTP 200, and production-vs-staging CSP contract.

Status: **PASS / CLOSED**.

Canonical successful run: #11 / `31364597982`.

### E1a-A2 — Evidence-backed runtime D1 identity pinning

Production identity was pinned only from reviewed A1 evidence.

Resulting immutable runtime:

`R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`

Status: **PASS / CLOSED**.

### E1a-A3 — Exact-runtime re-audit

Production Identity Evidence was re-run against exact `R` after Pages propagation.

Run #12 / `31366644577`: **PASS**.

Status: **CLOSED**.

### E1a-A4 — Protected-main activation authority

Controlled evidence under `docs/governance/evidence/production-activation/` authorized exact `R`.

Authority:

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

Status: **PASS / CLOSED**.

### E1a-A5 — Canonical Worker deployment

Deploy Worker run #1 / `31368153511` used `source_sha = R`.

Observed:

- runtime/authority/D1 preflight: PASS;
- reviewer gate: PASS;
- no pending D1 migrations;
- canonical Worker deploy: SUCCESS;
- deployed Worker version: `245eb37c-0d52-4344-9cc3-f82866434f28`.

The workflow's final conclusion was FAILURE because the immediate post-deploy CORS audit hit a stale edge after the first single readiness observation. That was a verification-state-machine race, not evidence that the new runtime failed to deploy.

PR #183 changed the verifier to require three consecutive full production-contract passes and reset on any failure. Runtime `R` was not rolled back or redundantly redeployed merely to repair the failed verification history.

Status: **DEPLOYED / INCIDENT RCA CLOSED**.

### E1a-A6 — Capability-specific production proof

Reviewer-protected Production Contract Audit run #40 / `31386148724` audited exact `R` and passed generic source/version/health/schema/auth/CORS/system checks.

Capability-specific discriminator:

- E1a-A runtime: trusted-system GET to valid-format intentionally nonexistent opaque job => `404 NOT_FOUND`;
- pre-E1a-A system-principal behavior => `403 FORBIDDEN`.

No production job was created/updated/deleted and no tenant identity was returned.

Status: **PASS / CLOSED**.

### E1a-A7 — Closeout

Legacy pre-cutover authenticated user path proof is now complete:

- Update Portfolio Data run #3222 / `31386988867`;
- post-A5;
- non-audit calculation path;
- calculation job marked running;
- calculation/upload succeeded;
- snapshot upload succeeded;
- final calculation-job callback `succeeded`;
- workflow conclusion SUCCESS.

Durable evidence:

- `docs/governance/evidence/GATE_E_E1A_A6_PRODUCTION_AUDIT_2026-08-10.json`;
- `docs/governance/evidence/GATE_E_E1A_A7_LEGACY_USER_SMOKE_2026-08-10.json`;
- `docs/engineering/GATE_E_E1A_A7_CLOSEOUT_2026-08-10.md`.

PR #185 is the final R2 closeout transition. E1a-A becomes CLOSED only when PR #185 passes exact-head CI/Independent Review, merges with expected-head protection, and post-main CI/Pages succeed.

## 7. E1a-B — Privacy cutover

After A7 closeout is merged/post-main verified, create a fresh branch from the then-current stable main. Do not merge superseded prototype PR #172.

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

Preserve failed A1/A5 runs as evidence. Do not erase or rewrite them as if they did not occur.

For the current A7 documentation/evidence closeout, no production runtime mutation is required. The pre-A7 recovery reference is:

`backup-pre-e1a-a7-closeout-210e004`

After PR #185 merges/post-main verifies, create a post-A7 recovery reference before starting E1a-B.

## 10. Next exact action

Finish PR #185 under V3 R2 controls:

```text
exact-head CI
-> Same-AI Independent Review
-> BLOCKER=0
-> expected-head merge
-> post-main CI + Pages
-> post-A7 recovery
-> re-read protected-main remote truth
-> create fresh E1a-B branch
```

Do **not** redeploy `R` as part of A7 closeout.
