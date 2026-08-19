# Project Execution Memory

Last updated: **2026-08-19 Asia/Taipei**

## CURRENT

**Project status**
- **DEVELOPMENT FROZEN**.
- Product feature development has stopped at the retained current-version behavior.
- There is no active feature roadmap, staging program, audit/evidence program or deployment-control project.
- A minimal `Terminal Integrity` workflow remains because `main` repository rules require three status checks; it is a branch-safety constraint, not an active development program.

**Recovery checkpoints**
- Pre-cleanup recovery branch: `release/terminal-pre-cleanup-2026-08-19`.
- Frozen pre-cleanup main SHA: `4377a6c92b95a9f253c4c893e944f9060f954a4f`.
- Final terminal recovery branch is created after the cleanup PR is merged and must point to the resulting `main` SHA.

**Validation evidence**
- Last full test-suite validation baseline: `00becc3157d5be65076a6adadd50fc8e0b4fb93b`.
- CI run #1406 passed Python runtime tests, Worker runtime tests, Worker production contract verification, local D1 migration/schema verification, frontend runtime tests and the production frontend build.
- The full tests/dev harness was then removed. The retained thin `Terminal Integrity` workflow only enforces the three status contexts required by repository rules: Python compile integrity, Worker parse/production-contract integrity and frontend production build integrity.

**Closed active development**
- PR #387 — closed without merge; UX-R1.3–R1.8 are not active work.
- Issue #97 — closed `not planned`; staging Worker/D1 development is not active work.

**Retained product boundary**
- Preserve current Overview, Charts, Holdings, Records, Dividends, Cash and Groups behavior.
- Preserve manual transaction create/edit/delete, Records search/filter/pagination/refresh, IBKR Import, broker-neutral CSV/template/mapping import, Backup JSON and Journal Restore as currently exposed by the retained UI.
- Preserve authentication, portfolio calculation/update callbacks, PWA behavior and all financial/data/security fail-closed runtime paths required by those capabilities.

**Terminal runtime**
- Frontend: `src/`, `public/`, `index.html`, Vite build policy.
- Worker/API: `worker-entry.js`, `worker.js`, `worker-dividend-event.js`, `worker-journal-restore.js`.
- D1 rebuild authority: migrations `0001` through `0006`.
- Calculations: `main.py`, `journal_engine/`, `tools/run_portfolio_update.py`.
- Hosted runtime workflow: `.github/workflows/update.yml`.
- Repository-rule safety workflow: `.github/workflows/ci.yml` (`Terminal Integrity`).
- Emergency recovery helpers: retained production environment/Worker/D1 identity and Wrangler rendering tools.
- Production-test reconciliation helpers remain as a safety exception until live D1 synthetic/test-row state can be reverified with private Cloudflare credentials.

## TERMINAL CLEANUP

- [x] Freeze exact pre-cleanup main SHA and create recovery branch.
- [x] Close active UX PR #387 without merge and staging Issue #97 as not planned.
- [x] Remove staging/development/audit/evidence/deployment-control infrastructure with no retained runtime caller.
- [x] Remove historical Worker copies, engineering docs, E2E/staging assets and redundant offline export utilities.
- [x] Freeze frontend deployment policy to production and disable non-main Pages deployment in source.
- [x] Preserve broker-neutral import and Journal Restore after reachability proved they are live product features.
- [x] Complete full runtime/build/schema validation before removing the full validation harness.
- [x] Remove the test suite, pytest/dev requirements and test-only schema tooling.
- [x] Replace the large CI harness with the smallest workflow that satisfies mandatory `main` status checks.
- [ ] Merge terminal-cleanup PR to `main`.
- [ ] Create `release/terminal-final-2026-08-19` at the merged terminal `main` SHA.

## EXTERNAL ACCOUNT CLEANUP STILL REQUIRES LIVE ACCOUNT AUTHORITY

Repository cleanup must not be confused with private account cleanup. GitHub account settings, Cloudflare account resources and Google OAuth console state must be inventoried from their authoritative private consoles/connectors before deletion. Never infer their existence from historical repository files.

## FUTURE RESTART

There is no active NEXT batch. If development resumes, start from `AI_PROJECT_PLAYBOOK.md`, compare the then-live production state to the terminal-final checkpoint, and add only the minimum development infrastructure required by the new goal.
