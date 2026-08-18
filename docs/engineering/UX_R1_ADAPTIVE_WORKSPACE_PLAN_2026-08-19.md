# UX-R1 — Adaptive Workspace & Responsive Interaction

Status: **PRIMARY NEXT / READY FOR IMPLEMENTATION**

Planning baseline: `main@44c62993706c083fd23fb7d1200adf217471efd4` on 2026-08-19 Asia/Taipei. Always refresh GitHub remote truth before implementation.

## Why this phase exists

A production UI review across Overview, Charts, Holdings, Records, Dividends, Cash, and Groups showed a common usability problem rather than a collection of page-specific cosmetic defects: the application still allocates workspace primarily from viewport-wide breakpoints and a persistent desktop transaction rail, while each page has very different minimum useful widths and interaction density.

The screenshots used for this review contained private portfolio values. They are intentionally **not** committed to the repository. This document records only generalized product/UX evidence and implementation contracts.

Existing D1–D5 desktop visibility work remains valid. UX-R1 extends it from desktop density tuning into a system-wide adaptive workspace model. Do not regress the D1–D5 rule: reclaim space through composition and presentation, not by shrinking typography or hiding business facts.

## Systemic diagnosis

### 1. Persistent transaction rail consumes high-value workspace

Desktop currently uses a main-content column plus a roughly 330–350px transaction rail. This is useful during entry/editing, but it remains present while the user is primarily analyzing charts, holdings, records, dividends, or strategy groups. The existing reversible `專注檢視` is correct, but it requires the user to understand and manually repair the layout.

UX-R1 should make workspace allocation adaptive by default while preserving one `TradeForm` authority.

### 2. Breakpoint authority is fragmented

Current behavior spans several viewport thresholds across App and page components (for example 600/768/900/1024/1250/1280/1600/1680-class rules). Individual rules may be locally reasonable, but component presentation often depends on the full browser width instead of the component's actual available width after the trade rail, cards, or management composition are applied.

Root architectural direction: use viewport media queries only for true app-shell modes, and use CSS container queries / component-owned inline-size rules for page/component presentation.

### 3. Mobile navigation is technically scrollable but not optimally discoverable

Seven destinations in a horizontal tab strip require off-screen discovery on compact devices. Mobile should prioritize the most frequent destinations and move lower-frequency management destinations behind a stable `更多` entry without creating a second routing authority.

### 4. Touch ergonomics should be explicit

The current desktop control density is intentionally compact. Compact mobile/touch environments need a separate shared interaction-density contract so primary controls, close buttons, row actions, pagination, form controls, and confirmation actions remain comfortably tappable without inflating desktop UI.

### 5. High-frequency work surfaces need priority-based adaptation

Holdings and Records already provide desktop table and mobile-card presentations. The missing abstraction is when to switch, how controls reflow, and how secondary tools are prioritized based on available container width rather than isolated component breakpoints.

### 6. Management/analysis pages have different workspace needs

- Charts benefit from height/width expansion and should not be permanently narrowed by an unused entry rail.
- Holdings needs enough width for analytical columns and concentration context.
- Records needs a strong primary toolbar hierarchy; import/backup utilities should not compete visually with search/filter tasks at narrower widths.
- Groups is a batch-management workspace and should strongly favor main-content width.
- Dividends and Cash should remain task-oriented and readable when only a small number of records are present.

## Product invariants

UX-R1 is a presentation/workspace phase. Unless a current-main trace proves otherwise, it must not change:

- accounting, holdings, P&L, NAV, TWR, XIRR, FX, tax, dividend, or cash semantics;
- record identity / idempotency authority;
- Worker, D1, schema, authentication, or deployment authorization;
- the single `TradeForm` create/edit authority;
- the single `activeView` navigation authority;
- existing authoritative desktop/mobile record and holding data projections;
- fail-closed financial/data behavior.

Do not solve layout pressure by reducing financial precision, hiding required fields, clipping facts, or creating an alternate presentation data source.

## Target adaptive workspace model

The exact implementation may change after source tracing, but the intended product behavior is:

### Compact

Typical width: `<600px`.

