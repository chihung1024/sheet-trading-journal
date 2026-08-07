# G00 Governance Control-Plane Acceptance

Status: IN PROGRESS  
Baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`  
Recovery branch: `backup-pre-v5-wave0-2557fc5`  
Work branch: `v5-g00-governance-baseline`

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

### Current observation

At Wave 0 start GitHub reported `main.protected=false`, protection disabled and required-status enforcement off. Therefore the acceptance state is currently **FAIL / NOT YET APPLIED**.

### Acceptance evidence

G00A may be marked complete only after a fresh GitHub API read shows the reviewed control is actually enforced. A plan, screenshot, or prose statement alone is insufficient.

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

### Current observation

The prior audit found both named environments present without effective protection rules. The acceptance state remains **FAIL / NOT YET APPLIED** until a fresh GitHub read proves otherwise.

## G00C — Tombstone dangerous legacy deployment instructions

The repository must not present an obsolete manual Quick Edit deployment path as the current production runbook.

Acceptance requires:

- `DEPLOYMENT_FINAL.md` clearly marked historical/archived and unsafe for current production use;
- canonical production path points to `.github/workflows/deploy-worker.yml` and current reviewed deployment documentation;
- canonical staging path points to `.github/workflows/deploy-worker-staging.yml` and `docs/STAGING_WORKER_CONTRACT.md`;
- the historical material remains recoverable through Git history and the Wave 0 backup branch.

## Batch safety acceptance

Before G00 repository-side changes merge:

- diff must contain documentation/governance changes only;
- no Worker/engine/migration/frontend runtime source may change;
- no D1 operation is performed;
- no staging/production deployment is performed;
- normal site usage must therefore remain unaffected.

## Rollback

Primary pre-change recovery reference:

`backup-pre-v5-wave0-2557fc5`

If merged, revert the G00 repository-side PR. No database or service rollback is required because G00 repository-side changes are non-runtime.

## Closeout rule

Wave 0 is fully closed only when **G00A + G00B + G00C** all pass. Repository documentation changes may merge before the external GitHub control-plane settings are applied, but subsequent runtime remediation must not treat G00 as fully closed until G00A/G00B are re-read and verified.
