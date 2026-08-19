# UX-R1 — Adaptive Workspace & Responsive Interaction

Status: **PRIMARY ACTIVE — R1.1 COMPLETE / R1.2 COMPLETE / R1.3 ACTIVE**

Current protected-main baseline at the 2026-08-19 product-priority decision: `main@97e2a7a582334518a18732237a0c686baaa547e0`.

Active branch: `feat/ux-r1-adaptive-workspace`.

Active Draft PR: **#387 — `feat: UX-R1 adaptive workspace and responsive interaction`**.

Always refresh remote GitHub / CI / deployment truth before implementation, merge, or production conclusions.

Newer product-surface authority:

`docs/engineering/PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`

If an older UX-R1 sentence conflicts with that decision about Import / Restore / R3.3B, the newer decision controls unless a later explicit user decision supersedes it.

---

## 1. Phase priority

After the 2026-08-19 data-feature discussion closeout, **UI/UX architecture and direct user experience are the highest active development priority**.

Current priority order:

1. UI/UX architecture, usability, responsiveness, accessibility, interaction clarity, and user-visible workflow quality.
2. Preserve functional continuity while improving those surfaces.
3. Preserve financial/data/security correctness as non-negotiable fail-closed gates.
4. Perform technical/debug work only where needed to safely deliver the product goal.
5. Defer optional refactor, dormant-adapter expansion, and methodology work that does not materially improve current user value.

This phase is not a license to weaken transaction/data guarantees. It is a rule preventing technical complexity from becoming an independent roadmap that displaces the interface users actually experience.

---

## 2. Why this phase exists

Production UI review across Overview, Charts, Holdings, Records, Dividends, Cash, Groups, and Trade entry showed a common architectural problem rather than isolated cosmetic defects:

- persistent transaction UI can consume high-value analysis/management width;
- component behavior historically depended too much on full viewport width instead of actual available workspace;
- navigation becomes difficult to discover at compact widths;
- desktop density and touch ergonomics need distinct presentation authority;
- high-frequency Holdings/Records surfaces need priority-based reflow;
- Chart/Group/Dividend workspaces can waste or lose useful space depending on transaction-surface presentation;
- page-specific breakpoint patches create long-term inconsistency.

Existing D1–D5 desktop visibility work remains valid. UX-R1 extends it into a system-wide adaptive workspace model.

Core design rule:

> **Reclaim and reorganize space through composition and presentation; do not simulate responsiveness by shrinking core typography or hiding material business facts.**

---

## 3. Product invariants

Unless current-main evidence proves a necessary blocker, UX-R1 must not change:

- accounting, holdings, P&L, NAV, TWR, XIRR, FX, tax, dividend, or cash semantics;
- record identity / idempotency authority;
- generic durable record-create intent / recovery / mutation barriers;
- Worker, D1, schema, authentication, or deployment authorization;
- the single `TradeForm` create/edit authority;
- the single `activeView` + URL + localStorage navigation authority;
- authoritative Holdings/Records data projections;
- historical imported-record readability and durable metadata compatibility;
- fail-closed financial/data behavior.

Do not create a second router, transaction authority, accounting source, presentation data authority, or browser-local recovery truth.

---

## 4. Product-surface convergence applied to UX-R1

### Keep in normal product UI

- manual transaction workflows;
- portfolio/history/analysis/management workflows;
- **Backup JSON download** as a read-only supporting safety feature.

### Product-retired / no new UX investment

- IBKR Import;
- Canonical CSV Import;
- mapped/broker-neutral CSV Import;
- mapping preset UI;
- CSV import template UI;
- import receipt/retry UX;
- R3.3B ambiguous import retry.

### Journal Restore

- normal product UI: retired;
- feature expansion: frozen;
- existing backend route/migration/tests: maintenance-only, unchanged during UX-R1;
- optional future production feature-gating review belongs after UX-R1.

### Historical compatibility

Retiring new import must not break records already created through IBKR/IMPORT paths.

Rule:

> **Retire write adapters; retain read compatibility.**

---

## 5. Adaptive workspace architecture

### A. Authority split

Use viewport media queries primarily for real app-shell transitions.

Use component/container inline-size authority when behavior depends on actual available workspace after shell, transaction surface, cards, or management composition are applied.

Avoid duplicating many viewport breakpoint families.

### B. Shared presentation tokens

Maintain shared contracts for:

- shell content maximum width and inline padding;
- page/section gaps;
- control height and touch target baseline;
- dock/drawer/sheet dimensions;
- safe-area spacing;
- named container boundaries;
- focus/transition behavior where shared.

Typography remains semantic; do not reintroduce local arbitrary font scales as a density shortcut.

### C. One transaction surface, multiple presentations

Preserve one `TradeForm` business/state authority.

Present it as:

- dock only when usable workspace remains sufficient;
- drawer at constrained noncompact sizes;
- mobile sheet at compact sizes.

