# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: restore reliable web `立即更新` portfolio recalculation without weakening idempotency, data integrity, or lifecycle correctness.
- Working branch: `fix/web-update-dispatch-recovery-20260826`.
- Baseline main: `28bea37098beceeba6ddae958f180833d26c71db`.
- Pull request: **#424**.

## Stable State

Terminal release `terminal-final-2026-08-21` remains the last known production checkpoint. Manual/scheduled calculation can execute independently of the web calculation-job callback path. Production D1 remains authoritative. No production deployment has been performed by this recovery branch.

## Architecture Notes

Web update path:

`Browser -> POST /api/trigger-update -> Worker calculation_jobs -> GitHub workflow_dispatch update.yml -> workflow running callback -> Python calculation/upload -> terminal callback -> browser polling`.

Manual GitHub Action with empty `calculation_job_id` bypasses the calculation-job callback lifecycle and therefore is not an equivalent validation of the web path.

The terminal Worker already uses `worker-entry.js` as the controlled entry layer in front of the canonical `worker.js`. R1-B1 adds one narrowly scoped recovery module at that existing boundary; it does not redesign the canonical calculation engine or data model.

## Master Plan

### Phase R1 — web update production defect recovery

#### Batch R1-B1 — root-cause correction

Objective: allow an ambiguous Worker -> GitHub dispatch failure to recover only when the real GitHub workflow supplies positive `running` callback evidence.

In scope:
- `worker-calculation-dispatch-recovery.js`;
- minimal `worker-entry.js` integration;
- one focused deterministic regression file;
- CI wiring for that regression;
- this handoff/playbook.

Out of scope:
- financial calculations;
- records/cash/dividend behavior;
- D1 schema changes;
- frontend redesign;
- timeout-only tuning;
- age-only queued expiry;
- snapshot-upload transient HTTP 500 RCA;
- generalized workflow/deployment framework.

Allowed investigation: current Worker/job state machine, update workflow, frontend recovery semantics, recent Actions evidence, and existing terminal deployment constraints.

Expansion trigger: only new evidence showing the defect cannot be corrected inside the dispatch/callback lifecycle or a data-integrity/security blocker.

Acceptance:
1. trusted positive GitHub `running` callback can recover only `GITHUB_DISPATCH_TIMEOUT` / `GITHUB_DISPATCH_FAILED` jobs with no bound run ID;
2. explicit GitHub rejection remains terminal;
3. a delayed callback is blocked if another same-user/same-benchmark job is already active;
4. Worker syntax, frontend build, Python compile, and exact-head CI pass;
5. independent review has zero BLOCKER;
6. production web smoke reaches terminal success/failure and does not remain stuck.

#### Batch R1-B2 — production activation / smoke

Only after B1 merge. Verify a valid deployment path exists, deploy exact merged Worker source, then perform one normal web update and verify Worker/GitHub/browser terminal lifecycle. Do not recreate broad retired infrastructure merely to deploy this fix.

## Current Phase / Batch

- Phase: R1
- Current Batch: R1-B1
- State: **IMPLEMENTED / FINAL REVIEW IN PROGRESS**.

## Root Cause Log

### RC-2026-08-26-01 — web update callback conflict

Evidence:
- multiple web-dispatched `Update Portfolio Data` runs fail at `Mark calculation job running` with Worker HTTP 409 before Python starts;
- the same failed workflows subsequently report their terminal `failed` callback successfully, which rules against a different already-bound GitHub run ID as the 409 cause;
- manual Action succeeds with empty `CALCULATION_JOB_ID`, proving the calculation engine can run while bypassing the failing lifecycle;
- Worker dispatch has a 5-second timeout;
- Worker catch path labels the situation ambiguous but calls `failQueuedDispatch`, making the job terminal before a delayed positive callback can advance it.

Root cause: Worker treats an ambiguous GitHub dispatch transport outcome as definitive failure. If GitHub accepted the dispatch despite response timeout/loss, the later positive workflow callback collides with the prematurely terminalized D1 job.

Systemic cause: positive GitHub callback evidence had no controlled way to reconcile a job terminalized solely by an ambiguous dispatch transport failure.

Status: **CONFIRMED BY CODE + REPEATED ACTION EVIDENCE; production D1 row inspection remains unavailable from current connected tools.**

## Decision Log

### D-2026-08-26-01

Decision: reject timeout-only extension and age-only queued expiry as permanent fixes.

