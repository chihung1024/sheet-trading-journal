# Document Quality Standard

Status: REVIEW CANDIDATE
Authority: **subordinate to `AI_PROJECT_PLAYBOOK.md`**. This document is an operational quality checklist and interpretation aid. It does not create, remove, weaken, or override any Playbook Gate.

If this standard conflicts with `AI_PROJECT_PLAYBOOK.md`, the Playbook wins. Any future mandatory governance change must satisfy a valid governance reopen condition and be integrated into the Playbook rather than silently promoted from this file.

## 1. Purpose

Keep repository documentation useful for product delivery, correctness, safety, auditability, and AI/human handoff without allowing documentation or governance work to become a self-sustaining project.

## 2. Execution-authority interpretation

`to_do_update_list.md` is the live source for current state, active Phase/Batch, blockers, and exact next action, consistent with the Playbook.

Historical plans, audits, ADRs, engineering records, issues, and superseded PRs remain evidence and candidate sources. They do not become the current active batch merely because they contain an older roadmap or unresolved recommendation.

A confirmed Master Plan remains a Working Baseline when the live handoff identifies it as such. It must not be silently replaced because of a new session, model, reviewer preference, or newer-looking document. Reopening or replacing a baseline requires current evidence and an explicit decision record consistent with the Playbook.

Remote production/CI/deployment truth overrides stale status prose.

## 3. Product-relevance checklist

The default execution focus should remain the current product objective.

Before expanding governance, infrastructure, CI/CD, audit, or documentation work, ask whether it:

- blocks the active product requirement;
- protects security, data integrity, financial correctness, or production availability;
- is required for safe deployment/rollback of the active batch; or
- produces a measurable delivery/maintenance benefit that exceeds its process and migration cost.

If none apply, the candidate should normally be classified BACKLOG or REJECT under the Playbook's convergence rules.

This checklist does not override Safety/Data Integrity/Security/Production Stability priority.

## 4. Document roles

### `README.md`

Stable product, architecture, development, testing, and deployment navigation. Not live status.

### `AI_PROJECT_PLAYBOOK.md`

Highest engineering governance and mandatory gate authority.

### `to_do_update_list.md`

Current execution/handoff truth: product goal, current Phase/Batch, blockers, decisions, risks, and exact next action.

### `docs/engineering/`

Durable engineering records with long-lived value: RCA, decisions, contracts, closeouts, and review evidence.

### `docs/governance/evidence/`

Sanitized machine-readable evidence for material production/governance claims.

### Historical plans and audits

Preserved evidence and candidate sources. Current execution authority depends on the live handoff and applicable Playbook decisions.

## 5. Document Quality Checklist

For a material document update, proportionally check:

1. **Authority** — is this the correct source of truth for the claim?
2. **Freshness** — are volatile remote facts identified and rechecked before consequential action?
3. **Product relevance** — does the content help current delivery, correctness, safety, or future handoff?
4. **Evidence** — are material claims traceable to code, contract, test, remote identifier, PR, or durable evidence where practical?
5. **Consistency** — does it avoid contradiction with a higher-authority document or remote truth?
6. **Actionability** — can the reader identify blocker and exact next action without reconstructing incident history?
7. **Compression** — is completed chronology summarized rather than retained in the live handoff?
8. **No duplicate authority** — is the same contract/status avoided across multiple competing sources of truth?
9. **No false completion** — are IMPLEMENTED, VALIDATED, MERGED, DEPLOYED, and CLOSED kept distinct?
10. **No process inflation** — does the document avoid inventing a new mandatory ceremony without Playbook authority and a defined failure mode?

R0/R1 documentation does not need a separate formal quality report unless the Playbook or actual risk requires one.

## 6. New-document checklist

Prefer updating an existing authoritative document.

A new durable document is justified when it has independent future value as a:

- stable contract/specification;
- long-lived architectural/decision record;
- reusable operational runbook;
- material RCA or closeout evidence;
- versioned methodology; or
- R2/R3 independent review record where the review itself is durable evidence.

Avoid new files for transient hypotheses, every CI run, shell-command logs, minor formatting, duplicate summaries, or one-off workflow details with no future reuse value.

## 7. Live handoff quality target

Near the top of `to_do_update_list.md`, a competent new agent should be able to determine:

- Primary Product Goal;
- single active functional Phase/Batch;
- functional acceptance criteria;
- external blockers;
- NOW / NEXT / BACKLOG / REJECT;
- stable production facts needed for safe continuation;
- locked decisions/non-goals;
- exact next actions.

Historical detail should normally be referenced rather than reproduced.

## 8. Independent Review aid — Product Relevance Test

For R2/R3 governance/infrastructure/documentation candidates, an independent reviewer should additionally test:

- What current product failure mode does this prevent or unblock?
- Could the same outcome be achieved with a smaller process surface?
- What ongoing maintenance/approval/documentation burden is introduced?
- Does that burden exceed the expected correctness or delivery benefit?
- Is the proposal NOW, NEXT, BACKLOG, or REJECT relative to the current product objective?

This is a reviewer checklist, not a new Gate. Applicable mandatory review requirements continue to come from `AI_PROJECT_PLAYBOOK.md`.

## 9. History compression

When a batch closes, preserve the outcome, material decision/RCA, important merge/deploy/evidence identifiers, rollback reference, and known limitations. Remove low-value completed operational chronology from the live handoff and retain forensic detail in Git history or dedicated evidence records when it has lasting value.

## 10. Success condition

Documentation quality is acceptable when a new competent agent can quickly determine what the product does, what is being built now, why it matters, what is blocked, what must not change, what evidence establishes the stable state, and what exact action comes next—without mistaking historical remediation or process machinery for the product roadmap.
