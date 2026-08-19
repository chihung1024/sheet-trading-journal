# Sheet Trading Journal

Status: **DEVELOPMENT FROZEN**

This repository is the retained production source for the current Trading Journal. New feature development has stopped. Terminal cleanup keeps only current user behavior, the runtime required to serve it, and the minimum information needed to recover or restart the project later.

## Current product

The current application includes:

- Google sign-in and authenticated journal access;
- overview, charts and holdings;
- transaction create/edit/delete and Records search/filter/pagination;
- the currently exposed IBKR trade import flow;
- Backup JSON export plus the currently exposed broker-neutral CSV and Journal Restore flows;
- dividends, cash and strategy groups;
- manual and scheduled portfolio recalculation;
- PWA/service-worker behavior and runtime integrity/self-recovery required by those flows.

Current portfolio terminology is intentionally precise:

- 持倉市值（Securities Market Value；目前不含未建模的現金部位）
- 未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）

Do not reinterpret `total_value` as cash-inclusive NAV unless the financial model itself is deliberately changed and revalidated.

## Runtime

- Frontend: Vue 3, Pinia, Vite (`src/`, `public/`, `index.html`).
- Worker/API: Cloudflare Worker (`worker-entry.js`, `worker.js`, retained Worker modules including current Journal Restore handling).
- Data: Cloudflare D1 through Worker binding `DB`.
- Calculation engine: `main.py` and `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Production schedule/callback workflow: `.github/workflows/update.yml`.
- Worker deployment template/source of truth: `wrangler.toml`.

Tracked production origins/endpoints in the terminal source include `https://sheet-trading-journal.pages.dev` and `https://journal-backend.chired.workers.dev`. Verify live external state before any future deployment or recovery operation.

## Frozen checkpoint

- Pre-cleanup release branch: `release/terminal-pre-cleanup-2026-08-19`.
- Pre-cleanup main SHA: `4377a6c92b95a9f253c4c893e944f9060f954a4f`.

Do not force-move or rewrite the release checkpoint.

## Data safety

Production D1 data is authoritative. Repository cleanup must never be used as a reason to delete or rewrite user records. Backup JSON remains the user-facing export path. Secret values are external and must not be committed.

## Recovery / future restart

Read `AI_PROJECT_PLAYBOOK.md` before changing or redeploying the terminal system. If development resumes, compare the then-live production state with the terminal checkpoint and add only the development infrastructure needed for the new goal; historical staging, audit and diagnostic machinery should not be restored wholesale.
