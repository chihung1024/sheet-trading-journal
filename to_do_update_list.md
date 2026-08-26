# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: restore reliable web `立即更新` portfolio recalculation without weakening idempotency, data integrity, or lifecycle correctness.
- Current main: `540d8ac38927ef8a93540e270635d00b45632f7e`.
- Root-cause fix PR: **#424 MERGED**.
- Production activation PR: **#425 MERGED**.
- Active Batch: **R1-B2 — production activation / smoke**.
- Current state: **BLOCKED BEFORE PRODUCTION MUTATION — protected Cloudflare deployment credentials are absent from GitHub Actions**.

## Stable State

Terminal release `terminal-final-2026-08-21` at `28bea37098beceeba6ddae958f180833d26c71db` remains the last recorded production deployment checkpoint. R1-B1 was merged to `main` at `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`; main Terminal Integrity #1477 passed. R1-B2 activation control was merged as `540d8ac38927ef8a93540e270635d00b45632f7e`; main Terminal Integrity #1480 passed.

Production deployment run #1 (`32948075702`) failed at the explicit protected-input preflight before config rendering, Wrangler dry-run, Worker deploy, or any D1 operation. Logs show all four required protected values were empty: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_D1_DATABASE_NAME`. Therefore **no production code or data was mutated by R1-B2** and the production rollback/stable state is unchanged.

Production D1 remains authoritative.

## Architecture Notes

Web update path:

`Browser -> POST /api/trigger-update -> Worker calculation_jobs -> GitHub workflow_dispatch update.yml -> workflow running callback -> Python calculation/upload -> terminal callback -> browser polling`.

Manual GitHub Action with empty `calculation_job_id` bypasses the calculation-job callback lifecycle and therefore is not an equivalent validation of the web path.

The terminal Worker uses `worker-entry.js` as the controlled entry layer in front of canonical `worker.js`. R1-B1 added one narrowly scoped recovery module at that boundary without changing financial calculations or the D1 schema.

Production deployment primitives retained after terminal cleanup:
- `wrangler.toml` production template;
- `tools/render_wrangler_config.mjs` with reviewed production origin/OAuth/D1 authority checks;
- `npm run worker:deploy` using `.wrangler/deploy.toml`.

Historical persistent deployment-control workflows were intentionally removed during terminal cleanup. R1-B2 therefore uses a bounded one-shot workflow and removes it after successful production activation. The workflow remains temporarily present while the credential blocker is unresolved because the failed exact activation run can be safely re-run after protected values are restored.

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
- independent review pass with no remaining BLOCKER;
- merge commit `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`;
- main Terminal Integrity #1477 PASS.

#### Batch R1-B2 — production activation / smoke

Objective: deploy the exact R1-B1 merged Worker source using the minimum retained production deployment primitives, verify live source identity, then perform one normal web update smoke.

In scope:
- one-shot production Worker deployment workflow;
- exact reviewed merge deployment only;
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
1. exact reviewed activation source is deployed to `journal-backend`;
2. no D1 migration runs in this batch;
3. public Worker response reports exact deployed source SHA and retained API/release/schema versions;
4. one normal web `立即更新` produces one calculation lifecycle and no prior first-callback 409/stuck condition;
5. temporary deployment workflow is removed after activation;
6. handoff records the final production state and rollback point.

## Current Phase / Batch

- Phase: R1
- Current Batch: **R1-B2**
- State: **BLOCKED ON EXTERNAL PROTECTED DEPLOYMENT CREDENTIALS**.
- Primary Active Batch remains R1-B2; do not open a new development line.

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

### RC-2026-08-26-02 — production activation cannot authenticate to Cloudflare

Reproduce:
- merge PR #425 with explicit `[r1-b2-deploy]` marker;
- one-shot production deployment workflow starts on exact merge SHA `540d8ac38927ef8a93540e270635d00b45632f7e`;
- checkout, reviewed-parent ancestry verification, Node setup, and dependency install all pass;
- protected deployment input verification fails.

Evidence:
- deployment run `32948075702`, job `98113081035`;
- Action environment shows all four deployment values empty;
- first explicit error: `Missing required protected production value: CLOUDFLARE_API_TOKEN`;
- render, dry-run, deploy, and live verification steps are all skipped.

Failure Point: GitHub Actions protected deployment input preflight.

Contributing Factor: terminal freeze/cleanup removed persistent deployment-control infrastructure and the current GitHub Actions environment no longer exposes the historical Cloudflare deployment credentials.

Root Cause: the current connected execution boundary has no authorized Cloudflare deployment credentials. This is an external credential/authority prerequisite, not an application-code defect.

Impact: R1-B1 production activation cannot proceed; no Cloudflare Worker or D1 mutation occurred.

Permanent Resolution for this batch: restore only the four required protected deployment values in GitHub Actions, then re-run the exact failed deployment job. Do not restore the retired deployment framework and do not commit credentials.

Status: **CONFIRMED / BLOCKING R1-B2**.

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

Reason: terminal cleanup intentionally removed persistent deployment-control infrastructure, while the retained Wrangler template, renderer, D1 authority contract, and deploy command are sufficient for this bounded production defect recovery.

