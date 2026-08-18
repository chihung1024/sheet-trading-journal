# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-19 Asia/Taipei**

Current line: **Primary Active Batch is UX-R1 — Adaptive Workspace & Responsive Interaction. R3.3B Safe Ambiguous Import Retry is explicitly DEFERRED, preserved in Draft PR #367 and `docs/engineering/R3_3B_SAFE_AMBIGUOUS_IMPORT_RETRY_DEFERRED_2026-08-19.md`. Do not resume or merge #367 until UX-R1 closes or the user explicitly reprioritizes it.**

Planning baseline before this handoff update: `main@44c62993706c083fd23fb7d1200adf217471efd4`. Always refresh remote truth at session start.

Key planning documents:

- UX-R1 plan: `docs/engineering/UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md`
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

## 2. Primary Active Batch — UX-R1 Adaptive Workspace & Responsive Interaction

Phase: `UX-R1 — Adaptive Workspace & Responsive Interaction`

Status: **PRIMARY ACTIVE / IMPLEMENTATION NEXT**

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

### Implementation batches

#### UX-R1.1 — Adaptive layout foundation

- map all current runtime/media breakpoint authorities;
- define shared app-shell/touch-density/container tokens;
- create named container boundaries where useful;
- remove only proven redundant breakpoint duplication;
- add deterministic layout-contract coverage where feasible.

#### UX-R1.2 — Adaptive transaction surface

- dock only when sufficient workspace remains;
- desktop/tablet drawer when docking would harm the active workspace;
- mobile sheet for compact layouts;
- preserve one `TradeForm` state/mutation authority;
- edit-from-history must reopen the correct surface;
- verify Escape, backdrop, focus, scroll locking, and unsaved in-memory form behavior.

#### UX-R1.3 — Responsive navigation

- compact primary destinations + `更多` presentation;
- preserve `activeView`, URL, localStorage, pending badges, and current-view state;
- no second routing authority.

#### UX-R1.4 — Holdings + Records work surfaces

- container-driven table/card/detail presentation;
- Holdings concentration summary/detail composition;
- Records primary search/filter vs secondary import/backup/CSV utilities;
- maintain all existing mutation/import/export authority.

#### UX-R1.5 — Overview + Charts

- preserve information hierarchy;
- use reclaimed workspace;
- viewport/container-aware chart height;
- reduce avoidable dead zones and first-screen displacement without removing KPI/business content.

#### UX-R1.6 — Dividends + Cash + Groups

- task-oriented adaptive layouts;
- workspace-first Group management;
- sticky changed-count/save/action feedback where useful;
- no mutation semantics change.

#### UX-R1.7 — Accessibility / interaction verification

- keyboard/focus/escape behavior;
- practical mobile touch targets;
- no hover-only required action;
- 200% zoom/narrow reflow;
- reduced motion;
- mobile safe-area and sticky action verification.

#### UX-R1.8 — Production visual verification + closeout

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

1. Refresh current `main`, open PRs, exact-head CI, Pages/deployment truth.
2. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, UX-R1 plan, and D4–D5 closeout.
3. Trace `App.vue`, `style.css`, `styles/product-consistency.css`, and primary page component breakpoint/layout authorities.
4. Produce one breakpoint/container authority map before editing CSS.
5. Implement UX-R1.1 first; do not begin with isolated page styling patches.
6. Keep business/data/mutation code unchanged unless source tracing proves a necessary UX-enabling correction.

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
8. Keep UX-R1 as the single Primary Active Batch.
9. Start with systemic layout/breakpoint authority mapping, then UX-R1.1 foundation.
10. Use Draft PR → exact-head CI → frozen review → expected-head merge → production/Pages verification.
11. Complete UX-R1 and persist closeout before opening another development phase.
