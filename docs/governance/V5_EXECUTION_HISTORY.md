# V5.0 Execution History

This is an append-only execution journal for the V5 remediation program. Future maintainers and AI agents should use it together with `docs/V5_ZERO_DOWNTIME_EXECUTION_PLAN.md`, the immutable audit baselines, PR history, workflow evidence, and backup branches.

## Entry 000 — Program approval and Wave 0 freeze

- Local approval time: `2026-08-07T09:28:00+08:00`
- Approved execution baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`
- Historical third-round audit baseline retained: `35e629ade1c3155ad5e44b839135d4406f9a4170`
- Worker release: `4.07`
- API version: `2.60`
- D1 schema: `2`
- Runtime/data change in this entry: **none**

### Pre-change recovery branch

Created:

`backup-pre-v5-wave0-2557fc5`

The branch was created directly from the exact approved baseline SHA. It is the primary Git-level recovery reference for Wave 0 documentation/governance work.

### Work branch

Created:

`v5-g00-governance-baseline`

The work branch also started from the exact approved baseline SHA.

### G00A observation

The GitHub `main` branch was re-read immediately before Wave 0 and reported:

- `protected: false`
- protection enabled: `false`
- required status check enforcement: `off`

Therefore G00A was **not** considered complete at program start.

The available GitHub connector can read repository rulesets/branch state and mutate repository contents/branches/PRs, but this execution environment does not expose a branch-protection/ruleset mutation operation. Accordingly, no claim is made that the GitHub control-plane setting has been changed. The required setting is tracked in the G00 acceptance document and must be verified by re-reading GitHub state before G00A closes.

### G00B observation

Earlier independent review found that the named `production` and `staging` GitHub environments existed but had no effective protection rules. As with G00A, the current connector does not expose an environment-protection mutation operation. G00B remains open until GitHub itself reports the reviewed protection configuration.

### G00C scope

Wave 0 repository-side work is allowed to:

- record the V5 approved plan and execution history;
- tombstone obsolete deployment instructions that could bypass exact-SHA deployment governance;
- document the control-plane acceptance requirements.

Wave 0 repository-side work is **not** allowed to:

- modify Worker runtime behavior;
- change D1 schema/data;
- change financial calculations;
- deploy staging or production;
- alter OAuth/CORS behavior.

### Recovery procedure for this entry

If any Wave 0 repository-side change must be undone before merge:

1. compare the work branch with `backup-pre-v5-wave0-2557fc5`;
2. revert the Wave 0 commits or abandon the work branch;
3. confirm `main` remains at the prior merge state unless a reviewed PR was intentionally merged.

If a Wave 0 PR is merged and later needs rollback, revert the Wave 0 PR. No D1, Worker or external-data rollback is required because the batch is documentation/governance-only.

### Evidence policy going forward

Each subsequent entry should record, when applicable:

- pre-change main SHA;
- backup branch;
- work branch;
- changed files;
- tests and workflow run IDs;
- PR number/head SHA/merge SHA;
- deployment source SHA;
- schema/release/API versions;
- feature-flag state;
- D1 recovery/export/restore evidence;
- acceptance result;
- rollback reference;
- unresolved external/manual control-plane actions.

Do not edit a historical entry to make an earlier batch appear more complete. Append a correction or later verification entry instead.
