# TO-DO / UPDATE LIST — UX-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → `docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md` → fresh GitHub remote truth.
>
> GitHub / CI / deployment remote truth overrides this snapshot. Stable rationale/evidence belongs in `docs/engineering/`; this file is the concise live execution handoff.

Last updated: **2026-08-19 Asia/Taipei**

## Current line

**UI/UX architecture and direct user experience are now the highest active development priority. The import/restore product-surface discussion is CLOSED. UX-R1 remains the only implementation phase. Finish UX-R1.3 first, then continue R1.4–R1.8 without opening a parallel development line.**

Protected-main baseline at this decision point: `main@97e2a7a582334518a18732237a0c686baaa547e0`.

Active branch: `feat/ux-r1-adaptive-workspace`.

Active Draft PR: **#387 — `feat: UX-R1 adaptive workspace and responsive interaction`**.

Last implementation head before the documentation closeout: `dc1af19a4ab6683cb68a80688d339c55ce2582c6`.

Latest CI known for that implementation head: run `32203363240` / attempt 2 — **Frontend contract tests failed; Python and Worker suites succeeded**. Do not assume that failure remains current after documentation commits; refresh PR #387 head and exact-head CI before resuming implementation.

R3.3B PR #367 is now **CLOSED / NOT MERGED / NOT PLANNED FOR CURRENT RELEASE**. It is history/reference only, not Deferred active work.

---

## 0. Operating doctrine

1. **Current product priority: UI/UX architecture, usability, responsiveness, interaction clarity, accessibility, and directly experienced workflow quality.**
2. Preserve functional continuity while improving the interface.
3. Financial/data/security correctness remains a non-negotiable fail-closed safety gate; UX priority does not authorize bypassing it.
4. Technical/debug work exists only to enable current product value, correctness, safety, or necessary maintainability.
5. Keep exactly one Primary Active Implementation Batch.
6. Debug from evidence/root cause; fix general invariants rather than page/device/specimen-specific symptoms.
7. Do not let optional refactor, dormant adapters, or methodology expansion become a parallel roadmap.
8. Prefer container/workspace composition over typography shrinkage, hidden business facts, horizontal overflow, or scattered breakpoint patches.
9. Important work remains Draft PR → exact-head CI → frozen review → expected-head merge → applicable post-main/deployment verification.
10. **AI 管流程，不管帳**: browser convenience state never becomes accounting, transaction identity, FX, tax, recovery, or market-data authority.
11. Public repo evidence must not expose credentials, personal financial values, backup contents, broker files, tenant identifiers, record IDs, or private screenshots.
12. Phase closeout is a hard handoff boundary: persist exact remote truth and then stop before opening the next development phase.

---

## 1. Product-surface decision — CLOSED

Authoritative rationale:

`docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`

### KEEP

- manual BUY / SELL / DIV / edit / delete flows;
- generic record-create durable intent, idempotency, recovery, mutation barriers, authoritative readback, recalculation recovery;
- existing imported-record read compatibility and historical metadata/note compatibility;
- **Backup JSON export** as a read-only supporting safety/data-portability feature.

### PRODUCT RETIRED / FROZEN

- IBKR Import;
- Canonical CSV Import;
- mapped/broker-neutral CSV Import;
- mapping presets;
- CSV import template UX;
- import reconciliation receipt/retry UX;
- R3.3B ambiguous import retry.

These are no longer active product-development or UX-polish obligations.

### RESTORE

- Journal Restore normal product UI: **RETIRED**;
- Restore feature expansion: **FROZEN**;
- existing backend Worker route/migration/tests: **MAINTENANCE-ONLY / KEEP FOR NOW**;
- do not purge backend/migrations during UX-R1;
- UI retirement does not eliminate the remaining production server mutation surface.

Optional future backlog after UX-R1: a separate `Production Mutation Surface Review` may decide whether the Restore route should be server-side feature-gated/default-disabled.

### Historical compatibility rule

> **Retire write adapters; retain read compatibility.**

Existing IBKR/IMPORT records must remain readable, display correctly, paginate correctly, and remain included in authoritative Backup export.

---

## 2. Primary Active Phase — UX-R1 Adaptive Workspace & Responsive Interaction

Status: **PRIMARY ACTIVE**

- UX-R1.1 — COMPLETE
- UX-R1.2 — COMPLETE
- UX-R1.3 — ACTIVE / CI CLOSURE REQUIRED
- UX-R1.4 — NEXT
- UX-R1.5 — PLANNED
- UX-R1.6 — PLANNED
- UX-R1.7 — PLANNED
- UX-R1.8 — PLANNED / PHASE CLOSEOUT

Key documents:

- current product decision: `docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`
- UX-R1 plan: `docs/engineering/UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md`
- breakpoint/container authority map: `docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`
- prior desktop visibility closeout: `docs/engineering/DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`
- historical R3.3B handoff: `docs/engineering/R3_3B_SAFE_AMBIGUOUS_IMPORT_RETRY_DEFERRED_2026-08-19.md` — historical only; newer product decision overrides its Deferred status.

### UX-R1 invariants

- one canonical `TradeForm` create/edit authority;
- one `activeView` + URL + localStorage navigation authority;
- no second accounting/data/mutation source;
- no accounting, holdings/P&L, NAV/TWR/XIRR, FX, tax, dividend, cash, Worker, D1, schema, or auth semantic change unless a separately justified blocker proves it necessary;
- preserve authoritative Holdings/Records projections and historical record compatibility;
- fail closed on uncertain financial/data facts.

---

## 3. Completed UX batches

### UX-R1.1 — Adaptive layout foundation

Status: **COMPLETE**

Implementation commit: `b9c10105a107c54c1d420cdc94cd1f847a750257`.

Delivered:

- shared adaptive workspace/control/touch/safe-area tokens;
- named inline-size container boundaries;
- app-shell vs component-width authority separation;
- deterministic foundation contracts;
- no financial/mutation authority change.

Exact-head CI #1379 / run `32162550781`: Frontend / Python / Worker **SUCCESS**.

### UX-R1.2 — Adaptive transaction surface

Status: **COMPLETE**

Primary implementation commit: `fdf13b35fda2091bb5c849b33e197711e7970fa3`.

Delivered:

- one existing TradeForm;
- dock only when actual usable content workspace is sufficient;
- drawer for noncompact constrained workspaces;
- sheet for compact workspaces;
- focus trap / Escape / restore-focus / scroll lock for transient modes;
- edit path reuses the existing setup authority;
- presentation changes do not create persistence or mutation authority.

Regression-contract corrections were made only where static tests encoded obsolete markup rather than the true invariant.

Exact-head CI #1383 / run `32165931615`: Frontend / Python / Worker **SUCCESS**.

---

## 4. NOW — UX-R1.3 Responsive Navigation closure

Status: **ACTIVE**

Current architecture already implemented on PR #387:

- App remains sole navigation authority;
- compact navigation receives existing `views` + `activeView` and emits `navigate`;
- primary destinations: overview / holdings / records / dividends;
- `更多` contains remaining destinations;
- pending-dividend badge retained;
- container-driven compact/full presentation;
- keyboard/Escape/outside-pointer/focus-restore semantics included;
- no second router or persistence authority.

### Known CI state before this docs closeout

Last implementation head: `dc1af19a4ab6683cb68a80688d339c55ce2582c6`.

CI run `32203363240` attempt 2:

- Frontend contracts/build: **FAIL**;
- Python: **SUCCESS**;
- Worker security/deployment: **SUCCESS**.

The Frontend failure occurs in the contract-test step. Do not guess product defects from this status alone.

### Required closure sequence

1. Refresh PR #387 current head after these documentation commits.
2. Inspect the new exact-head CI; if no current run exists, allow/trigger the normal PR CI path.
3. Identify the exact failing Frontend assertion from evidence.
4. Classify it from four perspectives:
   - product/UX invariant;
   - architecture/state-authority invariant;
   - accessibility/interaction invariant;
   - test-contract brittleness/staleness.
5. Apply the smallest general fix. Do not change correct product behavior merely to satisfy an obsolete source-string expectation.
6. Require exact-head Frontend + Python + Worker success.
7. Update this handoff with final R1.3 evidence and rollback point.
8. Only then advance to R1.4.

Do not mix Records/Import retirement changes into the R1.3 implementation diff.

---

## 5. NEXT — UX-R1.4 Holdings + Records

R1.4 is intentionally narrowed by the closed product-surface decision so UX work is not wasted on retired controls.

### Holdings

- container-driven table/card/detail presentation;
- preserve concentration facts and analytical context;
- prevent concentration panels from displacing the primary holdings surface excessively;
- use actual available workspace rather than raw viewport-only switching where practical;
- preserve authoritative holdings data/projection semantics.

### Records — target normal product surface

Primary workflow:

- search;
- transaction type filter;
- date range;
- result/filter context;
- pagination/page size;
- refresh;
- **Backup JSON download**.

Retire from normal product UI in this batch:

- IBKR Import;
- Canonical/mapped CSV import entry points;
- CSV import template;
- mapping/preset/import-receipt/retry entry points;
- Journal Restore.

Architecture boundary:

