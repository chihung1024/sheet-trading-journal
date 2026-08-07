# ARCHIVED — DO NOT USE FOR CURRENT PRODUCTION DEPLOYMENT

> This file is a historical runbook from the Worker v2.38 era. Its former instructions used manual Cloudflare Worker Quick Edit deployment and referenced `portfolio-dt-proxy`. Those instructions are **not** the canonical deployment path for the current system and must not be used for production changes.

## Why this file was tombstoned

The current remediation program requires production changes to preserve exact source provenance, CI evidence, migration gates, environment isolation and post-deployment verification. Manual copy/paste or Quick Edit deployment can bypass those controls and can make the deployed code impossible to tie back to a reviewed Git commit.

The historical content remains recoverable through Git history and the Wave 0 recovery branch:

`backup-pre-v5-wave0-2557fc5`

The baseline commit immediately before this tombstone is:

`2557fc582d3555f7b129f36d2cf5ad67c141375e`

## Canonical deployment paths

### Production Worker

Use the reviewed GitHub Actions workflow:

`.github/workflows/deploy-worker.yml`

The production workflow is designed around an exact requested Git SHA, repository deployment gates, rendered Wrangler configuration, D1 migration execution and post-deployment source/version/schema verification.

Do not manually replace Worker source in the Cloudflare dashboard as the routine deployment method.

### Staging Worker

Use:

`.github/workflows/deploy-worker-staging.yml`

and the current staging contract:

`docs/STAGING_WORKER_CONTRACT.md`

The fixed staging identities and isolation rules are part of that contract. Arbitrary Pages preview branches are intentionally not a trusted backend environment in the current design.

## Current remediation authority

The approved staged remediation sequence is recorded in:

`docs/V5_ZERO_DOWNTIME_EXECUTION_PLAN.md`

Execution/recovery history is append-only in:

`docs/governance/V5_EXECUTION_HISTORY.md`

The current Wave 0 governance acceptance requirements are in:

`docs/governance/G00_CONTROL_PLANE_ACCEPTANCE.md`

## Historical-use rule

If old instructions are needed for forensic comparison, debugging history or migration archaeology, read the pre-tombstone Git revision or recovery branch. Do not copy historical deployment commands into a current production procedure without a new review.