- single-column content;
- primary mobile navigation optimized for frequent destinations;
- trade entry/edit presented as a full-width or near-full-width sheet;
- mobile/touch control target baseline approximately 44px or better where practical;
- no page-level horizontal scrolling for ordinary controls/content;
- tables that cannot safely reflow use existing card/detail presentations.

### Medium

Typical width: `600–1024px`.

- single primary content workspace;
- trade entry uses sheet/drawer rather than permanent dock;
- page controls recompose based on local container width;
- table/card presentation chosen from actual available width.

### Desktop

Typical width: `1025–1439px`.

- main content takes priority;
- trade entry should not automatically consume a permanent 330–350px rail when this would materially degrade the active workspace;
- entry/edit can use a reversible drawer/overlay presentation while retaining the same mounted or canonical `TradeForm` state contract.

### Wide desktop

Typical width: `1440–1679px`.

- docked trade rail is allowed only when the main workspace remains above the active component's useful width;
- focus mode remains available and reversible;
- components adapt from their own containers rather than assuming viewport width equals usable width.

### Ultra-wide desktop

Typical width: `>=1680px`.

- current center-header navigation concept may remain;
- docked trade rail is appropriate when space permits;
- management pages may use wider multi-column compositions without reducing text size.

These ranges are planning categories, not a requirement to duplicate five hard-coded viewport breakpoint sets. Prefer a small number of app-shell media modes plus container-query component modes.

## Architecture direction

### A. Shared adaptive layout tokens

Create/extend one shared presentation contract for:

- page gaps and card padding;
- desktop vs touch control height;
- app-shell maximum width;
- docked rail width bounds;
- drawer/sheet width bounds;
- sticky action/footer safe-area spacing;
- component container names where useful.

Keep typography authority in the existing semantic type tokens. Do not reintroduce arbitrary local font scales.

### B. Container-aware components

Candidate container authorities:

- main workspace;
- transaction workspace;
- holdings workspace;
- records toolbar/workspace;
- management workspace.

Use container queries where component behavior depends on actual available inline width. Viewport media queries remain appropriate for app-shell transitions and true device/window classes.

### C. One transaction surface, multiple presentations

Preserve one `TradeForm` business/state authority and expose it through adaptive presentation:

- docked rail when useful width permits;
- desktop/tablet drawer when dock would harm the active workspace;
- mobile sheet on compact devices.

Editing from Record history must still open the transaction surface and call the same setup/edit path. No duplicate form component and no second mutation authority.

### D. Responsive navigation presentation

Preserve the existing `activeView` state/URL/localStorage authority.

Compact recommendation:

- primary visible destinations: `總覽`, `持倉`, `交易紀錄`, `配息`, `更多`;
- `更多` contains lower-frequency destinations such as `圖表`, `現金`, `群組管理`;
- badge/attention semantics (for example pending dividends) must remain visible/discoverable;
- desktop navigation may retain the current tab/header model.

Exact grouping should be verified in implementation; do not create a second router.

### E. Priority-based high-frequency toolbars

Records toolbar should distinguish:

1. primary find/filter tasks: search, type, date range;
2. result context: counts/current filters;
3. secondary utilities: IBKR import, CSV tools, backup/restore, refresh.

At narrower containers, secondary utilities may collapse into a tools group/menu while remaining directly reachable and accessible.

### F. Page-specific adaptation without page-specific hacks

- **Overview:** preserve current hierarchy; gain space mainly from adaptive transaction presentation.
- **Charts:** use viewport/container-aware chart height; reduce dead space; allow focus-width chart analysis.
- **Holdings:** keep concentration summary facts visible; allow detailed donut/list context to recompose or expand without delaying the primary holdings table excessively.
- **Records:** improve toolbar hierarchy and container-driven table/card switch.
- **Dividends:** task-oriented pending queue; avoid wasting workspace when queue is small.
- **Cash:** retain authoritative editor/ledger model; adapt table/card and sticky actions for narrow widths.
- **Groups:** workspace-first mode; preserve batch state and make changed-count/save actions persistently visible when useful.

## Implementation batches

### UX-R1.1 — Adaptive layout foundation

