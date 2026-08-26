# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: restore reliable web `立即更新` portfolio recalculation without weakening idempotency, data integrity, or lifecycle correctness.
- Current recovery branch: `ops/r1-b2-production-recovery-deploy-20260826`.
- Current main: `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`.
- Root-cause fix PR: **#424 MERGED**.

## Stable State

Terminal release `terminal-final-2026-08-21` at `28bea37098beceeba6ddae958f180833d26c71db` remains the last recorded production deployment checkpoint. R1-B1 was merged to `main` at `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`; main Terminal Integrity run #1477 passed. Production D1 remains authoritative. The R1-B1 source has not yet been verified as deployed to Cloudflare.

## Architecture Notes

Web update path:

`Browser -> POST /api/trigger-update -> Worker calculation_jobs -> GitHub workflow_dispatch update.yml -> workflow running callback -> Python calculation/upload -> terminal callback -> browser polling`.

Manual GitHub Action with empty `calculation_job_id` bypasses the calculation-job callback lifecycle and therefore is not an equivalent validation of the web path.

The terminal Worker uses `worker-entry.js` as the controlled entry layer in front of canonical `worker.js`. R1-B1 added one narrowly scoped recovery module at that boundary without changing financial calculations or the D1 schema.

Production deployment primitives retained after terminal cleanup:
- `wrangler.toml` production template;
- `tools/render_wrangler_config.mjs` with reviewed production origin/OAuth/D1 authority checks;
- `npm run worker:deploy` using `.wrangler/deploy.toml`.

Historical persistent deployment-control workflows were intentionally removed during terminal cleanup. R1-B2 therefore uses a bounded one-shot workflow and removes it after production activation.

## Master Plan

### Phase R1 — web update production defect recovery

#### Batch R1-B1 — root-cause correction

Objective: allow an ambiguous Worker -> GitHub dispatch failure to recover only when the real GitHub workflow supplies positive `running` callback evidence.

Status: **DONE / MERGED**.

Delivered:
- `worker-calculation-dispatch-recovery.js`;
- minimal `worker-entry.js` integration;
- focused deterministic regression;
- CI wiring;
- independent review with no remaining BLOCKER;
- merge commit `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`;
- main Terminal Integrity #1477 PASS.

#### Batch R1-B2 — production activation / smoke

Objective: deploy the exact R1-B1 merged Worker source using the minimum retained production deployment primitives, verify live source identity, then perform one normal web update smoke.

In scope:
- one-shot production Worker deployment workflow;
- exact merged-SHA deployment only;
- existing production D1 binding validation through the retained renderer;
- Wrangler dry-run and deploy;
- post-deploy public Worker header/source identity verification;
- remove the one-shot workflow after activation;
- one normal authenticated web `立即更新` smoke.

Out of scope:
- D1 migrations or data rewrites;
- frontend deployment or redesign;
- financial logic changes;
- generalized deployment framework restoration;
- staging recreation;
- snapshot-upload HTTP 500 RCA unless it blocks the smoke.

Allowed investigation: retained production deployment configuration, GitHub Actions production environment/credentials, Cloudflare Worker deploy result, and the exact web-update lifecycle.

Expansion trigger: production deploy cannot execute with retained protected credentials, deployment changes the wrong Worker/D1 identity, or web smoke produces a new blocker unrelated to the repaired dispatch ambiguity.

Acceptance:
1. exact merged source is deployed to `journal-backend`;
2. no D1 migration runs in this batch;
3. public Worker response reports exact deployed source SHA and retained API/release/schema versions;
4. one normal web `立即更新` produces one calculation lifecycle and no prior first-callback 409/stuck condition;
5. temporary deployment workflow is removed after activation;
6. handoff records the final production state and rollback point.

## Current Phase / Batch

- Phase: R1
- Current Batch: **R1-B2**
- State: **IN PROGRESS — production activation workflow prepared**.

## Root Cause Log

### RC-2026-08-26-01 — web update callback conflict

Evidence:
- multiple web-dispatched `Update Portfolio Data` runs failed at `Mark calculation job running` with Worker HTTP 409 before Python started;
- the same failed workflows subsequently reported terminal `failed` callback successfully;
- manual Action succeeded with empty `CALCULATION_JOB_ID`, bypassing the failing lifecycle;
- Worker dispatch had a 5-second timeout and terminalized ambiguous dispatch outcomes.

Root cause: Worker treated an ambiguous GitHub dispatch transport outcome as definitive failure. If GitHub accepted the dispatch despite response timeout/loss, the later positive workflow callback collided with the prematurely terminalized D1 job.

Systemic cause: positive GitHub callback evidence had no controlled way to reconcile a job terminalized solely by an ambiguous dispatch transport failure.

