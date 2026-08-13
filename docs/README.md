# Documentation Map

This directory separates **current operational authority** from **architecture/contracts** and **historical evidence**. Do not infer current state from an old acceptance, audit, release, recovery, or completed Gate plan.

## Future-AI bootstrap / source-of-truth order

For any live decision, use this order:

1. re-check current GitHub remote truth: protected `main`, open PRs, CI, Pages/deployments, and applicable workflow runs;
2. inspect current runtime/config/workflow code and machine-readable contracts;
3. read `AI_PROJECT_PLAYBOOK.md` for governance and review/debug rules;
4. read `README.md` for product/architecture orientation;
5. read `to_do_update_list.md` for the current Phase / Batch / blocker / exact next action;
6. use the current operational runbook for the active action, especially `DEPLOYMENT.md` for production activation;
7. use architecture / ADR / versioned contracts for design constraints;
8. use historical acceptance, audit, evidence, Gate plans, and Git/PR history for provenance only.

If two sources disagree, the lower item does not override a higher current authority. **Remote truth and machine contracts override stale prose.** A historical PASS proves only what that evidence was explicitly bound to; it is not transferable authorization for a later source SHA.

## Current operational documents

- `../AI_PROJECT_PLAYBOOK.md` — governance baseline. V3.0 is frozen unless a documented reopen condition is met.
- `../README.md` — product overview and architecture/navigation entry point.
- `../to_do_update_list.md` — current-state-first execution handoff and exact next actions.
- `DEPLOYMENT.md` — canonical deployment navigation and NOW-1A production-activation runbook.

The current product line is defined by `to_do_update_list.md`, not by an older Gate-E plan. At the 2026-08-13 whole-project recheck, Product Functionality Review / NOW-1 is active; E1a/E1b/E1c are closed.

## Machine-readable authority

These are not narrative documentation and must not be replaced by prose assumptions:

- `../worker-manifest.json`
- `../config/deployment-environments.json`
- `../config/production-activation-authority.json`
- `../config/recovery-evidence-gate.json`
- `governance/github-actions-pins.json`
- `governance/python-coverage-baseline.json`
- current `.github/workflows/*.yml`
- current verifier/test code under `tools/` and `tests/`

For production activation, especially distinguish:

- repository source contract (`worker-manifest.json`);
- last verified live production runtime;
- exact runtime candidate/evidence SHA `R`;
- later activation-authority SHA `A`;
- immutable recovery evidence baseline.

Do not collapse these into one generic “current SHA”.

## Architecture and completed operational records

- `engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — architecture-roadmap provenance/constraints; it is **not** the current execution handoff.
- `engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — **COMPLETED / HISTORICAL** E1a production activation record; it is not a current Gate-E plan.
- `engineering/GATE_E_E1A_B_CLOSEOUT_2026-08-10.md` and later Gate-E closeouts — completed production evidence retained for provenance.
- `engineering/GATE_E_E1C_JOB_LIFECYCLE_2026-08-11.md` — completed E1c lifecycle record.
- `engineering/MD_EVENT_ROW_SEMANTIC_NORMALIZATION_2026-08-13.md` — durable root-cause/evidence record for the generic provider event-row fix.

`engineering/` contains current architecture decisions plus completed Gate-C/Gate-D/Gate-E audit and closeout records. Closed-gate documents are retained because they explain financial-integrity, privacy, lifecycle, recovery, and reproducibility contracts still enforced by code/tests.

Do not delete or reactivate a closed-gate record merely because it contains detailed steps. Compress live handoff references instead.

## Governance and audit archive

`governance/`, `governance/evidence/`, and `audits/` contain acceptance contracts, machine evidence, failure history, recovery history, and independent audit records.

These files are historical/forensic evidence unless a current document explicitly names one as an active contract. Historical evidence must not be rewritten to make a later state appear to have existed earlier.

`governance/V5_CURRENT_HANDOFF.md` is retained only as a D3D historical closeout/navigation record. It is not the current Gate-E or product-functionality handoff.

## Archived compatibility material

- `../DEPLOYMENT_FINAL.md` is an explicit tombstone for an obsolete manual Worker deployment procedure. It remains because the warning itself prevents accidental reuse and historical documents reference it.
- `../cloudflare worker/` is a legacy Worker archive. `worker-entry.js` + `worker.js` are the current deployment path; tests and `worker-manifest.json` enforce that distinction.

## Cleanup rule

Delete a document only when all of the following are true:

- it has no current operational/contract authority;
- it is fully superseded by a stronger current source;
- it has no unique audit, acceptance, recovery, or forensic value;
- current code/tests/docs do not depend on it;
- Git history is sufficient for any remaining archaeology.

Do not create new one-off root-level audit/plan documents. New durable material belongs in the appropriate `docs/` category; transient reasoning belongs in PR discussion or `to_do_update_list.md` only when it affects handoff.

## GitHub Actions hygiene

The repository intentionally tracks only the workflows enumerated by `governance/github-actions-pins.json`; `tests/test_workflow_supply_chain.py` fails closed if tracked workflow inventory drifts.

GitHub may continue to display historical workflow registrations for workflow files that were deleted in prior commits. A historical UI registration is not an active repository workflow. Do not recreate or run a deleted one-off PR/release workflow merely to clean the Actions list.
