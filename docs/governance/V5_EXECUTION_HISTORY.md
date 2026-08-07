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

## Entry 001 — G00 repository-side implementation opened for review

- PR: `#112` — `G00C: record V5 execution baseline and tombstone legacy deployment runbook`
- PR base at creation: `main@2557fc582d3555f7b129f36d2cf5ad67c141375e`
- PR head at creation: `b4bfc8db7787ba6f66cda1272100f09e4db39cbe`
- Initial CI run observed: `31138302102` (`CI`, run number 214), initially queued when first recorded.
- Runtime/data change: **none**

### Initial independent diff check

A direct commit comparison from the approved baseline to the work branch reported four changed files only:

1. `DEPLOYMENT_FINAL.md` — historical manual deployment instructions replaced by an archive/tombstone notice.
2. `docs/V5_ZERO_DOWNTIME_EXECUTION_PLAN.md` — approved V5 execution authority.
3. `docs/governance/G00_CONTROL_PLANE_ACCEPTANCE.md` — enforceable closeout requirements for G00A/G00B/G00C.
4. `docs/governance/V5_EXECUTION_HISTORY.md` — this append-only history.

No Worker, Python financial engine, frontend runtime, workflow YAML, migration, D1 schema/data, OAuth or CORS file was changed at the time of the independent comparison.

### G00C result at PR creation

Repository-side G00C implementation is present in the PR: obsolete Worker v2.38 Quick Edit instructions no longer appear as the current production deployment procedure. The exact historical content remains available at the pre-change commit and `backup-pre-v5-wave0-2557fc5`.

### G00A/G00B result at PR creation

Still open. This entry deliberately does not upgrade either control to PASS because their authoritative state lives in GitHub control-plane settings, not repository prose.

### Why the PR head may move after this entry

This execution journal is intentionally updated with review/CI/merge evidence. Therefore later evidence-only commits can move the PR head without changing runtime scope. The final reviewed head SHA, CI conclusion and merge SHA must be appended in a later entry rather than retroactively editing this one.

## Entry 002 — G00D wall-clock coverage nondeterminism root-cause repair

- Trigger: PR `#112` changed documentation/governance only, all `125` Python functional tests passed, but the measured coverage baseline gate failed.
- Root cause: `DailyPnLHelper` reads real `datetime.now(Asia/Taipei)` and existing tests indirectly exercised different branches before/after the Taiwan market-session boundary.
- Repair PR: `#113` — `G00D: make Python coverage independent of market wall clock`
- Pre-change backup: `backup-pre-g00d-coverage-clock-2557fc5`
- Repair branch: `g00d-coverage-clock-determinism`
- Repair head before merge: `0e8ca7c6bfc6cab7be4d816e7578c3a54ded8694`
- PR CI run: `31138593008`
- PR Python result: `130 passed, 2 warnings, 7 subtests passed`
- Measured coverage after deterministic tests: `69.37849162011173%`
- `daily_pnl_helper.py`: `100%` measured coverage in the proof run.
- Worker/security/D1 checks: PASS.
- Frontend contracts/build: PASS.
- Merge SHA: `00946349b67cda32d8c3cf5cc4dbba9688470cc4`
- Post-merge main CI run: `31138682197`, PASS.
- Production runtime source changed: **no**.
- Coverage threshold weakened: **no**.

### Root-cause policy evidence

The failure was not cleared by retrying CI, lowering tolerance, or changing financial logic. The test clock was made deterministic and the unchanged coverage policy then passed in the same post-09:00 Taiwan time window that had exposed the earlier false regression.

Detailed evidence is retained in `docs/governance/G00D_COVERAGE_CLOCK_ACCEPTANCE.md` and PR `#113`.

## Entry 003 — G00C governance baseline merged after G00D repair

