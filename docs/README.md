# Documentation Map

This directory separates **current operational authority** from **architecture/contracts** and **historical evidence**. Do not infer current state from an old acceptance, audit, release, or recovery document.

## Source-of-truth order

For any live decision, use this order:

1. current GitHub / CI / deployment remote state;
2. current runtime/config/workflow code and machine-readable contracts;
3. `AI_PROJECT_PLAYBOOK.md` for governance;
4. `to_do_update_list.md` for current Phase / Batch / blocker / next action;
5. current operational plan or runbook for the active Batch;
6. architecture / ADR / versioned contracts;
7. historical acceptance, audit, evidence, and Git/PR history.

If two documents disagree, the lower item does not override a higher current authority.

## Current operational documents

- `../AI_PROJECT_PLAYBOOK.md` — governance baseline. V3.0 is frozen unless a documented reopen condition is met.
- `../to_do_update_list.md` — current-state-first execution handoff.
- `DEPLOYMENT.md` — canonical deployment navigation and production activation runbook.
- `engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — current Gate E / E1a zero-downtime activation sequence.
- `engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — Gate-E architecture roadmap authority; operational sequencing is refined by the current E1a plan above.

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

## Engineering records

`engineering/` contains current architecture decisions plus completed Gate-C/Gate-D audit and closeout records. Closed-gate documents are retained because they explain financial-integrity and reproducibility contracts still enforced by code/tests.

Do not delete a closed-gate record merely because the gate is complete. Compress live handoff references instead.

## Governance and audit archive

`governance/`, `governance/evidence/`, and `audits/` contain acceptance contracts, machine evidence, failure history, recovery history, and independent audit records.

These files are historical/forensic evidence unless a current document explicitly names one as an active contract. Historical evidence must not be rewritten to make a later state appear to have existed earlier.

`governance/V5_CURRENT_HANDOFF.md` is retained only as a D3D historical closeout/navigation record. It is not the current Gate-E handoff.

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