- `JournalBackupButton.vue` becomes a focused Backup export control instead of an Import/Template/Backup/Restore aggregator;
- do not delete generic record-create recovery/idempotency;
- do not delete historical IBKR/IMPORT read compatibility;
- do not delete Restore backend/migration/tests in this batch;
- do not create a new mega-menu merely to hide retired features.

Verification must include existing imported records to prove retirement of new writes does not break old data display/export.

---

## 6. THEN — remaining UX-R1 batches

### UX-R1.5 — Overview + Charts

- preserve KPI/information hierarchy;
- use reclaimed workspace;
- container/viewport-aware chart dimensions;
- reduce first-screen displacement/dead zones;
- no business-content removal to simulate density.

### UX-R1.6 — Dividends + Cash + Groups

- task-oriented adaptive layouts;
- pending-dividend queue remains visible/useful;
- Cash authoritative editor/ledger semantics unchanged;
- Groups favor management workspace width;
- changed-count/save/action feedback may be sticky when useful.

### UX-R1.7 — Accessibility / interaction verification

Verify:

- keyboard-only use;
- visible focus;
- Escape / focus restore;
- modal/sheet focus containment;
- no hover-only required action;
- practical touch targets (shared baseline ~44px where appropriate);
- 200% zoom / narrow reflow;
- reduced motion;
- mobile safe-area;
- long text and empty/small/large datasets.

### UX-R1.8 — Production visual verification + closeout

- full exact-head CI;
- frozen multi-perspective review: BLOCKER 0;
- expected-head merge;
- post-main CI;
- Pages/deployment/runtime verification where applicable;
- representative responsive matrix verification;
- stable closeout/handoff document;
- update this file with final main SHA / PR / CI / deployment truth;
- stop after UX-R1 closes before starting a new development phase.

---

## 7. Required responsive verification matrix

At minimum:

`320 / 360 / 390 / 430 / 600 / 768 / 820 / 1024 / 1280 / 1440 / 1680 / 2048 CSS px`

Cross-check:

- light and dark themes;
- trade surface closed/open/editing;
- long symbol/tag/note/content;
- empty/small/large data sets;
- pending-dividend attention;
- Records filter states;
- existing imported records after Import UI retirement;
- Backup control and download flow;
- Groups large record sets;
- keyboard-only interaction;
- 200% zoom/narrow reflow;
- reduced motion and safe-area behavior.

Prefer existing deterministic/E2E/visual infrastructure. Do not create heavy test infrastructure unless it prevents a material product regression.

---

## 8. Retired-feature CI/test rule

Import/Restore code may remain in the repository after product retirement. Its tests must not silently re-create product obligations.

When a retired-feature test fails after a shared change:

```text
Still-required core invariant broken?
├─ YES → fix the invariant and retain coverage.
└─ NO  → retire/isolate/update the obsolete surface contract.
```

Still-required examples:

- existing imported records readable/exportable;
- normal manual record create remains idempotent/recoverable;
- Backup remains read-only/authoritative;
- tenant/security boundaries remain intact.

No-longer-required examples after R1.4:

- Import controls remain visible;
- Restore UI remains reachable;
- mapping/template UI receives responsive polish;
- ambiguous import retry is completed.

---

## 9. NOW / NEXT / BACKLOG / REJECT

### NOW

- documentation/product-surface discussion closeout — **this update**;
- refresh remote truth;
- close UX-R1.3 from exact evidence and exact-head CI.

### NEXT

- UX-R1.4 Holdings + Records using the reduced product surface;
- R1.5–R1.8 until UX-R1 is fully closed.

### BACKLOG

- post-UX `Production Mutation Surface Review` for possible Restore server-side feature gating/default-disable;
- future Import discovery only after explicit renewed product need.

### REJECT / NOT PLANNED

- R3.3B continuation;
- new Import development/polish during UX-R1;
- full Import source purge during UX-R1;
- Restore backend/migration purge during UX-R1;
- deleting generic transaction idempotency/recovery;
- breaking historical imported-record compatibility;
- shrinking/hiding financial facts instead of fixing UI composition;
- parallel implementation phases while UX-R1 is active.

---

## 10. Fresh-session / AI takeover checklist

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Read `docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`.
5. Read `docs/engineering/UX_R1_ADAPTIVE_WORKSPACE_PLAN_2026-08-19.md`.
6. Read `docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`.
7. Refresh current `main`, PR #387 head, exact-head CI, open PRs, and deployment/Pages truth.
8. Treat PR #367 as closed history, not a Deferred batch.
9. Keep one implementation batch active and resume from the current UX-R1 batch.
10. Do not restart the Import/Restore architecture discussion unless new evidence or an explicit user decision changes this product boundary.
11. After each UX-R1 batch: verify → document exact evidence/rollback → then advance.
12. After UX-R1.8: persist closeout and stop before opening the next phase.