- PR: `#112` — `G00C: record V5 execution baseline and tombstone legacy deployment runbook`
- Original baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`
- PR branch was synchronized with `main@00946349b67cda32d8c3cf5cc4dbba9688470cc4` through an explicit two-parent merge commit; prior history was not force-rewritten.
- Final reviewed PR head: `ff74b37b8c1a1897f127aa783c8e81e42dedea5a`
- Final PR CI run: `31138766627`, PASS.
- Independent compare against then-current main still contained only the four intended governance/documentation files.
- Merge SHA: `5d34dd0d0ea76907ee315543e10ccb400103781d`
- Post-merge main CI run: `31138830694`, PASS.
- Post-merge Pages deployment run: `31138830024`, PASS.
- Runtime/data/schema change: **none**.

### G00C acceptance

`DEPLOYMENT_FINAL.md` is no longer an executable current-production Quick Edit guide. Historical content remains recoverable through Git history and `backup-pre-v5-wave0-2557fc5`.

G00A and G00B remained open after this merge because external control-plane settings had not yet been authoritatively verified.

## Entry 004 — G00A/G00B authoritative control-plane verification

- Verification time: `2026-08-07T10:49:00+08:00`
- Verified `main`: `5d34dd0d0ea76907ee315543e10ccb400103781d`
- Post-control-plane recovery branch: `backup-post-g00-control-plane-5d34dd0`
- Closeout work branch: `g00-closeout-evidence`
- Machine-readable evidence: `docs/governance/evidence/G00_CONTROL_PLANE_VERIFICATION_2026-08-07.json`
- Runtime/data/schema change: **none**.

### G00A — PASS

Fresh GitHub API reads reported:

- `main.protected=true`;
- active repository ruleset `main-protection-v5`, id `20536921`;
- target `~DEFAULT_BRANCH`;
- deletion blocked;
- non-fast-forward / force-push blocked;
- pull request required;
- approval count `0` for single-maintainer operability;
- allowed merge methods: `merge` only;
- strict required-status-check policy enabled;
- required checks:
  - `Python tests`;
  - `Worker security and deployment tests`;
  - `Frontend contracts and build`;
- bypass actor list empty;
- `current_user_can_bypass=never`.

This is materially stronger than the Wave 0 starting state, where GitHub reported no ruleset and `main.protected=false`.

### G00B production — PASS control plane

Fresh GitHub API reads reported:

- environment id `11042279942`;
- custom deployment branch policy enabled;
- exactly one deployment branch allowed: `main`;
- required-reviewer rule enabled;
- reviewer: `chihung1024`;
- `prevent_self_review=false`;
- `can_admins_bypass=true`, retained only as break-glass capability.

### G00B staging — PASS control plane

Fresh GitHub API reads reported:

- environment id `19418410152`;
- custom deployment branch policy enabled;
- exactly one deployment branch allowed: `main`;
- no required reviewer, intentionally preserving rapid staging iteration;
- `can_admins_bypass=true`, retained only as break-glass capability.

### Secret inventory verification limitation

The connected GitHub integration returned HTTP `403` when attempting to enumerate environment secret inventory. No secret value was requested or exposed. Therefore this entry does not claim direct API proof of secret values.

The deployment workflows remain fail closed:

- production executes under `environment: production` and requires named Cloudflare/D1 environment secrets;
- staging executes under `environment: staging`, requires isolated Cloudflare/D1 values plus `STAGING_GOOGLE_CLIENT_ID`, requires D1 name `trading-journal-staging`, and rejects the known production Google client id;
- both workflows require an exact 40-character source SHA reachable from `main`.

Operational secret-isolation proof is deferred to the reviewed staging and first production deployment exercises. This does not reopen the G00B control-plane requirement; it remains an explicit later deployment acceptance item.

### Wave 0 self-test still required

The newly enforced ruleset must now govern this closeout evidence itself. Wave 0 is not declared fully closed until the G00 closeout PR:

1. is created from `g00-closeout-evidence` to `main`;
2. passes all three newly required CI checks;
3. is up to date with `main` under strict status-check policy;
4. is independently diff-reviewed as governance/evidence only;
5. merges using the allowed `merge` method.

This creates operational proof that the control plane is both present and usable without bypass.