Reason: timeout tuning changes probability, not mutation certainty; elapsed age cannot prove a GitHub run is dead. Historical project decisions already rejected age-only orphan guessing.

Reopen condition: only if GitHub platform behavior removes the trusted callback evidence or a new production failure disproves the current lifecycle diagnosis.

### D-2026-08-26-02

Decision: use the existing system-authenticated GitHub `running` callback itself as the minimum exact dispatch-success evidence. No additional GitHub run-list API, new status enum, or D1 migration is required.

The recovery is allowed only when:
- current row is `failed`;
- `error_code` is `GITHUB_DISPATCH_TIMEOUT` or `GITHUB_DISPATCH_FAILED`;
- `github_run_id` is still NULL;
- callback supplies a valid GitHub run ID;
- no other same-user/same-benchmark row is `queued` or `running`.

This is an evidence-based state repair, not age-based guessing. If any condition fails, canonical fail-closed behavior remains unchanged.

## Change Log

- 2026-08-26: created recovery branch from frozen `main` checkpoint.
- 2026-08-26: created `AI_PROJECT_PLAYBOOK.md` and this handoff because both were absent from terminal tree.
- 2026-08-26: added `worker-calculation-dispatch-recovery.js` and integrated it at `worker-entry.js` before the canonical status handler.
- 2026-08-26: added focused Node regression and CI invocation.
- 2026-08-26: PR #424 opened from exact frozen baseline.
- 2026-08-26: Terminal Integrity run #1473 passed all three jobs on implementation head `4ddb1d6906db331e7cbe8a6fe1e51c46d465d581`: Worker recovery regression PASS, Worker syntax PASS, frontend build PASS, Python compile PASS.

## Known Issues

- Production has not yet received this recovery code; user-visible web update remains unverified until R1-B2 deployment/smoke.
- A separate transient portfolio snapshot upload HTTP 500 has been observed in manual/scheduled execution; later retry succeeded.

## Technical Debt

None promoted into the active batch beyond the root-cause lifecycle gap.

## Deferred / Rejected Candidates

- BACKLOG: investigate transient snapshot upload HTTP 500 if it recurs.
- REJECT: simply increase GitHub dispatch timeout as the full fix.
- REJECT: expire queued jobs based only on elapsed age.
- REJECT: broad refactor of the canonical calculation-job state machine.
- REJECT: add GitHub run-list reconciliation/API polling when the existing trusted callback already supplies the required positive evidence.

## Risks

- Incorrect recovery could duplicate a calculation run or suppress a legitimate run.
- The implementation prevents that class by using one conditional D1 UPDATE with `NOT EXISTS` for any other same-user/same-benchmark active job.
- A conflicting pre-bound GitHub run ID cannot be overwritten because recovery requires `github_run_id IS NULL`.
- Production activation is not yet available through the current retained repository workflows; deployment capability must be verified in R1-B2 rather than silently rebuilding retired infrastructure.

## Next Actions

1. Complete independent review of exact PR #424 head; fix only BLOCKER findings.
2. Confirm final-head CI after this handoff-only commit.
3. Merge with expected-head SHA if review and CI remain clean.
4. Start R1-B2: verify the minimum valid production deployment path.
5. Deploy exact merged source and run one normal web update smoke.
6. Stop when the web flow reaches terminal success/failure without the prior callback 409/stuck lifecycle.

## Batch Completion Record

R1-B1: **IMPLEMENTED; MERGE PENDING**.

- Scope: narrow Worker callback lifecycle recovery + required handoff/test/CI only.
- Files Changed: `.github/workflows/ci.yml`, `AI_PROJECT_PLAYBOOK.md`, `to_do_update_list.md`, `worker-calculation-dispatch-recovery.js`, `worker-entry.js`, `tests/worker_calculation_dispatch_recovery.test.mjs`.
- Root Cause: documented and addressed with positive-evidence recovery.
- Implementation: COMPLETE on PR branch.
- Verification: implementation-head CI #1473 PASS; final handoff head re-verification pending.
- Regression: targeted Node test PASS on CI #1473.
- Commit: implementation head `4ddb1d6906db331e7cbe8a6fe1e51c46d465d581`; this handoff update advances the PR head.
- PR: #424 open.
- Release/Deployment: NOT STARTED; belongs to R1-B2 after merge.
- Rollback: branch base `28bea37098beceeba6ddae958f180833d26c71db` / terminal release.
- Follow-up: final review -> expected-head merge -> production activation/smoke.