Presentation-only transitions must not invent persistence/mutation authority or silently discard unsaved in-memory state.

### D. One navigation authority, adaptive presentation

Preserve existing `views`, `activeView`, URL, localStorage, pending badge semantics.

Compact presentation may expose high-frequency destinations directly and place remaining destinations under `更多`, but must not create a second router or selected-view store.

### E. High-frequency workflow hierarchy

At narrower workspace sizes, keep primary task controls visually first.

For Records after product-surface convergence, primary workflow is:

- search;
- type/date filters;
- result context;
- pagination/page size;
- refresh;
- Backup JSON download.

Retired Import/Restore utilities do not receive responsive polish.

---

## 6. Target workspace categories

These are planning categories, not permission to duplicate hard-coded breakpoint stacks.

### Compact — typical `<600px`

- single-column content;
- compact primary navigation + `更多`;
- transaction entry/edit as sheet;
- practical touch targets (~44px baseline where appropriate);
- no ordinary page-level horizontal scrolling;
- use card/detail presentation when a table cannot safely reflow.

### Medium — typical `600–1024px`

- single primary content workspace;
- transaction entry as drawer/sheet rather than permanent dock;
- local controls recompose from actual available width;
- table/card choice follows component usefulness rather than browser width alone.

### Desktop — typical `1025–1439px`

- main content gets priority;
- transaction entry does not automatically consume a permanent rail when that harms the active page;
- drawer/overlay remains available with the same canonical TradeForm.

### Wide desktop — typical `1440–1679px`

- dock allowed only when the main workspace remains above the useful threshold;
- components continue to use container authority.

### Ultra-wide desktop — typical `>=1680px`

- dock appropriate when space permits;
- wider management/analysis composition may be used without reducing text size;
- current center-header navigation concept may remain if it continues to satisfy usability/accessibility.

---

## 7. Implementation batches and current status

### UX-R1.1 — Adaptive layout foundation

Status: **COMPLETE**

Delivered:

- breakpoint/runtime-width authority audit;
- shared app-shell/control/touch/safe-area tokens;
- named inline-size containers;
- deterministic foundation contracts;
- no business/mutation authority change.

Implementation commit: `b9c10105a107c54c1d420cdc94cd1f847a750257`.

Exact-head CI #1379 / run `32162550781`: Frontend / Python / Worker **SUCCESS**.

Authority map:

`docs/engineering/UX_R1_BREAKPOINT_CONTAINER_AUTHORITY_MAP_2026-08-19.md`

### UX-R1.2 — Adaptive transaction surface

Status: **COMPLETE**

Delivered:

- one canonical TradeForm;
- actual content-container measurement;
- dock / drawer / compact sheet presentation;
- edit-from-history reuse of existing setup path;
- focus trap, Escape, focus restore, body scroll lock for transient surfaces;
- presentation-only state remains memory-only.

Primary implementation commit: `fdf13b35fda2091bb5c849b33e197711e7970fa3`.

Exact-head CI #1383 / run `32165931615`: Frontend / Python / Worker **SUCCESS**.

### UX-R1.3 — Responsive navigation

Status: **ACTIVE / MUST CLOSE BEFORE R1.4**

Implemented direction on PR #387:

- existing App navigation remains authority;
- compact direct destinations: overview / holdings / records / dividends;
- `更多` presents remaining destinations;
- pending-dividend attention retained;
- container-driven compact/full presentation;
- keyboard/Escape/outside-pointer/focus-restore behavior;
- no router/persistence duplication.

Last implementation head before the product-decision docs closeout:

`dc1af19a4ab6683cb68a80688d339c55ce2582c6`.

Known CI on that implementation head:

- run `32203363240` attempt 2;
- Frontend contract step: **FAIL**;
- Python: **SUCCESS**;
- Worker: **SUCCESS**.

Required closure:

1. refresh current PR head after documentation commits;
2. inspect current exact-head CI;
3. identify exact Frontend failing assertion from evidence;
4. classify whether it is product/architecture/accessibility regression or stale/brittle contract;
5. apply the smallest general correction;
6. obtain exact-head Frontend + Python + Worker success;
7. document rollback/evidence;
8. only then start R1.4.

Do not mix Records/Import retirement into the R1.3 implementation diff.

### UX-R1.4 — Holdings + Records work surfaces

Status: **NEXT**

#### Holdings

- container-aware table/card/detail presentation;
- preserve concentration facts;
- recompose donut/list/context without pushing the primary holdings table excessively far down;
- prioritize actual workspace usefulness;
- preserve authoritative data semantics.

#### Records

Target normal product surface:

- search;
- type filter;
- date range;
- result/filter context;
- pagination/page size;
- refresh;
- **Backup JSON download**.

Retire from normal product UI:

- IBKR Import;
- Canonical/mapped CSV Import controls;
- CSV import template;
- mapping/preset/import receipt/retry entry points;
- Journal Restore.

