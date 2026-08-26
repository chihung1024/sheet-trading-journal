# Project Status / Handoff

## Project Status

- Mode: **DEVELOPMENT FROZEN / production defect recovery**.
- Primary invariant: schedule, manual GitHub dispatch, and web `立即更新` must reach the same portfolio calculation engine without trigger-specific lifecycle prerequisites.
- Current main before this final checkpoint: `e7dc38c07240dd970edea2587b2f37211099442e`.
- D1 schema/data migration: **NONE**.

## Root Correction

PR #429 removed the structural web-only pre-calculation gate:

`any trigger -> trusted calculation context -> run_portfolio_update.py -> snapshot upload -> optional lifecycle/result reporting`

The old web-only `Mark calculation job running` prerequisite is gone. Trusted queued jobs are valid calculation context; terminal jobs remain non-runnable. The application-imposed five-second GitHub dispatch abort and the old dispatch-recovery shim are also gone.

## Browser-Native Deployment Contract

The user operates this project through browser-based GitHub and Cloudflare only; no local clone or terminal is assumed.

PR #432 (`e7dc38c07240dd970edea2587b2f37211099442e`) made the retained Worker deployment source self-sufficient for Cloudflare Workers Builds:

- production D1 identity is the reviewed existing `journal-db` UUID `fbef989c-dede-4f94-8907-6a2134cdf372` plus its existing SHA-256 fingerprint;
- `tools/render_wrangler_config.mjs` accepts Cloudflare `WORKERS_CI_COMMIT_SHA` provenance;
- `npm run worker:deploy` renders the reviewed production config immediately before `wrangler deploy`;
- CI validates that Cloudflare-Builds-style rendering resolves exactly to `journal-db`, the reviewed UUID, and the exact commit SHA;
- no GitHub Cloudflare secrets or GitHub deployment workflow are retained.

Cloudflare `journal-backend` is now connected to `chihung1024/sheet-trading-journal` through Workers Builds with production branch `main`. The intended production deploy command is:

`npm run worker:deploy`

Build command is intentionally empty; non-production builds are disabled; build variables/secrets remain empty. Existing Worker runtime secrets remain Cloudflare-managed.

## Verification to Date

- PR #429 exact-head and main Terminal Integrity: PASS.
- temporary GitHub production deployment workflow removed by PR #431.
- PR #432 exact-head Terminal Integrity #1499: PASS.
- main Terminal Integrity #1500 on `e7dc38c07240dd970edea2587b2f37211099442e`: PASS.
- Cloudflare Pages automatic deployment is active on `main` and has already deployed the current frontend line.
- Cloudflare Workers Builds connection for `journal-backend` has been saved; Cloudflare reports that the next `main` push will start the first build.

## Final Acceptance

1. merge this documentation checkpoint after exact-head CI PASS; that meaningful `main` push is intentionally the first Cloudflare Workers Builds production trigger.
2. confirm Cloudflare `journal-backend` build/deploy succeeds from the resulting exact `main` SHA.
3. perform one authenticated web `立即更新`.
4. confirm the corresponding `Update Portfolio Data` workflow reaches Python calculation and snapshot upload before terminal lifecycle reporting, with no historical pre-calculation HTTP 409.
5. confirm browser polling settles to success or a real calculation/upload failure and does not remain indefinitely blocked.
6. if the smoke passes, record the exact deployed Worker source SHA as the final recovery checkpoint and stop.

## Rejected Expansion

- no local-terminal deployment requirement;
- no GitHub Cloudflare credentials solely for this frozen project;
- no replacement GitHub deployment workflow;
- no D1 migration or financial calculation change;
- no lifecycle workaround for the removed structural failure mode;
- no dummy deployment commit: this handoff/checkpoint update is the intentional meaningful first Workers Builds trigger.
