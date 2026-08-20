# Sheet Trading Journal

Status: **DEVELOPMENT FROZEN**

This repository is the intended terminal source for the current Trading Journal. New feature development has stopped. The repository should contain only current user behavior, production runtime, data-safety controls, and the minimum recovery information required to restart the system later. Live component identities remain authoritative until a terminal deployment is recorded; do not assume that every commit on `main` has already reached Cloudflare.

This is an operational freeze, not a promise of indefinite maintenance. The scheduled workflow is retained only because the live product still depends on portfolio recalculation and its Worker callback. GitHub may automatically disable scheduled workflows in public repositories after 60 days without repository activity; before relying on a future scheduled run, verify that the workflow is still enabled and that its external secrets and production endpoints remain valid. Do not add keep-alive development commits solely to bypass that policy. If automatic recalculation is no longer required, retire the workflow and archive the repository after completing the data and deployment handoff.

## Current product

The retained application includes:

- Google sign-in and authenticated journal access;
- overview, charts and holdings;
- transaction create/edit/delete and Records search/filter/pagination;
- IBKR trade import;
- Backup JSON export, broker-neutral CSV import and Journal Restore;
- dividends, cash and strategy groups;
- manual and scheduled portfolio recalculation;
- browser-based journal behavior and the runtime integrity/data-recovery controls required by those flows.

Portfolio terminology is intentionally precise:

- 持倉市值（Securities Market Value；目前不含未建模的現金部位）
- 未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）

Do not reinterpret `total_value` as cash-inclusive NAV unless the financial model itself is deliberately changed and revalidated.

## Runtime

- User-facing runtime: a desktop browser (Windows is the current freeze target); this is not a native Windows, macOS or Linux application and no operating-system package is retained.
- Frontend: Vue 3, Pinia, Vite (`src/`, `public/`, `index.html`).
- Worker/API: Cloudflare Worker (`worker-entry.js`, `worker.js` and retained Worker modules); public health/version diagnostic routes are not part of the terminal source contract.
- Data: Cloudflare D1 through Worker binding `DB`.
- Calculation engine: `main.py` and `journal_engine/`.
- Hosted calculation runner: `tools/run_portfolio_update.py`.
- Production schedule/callback workflow: `.github/workflows/update.yml`.
- Worker deployment template/source of truth: `wrangler.toml`.

The canonical frontend is `https://sheet-trading-journal.pages.dev`; the API is `https://journal-backend.chired.workers.dev`. The retired GitHub Pages host is not a supported frontend or API origin. GitHub Actions runs on Ubuntu and Cloudflare Workers run in Cloudflare's service runtime; those are production infrastructure dependencies, not alternate user operating-system targets, and remain while the service is online. Live Cloudflare, D1 and Google OAuth state is authoritative over repository documentation.

Historical browser-registration compatibility: `public/service-worker.js` remains at `/service-worker.js` as a minimal retirement tombstone for registrations created by earlier releases. On install/activation it skips waiting, clears this origin's Cache Storage, claims clients, and unregisters itself; it has no fetch handler or application behavior. The manifest, PWA install metadata, and `usePWA` integration are removed. This tombstone is not a supported PWA, installation, offline, or update contract. Keep the URL through the terminal deployment that verifies old registrations have retired; remove it only after that deployment and verification.

## Data safety

Production D1 data is authoritative. Repository cleanup must never be used as a reason to delete or rewrite user records. Backup JSON remains the user-facing export path. Secret values are external and must not be committed.

Retain fail-closed authentication, ownership isolation, idempotency, mutation validation, calculation provenance and recovery controls when changing production code.

## Recovery / future restart

Git history and terminal release checkpoints are the archive; do not recreate historical staging/audit infrastructure inside the active tree. Before any future redeploy or development restart:

1. verify the then-live frontend, Worker, D1 identity/schema and OAuth origins;
2. compare live production behavior with the terminal source/release checkpoint;
3. restore only the development tooling required for the new task;
4. run full runtime, schema and production-flow validation before deploying changes.
