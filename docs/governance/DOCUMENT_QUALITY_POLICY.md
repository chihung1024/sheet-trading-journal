# Document Quality Policy

Status: ACTIVE WHEN MERGED
Authority: subordinate to `AI_PROJECT_PLAYBOOK.md`; complements its Documentation Update Policy, History Compression, Review Convergence, and source-of-truth rules.

## 1. Purpose

Documentation must improve product delivery, correctness, safety, auditability, or handoff quality. Documentation is not itself a product roadmap and must not create self-sustaining process work.

## 2. Execution authority

Only the current live handoff may designate the active Phase/Batch. Historical plans, audits, ADRs, engineering records, issues, and superseded PRs are evidence or candidate sources unless the live handoff explicitly promotes an item into NOW/NEXT with current evidence.

Remote production/CI/deployment truth overrides stale status prose.

## 3. Product-first default

The default execution priority is user-visible functionality and calculation/data correctness.

A governance, infrastructure, CI/CD, audit, or documentation task may displace the product batch only when at least one is true:

- it blocks the active product requirement;
- it protects security, data integrity, financial correctness, or production availability;
- it is required for safe deployment/rollback of the active batch;
- it has a measurable delivery/maintenance benefit greater than its process and migration cost.

Otherwise classify it as BACKLOG or REJECT.

## 4. Document roles

### `README.md`

Stable product, architecture, local development, testing, and deployment navigation. Never live status.

### `AI_PROJECT_PLAYBOOK.md`

Highest engineering governance. Change only when a real governance reopen condition exists.

### `to_do_update_list.md`

Current product-first execution truth. Must make the product goal, single active batch, blocker, exact next action, and non-goals visible before historical detail.

### `docs/engineering/`

Durable decisions, RCA, contracts, closeouts, and engineering evidence with long-lived value.

### `docs/governance/evidence/`

Sanitized machine-readable evidence for production/governance claims.

### Historical plans and audits

Retained as evidence. They do not automatically control current execution order.

## 5. Document Quality Gate

A material document update is acceptable only when applicable checks pass:

1. **Authority** — the document is the correct source of truth for the claim.
2. **Freshness** — volatile remote facts are timestamped/identified and rechecked before consequential action.
3. **Product relevance** — the content helps current product delivery, correctness, safety, or future handoff.
4. **Evidence** — material factual claims point to code, contract, remote identifier, test, PR, or durable record where practical.
5. **Consistency** — it does not contradict a higher-authority document or current remote truth.
6. **Actionability** — live status identifies the exact next action and blocker without reconstructing incident history.
7. **Compression** — completed detail is summarized; low-value chronology is removed from live documents.
8. **No duplication** — the same contract/status is not copied into multiple authoritative locations.
9. **No false completion** — IMPLEMENTED, VALIDATED, MERGED, DEPLOYED, and CLOSED remain distinct.
10. **No process inflation** — the update does not introduce a new mandatory ceremony without a defined failure mode it prevents.

R0/R1 documentation does not require a separate formal quality report. Apply this gate proportionally.

## 6. New-document gate

Prefer modifying an existing authoritative document.

Create a new durable document only when it has independent future value as one of:

- stable contract/specification;
- long-lived architectural/decision record;
- reusable operational runbook;
- material RCA or closeout evidence;
- versioned methodology;
- independent review record for an R2/R3 candidate when the review itself is important evidence.

Do not create a new file merely to record:

- a transient hypothesis;
- every CI run;
- every shell command;
- minor formatting;
- a summary already captured by an authoritative file;
- a one-off workflow step with no future reuse value.

## 7. Live handoff minimum structure

`to_do_update_list.md` must keep these near the top:

1. Primary Product Goal.
2. Single Active Functional Phase/Batch.
3. Functional acceptance criteria.
4. Current external blockers.
5. NOW / NEXT / BACKLOG / REJECT.
6. Stable production state needed for safe continuation.
7. Locked decisions/non-goals.
8. Exact next actions.

Historical detail should be referenced, not reproduced.

## 8. Independent review — Product Relevance Test

For R2/R3 governance/infrastructure/documentation candidates, Independent Review must answer in addition to correctness/risk checks:

- What current product failure mode does this prevent or unblock?
- Could the same outcome be achieved with a smaller process surface?
- Does the proposal create ongoing maintenance/approval/documentation burden?
- Does that burden exceed the expected correctness or delivery benefit?
- Is the proposal NOW, NEXT, BACKLOG, or REJECT relative to the current product objective?

A technically correct governance proposal can still be rejected for insufficient product relevance.

## 9. History compression

When a batch closes:

- keep outcome, material decision, RCA, exact merge/deploy/evidence identifiers, rollback reference, and known limitations;
- remove completed low-value operational chronology from the live handoff;
- preserve forensic detail in Git history or dedicated evidence records when it has lasting value.

## 10. Quality objective

The repository documentation is healthy when a new competent agent can determine, with minimal reading:

- what the product currently does;
- what is being built now;
- why it matters to the user;
- what is blocked;
- what must not be changed;
- what evidence establishes the current stable state;
- what exact action comes next.