Status: **FIX MERGED; production activation/smoke pending**.

## Decision Log

### D-2026-08-26-01

Decision: reject timeout-only extension and age-only queued expiry as permanent fixes.

Reason: timeout tuning changes probability, not mutation certainty; elapsed age cannot prove a GitHub run is dead.

Status: LOCKED.

### D-2026-08-26-02

Decision: use the existing system-authenticated GitHub `running` callback itself as the minimum exact dispatch-success evidence. No additional GitHub run-list API, new status enum, or D1 migration is required.

Status: IMPLEMENTED / LOCKED.

### D-2026-08-26-03

Decision: production activation uses a temporary one-shot GitHub Actions workflow instead of restoring the retired deployment framework.

Reason: terminal cleanup intentionally removed persistent deployment-control infrastructure, while the retained Wrangler template, renderer, D1 authority contract, and deploy command are sufficient for this bounded production defect recovery. The one-shot workflow runs only on a merge commit carrying the explicit `[r1-b2-deploy]` marker and is removed after activation.

Trade-off: if the protected `production` environment requires manual approval, the deployment will wait rather than bypass that protection.

Status: ACTIVE for R1-B2 only.

## Change Log

- 2026-08-26: created R1-B1 recovery branch from frozen main checkpoint.
- 2026-08-26: created `AI_PROJECT_PLAYBOOK.md` and this handoff because both were absent from terminal tree.
- 2026-08-26: added dispatch-ambiguity recovery, focused regression, and CI invocation.
- 2026-08-26: PR #424 exact-head CI #1476 passed and independent review completed with no remaining BLOCKER.
- 2026-08-26: PR #424 merged as `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`; main Terminal Integrity #1477 passed.
- 2026-08-26: started R1-B2 branch `ops/r1-b2-production-recovery-deploy-20260826`.
- 2026-08-26: added temporary `.github/workflows/r1-b2-production-recovery-deploy.yml` using only retained production deploy primitives, with no D1 migration step.

## Known Issues

- Production has not yet been verified on the R1-B1 source; web update remains user-visible NOT VERIFIED until R1-B2 deployment/smoke.
- Separate transient portfolio snapshot upload HTTP 500 remains BACKLOG unless it recurs and blocks the smoke.

## Technical Debt

None promoted into the active batch beyond production activation required for the merged defect correction.

## Deferred / Rejected Candidates

- BACKLOG: investigate transient snapshot upload HTTP 500 if it recurs.
- REJECT: simply increase GitHub dispatch timeout as the full fix.
- REJECT: expire queued jobs based only on elapsed age.
- REJECT: broad refactor of the canonical calculation-job state machine.
- REJECT: restore the retired long-lived production/staging deployment framework.
- REJECT: run D1 migrations during R1-B2 when the defect fix has no schema change.

## Risks

- Production deployment must bind the reviewed `journal-db`; the retained renderer verifies name and hashed D1 ID authority before deploy.
- The temporary workflow depends on existing protected GitHub production secrets; missing secrets fail before deployment.
- A protected GitHub `production` environment may require manual reviewer approval; do not bypass it.
- Rollback source remains `terminal-final-2026-08-21` / `28bea37098beceeba6ddae958f180833d26c71db` until the new production source is verified.

## Next Actions

1. Open and review the R1-B2 one-shot deployment PR.
2. Run exact-head Terminal Integrity; fix only BLOCKER findings.
3. Merge with explicit `[r1-b2-deploy]` marker to trigger the bounded production deploy.
4. Verify deployment Action reaches success and exact source identity matches the merged SHA.
5. Delete the one-shot deployment workflow in a cleanup PR.
6. Perform one authenticated web `立即更新` smoke and inspect the corresponding Update Portfolio Data workflow lifecycle.
7. If smoke passes, mark `OPTIMIZED FOR CURRENT REQUIREMENTS` and stop.

## Batch Completion Record

### R1-B1

Status: **DONE / MERGED**.

- Root Cause: confirmed and corrected.
- Code: COMPLETE.
- Regression: PASS.
- PR: #424 merged.
- Main CI: #1477 PASS.
- Deployment: belongs to R1-B2.
- Rollback: `28bea37098beceeba6ddae958f180833d26c71db`.

### R1-B2

Status: **IN PROGRESS**.

- Scope: one-shot exact-SHA Worker activation + live identity verification + web smoke + cleanup.
- Files Changed so far: `.github/workflows/r1-b2-production-recovery-deploy.yml`, `to_do_update_list.md`.
- D1 migration: NONE / prohibited by scope.
- Verification: NOT YET RUN on branch.
- Deployment: NOT YET EXECUTED.
- Production web smoke: NOT VERIFIED.
- Rollback: terminal production checkpoint remains available.
