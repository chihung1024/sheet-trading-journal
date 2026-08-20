# Sheet Trading Journal

Status: **DEVELOPMENT FROZEN**

This repository is the retained production source for the current Trading Journal. New feature development has stopped. The repository should contain only current user behavior, production runtime, data-safety controls, and the minimum recovery information required to restart the system later.

## Current product

The retained application includes:

- Google sign-in and authenticated journal access;
- overview, charts and holdings;
- transaction create/edit/delete and Records search/filter/pagination;
- IBKR trade import;
- Backup JSON export, broker-neutral CSV import and Journal Restore;
- dividends, cash and strategy groups;
- manual and scheduled portfolio recalculation;
- PWA/service-worker behavior and runtime integrity/self-recovery required by those flows.

Portfolio terminology is intentionally precise:

- 持倉市值（Securities Market Value；目前不含未建模的現金部位）
- 未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）

Do not reinterpret `total_value` as cash-inclusive NAV unless the financial model itself is deliberately changed and revalidated.

## Runtime

- Frontend: Vue 3, Pinia, Vite (`src/`, `public/`, `index.html`).
- Worker/API: Cloudflare Worker (`worker-entry.js`, `worker.js` and retained Worker modules); no public health/version diagnostic routes are retained.
- Data: Cloudflare D1 through Worker binding `DB`.
- Calculation engine: `main.py` and `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Production schedule/callback workflow: `.github/workflows/update.yml`.
- Worker deployment template/source of truth: `wrangler.toml`.

Tracked production endpoints include `https://sheet-trading-journal.pages.dev` and `https://journal-backend.chired.workers.dev`. Live Cloudflare, D1 and Google OAuth state is authoritative over repository documentation.

## Data safety

Production D1 data is authoritative. Repository cleanup must never be used as a reason to delete or rewrite user records. Backup JSON remains the user-facing export path. Secret values are external and must not be committed.

Retain fail-closed authentication, ownership isolation, idempotency, mutation validation, calculation provenance and recovery controls when changing production code.

## Recovery / future restart

Git history and terminal release checkpoints are the archive; do not recreate historical staging/audit infrastructure inside the active tree. Before any future redeploy or development restart:

1. verify the then-live frontend, Worker, D1 identity/schema and OAuth origins;
2. compare live production behavior with the terminal source/release checkpoint;
3. restore only the development tooling required for the new task;
4. run full runtime, schema and production-flow validation before deploying changes.
