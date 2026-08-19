# AI Project Playbook — Terminal State

Status: **DEVELOPMENT FROZEN**

This repository is retained as the production source and restart capsule for the Trading Journal. Normal feature development is stopped. Terminal cleanup must preserve the current user-visible product and the runtime/data-safety paths required to serve it.

## Recovery checkpoints

- Pre-cleanup recovery branch: `release/terminal-pre-cleanup-2026-08-19`.
- Frozen pre-cleanup main SHA: `4377a6c92b95a9f253c4c893e944f9060f954a4f`.
- Final terminal authority: `release/terminal-final-2026-08-19` after terminal cleanup is merged.
- Do not rewrite or force-move either recovery checkpoint.

## Production architecture

- Frontend: Vue 3 + Pinia + Vite (`src/`, `public/`, `index.html`).
- API/runtime: Cloudflare Worker (`worker-entry.js`, `worker.js`, retained dividend and Journal Restore modules).
- Data: Cloudflare D1 through Worker binding `DB`; retained migrations `0001`–`0006` are rebuild authority.
- Portfolio calculations: `main.py` + `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Scheduled/user-triggered calculation workflow: `.github/workflows/update.yml`.

## Retained normal user capabilities

- Google authentication and token lifecycle.
- Overview, Charts, Holdings and Records.
- Manual transaction create/edit/delete and Records search/filter/pagination/refresh.
- IBKR trade import.
- Broker-neutral CSV/template/mapping import as currently exposed by the Records backup/import surface.
- Backup JSON export and Journal Restore as currently exposed by the retained UI.
- Dividends, Cash and strategy Groups.
- Manual and scheduled portfolio recalculation and calculation-job callbacks.
- Existing runtime integrity, idempotency, ambiguity recovery and self-healing required by those capabilities.
- PWA/service-worker behavior that is part of the current frontend.

## Financial semantics

- `total_value` is securities market value under the retained model; it is not automatically cash-inclusive NAV.
- Unrealized return is unrealized P/L divided by current holdings cost under the retained model.
- Do not change financial semantics, record authority, idempotency or snapshot authority merely for code cleanliness.

## Production identities and secrets

Tracked production identity is defined by `config/deployment-environments.json`, `wrangler.toml` and `worker-manifest.json`. Non-main Pages deployments are disabled in the terminal frontend policy.

Never store secret values in this repository. Retained secret names include:

- Cloudflare Worker secret: `API_SECRET`.
- GitHub Actions secret used by `update.yml`: `API_KEY`.

Any additional GitHub/Cloudflare/Google secret or environment value must have a live retained runtime reference; otherwise it is an external terminal-cleanup candidate after authoritative account verification.

## Data safety

- Production D1 is authoritative. Do not drop or rewrite user records for repository cleanliness.
- Backup JSON remains the user-facing export escape hatch.
- Production-test reconciliation helpers are retained until live D1 synthetic/test-row state can be reverified with private Cloudflare credentials.
- Before any future schema or Worker recovery work, inventory and back up the live D1 database from Cloudflare account authority.

## Terminal validation evidence

- Last full validation baseline before deleting the development harness: `00becc3157d5be65076a6adadd50fc8e0b4fb93b`.
- CI #1406 passed Python runtime tests, Worker runtime tests, production Worker contract verification, local D1 migrations/schema verification, frontend runtime tests and production frontend build.
- The subsequent terminal strip removes only tests/CI/test-only tooling and development scripts; it does not intentionally alter production runtime source.

## Emergency reconstruction

1. Start from `release/terminal-final-2026-08-19`; use the pre-cleanup checkpoint only for rollback comparison.
2. Verify live production frontend, Worker and D1 identities before deploying anything.
3. Install pinned dependencies from `package-lock.json` and `requirements.txt`.
4. Build the frontend with the retained Vite configuration and production environment policy.
5. Run `npm run worker:config:check`, then render a production-safe Wrangler file with `npm run worker:config:render`; never deploy the sentinel D1 ID from tracked `wrangler.toml`.
6. Restore required secrets from external secret stores, never from Git history.
7. Verify login, records CRUD, all retained import/backup/restore flows, dividends, cash, groups, calculation callbacks and scheduled update before resuming development.

## Future restart rule

If development resumes, compare then-current production state with the terminal-final checkpoint. Create tests/CI/staging infrastructure only when required by the new work; do not restore historical governance, staging, audit, evidence or diagnostic systems wholesale.