Status: ACTIVE for R1-B2 only.

### D-2026-08-26-04

Decision: do not bypass, hardcode, guess, or reconstruct missing Cloudflare credentials from public metadata.

Reason: deployment credentials are a security/production authority boundary. The repository intentionally stores only the production D1 ID fingerprint, not the raw database ID, and GitHub/Cloudflare secret values must remain outside source control.

Resolution: user restores the required protected values through GitHub/Cloudflare UI; after that the existing exact deployment run is re-run and execution continues without code changes.

Status: LOCKED.

## Change Log

- 2026-08-26: created R1-B1 recovery branch from frozen main checkpoint.
- 2026-08-26: created `AI_PROJECT_PLAYBOOK.md` and this handoff because both were absent from terminal tree.
- 2026-08-26: added dispatch-ambiguity recovery, focused regression, and CI invocation.
- 2026-08-26: PR #424 exact-head CI #1476 passed and independent review completed with no remaining BLOCKER.
- 2026-08-26: PR #424 merged as `591b8dc3c10dca6850bf0b6514a0857fcc5ac607`; main Terminal Integrity #1477 passed.
- 2026-08-26: started R1-B2.
- 2026-08-26: PR #425 added temporary exact-merge production activation workflow; final PR head `db312189bf126acb5931a42987bdfec0d5f1d1e0`; Terminal Integrity #1479 PASS; independent review pass recorded with no BLOCKER.
- 2026-08-26: PR #425 merged as `540d8ac38927ef8a93540e270635d00b45632f7e`; main Terminal Integrity #1480 PASS.
- 2026-08-26: production deployment run `32948075702` failed before any remote mutation because all required Cloudflare deployment protected values were absent.

## Known Issues

- Production has not yet been verified on the R1-B1 recovery source; web update remains user-visible NOT VERIFIED until R1-B2 deployment/smoke.
- GitHub Actions currently lacks the four protected Cloudflare deployment values required for exact Worker activation.
- Separate transient portfolio snapshot upload HTTP 500 remains BACKLOG unless it recurs and blocks the final smoke.

## Technical Debt

None promoted into the active batch. The missing production credentials are an operational prerequisite, not technical debt and must not trigger architecture expansion.

## Deferred / Rejected Candidates

- BACKLOG: investigate transient snapshot upload HTTP 500 if it recurs.
- REJECT: simply increase GitHub dispatch timeout as the full fix.
- REJECT: expire queued jobs based only on elapsed age.
- REJECT: broad refactor of the canonical calculation-job state machine.
- REJECT: restore the retired long-lived production/staging deployment framework.
- REJECT: run D1 migrations during R1-B2 when the defect fix has no schema change.
- REJECT: hardcode or commit Cloudflare account/database/token values.
- REJECT: weaken the production deployment preflight to make the Action pass without credentials.

## Risks

- Production deployment must bind the reviewed `journal-db`; the retained renderer verifies name and hashed D1 ID authority before deploy.
- Missing Cloudflare credentials currently block deployment before any mutation, which is the intended fail-closed behavior.
- A protected GitHub `production` environment may require manual reviewer approval after credentials are restored; do not bypass it.
- Rollback source remains `terminal-final-2026-08-21` / `28bea37098beceeba6ddae958f180833d26c71db` until the new production source is verified.

## Next Actions

1. **USER ACTION REQUIRED:** restore the four protected production values used by the GitHub Actions `production` environment:
   - `CLOUDFLARE_API_TOKEN`;
   - `CLOUDFLARE_ACCOUNT_ID`;
   - `CLOUDFLARE_D1_DATABASE_ID` for production `journal-db`;
   - `CLOUDFLARE_D1_DATABASE_NAME` = `journal-db`.
2. Do not paste secret/token values into chat or source control. Report only that all four values have been saved.
3. Re-run failed deployment run `32948075702` / job `98113081035` on exact source `540d8ac38927ef8a93540e270635d00b45632f7e`.
4. Verify dry-run, deploy, and exact live source/API/release/schema checks all PASS.
5. Delete the temporary deployment workflow in a cleanup PR.
6. Perform one authenticated web `立即更新` smoke and inspect the corresponding `Update Portfolio Data` workflow lifecycle.
7. If smoke passes, create the final stable recovery checkpoint, mark `OPTIMIZED FOR CURRENT REQUIREMENTS`, and stop.

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

Status: **BLOCKED BEFORE PRODUCTION MUTATION**.

- Scope: one-shot exact-source Worker activation + live identity verification + web smoke + cleanup.
- Activation PR: #425 merged.
- Activation source: `540d8ac38927ef8a93540e270635d00b45632f7e`.
- PR CI: #1479 PASS.
- Main CI: #1480 PASS.
- Deployment run: `32948075702` FAILURE at credential preflight.
- D1 migration: NONE / not executed.
- Worker deploy: NOT EXECUTED.
- Production data mutation: NONE.
- Live source verification: NOT EXECUTED.
- Production web smoke: NOT VERIFIED.
- Blocker: missing protected Cloudflare deployment values.
- Rollback: terminal production checkpoint remains unchanged.
