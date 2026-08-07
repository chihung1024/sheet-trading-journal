# G00 Governance Control-Plane Acceptance

Status: CLOSED / PASS  
Baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`  
Pre-Wave-0 recovery branch: `backup-pre-v5-wave0-2557fc5`  
Post-control-plane recovery branch: `backup-post-g00-control-plane-5d34dd0`  
Pre-finalization recovery branch: `backup-pre-g00-finalize-98cafc6`  
Verification evidence: `docs/governance/evidence/G00_CONTROL_PLANE_VERIFICATION_2026-08-07.json`

## Objective

G00 establishes repository/deployment governance before additional runtime or schema remediation proceeds. It intentionally changes no financial logic, Worker runtime, D1 schema/data, market-data behavior or OAuth/CORS behavior.

## G00A — Protect `main`

### Required repository control

`main` must be protected by an enforceable GitHub repository ruleset or equivalent branch protection that, at minimum:

- requires changes to reach `main` through a pull request;
- requires the reviewed CI/status checks used by this repository before merge;
- blocks force pushes;
- blocks deletion of `main`;
- prevents routine bypass of the PR/check evidence chain;
- documents any break-glass/admin bypass path rather than using it as the normal merge path.

### Initial observation

At Wave 0 start GitHub reported `main.protected=false`, protection disabled and required-status enforcement off. G00A therefore began as **FAIL / NOT YET APPLIED**.

### Verified state — 2026-08-07T10:49+08:00

Fresh GitHub API reads prove G00A is **PASS**:

- `main.protected=true`;
- repository ruleset `main-protection-v5` exists with id `20536921`;
- enforcement is `active`;
- target condition is `~DEFAULT_BRANCH`;
- deletion is blocked;
- non-fast-forward updates / force pushes are blocked;
- pull requests are required;
- required approving review count is `0`, preserving the single-maintainer operating model;
- allowed merge method is only `merge`, preserving explicit merge-commit history;
- strict required-status-check policy is enabled, requiring the PR branch to be tested against current `main`;
- required checks are exactly:
  - `Python tests`;
  - `Worker security and deployment tests`;
  - `Frontend contracts and build`;
- ruleset bypass actor list is empty;
- GitHub reports `current_user_can_bypass: never`.

### Operational self-test

PR `#116` was opened after the ruleset became active. Its head `9a7528095f64288ff2b173d18db985afc1238783` passed all three required checks in CI run `31142637493`, received an independent AI diff review, and merged through the normal allowed `merge` path without bypass.

Merge SHA: `98cafc64ce065c377a291967a915f0723434dcae`.

Post-merge `main` CI run `31142702692` passed, and Pages deployment run `31142701631` passed. This is the operational proof that the ruleset is both enforced and usable.

## G00B — Protect deployment environments

### Required `production` control

At minimum:

- restrict deployment to reviewed production source/branch policy;
- require explicit environment authorization appropriate to the repository's operating model;
- keep production secrets scoped to the production environment;
- document whether administrators can bypass and under which emergency procedure;
- ensure exact-SHA production deployment remains the canonical path.

### Required `staging` control

At minimum:

- restrict staging deployment to the reviewed staging/main-reachable source policy;
- keep staging secrets isolated from production secrets;
- ensure the staging Worker cannot receive the production Google client or production data-plane credentials;
- keep arbitrary Pages preview environments disabled unless a later reviewed design explicitly changes that policy.

### Initial observation

The prior audit found both named environments present without effective protection rules. G00B therefore began as **FAIL / NOT YET APPLIED**.

### Verified state — 2026-08-07T10:49+08:00

Fresh GitHub API reads prove the G00B control-plane portion is **PASS**.

#### Production

- environment id: `11042279942`;
- custom deployment branch policy is enabled;
- exactly one deployment branch policy exists: `main`;
- required-reviewer protection rule exists;
- required reviewer is `chihung1024`;
- `prevent_self_review=false`, avoiding a single-maintainer deadlock;
- `can_admins_bypass=true` remains available only as documented break-glass capability, not the routine deployment path.

#### Staging

- environment id: `19418410152`;
- custom deployment branch policy is enabled;
- exactly one deployment branch policy exists: `main`;
- no staging required reviewer is configured, intentionally allowing repeated test deployments without production-style manual approval;
- `can_admins_bypass=true` remains break-glass only.

#### Secret isolation verification boundary

The connected GitHub integration receives HTTP 403 when attempting to enumerate environment secret inventory, and secret values are intentionally not readable. Therefore this acceptance does **not** claim direct API proof of secret values.

Operational fail-closed controls remain in the reviewed workflows:

- production workflow runs under `environment: production` and requires its named Cloudflare/D1 environment secrets;
- staging workflow runs under `environment: staging`, requires isolated Cloudflare/D1 values plus `STAGING_GOOGLE_CLIENT_ID`, requires D1 name `trading-journal-staging`, and explicitly rejects the known production Google OAuth client id;
- both deployment workflows require an exact 40-character source SHA reachable from `main`.

The later reviewed staging and production deployment exercises must provide operational proof that the environment-specific secrets satisfy those fail-closed checks. G00B control-plane governance itself is closed because GitHub now enforces distinct named environments and main-only deployment branch policies, with explicit production authorization.

## G00C — Tombstone dangerous legacy deployment instructions

The repository must not present an obsolete manual Quick Edit deployment path as the current production runbook.

Acceptance requires:

- `DEPLOYMENT_FINAL.md` clearly marked historical/archived and unsafe for current production use;
- canonical production path points to `.github/workflows/deploy-worker.yml` and current reviewed deployment documentation;
- canonical staging path points to `.github/workflows/deploy-worker-staging.yml` and `docs/STAGING_WORKER_CONTRACT.md`;
- the historical material remains recoverable through Git history and the Wave 0 backup branch.

G00C is **PASS**. The governance baseline was merged in PR `#112` at merge SHA `5d34dd0d0ea76907ee315543e10ccb400103781d`.

## Batch safety acceptance

G00 repository-side changes remained governance/test/documentation only:

- no Worker/engine/migration/frontend runtime source changed as part of G00;
- no D1 operation was performed by the governance batches;
- no staging/production Worker deployment was performed by the governance batches;
- post-merge CI and Pages deployment both remained healthy.

## Recovery

Primary pre-change recovery reference:

`backup-pre-v5-wave0-2557fc5`

Post-control-plane checkpoint:

`backup-post-g00-control-plane-5d34dd0`

Pre-finalization checkpoint:

`backup-pre-g00-finalize-98cafc6`

Git branches preserve repository state, not external GitHub settings. The machine-readable evidence JSON plus GitHub ruleset/environment APIs are the authoritative control-plane history.

If repository-side G00 documentation must be rolled back, revert the relevant PR. No database or service rollback is required because G00 repository-side changes are non-runtime. If a GitHub control-plane rule itself must be corrected, change the GitHub setting deliberately and append a new evidence record rather than rewriting this historical verification.

## Closeout result

**Wave 0 / G00 is CLOSED.** G00A, G00B control-plane governance and G00C all pass, and the newly enforced ruleset has successfully governed its own closeout PR without bypass. Subsequent work must preserve these controls and must not weaken them merely to make later remediation easier.
