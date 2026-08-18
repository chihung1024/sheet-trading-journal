# UX-R1.1 Breakpoint + Container Authority Map

Status: **IMPLEMENTATION BASELINE**

Baseline audited: `main@97e2a7a582334518a18732237a0c686baaa547e0` on 2026-08-19 Asia/Taipei.

This document records presentation/layout authority only. It intentionally contains no private production screenshots or portfolio values.

## Primary goal

Replace fragmented assumptions that `browser viewport width === component usable width` with a small app-shell viewport authority plus component-owned inline-size containers. Migration is incremental: UX-R1.1 establishes authority and tests; later UX-R1 batches move component presentation to those containers without changing financial/data/mutation authority.

## Current viewport media-query inventory

The source audit found the following breakpoint classes in current frontend presentation code. These are not all endorsed as permanent; this is the migration inventory.

| Threshold class | Current owners / purpose | UX-R1 disposition |
| --- | --- | --- |
| `480px` | App compact header; RecordList compact date filter; Dividend cards/history; several compact detail/helper surfaces | COMPONENT/COMPACT candidate; migrate only when owning component is changed |
| `600px` | Cash form/header single-column behavior | COMPONENT candidate → `cash-workspace` |
| `768px` / `769px` | Global mobile/desktop utilities; Holdings table/cards; Records table/cards/toolbar; charts controls; overview support cards/skeletons; TradeForm/detail helpers | FRAGMENTED COMPONENT authority; migrate by owning UX-R1 batch, not via global mass rewrite |
| `820px` | GroupManager control/footer reflow | COMPONENT candidate → `groups-workspace` |
| `900px` | Holdings concentration composition; Cash 2-column form; RecordDetail; StrategyGroup; IBKR/import presentation; shared record table behavior | COMPONENT candidate; import presentation remains separate from deferred R3.3B mutation work |
| `1024px` / `1025px` | App shell single-column + transaction sheet boundary; Dividend table/cards; reliability banner; desktop D1-D5 density | APP-SHELL where it selects app mode; component uses should migrate to local containers |
| `1200px` | Shared desktop density/table tuning; allocation donut presentation | SHARED/COMPONENT candidate; reassess when component migrates |
| `1250px` | Holdings concentration 3→2-column composition | COMPONENT candidate → `holdings-workspace` |
| `1280px` | Cash editor + authoritative ledger side-by-side in product consistency layer | VIEWPORT workaround from persistent rail era → migrate to `cash-workspace` |
| `1600px` | Groups two-column management workspace; Overview summary/context pairing | VIEWPORT workaround → migrate to `groups-workspace` / `analysis-workspace` |
| `1680px` | Wide desktop centered navigation and group strategy columns | APP-SHELL for header placement; component layout portion should migrate locally |

The audit also confirmed the existing cross-page `product-consistency.css` layer intentionally owns spacing/density and no typography. UX-R1 must keep that contract.

## JavaScript runtime-width inventory

`window.innerWidth` is currently used in four presentation paths:

1. `src/App.vue` — `<= 1024`: app-shell transaction presentation state.
2. `src/components/RecordList.vue` — `< 768`: filter visibility state.
3. `src/components/HoldingsTable.vue` — `< 768`: window-scroll continuation for mobile-card infinite display.
4. `src/components/PerformanceChart.vue` — `< 768`: Chart.js x-axis tick density.

Disposition:

- App runtime width remains temporarily authoritative for the true shell boundary until UX-R1.2 replaces the transaction-surface state machine.
- RecordList/Holdings/PerformanceChart runtime width checks are **NEXT**, owned respectively by UX-R1.4/R1.5. They must not be shotgun-refactored in R1.1.
- No second global responsive state store is introduced in R1.1.

## Shared container authorities introduced by UX-R1.1

Defined in `src/styles/adaptive-workspace.css`:

| Container name | Boundary | Intended authority |
| --- | --- | --- |
| `app-workspace` | `.content-container` | available application work area after shell chrome |
| `main-workspace` | `.main-column` | primary content width after transaction presentation |
| `transaction-workspace` | `.side-column` | single TradeForm presentation width |
| `analysis-workspace` | Overview / Charts sections | analysis/detail composition |
| `holdings-workspace` | Holdings section | concentration + table/card presentation |
| `records-workspace` | Records section | toolbar + history table/card presentation |
| `management-workspace` | Dividends/Cash/Groups | shared management-width semantics |
| `dividends-workspace` | Dividends section | pending/history presentation |
| `cash-workspace` | Cash section | editor + ledger composition |
| `groups-workspace` | Groups section | batch-management composition |

A container may carry more than one name when both generic management and page-specific queries are useful.

## Shared adaptive tokens introduced by UX-R1.1

- app shell maximum width and inline padding;
- docked rail width bounds;
- drawer/sheet width bounds;
- desktop vs touch/coarse-pointer control-height contract;
- minimum touch target token;
- safe-area inset tokens.

Typography remains in `src/style.css`; existing page/card density remains in `src/styles/product-consistency.css`.

## Root-cause statement

**Symptom:** layout quality changes unpredictably across pages and widths, and a viewport that appears wide can still leave a component too narrow after the persistent transaction rail consumes 330–350px.

**Failure point:** page/component media queries decide presentation from full browser width, while the component actually renders in a smaller local workspace.

**Contributing factor:** desktop visibility work accumulated several valid but independent viewport thresholds over time.

**Root cause:** there was no explicit shared distinction between app-shell viewport authority and component inline-size authority.

**Systemic fix:** establish named component containers and shared adaptive/touch tokens first; migrate one owning work surface at a time in later UX-R1 batches. Do not replace fragmentation with a new global JavaScript breakpoint store.

## Scope governance

### NOW — UX-R1.1

- establish container boundaries;
- establish shared shell/transaction/touch/safe-area tokens;
- load the adaptive layer after existing design/product-consistency layers;
- add deterministic static regression contracts;
- keep existing presentation behavior unless a change is required to establish authority.

### NEXT

- R1.2 transaction dock/drawer/sheet state machine;
- R1.3 compact navigation;
- R1.4 Holdings/Records container migrations;
- R1.5 Overview/Charts container migrations;
- R1.6 Dividends/Cash/Groups container migrations.

### BACKLOG

- component breakpoint cleanup not reached by the owning UX-R1 batch;
- optional visual-regression infrastructure beyond current lightweight deterministic contracts.

### REJECT for UX-R1.1

- mass replacement of every `@media` rule;
- global responsive JavaScript store;
- font shrinking or financial precision reduction;
- duplicated TradeForm/navigation/data authority;
- Worker/D1/schema/auth/accounting/FX/idempotency changes;
- any mutation behavior from deferred PR #367.

## Reopen / expansion triggers

Re-evaluate this foundation only if a container introduces measurable layout regression, browser support blocks required production devices, or a later batch demonstrates that the named boundary cannot represent the component's actual usable inline size. Otherwise this map is the working baseline for UX-R1.
