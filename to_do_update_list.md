# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: schedule, manual GitHub dispatch, and web `立即更新` must reach the same portfolio calculation engine without trigger-specific lifecycle prerequisites.
- Main before this batch: `ce4e4a709ee87abad9838e49a57b7f0c34a53b49`.
- Active branch: `fix/unify-calculation-pipeline-20260826`.
- Active PR: **#429 — Unify calculation execution across trigger paths**.
- Active Batch: **R1-B3 — trigger-invariant calculation path**.
- D1 schema/data migration: **NONE**.

## First-Principles Invariant

Required:

`any trigger -> resolve trusted calculation context -> run_portfolio_update.py -> upload snapshot -> report optional lifecycle/result metadata`

Forbidden:

`web trigger -> lifecycle/status checkpoint -> only then run calculation`

Trigger source may select trusted target context, but control-plane lifecycle metadata must not determine whether the calculation engine is allowed to run.

## Root Cause

### RC-2026-08-26-01 — web-only pre-calculation lifecycle gate

Evidence:
- schedule/manual runs with empty `calculation_job_id` skipped `Mark calculation job running` and reached Python;
- web runs #3383/#3385/#3386 executed that callback first, received HTTP 409, and skipped Python;
- manual run #3390 succeeded through the same Python calculation/upload path;
- canonical Worker also imposed a 5-second dispatch abort, allowing a locally failed D1 job to diverge from an upstream GitHub workflow that had actually been accepted.

Root cause: the web trigger had a control-plane checkpoint that schedule/manual triggers did not have. The calculation engine was not the failing component.

## R1-B3 Implementation

- `.github/workflows/update.yml`
  - removed `Mark calculation job running`;
  - every trigger reaches `Run calculation and upload to API` before lifecycle result reporting.
- `worker.js`
  - removed the application-imposed 5-second GitHub dispatch abort;
  - allows trusted terminal evidence to settle `queued -> succeeded/failed`; `queued -> running` remains valid for backward compatibility.
- `journal_engine/clients/api_client.py`
  - trusted opaque calculation context accepts both `queued` and `running` jobs;
  - terminal `succeeded/failed` jobs remain non-runnable.
- `worker-entry.js`
  - removed dispatch-recovery interception.
- deleted `worker-calculation-dispatch-recovery.js` and its regression test.
- added `tests/worker_calculation_trigger_invariant.test.mjs`.
- added `tests/test_calculation_job_context.py`.
- CI now tests both the trigger invariant and queued trusted calculation context.

## Adversarial Review Finding

Initial R1-B3 candidate had one blocker: `CloudflareClient.resolve_calculation_job_context()` still required `status == running`. Removing the workflow's `running` callback without changing that requirement would have moved the failure from GitHub lifecycle reporting into Python context resolution.

Resolution:
- change trusted context acceptance to `status in {queued, running}`;
- retain rejection of terminal jobs;
- add executable regression for queued/running acceptance and terminal rejection.

This is part of the root correction, not a bypass: the newly created durable queued job is already the trusted execution intent. No second lifecycle transition is required to authorize the same calculation.

## Verification

- deterministic canonical Worker patch application: PASS (`node --check`).
- temporary patch workflows removed from final PR tree.
- PR #429 initial exact-head Terminal Integrity #1487: PASS.
- adversarial review blocker identified and corrected.
- updated exact-head Terminal Integrity #1492 on `743601a1e987cbb236775e2999f4168447589d22`: PASS, including:
  - Worker syntax;
  - trigger-invariant calculation regression;
  - Python compile;
  - queued calculation-context regression;
  - frozen frontend build.
- final documentation-only head requires one last exact-head CI before merge.
- production deployment / authenticated web smoke: pending.

## Acceptance

1. no `Mark calculation job running` pre-calculation step exists.
2. every trigger reaches the same Python calculation step first.
3. web job target/benchmark context is valid while durable job state is `queued`.
4. canonical dispatch has no synthetic 5-second abort.
5. queued web jobs can settle directly from terminal calculation evidence.
6. old dispatch-recovery shim is absent.
7. all focused regressions and retained build/compile gates pass.
8. after deployment, one web `立即更新` reaches Python and settles cleanly without the historical first-callback 409.

## Decisions / Rejected Expansion

- LOCKED: calculation execution is primary; lifecycle metadata is secondary.
- LOCKED: `calculation_job_id` remains only trusted target/benchmark context and terminal result correlation.
- REJECT: retain the old callback-recovery shim after removing its structural failure mode.
- REJECT: timeout-only tuning as the permanent solution.
- REJECT: age-only deletion/expiry as evidence that an upstream workflow is dead.
- OUT: financial calculation changes, D1 schema changes, UI redesign, generalized deployment framework work.
- BACKLOG: transient snapshot upload HTTP 500 only if it recurs and blocks final smoke.

## Stable / Production State

- Terminal historical checkpoint: `terminal-final-2026-08-21` / `28bea37098beceeba6ddae958f180833d26c71db`.
- User reported Cloudflare deployment completed earlier in this recovery sequence; that deployment predates R1-B3 and therefore does not contain the current trigger-invariant Worker correction.
- Production D1 remains authoritative.

## Next Actions

1. wait for final exact-head PR #429 Terminal Integrity PASS.
2. record no-blocker review and merge #429 with expected head SHA.
3. verify main Terminal Integrity PASS.
4. deploy the merged R1-B3 Worker source to Cloudflare using the user's established deployment path; no D1 migration.
5. perform one authenticated web `立即更新` smoke.
6. verify GitHub workflow executes Python calculation, then terminal result reporting, with no web-only pre-calculation 409.
7. remove the temporary R1-B2 production deployment workflow, update this handoff, create final recovery checkpoint, and stop.
