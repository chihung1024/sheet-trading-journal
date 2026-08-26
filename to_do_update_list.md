# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary Goal: schedule, manual GitHub dispatch, and web `立即更新` must reach the same portfolio calculation engine without trigger-specific lifecycle prerequisites.
- Current verified main before cleanup: `538c77b5daa3f432ad06874f2b6322502379a7a2`.
- Active branch: `chore/remove-temporary-deploy-20260826`.
- Active Batch: **R1-B4 — remove temporary deployment infrastructure and finish production verification**.
- D1 schema/data migration: **NONE**.

## First-Principles Invariant

Required execution path:

`any trigger -> resolve trusted calculation context -> run_portfolio_update.py -> upload snapshot -> report optional lifecycle/result metadata`

Forbidden execution path:

`web trigger -> lifecycle/status checkpoint -> only then run calculation`

Trigger source may select trusted target context, but lifecycle metadata cannot gate the calculation engine.

## Root Correction Completed

PR #429 merged as `a300939f105b2a9e93ac1a363ddc3018066b2edb` and removed the structural web-only failure path:

- `.github/workflows/update.yml`
  - removed `Mark calculation job running` before Python;
  - all trigger types reach `Run calculation and upload to API` first.
- `worker.js`
  - removed the application-imposed five-second GitHub dispatch abort;
  - allows durable `queued` jobs to settle directly to `succeeded` or `failed` from terminal calculation evidence.
- `journal_engine/clients/api_client.py`
  - trusted calculation context accepts `queued` and `running`;
  - terminal jobs remain non-runnable.
- removed `worker-calculation-dispatch-recovery.js` and its runtime interception.
- added trigger-invariant Worker regression and queued-context Python regression.

PR #429 exact-head Terminal Integrity #1493 PASS. Main Terminal Integrity #1494 PASS.

## Deployment Decision

The temporary GitHub Actions deployment workflow was an execution aid, not part of the application architecture.

A final attempt was made through PR #430 / main `538c77b5daa3f432ad06874f2b6322502379a7a2`. Main Terminal Integrity #1496 PASS. Production deployment run `32960197133` failed closed before config rendering or Worker deployment because all four GitHub `production` environment values were absent:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`

No Worker or D1 mutation occurred in that failed run.

First-principles decision: **do not create permanent GitHub deployment credentials or infrastructure solely to finish this frozen-project recovery**. Use the user's already-established Cloudflare-authenticated local deployment path for one exact deploy, then stop.

## R1-B4 Cleanup

- delete `.github/workflows/r1-b2-production-recovery-deploy.yml`;
- do not replace it with another deployment framework;
- retain existing production renderer and `npm run worker:deploy` only;
- no application code, financial logic, frontend, Worker behavior, or D1 changes in this cleanup batch.

## Local Production Deploy Contract

Deploy the exact post-cleanup main with the existing retained tools:

1. checkout/pull exact latest `main`;
2. authenticate with `npx wrangler login` if needed;
3. provide the production `journal-db` UUID only in the local environment;
4. set `CLOUDFLARE_D1_DATABASE_NAME=journal-db` and `SOURCE_COMMIT=$(git rev-parse HEAD)`;
5. run `npm run worker:config:render`;
6. run `npx wrangler deploy --dry-run --strict --config .wrangler/deploy.toml`;
7. run `npm run worker:deploy`;
8. verify the public Worker reports the exact deployed source SHA with API `2.65`, release `4.12`, schema `3`.

Do not hard-code the production D1 UUID into tracked files and do not bypass the renderer's identity checks.

## Acceptance

1. temporary deployment workflow is absent from final main.
2. CI remains PASS after cleanup.
3. exact post-cleanup main is deployed to Cloudflare through the retained local Wrangler path.
4. one authenticated web `立即更新` creates/joins one calculation job and the corresponding `Update Portfolio Data` workflow reaches Python calculation before lifecycle terminal reporting.
5. no historical web-only pre-calculation HTTP 409 occurs.
6. terminal job state settles cleanly to success or a real calculation/upload failure; browser does not remain indefinitely blocked.
7. after smoke PASS, create one stable recovery checkpoint and stop.

## Out of Scope / Rejected Expansion

- OUT: generalized CI/CD reconstruction.
- OUT: Cloudflare credentials stored in GitHub solely for this one frozen-project recovery.
- OUT: D1 schema/data migration.
- OUT: financial calculation changes.
- OUT: UI redesign.
- REJECT: reintroducing lifecycle recovery shims for the removed structural failure mode.
- REJECT: timeout-only tuning as a permanent solution.
- BACKLOG: transient snapshot upload HTTP 500 only if it recurs and blocks final smoke.

## Next Actions

1. open cleanup PR from `chore/remove-temporary-deploy-20260826`.
2. require exact-head Terminal Integrity PASS and no-blocker review.
3. merge cleanup PR with expected head SHA and verify main CI PASS.
4. deploy exact latest main once through local Wrangler authentication.
5. perform one authenticated web `立即更新` smoke and inspect the corresponding workflow through terminal result.
6. if smoke passes, create final stable recovery checkpoint and stop.
