# AI Project Playbook — Terminal State

Status: **DEVELOPMENT FROZEN**

This repository is retained as the production source and restart capsule for the Trading Journal. Normal feature development is stopped. The terminal cleanup must preserve current user-visible behavior and the runtime paths required to serve it.

## Recovery checkpoint

- Pre-cleanup release branch: `release/terminal-pre-cleanup-2026-08-19`
- Frozen pre-cleanup main SHA: `4377a6c92b95a9f253c4c893e944f9060f954a4f`
- Do not rewrite or force-move that checkpoint.

## Production architecture

- Frontend: Vue 3 + Pinia + Vite.
- Frontend product source: `src/`, `public/`, `index.html`.
- API/runtime: Cloudflare Worker, canonical entry `worker-entry.js` and `worker.js` plus retained runtime modules.
- Data: Cloudflare D1 through Worker binding `DB`.
- Portfolio calculations: `main.py` + `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Scheduled/user-triggered calculation workflow: `.github/workflows/update.yml`.

## Retained normal user capabilities

- Google authentication and token lifecycle.
- Overview, charts, holdings and transaction history.
- Manual transaction create/edit/delete.
- Records search/filter/pagination and refresh.
- IBKR trade import as currently exposed by the production Records UI.
- Backup JSON export.
- Dividends, cash and strategy groups.
- Manual and scheduled portfolio recalculation.
- Existing runtime integrity, idempotency and self-recovery paths required by those capabilities.
- PWA/service-worker behavior that is part of the current frontend.

## Production identities and secrets

Tracked Worker identity is defined in `wrangler.toml`. Never store secret values in this repository.

Retained secret names may include:

- Cloudflare Worker secret: `API_SECRET`.
- GitHub Actions secret used by `update.yml`: `API_KEY`.

Any additional GitHub/Cloudflare/Google secret or environment value must have a live retained runtime reference; otherwise it is a terminal-cleanup candidate.

## Data safety

- Production D1 data is authoritative. Do not drop or rewrite user records for repository cleanliness.
- Migration/schema cleanup is allowed only after proving production schema compatibility and a tested rebuild/recovery path.
- Backup JSON remains the user-facing export escape hatch.
- Before any future schema or Worker restoration work, inventory the live D1 database and back it up externally.

## Emergency reconstruction

1. Start from the terminal release/checkpoint, not an abandoned feature branch.
2. Verify production frontend, Worker and D1 identities before deploying anything.
3. Install the pinned Node/Python dependencies from the retained lock/requirements files.
4. Build the frontend with the retained Vite configuration.
5. Render/use a production-safe Wrangler configuration; never deploy the sentinel D1 ID from the tracked template.
6. Restore required secret values from the external secret stores, never from Git history.
7. Verify login, records CRUD, IBKR import, Backup JSON, dividends, cash, groups, calculation callbacks and scheduled update before resuming development.

## Future restart rule

If development resumes, first compare the then-current production runtime with this terminal checkpoint. Create new tests/CI/staging infrastructure only when required by the new work; do not restore historical governance, staging, audit or diagnostic infrastructure wholesale.
