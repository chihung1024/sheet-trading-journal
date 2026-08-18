# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-19 Asia/Taipei**

Current line: **Primary Active Batch is UX-R1.3 — Responsive Navigation on Draft PR #387. UX-R1.1 and UX-R1.2 are COMPLETE with exact-head CI success. R3.3B Safe Ambiguous Import Retry remains explicitly DEFERRED in Draft PR #367; do not resume or merge #367 until UX-R1 closes or the user explicitly reprioritizes it.**

Current protected-main baseline for UX-R1: `main@97e2a7a582334518a18732237a0c686baaa547e0`. Active UX branch: `feat/ux-r1-adaptive-workspace`. Always refresh remote truth before merge or after external changes.

Key planning documents:

- UX-R1 plan: `docs/engineering/UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md`
- UX-R1.1 breakpoint/container authority map: `docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`
- deferred R3.3B handoff: `docs/engineering/R3_3B_SAFE_AMBIGUOUS_IMPORT_RETRY_DEFERRED_2026-08-19.md`
- Update Portfolio Data #3317 RCA: `docs/engineering/update-portfolio-3317-systemic-rca.md`
- prior desktop visibility closeout: `docs/engineering/DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, safety, maintainability, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention; do not patch individual symbols, dates, users, pages, or specimens when a general invariant can be fixed.
4. Financial/data correctness is fail-closed. Browser convenience state never becomes a second accounting, FX, tax, recovery, market-data, or transaction-identity authority.
5. Important work uses Draft PR → exact-head CI → frozen review → expected-head merge → authoritative post-main verification where available.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, transaction identity, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over optional methodology expansion.
10. Public repo evidence must not unnecessarily record personal financial values, credentials, backup contents, broker file contents, tenant identities, record IDs, or private production screenshots.
11. For UX work, fix layout/composition authority before shrinking text, hiding business facts, or adding page-specific exceptions.
12. A phase transition is a hard handoff boundary: close the current phase, persist exact repo truth, then continue in a new conversation/session.

---

## 1. Current authoritative product state

### P0 — Update Portfolio Data #3317

Status: **CLOSED / PRODUCTION VERIFIED**

Systemic market-data, row-level recovery composition, XIRR safety-domain, and production synthetic-record lifecycle work are complete. Final production proof before this planning change:

- Production Test Record Reconciliation: one exact-owned legacy synthetic row removed atomically; zero residual tenant rows;
- Update Portfolio Data #3332 / run ID `32157227218`: SUCCESS;
- 264 transactions processed across 2 real users;
- 58 market symbols downloaded;
- both portfolio snapshots uploaded;
- final success 2 / failure 0;
- `DELETE /api/records` remains user-only.

Do not reopen #3317 for isolated upstream noise unless new evidence disproves its generic invariants.

### Stable product boundaries

Transaction mutation:

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ authoritative readback
→ calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

Broker-neutral import:

```text
explicit source semantics
→ strict Canonical/mapped preview
→ optional explicit saved mapping convenience
→ explicit source profile + confirmation
→ source-bound stable idempotency
→ existing durable record-create writer
→ shared batch outcome / readback / recalculation
```

Cash/account value, dividend, backup/restore, FX, accounting, and transaction identity remain governed by their existing authoritative contracts. UX-R1 must not create parallel authorities.

---

## 2. Primary Active Phase — UX-R1 Adaptive Workspace & Responsive Interaction

Phase: `UX-R1 — Adaptive Workspace & Responsive Interaction`

Status: **PRIMARY ACTIVE / R1.1 COMPLETE / R1.2 COMPLETE / R1.3 ACTIVE**

Draft PR: **#387 — `feat: UX-R1 adaptive workspace and responsive interaction`**

### Primary goal

> Make the application adapt to actual available workspace so Overview, Charts, Holdings, Records, Dividends, Cash, Groups, and Trade entry remain readable, interactive, and efficient on desktop, tablet, and mobile without shrinking core typography or changing financial/business authority.

The production UI review identified common architectural pressure rather than page-specific cosmetic bugs:

- persistent desktop transaction rail consumes analysis/management width even when trade entry is not the user's primary task;
- component presentation is governed by fragmented viewport breakpoints instead of actual available container width;
- compact navigation relies on a long horizontally scrollable destination row;
- desktop density and touch ergonomics currently share too much control sizing authority;
- high-frequency Holdings/Records workspaces need priority-based reflow rather than independent breakpoint patches;
- Charts/Groups/Dividends can waste or lose useful workspace depending on whether the transaction rail is visible.

No private portfolio screenshot or actual financial value should be committed as UX evidence.

### UX-R1 architecture direction

1. Keep viewport media queries for true app-shell transitions only.
2. Introduce component/container-width authority for workspace-dependent presentation.
3. Keep one canonical `TradeForm`; expose it as docked rail, drawer, or mobile sheet depending on usable space.
4. Keep one `activeView` navigation authority; mobile/desktop may present it differently.
5. Preserve semantic typography tokens; do not solve density by making financial text smaller.
6. Add touch-specific interaction density without inflating desktop work surfaces.
7. Reuse existing Holdings/Records desktop-table and mobile-card projections; improve the switching/composition authority instead of duplicating data logic.
8. Treat accessibility, keyboard navigation, zoom/reflow, focus management, and mobile safe-area behavior as product requirements, not post-polish.

### UX-R1.1 — Adaptive layout foundation

Status: **COMPLETE**

Risk: **R2 Significant presentation architecture change; no financial/mutation authority change.**

Scope / root cause:

- audited viewport media-query classes and all current `window.innerWidth` presentation paths;
- root cause confirmed as missing distinction between app-shell viewport authority and component usable inline-size authority;
- intentionally did not shotgun-rewrite every legacy component breakpoint.

Implementation:

- added `src/styles/adaptive-workspace.css` after the existing product-consistency layer;
- added shared app-shell/transaction/touch/safe-area tokens;
- added named inline-size containers for app/main/transaction/analysis/holdings/records/management/dividends/cash/groups workspaces;
- added deterministic `frontend_adaptive_workspace_foundation.test.mjs` contracts;
- committed systemic authority map at `docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`;
- no Worker/D1/schema/auth/accounting/FX/idempotency/import mutation changes.

Files changed in implementation commit:

- `src/main.js`
- `src/styles/adaptive-workspace.css`
- `tests/frontend_adaptive_workspace_foundation.test.mjs`
- `docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`

Verification:

- implementation commit: `b9c10105a107c54c1d420cdc94cd1f847a750257`;
- PR #387 Draft exact-head CI #1379 / run `32162550781`: **SUCCESS**;
- Frontend contracts + build: SUCCESS;
- Python tests: SUCCESS;
- Worker security/deployment tests: SUCCESS;
- diff review: no business/data/mutation authority introduced;
- rollback: revert R1.1 commit or reset only the feature branch before merge; protected `main` remains unchanged.

Regression / follow-up:

- existing app-shell `<=1024` transaction mode remained intact for R1.1;
- RecordList/Holdings/PerformanceChart runtime width checks remain intentionally deferred to their owning R1.4/R1.5 batches.

### UX-R1.2 — Adaptive transaction surface

Status: **COMPLETE**

Risk: **R2 interaction/layout state-machine change; one existing TradeForm and mutation authority preserved.**

Scope / root cause:

- persistent desktop rail was a presentation allocation decision tied too strongly to viewport class rather than the actual workspace left for the active page;
- the required correction was one transaction-surface presentation state machine, not a second form or page-specific hide/show patches.

Implementation:

- kept exactly one mounted/canonical `TradeForm` in `App.vue`;
- introduced actual `content-container` inline-size observation with `ResizeObserver` and one shared dock-eligibility token;
- same TradeForm now composes as dock, desktop/tablet drawer, or compact sheet;
- preserved create/edit setup path and unsaved in-memory form state across presentation changes;
- edit-from-Record history opens the current transaction presentation before delegating to the existing `setupForm(record)` path;
- transient drawer/sheet supports backdrop close, Escape close, focus containment, focus restoration, and body scroll lock;
- adaptive transaction state remains memory-only and creates no localStorage, API, financial, or mutation authority.

Files changed:

- `src/App.vue`
- `src/styles/adaptive-workspace.css`
- `tests/frontend_adaptive_workspace_foundation.test.mjs`
- `tests/frontend_desktop_trade_rail_focus.test.mjs`
- `tests/frontend_user_reported_product_defects.test.mjs`
- `tests/frontend_data_reliability.test.mjs`

Verification / regression:

- implementation commit: `fdf13b35fda2091bb5c849b33e197711e7970fa3`;
- first contract-adjustment commit: `f3c838c45c9d7e373b790f14ee40ce5386ada845`;
- CI then exposed one unrelated-looking but structurally triggered reliability-banner contract failure. Trace showed the banner itself remained persistently mounted between header and content, while the test searched for the obsolete exact literal `<div class="content-container">`; R1.2 had correctly added `ref="contentContainerRef"` to that element for ResizeObserver authority. The failure point was the brittle source-string locator, not product behavior;
- root-cause prevention commit `0894907f513ac8690bb58b1429c4d0ac8397efdc` changed the test to locate the stable `class="content-container"` invariant and explicitly assert the banner exists before checking structural order. No production behavior was weakened or bypassed;
- PR #387 exact-head CI #1383 / run `32165931615`: **SUCCESS**;
- Frontend contracts + build: SUCCESS;
- Python tests: SUCCESS;
- Worker security/deployment tests: SUCCESS;
- protected `main` remains unchanged and rollback is limited to the UX feature branch/commits.

NOW/NEXT/BACKLOG/REJECT after R1.2:

- NOW: UX-R1.3 responsive navigation;
- NEXT: UX-R1.4 Holdings + Records work surfaces;
- BACKLOG: page-specific visual refinements that are not required by the current adaptive authority;
- REJECT: duplicate TradeForm, navigation router, persistence state, or page-specific breakpoint exceptions as a substitute for the shared adaptive architecture.

### UX-R1.3 — Responsive navigation

Status: **PRIMARY ACTIVE**

- implement compact primary destinations + `更多` presentation;
- preserve the existing `views` / `activeView` / URL / localStorage authority rather than creating a router or parallel selected state;
- preserve pending-dividend attention in the compact presentation;
- use actual main-workspace inline size where possible for presentation switching instead of another browser-width-only exception;
- verify keyboard/focus/current-view semantics and that hidden presentation variants are not focusable.

### UX-R1.4 — Holdings + Records work surfaces

- container-driven table/card/detail presentation;
- Holdings concentration summary/detail composition;
- Records primary search/filter vs secondary import/backup/CSV utilities;
- maintain all existing mutation/import/export authority.

### UX-R1.5 — Overview + Charts

- preserve information hierarchy;
- use reclaimed workspace;
- viewport/container-aware chart height;
- reduce avoidable dead zones and first-screen displacement without removing KPI/business content.

### UX-R1.6 — Dividends + Cash + Groups

- task-oriented adaptive layouts;
- workspace-first Group management;
- sticky changed-count/save/action feedback where useful;
- no mutation semantics change.

### UX-R1.7 — Accessibility / interaction verification

- keyboard/focus/escape behavior;
- practical mobile touch targets;
- no hover-only required action;
- 200% zoom/narrow reflow;
- reduced motion;
- mobile safe-area and sticky action verification.

### UX-R1.8 — Production visual verification + closeout

- exact-head CI;
- frozen review BLOCKER 0;
- expected-head merge;
- Pages/deployment truth where appropriate;
- representative desktop/tablet/mobile width verification;
- stable closeout documentation without private financial values.

### Required width matrix

At minimum verify representative widths around:

`320 / 360 / 390 / 430 / 600 / 768 / 820 / 1024 / 1280 / 1440 / 1680 / 2048 CSS px`.

Also verify light/dark themes, trade surface open/closed/editing, long labels/notes, empty/small/large data sets, pending dividend attention, Records filter states, Groups large record sets, keyboard-only interaction, and browser zoom/reflow.

### Immediate next actions

1. Treat `main@97e2a7a582334518a18732237a0c686baaa547e0` + current PR #387 head as the working baseline; refresh before any merge.
2. Implement UX-R1.3 only; do not mix R1.4 Holdings/Records layout work into the same implementation batch.
3. Keep `activeView` as the only selected-destination state and retain the current URL query/localStorage watch contract.
4. Reuse the single `views` catalog; compact navigation may group/present destinations but must not duplicate route/business authority.
5. Prefer `main-workspace` container authority for compact-vs-full navigation presentation; do not add a scatter of page-specific viewport thresholds.
6. Add deterministic contracts for compact destination grouping, pending-dividend badge, current-view indication, focus/keyboard behavior, and no persistence/router duplication.
7. Run exact-head CI before marking R1.3 complete, update this handoff, then advance to R1.4.

---

## 3. Deferred Batch — R3.3B Safe Ambiguous Import Retry

Status: **DEFERRED / PRESERVED / DO NOT MERGE YET**

Stable handoff: `docs/engineering/R3_3B_SAFE_AMBIGUOUS_IMPORT_RETRY_DEFERRED_2026-08-19.md`

Remote state at deferral:

- PR #367: OPEN / DRAFT / not merged;
- branch: `feat/r3-3b-safe-ambiguous-import-retry`;
- head: `6eb1a86ea08b6a732b082b1e102915fe842102c2`;
- original base: `e4edf84e3a60e4c63343ff5b54659def9ec950b9`;
- 14 commits / 8 changed files;
- CI #1255 / run ID `32111867887`: failure in Frontend security contract tests; Python and Worker suites succeeded.

R3.3B product intent and safety contract are **not cancelled**. They are frozen for future resumption. Do not hard-merge/rebase the old branch when resumed. First compare it to then-current `main`, re-trace stable-key reproduction for Canonical/mapped/IBKR, classify the old Frontend failure under current contracts, then choose transplant vs clean reimplementation.

While UX-R1 is active:

- do not merge #367;
- do not partially absorb R3.3B mutation behavior into UX work;
- UI changes around import controls may improve presentation only;
- if UX-R1 touches a file also changed by #367, document the overlap for future resumption instead of preserving old code assumptions.

---

## 4. Closed portability checkpoints

- R3.2A Canonical Trade CSV v1 Preview — PR #355 — CLOSED
- R3.2B Canonical CSV Template — PR #356 — CLOSED
- R3.2C Safe Canonical CSV Execution — PR #358 — CLOSED
- R3.2D Explicit Broker Column Mapping Preview — PR #360 — CLOSED
- R3.2E Safe Mapped Broker CSV Execution — PR #361 — CLOSED
- R3.2F Saved Mapping Presets — PR #363 — CLOSED
- R3.3A Import Reconciliation Receipt — PR #365 — CLOSED

R3.3A memory-only receipts remain convenience/reconciliation state, not transaction/accounting authority.

---

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Read `docs/engineering/UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md`.
5. Read `docs/engineering/DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`.
6. Refresh protected `main`, open PRs, exact-head CI, and Pages/deployment truth.
7. Confirm #367 remains Draft/deferred; read its deferred handoff only if UX work overlaps its files.
8. Keep UX-R1 as the single Primary Active Phase and exactly one active implementation batch.
9. Resume from the recorded Current Batch; closed batches stay closed unless new material evidence appears.
10. Use Draft PR → exact-head CI → frozen review → expected-head merge → production/Pages verification.
11. Complete UX-R1 and persist closeout before opening another development phase.