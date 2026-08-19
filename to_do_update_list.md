# Project Execution Memory

Last updated: **2026-08-19 Asia/Taipei**

## CURRENT

**Project status**
- **DEVELOPMENT FROZEN**.
- Product feature development has stopped at the current `main` behavior.
- Terminal cleanup is allowed only when it does not remove a current normal user capability or a runtime/data-safety dependency of that capability.

**Recovery checkpoint**
- Pre-cleanup release branch: `release/terminal-pre-cleanup-2026-08-19`.
- Frozen pre-cleanup main SHA: `4377a6c92b95a9f253c4c893e944f9060f954a4f`.

**Closed active development**
- PR #387 — closed without merge; UX-R1.3–R1.8 are not active work.
- Issue #97 — closed `not planned`; staging Worker/D1 development is not active work.

**Retained product boundary**
- Preserve the user-visible behavior present on frozen `main`, including current Records behavior, IBKR Import, Backup JSON, manual transaction flows, dividends, cash, groups, charts/holdings/overview, authentication and recalculation.
- Preserve financial/data/security fail-closed runtime logic, Worker/D1 authority, idempotency and runtime self-recovery required by those capabilities.

**Terminal runtime**
- Frontend: `src/`, `public/`, Vite.
- Worker: `worker-entry.js`, `worker.js` and retained runtime modules.
- Calculations: `main.py`, `journal_engine/`, `tools/run_portfolio_update.py`.
- Hosted runtime workflow: `.github/workflows/update.yml`.

## TERMINAL CLEANUP

- [x] Freeze exact pre-cleanup main SHA.
- [x] Create pre-cleanup release branch.
- [x] Close active UX PR #387 without merge.
- [x] Close staging Issue #97 as not planned.
- [ ] Remove staging/development/audit/evidence infrastructure that has no retained runtime caller.
- [ ] Remove verified unreachable source families without changing current user behavior.
- [ ] Verify production user flows and calculation runtime.
- [ ] Remove final test/CI development harness after terminal verification.
- [ ] Create final terminal checkpoint.

## FUTURE RESTART

There is no active roadmap or NEXT feature batch. If development resumes in the future, start from `AI_PROJECT_PLAYBOOK.md`, compare the live production state to the terminal checkpoint, and introduce only the minimum new development infrastructure required by the new goal.
