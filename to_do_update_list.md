# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: make portfolio calculation execution independent of trigger source: schedule, manual GitHub dispatch, and web `立即更新` must all reach the same calculation engine without a web-only lifecycle prerequisite.
- Current main before this batch: `ce4e4a709ee87abad9838e49a57b7f0c34a53b49`.
- Active branch: `fix/unify-calculation-pipeline-20260826`.
- Active Batch: **R1-B3 — trigger-invariant calculation path**.
- D1 schema migration: **NONE**.

## Stable / Observed State

- Terminal release checkpoint remains `terminal-final-2026-08-21` / `28bea37098beceeba6ddae958f180833d26c71db` until a new production recovery checkpoint is verified.
- PR #424 merged the first dispatch-callback recovery.
- PR #425 merged bounded production activation control.
- PR #427 bounded stale browser calculation recovery state.
- PR #428 kept the manual update control actionable; main merge commit `ce4e4a709ee87abad9838e49a57b7f0c34a53b49`; Terminal Integrity #1486 PASS.
- The user subsequently reported that Cloudflare deployment had been completed. Exact currently deployed Worker source SHA has not yet been independently verified in this execution context.
- Production D1 remains authoritative.

## First-Principles Invariant

Trigger source may change scope/context, but must not change whether the core calculation is allowed to run.

Required execution shape:

`any trigger -> resolve trusted calculation context -> run_portfolio_update.py -> upload snapshot -> report optional lifecycle/result metadata`

Forbidden execution shape:

`web trigger -> lifecycle/status checkpoint -> only then run calculation`

Lifecycle/status is control-plane metadata. It must not be a prerequisite for the calculation engine.

## Root Cause

### RC-2026-08-26-01 — web-only pre-calculation lifecycle gate

Evidence:
- scheduled/manual workflow paths with empty `calculation_job_id` skipped `Mark calculation job running` and reached Python calculation;
- web-triggered runs with `calculation_job_id` executed `Mark calculation job running` before Python;
- web runs #3383/#3385/#3386 failed at that callback with HTTP 409 and therefore skipped Python;
- manual run #3390 succeeded through the same Python calculation/upload path.

Root cause: `update.yml` made the control-plane `running` callback a hard prerequisite only for the web trigger path. The calculation engine itself was not the failing component.

Contributing root cause: canonical Worker imposed a 5-second abort on the GitHub dispatch response. GitHub could accept/create the workflow after that local timeout, while Worker had already terminalized the D1 job; the later web-only `running` callback then collided with that terminal state.

The previous recovery module repaired the collision after it occurred. R1-B3 removes the structural cause instead of retaining that recovery as permanent architecture.

## R1-B3 — Trigger-Invariant Calculation Path

### Objective

Remove the web-only pre-calculation gate and the artificial 5-second dispatch abort, then delete the callback-recovery shim that is no longer required.

### Implementation

- `.github/workflows/update.yml`
  - remove `Mark calculation job running` entirely;
  - schedule/manual/web all reach `Run calculation and upload to API` before lifecycle reporting;
  - web-only terminal reporting remains after calculation so the browser can settle the durable calculation job.
- `worker.js`
  - remove the application-imposed 5-second `AbortSignal.timeout` from GitHub workflow dispatch;
  - allow a queued web calculation job to settle directly to `succeeded` or `failed`; `running` remains accepted for backward compatibility but is no longer required by the workflow.
- `worker-entry.js`
  - remove dispatch-recovery interception.
- delete `worker-calculation-dispatch-recovery.js`.
- replace the old recovery regression with `tests/worker_calculation_trigger_invariant.test.mjs`.
- update CI to run the new invariant regression.

### Acceptance

1. `update.yml` contains no `Mark calculation job running` step.
2. `Run calculation and upload to API` precedes all calculation-job lifecycle reporting.
3. canonical Worker dispatch request has no application-imposed 5-second abort signal.
4. canonical calculation state machine accepts `queued -> succeeded` and `queued -> failed` terminal evidence.
5. the old dispatch-recovery module is absent from runtime and tests.
6. Worker syntax, trigger-invariant regression, Python compile, and frozen frontend build all PASS.
7. after deployment, one web `立即更新` run reaches the Python calculation step and terminates cleanly without the historical first-callback 409.

## Decision Log

### D-2026-08-26-01

Decision: the calculation engine is the primary functional path; trigger-specific lifecycle metadata cannot gate it.

Status: **LOCKED**.

### D-2026-08-26-02

Decision: remove the self-imposed 5-second GitHub dispatch abort rather than tune it upward. A local timeout was creating a failure state that the upstream workflow did not necessarily share.

Status: **IMPLEMENTED ON R1-B3 BRANCH**.

### D-2026-08-26-03

Decision: delete the positive-callback recovery shim once the web-only pre-calculation checkpoint is removed. Do not keep both the root correction and the workaround.

Status: **IMPLEMENTED ON R1-B3 BRANCH**.

### D-2026-08-26-04

Decision: retain `calculation_job_id` only as trusted target/benchmark context and terminal result correlation for web runs. It must not create a separate calculation engine or a precondition before calculation.

Status: **LOCKED**.

## Out of Scope / Backlog

- BACKLOG: transient portfolio snapshot upload HTTP 500, unless it recurs and blocks the final smoke.
- OUT: financial calculation changes.
- OUT: D1 schema/data rewrites.
- OUT: generalized deployment framework restoration.
- OUT: UI redesign.
- REJECT: timeout-only tuning as the permanent solution.
- REJECT: age-only deletion/expiry as proof that a GitHub workflow is dead.
- REJECT: retain a recovery shim for a failure mode removed by the canonical path.

## Current Verification State

- Canonical Worker patch applied on branch by exact deterministic replacement and passed `node --check` during application.
- Workflow gate removal: implemented on branch.
- Recovery shim/runtime removal: implemented on branch.
- Trigger-invariant regression: added on branch.
- CI wiring: updated on branch.
- PR / exact-head CI / review / merge: **pending**.
- Production deploy / web smoke: **pending**.

## Next Actions

1. Open one R1-B3 PR against `main`.
2. Run exact-head Terminal Integrity and fix only blockers.
3. Review diff for trigger invariance, state-transition correctness, and absence of the old recovery shim.
4. Merge with expected head SHA only after CI PASS.
5. Deploy the merged Worker source to Cloudflare; Pages handles the frontend/workflow source through `main`.
6. Perform one authenticated web `立即更新` smoke and inspect the corresponding `Update Portfolio Data` run.
7. Acceptance requires Python calculation to execute before lifecycle reporting and terminal result to settle without HTTP 409.
8. Remove the temporary R1-B2 deployment workflow after production recovery is confirmed, update this handoff, create a stable recovery checkpoint, and stop.
