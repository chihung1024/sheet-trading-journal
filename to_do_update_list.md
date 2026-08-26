# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: restore reliable web `立即更新` portfolio recalculation without weakening idempotency, data integrity, or lifecycle correctness.
- Working branch: `fix/web-update-dispatch-recovery-20260826`.
- Baseline main: `28bea37098beceeba6ddae958f180833d26c71db`.

## Stable State

Terminal release `terminal-final-2026-08-21` remains the last known production checkpoint. Manual/scheduled calculation can execute independently of the web calculation-job callback path. Production D1 remains authoritative.

## Architecture Notes

Web update path:

`Browser -> POST /api/trigger-update -> Worker calculation_jobs -> GitHub workflow_dispatch update.yml -> workflow running callback -> Python calculation/upload -> terminal callback -> browser polling`.

Manual GitHub Action with empty `calculation_job_id` bypasses the calculation-job callback lifecycle and therefore is not an equivalent validation of the web path.

## Master Plan

### Phase R1 — web update production defect recovery

#### Batch R1-B1 — root-cause correction

Objective: make Worker -> GitHub dispatch ambiguity recover from positive GitHub run evidence instead of converting an uncertain dispatch into a conflicting terminal job.

In scope:
- `worker.js` dispatch lifecycle only as required by the root cause;
- `.github/workflows/update.yml` only if exact opaque job/run correlation is required;
- one focused deterministic regression test;
- CI wiring for that focused test;
- this handoff/playbook.

Out of scope:
- financial calculations;
- records/cash/dividend behavior;
- D1 schema changes;
- frontend redesign;
- snapshot-upload transient HTTP 500 RCA;
- generalized workflow framework or new deployment architecture.

Allowed investigation: current Worker/job state machine, update workflow, frontend recovery semantics, recent Actions evidence, and existing terminal deployment constraints.

Expansion trigger: only new evidence showing the defect cannot be corrected inside the dispatch/callback lifecycle or a data-integrity/security blocker.

Acceptance:
1. deterministic timeout/response-loss regression demonstrates recovery from an actually-created GitHub run;
2. no exact GitHub run evidence fails closed;
3. callback binding/conflict invariants remain intact;
4. Worker syntax, frontend build, Python compile, and exact-head CI pass;
5. independent review has zero BLOCKER;
6. production web smoke reaches terminal success/failure and does not remain stuck.

#### Batch R1-B2 — production activation / smoke

Only after B1 merge. Verify a valid deployment path exists, deploy exact merged Worker/workflow source, then perform one normal web update and verify Worker/GitHub/browser terminal lifecycle. Do not recreate broad retired infrastructure merely to deploy this fix.

## Current Phase / Batch

- Phase: R1
- Current Batch: R1-B1
- State: **IN PROGRESS**

## Root Cause Log

### RC-2026-08-26-01 — web update callback conflict

Evidence:
- multiple web-dispatched `Update Portfolio Data` runs fail at `Mark calculation job running` with Worker HTTP 409 before Python starts;
- manual Action succeeds with empty `CALCULATION_JOB_ID`, proving the calculation engine can run while bypassing the failing lifecycle;
- Worker dispatch has a 5-second timeout;
- Worker catch path labels the situation ambiguous but calls `failQueuedDispatch`, making the job terminal before a delayed positive callback can advance it.

Root cause: Worker treats an ambiguous GitHub dispatch transport outcome as definitive failure. If GitHub accepted the dispatch despite response timeout/loss, the later positive workflow callback collides with the prematurely terminalized D1 job.

Systemic cause: dispatch acceptance truth and durable calculation-job truth are not reconciled after an ambiguous Worker -> GitHub mutation outcome.

Status: **CONFIRMED BY CODE + REPEATED ACTION EVIDENCE; production D1 row inspection unavailable from current connected tools.**

## Decision Log

### D-2026-08-26-01

Decision: reject timeout-only extension and age-only queued expiry as permanent fixes.

Reason: timeout tuning changes probability, not mutation certainty; elapsed age cannot prove a GitHub run is dead. Historical project decisions already rejected age-only orphan guessing.

Reopen condition: only if GitHub platform behavior removes any means to obtain exact run evidence and a new reviewed lifecycle model is required.

### D-2026-08-26-02

Decision: use privacy-safe opaque calculation-job identity for exact GitHub run correlation if reconciliation is required. Do not expose tenant email or other user identity.

Status: working baseline for R1-B1.

## Change Log

- 2026-08-26: created recovery branch from frozen `main` checkpoint.
- 2026-08-26: created `AI_PROJECT_PLAYBOOK.md` and this handoff because both were absent from terminal tree.

## Known Issues

- Web-triggered calculation jobs can conflict at the first workflow callback and skip calculation.
- A separate transient portfolio snapshot upload HTTP 500 has been observed in manual/scheduled execution; later retry succeeded.

## Technical Debt

None promoted into the active batch beyond the root-cause lifecycle gap.

## Deferred / Rejected Candidates

- BACKLOG: investigate transient snapshot upload HTTP 500 if it recurs.
- REJECT: simply increase GitHub dispatch timeout as the full fix.
- REJECT: expire queued jobs based only on elapsed age.
- REJECT: broad refactor of calculation-job state machine while the narrow lifecycle correction is sufficient.

## Risks

- Incorrect recovery could duplicate a calculation run or suppress a legitimate run.
- Incorrect callback relaxation could allow a conflicting GitHub run identity to overwrite durable identity.
- Production activation is currently not guaranteed because terminal cleanup removed prior deployment workflows; deployment capability must be verified after code/CI acceptance.

## Next Actions

1. Implement the narrow R1-B1 dispatch ambiguity correction.
2. Add the minimum deterministic regression test and CI invocation.
3. Review exact diff and run PR CI.
4. Perform independent review; fix only BLOCKER findings.
5. Merge expected head if accepted.
6. Verify production deployment path and execute B1 production smoke.

## Batch Completion Record

R1-B1: **NOT DONE**.

- Scope: defined.
- Files Changed: playbook + handoff so far.
- Root Cause: documented.
- Implementation: NOT COMPLETE.
- Verification: NOT VERIFIED.
- Regression: NOT VERIFIED.
- Commit: documentation recovery point created.
- PR: not opened.
- Release/Deployment: not started.
- Rollback: branch base `28bea37098beceeba6ddae958f180833d26c71db`.
- Follow-up: implement minimal runtime correction.
