# Repository Docs / Actions Hygiene — 2026-08-10

Status: **VALIDATING**  
Risk class: **R2 — Significant**

## Objective

Restore a complete governance baseline, remove current-facing documentation ambiguity, delete only proven no-value standalone documents, and verify that current GitHub Actions inventory is already minimal/machine-enforced before returning to Gate E / E1a production activation.

## Root Cause

PR #175 replaced `AI_PROJECT_PLAYBOOK.md` with only the V3 Final Hardening patch rather than integrating the patch into the complete V3 constitution. CI remained green because no repository test validated governance-document completeness.

This batch restores the complete V3 and adds a structural regression guard.

## Scope

Changed current/governance documents:

- `AI_PROJECT_PLAYBOOK.md`
- `to_do_update_list.md`
- `docs/README.md`
- `docs/DEPLOYMENT.md`
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`
- `docs/governance/V5_CURRENT_HANDOFF.md`
- `docs/governance/PR_10D3D_B_PRODUCTION_IDENTITY_EVIDENCE_ACCEPTANCE.md`

Validation:

- `tests/test_repository_governance.py`

Deleted as fully superseded/no-current-reference standalone root material:

- `AUDIT_TRADING_CALC_REVIEW.md`
- `TRADING_CALC_OPTIMIZATION_PLAN.md`

## Explicit non-goals

- no runtime source change;
- no config/secret/environment change;
- no GitHub workflow file change;
- no D1/schema/migration change;
- no financial/calculation behavior change;
- no frontend behavior change;
- no production deployment;
- no broad deletion of audit/acceptance/evidence history.

## Actions audit result

The current repository tracks exactly seven workflow files and that set is already fail-closed by `docs/governance/github-actions-pins.json` + `tests/test_workflow_supply_chain.py`.

Historical deleted one-off workflows may remain visible as GitHub Actions UI registrations. They are not current repository workflows. The available GitHub connector does not expose a disable/delete-workflow mutation, so this batch does not make a false claim that GitHub historical registrations were removed.

## Recovery

Pre-batch recovery:

`backup-pre-docs-actions-hygiene-ca7c864`

Working base:

`main@ca7c8649664b12c9bd4dda530c3b072354767ce8`

Rollback before merge: delete/recreate the working branch from the recovery baseline.

Rollback after merge: normal protected revert of the hygiene PR. No production runtime/data rollback is required because this batch has no production mutation.

## Verification Gate

Before merge:

1. exact final diff remains limited to the declared hygiene scope;
2. final Risk Class remains R2;
3. required exact-head CI passes;
4. governance completeness regression passes;
5. existing Actions inventory/supply-chain test passes;
6. Independent Review Gate runs against exact candidate head with fresh primary evidence;
7. `BLOCKER = 0`;
8. merge uses expected exact head.

After merge:

- verify post-main CI;
- create post-hygiene recovery;
- close current handoff accurately;
- begin E1a-A1 Production Identity Evidence.
