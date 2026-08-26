# AI Project Playbook

## Project mode

Status: **DEVELOPMENT FROZEN / PRODUCTION DEFECT RECOVERY ONLY**.

The terminal production source is `main` at the current frozen checkpoint. New features, speculative refactors, infrastructure expansion, and unrelated cleanup are out of scope unless a production defect makes them necessary.

## Primary engineering principle

Use first principles, executable delivery, and minimum sufficient engineering. Every change must have a present requirement or evidence-backed risk, a concrete implementation path, bounded scope, verification, rollback, and an explicit stop condition.

## Runtime architecture

- Frontend: Vue 3 + Pinia + Vite.
- API/runtime: Cloudflare Worker via `worker-entry.js` -> `worker.js` plus retained extension modules.
- Authoritative data: production Cloudflare D1 binding `DB`.
- Calculation engine: `main.py` + `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Production recalculation callback/schedule: `.github/workflows/update.yml`.
- Canonical frontend: `https://sheet-trading-journal.pages.dev`.
- Canonical API: `https://journal-backend.chired.workers.dev`.

## Data and lifecycle invariants

1. Production D1 data is authoritative; never rewrite user records as part of code cleanup.
2. User-triggered recalculation is idempotent and tenant-scoped.
3. A GitHub dispatch timeout/network loss is not proof that GitHub rejected the mutation.
4. A calculation job may advance only from positive lifecycle evidence; elapsed time alone must not decide whether a GitHub run is dead.
5. A durable GitHub run identity must not be overwritten by a conflicting run.
6. Existing snapshot/financial integrity gates remain fail-closed.

## Debug workflow

Reproduce -> Evidence -> Hypotheses -> Trace -> Isolate -> Root Cause -> Impact Analysis -> Fix -> Regression -> Prevention.

Classify new findings as NOW / NEXT / BACKLOG / REJECT. Only NOW may expand the active batch.

## Git and recovery

- Check remote `main`, open PRs, current release, and live-runtime evidence before changes.
- Use one active implementation branch.
- The branch base is the recovery point for the batch; no force push/reset/clean is permitted without explicit evidence.
- Important runtime changes go through PR, CI, independent review, expected-head merge, and a post-merge checkpoint.

## Minimum verification gate

For a Worker/workflow lifecycle repair, require as applicable:

- exact diff review;
- targeted deterministic regression test for the root cause;
- Worker syntax check;
- frozen frontend build to detect accidental integration breakage;
- retained Python compile gate;
- GitHub Actions CI on the exact PR head;
- independent review with BLOCKER / FOLLOW-UP / BACKLOG / REJECT classification;
- production deployment verification before declaring the user-visible defect fixed.

Do not add broad test matrices unrelated to the changed lifecycle.

## Current locked decision

The active production defect is the web-triggered portfolio recalculation lifecycle. The current batch must repair Worker -> GitHub dispatch ambiguity without using timeout-only tuning or age-only stale-job expiry. Snapshot-upload HTTP 500 incidents are a separate follow-up unless new evidence proves they share the same root cause.

## Stop condition

Stop the recovery when the web `立即更新` path creates or recovers exactly one calculation job, the GitHub workflow can report `running` without lifecycle conflict, calculation completes, the browser reaches a terminal non-stuck state, required regression/CI gates pass, and production verification succeeds. Remaining optimizations go to backlog.
