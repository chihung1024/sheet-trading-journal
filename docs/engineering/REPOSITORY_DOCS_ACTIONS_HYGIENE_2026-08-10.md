# Repository Docs / Actions Hygiene — 2026-08-10

Status: **CLOSED / POST-MAIN VERIFIED**  
Risk class: **R2 — Significant**

## Objective

Restore a complete governance baseline, remove current-facing documentation ambiguity, delete only proven no-value standalone documents, and verify that current GitHub Actions inventory is minimal/machine-enforced before returning to Gate E / E1a production activation.

## Root Cause

PR #175 replaced `AI_PROJECT_PLAYBOOK.md` with only the V3 Final Hardening patch rather than integrating the patch into the complete V3 constitution. CI remained green because no repository test validated governance-document completeness.

## Result

PR #176 restored the complete locked V3 governance constitution, added a semantic completeness regression guard, established a documentation source-of-truth map, re-baselined Gate-E deployment/handoff authorities, reclassified D3D current-looking records as historical, corrected the B1 collector/live-evidence distinction, and removed two fully superseded standalone root documents.

Changed current/governance documents:

- `AI_PROJECT_PLAYBOOK.md`
- `to_do_update_list.md`
- `docs/README.md`
- `docs/DEPLOYMENT.md`
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`
- `docs/governance/V5_CURRENT_HANDOFF.md`
- `docs/governance/PR_10D3D_B_PRODUCTION_IDENTITY_EVIDENCE_ACCEPTANCE.md`

Validation added:

- `tests/test_repository_governance.py`

Deleted as fully superseded/no-current-reference standalone root material:

- `AUDIT_TRADING_CALC_REVIEW.md`
- `TRADING_CALC_OPTIMIZATION_PLAN.md`

No runtime/config/workflow/schema/financial/frontend/production behavior was changed.

## Actions audit result

Current repository workflow inventory remains exactly seven tracked workflow files and is fail-closed by `docs/governance/github-actions-pins.json` plus `tests/test_workflow_supply_chain.py`.

Historical deleted one-off workflows may remain visible as GitHub Actions UI registrations. They are not current repository workflows. The available GitHub connector does not expose a disable/delete-workflow mutation, so this batch does not claim those remote historical registrations were removed.

## Verification

PR #176:

- base: `ca7c8649664b12c9bd4dda530c3b072354767ce8`;
- exact reviewed head: `df99da95d6a80f099d33e5cfcf2a7d340bad785b`;
- exact-head CI #567 / run `31361469797`: **SUCCESS**;
- Same-AI Independent Review under V3 isolation: **PASS — NO BLOCKER**;
- review threads: `0`;
- exact-head merge: `b03fed2d0d26807d7d617d51e6ed9f0aab3767a9`;
- post-main CI #568 / run `31361899913`: **SUCCESS** across Python / Frontend / Worker-D1;
- post-hygiene recovery: `backup-post-docs-actions-hygiene-b03fed2`.

## Recovery

Pre-batch:

`backup-pre-docs-actions-hygiene-ca7c864`

Post-batch:

`backup-post-docs-actions-hygiene-b03fed2`

A normal protected revert of PR #176 remains the repository rollback path. No production/data rollback is required because this batch performed no production mutation.

## Closeout

Gate E / E1a-A0 repository stabilization is complete.

Next active batch:

> **E1a-A1 — Production Identity Evidence**

Required first action: manually dispatch the reviewer-protected GET-only workflow against the exact then-current protected-main SHA. Do **not** dispatch `Deploy Worker` first.
