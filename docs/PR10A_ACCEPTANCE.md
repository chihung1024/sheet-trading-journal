# PR-10A Acceptance Contract

## Identity

- Issue: `#66`
- Baseline main SHA: `35e629ade1c3155ad5e44b839135d4406f9a4170`
- Working branch: `pr10a-audit-governance`
- Pre-change backup ref: `backup-pre-pr10a-35e629a`
- Worker release/API/schema remain: `4.07` / `2.60` / `2`

## Objective

PR-10A establishes the audit and remediation governance baseline required before any production behavior or financial methodology changes.

## Allowed changed paths

- `docs/audits/**`
- `docs/governance/**`
- `docs/MASTER_REMEDIATION_PLAN.md`
- `docs/ZERO_DOWNTIME_CHANGE_POLICY.md`
- `docs/PR10A_ACCEPTANCE.md`
- `tests/test_audit_governance.py`

Any other changed path is a release blocker unless the issue and this contract are amended before review.

## Required deliverables

- [x] Three-round audit archive with exact baseline.
- [x] Stable risk identifiers.
- [x] Machine-readable risk register.
- [x] B00–B15 remediation sequence.
- [x] PR decomposition from PR-10A through the durable compute migration.
- [x] Expand, backfill, dual-write, shadow, canary, cutover, and contract policy.
- [x] Old frontend, old Worker, queued job, old snapshot, and legacy service-worker compatibility gates.
- [x] Rollback hierarchy.
- [x] Deterministic governance regression test.

## Explicit exclusions

This PR must not change:

- Worker runtime.
- Frontend runtime.
- Calculation formulas.
- Market-data behavior.
- Authentication or CORS.
- D1 schema or production data.
- GitHub Actions workflow behavior.
- Package or Python dependencies.
- Release, API, schema, or package version.

## Validation gates

1. `python -m pytest -q tests/test_audit_governance.py`
2. Existing full Python suite remains green.
3. Existing Worker test suite remains green.
4. Existing Worker config and D1 schema checks remain green.
5. Existing frontend production build remains green.
6. Compare against baseline shows only allowed paths.
7. Risk register JSON parses and contains exactly 50 unique `RISK-NNN` entries.
8. Every risk has severity, subsystem, target batch, migration class, rollback class, acceptance, and status.
9. Every target batch is defined in the master plan.
10. Every risk ID is retained in the audit archive or machine-readable register.
11. No full email address, credential, private transaction data, or production secret is introduced.

## Independent review checklist

- [ ] Confirm baseline SHA did not move before branch creation.
- [ ] Confirm no existing runtime file was modified.
- [ ] Confirm governance test fails if a required document is missing.
- [ ] Confirm governance test fails for duplicate or malformed risk IDs.
- [ ] Confirm governance test fails for unknown target batches or rollback classes.
- [ ] Confirm the plan does not claim that unresolved findings are already fixed.
- [ ] Confirm the plan keeps legacy paths available until their contract stage.
- [ ] Confirm rollback never starts with a destructive database restore.
- [ ] Confirm public evidence contains no personal identifiers.

## Merge contract

PR-10A may be merged only when:

- The pull-request head SHA is unchanged from the reviewed SHA.
- Required checks are green.
- Independent review finds no out-of-scope change.
- The issue and PR contain exact validation evidence.
- A post-merge backup ref is created.

## Rollback

This change is additive and does not alter runtime behavior. Rollback is a normal revert of the merge commit. No D1, Worker, Pages, OAuth, market-data, or calculation rollback is required.