Component boundary target:

```text
RecordList
├─ primary history/filter controls
├─ refresh
└─ JournalBackupButton (Backup export only)
```

Do not:

- delete generic record-create recovery/idempotency;
- delete historical IBKR/IMPORT read compatibility;
- delete Restore backend/migration/tests;
- build a replacement mega-menu for retired controls;
- perform a source-code purge as part of this UX batch.

Verification must include existing imported records to prove that retiring new-write UI does not break old-data display/export.

### UX-R1.5 — Overview + Charts

- preserve information hierarchy and KPIs;
- use reclaimed workspace;
- container/viewport-aware chart sizing;
- reduce avoidable dead zones and first-screen displacement;
- no content removal solely to create apparent density.

### UX-R1.6 — Dividends + Cash + Groups

- task-oriented adaptive layouts;
- pending-dividend queue remains visible/useful;
- Cash authoritative editor/ledger semantics unchanged;
- Groups favor management workspace width;
- sticky changed-count/save/action feedback where it materially improves the workflow.

### UX-R1.7 — Accessibility / interaction verification

Verify at minimum:

- keyboard-only navigation;
- visible focus;
- Escape and focus restoration;
- focus containment for modal/sheet presentations;
- practical touch targets;
- no hover-only required action;
- 200% zoom / narrow reflow;
- reduced motion;
- mobile safe-area;
- long content and empty/small/large datasets.

### UX-R1.8 — Production visual verification + closeout

- exact-head CI;
- frozen multi-perspective review / BLOCKER 0;
- expected-head merge;
- post-main CI;
- Pages/deployment/runtime verification where applicable;
- required responsive matrix;
- stable closeout documentation;
- final `to_do_update_list.md` with exact main/PR/CI/deployment truth;
- stop after phase closure before starting another development phase.

---

## 8. Required verification matrix

At minimum verify:

`320 / 360 / 390 / 430 / 600 / 768 / 820 / 1024 / 1280 / 1440 / 1680 / 2048 CSS px`

Cross-product states:

- light and dark themes;
- transaction surface closed/open/editing;
- long symbol/tag/note/content;
- empty/small/large datasets;
- pending dividend badge/content;
- Records filters expanded/collapsed;
- existing imported records after Import UI retirement;
- Backup control and download path;
- Groups with large transaction sets;
- keyboard-only interaction;
- 200% browser zoom / narrow reflow;
- reduced-motion preference;
- mobile safe-area/sticky controls.

Use existing deterministic/E2E/visual infrastructure where it materially proves behavior. Do not create heavy testing infrastructure for process completeness alone.

---

## 9. Retired-feature test governance

The frontend suite currently contains Import/Restore-specific contracts. After those product surfaces are retired, their tests must not silently recreate roadmap obligations.

When a retired-feature test fails:

```text
Does it prove a still-required invariant is broken?
├─ YES → fix the invariant and retain coverage.
└─ NO  → retire/isolate/update the obsolete surface contract.
```

Still-required invariants include:

- old imported records remain readable/exportable;
- manual record creation remains idempotent/recoverable;
- Backup remains authoritative/read-only;
- tenant/security boundaries remain intact.

No-longer-required surface contracts after R1.4 include:

- Import buttons remain visible;
- Restore UI remains reachable;
- mapping/template UI receives responsive polish;
- ambiguous import retry is completed.

---

## 10. Definition of done

UX-R1 is complete only when:

1. app-shell/work-surface behavior is adaptive instead of page-by-page patched;
2. ordinary mobile/tablet/desktop use avoids unnecessary horizontal overflow;
3. transaction entry does not unnecessarily steal analysis/management workspace;
4. navigation remains discoverable and uses one authority;
5. high-frequency Holdings/Records workflows remain readable and efficient across representative widths;
6. retired Import/Restore UI no longer consumes normal product workspace or UX effort while historical records remain compatible;
7. Backup remains directly usable;
8. accessibility/keyboard/touch/zoom/reflow requirements pass;
9. financial/data/mutation authorities remain correct and fail-closed;
10. exact-head CI, frozen review, expected-head merge, post-main verification, responsive verification, and handoff documentation complete successfully.

---

## 11. Immediate takeover sequence

A new AI/session should:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read `to_do_update_list.md`;
4. read `PRODUCT_SURFACE_CONVERGENCE_AND_UX_PRIORITY_DECISION_2026-08-19.md`;
5. read this plan and the breakpoint/container authority map;
6. refresh current `main`, PR #387 head, exact-head CI, open PRs, and deployment truth;
7. treat PR #367 as closed history, not Deferred work;
8. keep exactly one implementation batch active;
9. finish R1.3 evidence/CI closure before touching R1.4;
10. continue R1.4–R1.8 without restarting Import/Restore product analysis unless a new explicit user decision changes the boundary;
11. update the live handoff after each completed batch;
12. stop after UX-R1 closeout before opening the next phase.