- trace all current media-query/runtime-width authorities;
- define shared app-shell and touch-density tokens;
- introduce container boundaries without changing financial/data behavior;
- add deterministic layout-contract tests where feasible;
- remove only breakpoint duplication proven redundant by the new authority.

### UX-R1.2 — Adaptive transaction surface

- dock/drawer/sheet presentation policy;
- preserve one `TradeForm` state/mutation authority;
- edit-from-history reopens the correct surface;
- Escape/backdrop/close behavior;
- focus management and scroll locking;
- no loss of unsaved in-memory form state from presentation-only transitions unless existing product semantics explicitly reset it.

### UX-R1.3 — Responsive navigation

- compact primary navigation + `更多` presentation;
- preserve `activeView`, URL, localStorage, badge semantics;
- keyboard/focus behavior and current-view indication;
- no duplicate route/state system.

### UX-R1.4 — Holdings + Records work surfaces

- container-driven presentation thresholds;
- Holdings concentration summary/detail composition;
- Records primary vs secondary toolbar hierarchy;
- table/card/detail usability and sticky headers/actions where beneficial;
- preserve all existing mutation/export/import authority.

### UX-R1.5 — Overview + Charts

- use reclaimed workspace;
- improve chart height behavior with `dvh`/`clamp()` or equivalent evidence-based sizing;
- prevent first-screen displacement and large avoidable dead zones;
- no KPI/content removal.

### UX-R1.6 — Dividends + Cash + Groups

- compact task-oriented compositions;
- adaptive management layouts from component width;
- sticky batch-save/action feedback where appropriate;
- no change to dividend/cash/group mutation semantics.

### UX-R1.7 — Accessibility / interaction verification

Verify at minimum:

- keyboard navigation and visible focus;
- Escape closes drawer/sheet where expected;
- focus does not escape active modal/sheet presentation;
- touch targets are practical on compact devices;
- no hover-only required action;
- 200% browser zoom / narrow reflow does not hide required controls;
- reduced-motion preference does not make transitions unusable;
- safe-area insets do not cover mobile sticky controls.

### UX-R1.8 — Production visual verification and closeout

- full exact-head CI;
- frozen review / BLOCKER 0;
- expected-head merge;
- deploy/Pages truth as appropriate;
- verify representative width matrix;
- record final screenshots/evidence without exposing private financial values;
- update `to_do_update_list.md` and stable closeout doc.

## Required verification matrix

At minimum test representative widths around:

- 320
- 360
- 390
- 430
- 600
- 768
- 820
- 1024
- 1280
- 1440
- 1680
- 2048 CSS px

Also verify:

- light and dark themes;
- trade surface closed/open/editing;
- long symbol/tag/note strings;
- empty/small/large datasets;
- pending dividend badge/content;
- Records filters expanded/collapsed;
- Groups with many transactions;
- browser zoom/reflow;
- keyboard-only interaction.

The exact matrix can be automated through existing test infrastructure or lightweight deterministic contracts. Do not add heavy visual infrastructure unless it materially improves regression prevention.

## Definition of done

UX-R1 is complete only when:

1. app-shell workspace behavior is adaptive rather than page-by-page patched;
2. ordinary mobile/tablet/desktop use has no avoidable horizontal page overflow;
3. the transaction surface no longer unnecessarily steals analysis/management workspace;
4. high-frequency pages remain readable and interactive across representative widths;
5. mobile navigation and touch interaction are discoverable and practical;
6. financial/data/mutation authorities are unchanged unless separately justified and reviewed;
7. exact-head CI, frozen review, expected-head merge, and production/Pages verification pass;
8. repo handoff accurately records the final authority.

## First actions for the implementation session

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, `to_do_update_list.md`, this document, and `DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`.
2. Refresh `main`, open PRs, CI, and deployment/Pages truth.
3. Trace all layout/breakpoint authorities in `App.vue`, `style.css`, `styles/product-consistency.css`, and the seven primary page components.
4. Produce a breakpoint/available-width authority map before changing CSS.
5. Implement UX-R1.1 first; do not begin with page-specific styling patches.
6. Keep R3.3B deferred until UX-R1 closes or the user explicitly reprioritizes it.
