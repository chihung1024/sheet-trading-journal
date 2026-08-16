# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote main/open PR/CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains archived at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **R1 Decision Cockpit is CLOSED / PRODUCTION VERIFIED. Roadmap V2 is active. R2 Ledger Truth v2 has started with R2.1 Event / Timeline Contract Audit; R2.2 capture/persistence is the next implementation batch after R2.1 merge gates close.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists to enable product correctness, maintainability and UX; do not create perpetual cleanup phases.
3. Debug by evidence and root cause. Inspect same-class impact and add regression/prevention rather than symptom-only patches.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Do not delete old code/files merely because they look old; first prove they are neither compatibility surfaces nor forensic/governance evidence.
8. Phase numbering is not priority. Rank work by cross-user applicability, frequency, product/UX value and dependency order.
9. Do not infer cash, historical lots, industry classifications, risk scores or financial facts that authoritative data does not provide.
10. When a product batch closes, stop its technical work instead of expanding scope for neatness.

---

## 1. Current authoritative state

### Recovery checkpoint before Roadmap V2

GitHub Release:

`backup-2026-08-16-tech-debt-closeout`

Target:

`13b6558e48fc703afc8b9d1572ec696d104eccb2`

This is a recovery/governance checkpoint, not a Worker/API/schema version.

### Current production product runtime

R1 Decision Cockpit merge:

`eda462b0741a36ece3f4064eb302ea1b3a5b58b7`

Verification:

- PR #301 final exact head `6735454a02abd4ecfdb2ab80facac4d4a12f471d`
- exact-head CI #1062 / run `31928863491`: **SUCCESS**
- frozen review `4945470029`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `eda462b0741a36ece3f4064eb302ea1b3a5b58b7`
- post-main CI #1063 / run `31928936171`: **SUCCESS**
- Pages #1583 / run `31928935341`: **SUCCESS**
- no Worker/D1/Python accounting deployment or schema change

Production Worker runtime remains:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Phase 9.2 production activation control plane remains:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

Latest repository baseline re-read before R2.1:

- `main = 6a50e3d3d69906ab891e27ed6a37211f8b786a67`
- open PRs at R2.1 start = `0`
- main CI #1065 = **SUCCESS**
- Pages #1584 = **SUCCESS**
- R2 recovery/work branch = `feat/r2-ledger-truth-v2`

A later docs-only merge may advance repository `main` without changing product runtime. Always re-read fresh remote truth.

### Product state

- Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED
- Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED
- Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 5 Historical Lot / Trade Analytics — BACKLOG until an authoritative historical lot producer exists
- Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED
- Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED
- Phase 10 roadmap — COMPLETE / OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 11 Daily Portfolio Command Center — **SUBSUMED by R1 Decision Cockpit**
- Former Phase 12 IBKR Sync Automation — OPTIONAL BROKER-SPECIFIC BACKLOG
- Phase 13 Cross-Page UX Consistency & Holdings Visualization — OPTIMIZED FOR CURRENT REQUIREMENTS
- Independent technical-debt root-cause cleanup TD-A / TD-B — CLOSED / PRODUCTION VERIFIED
- **R1 Decision Cockpit — CLOSED / PRODUCTION VERIFIED**
- **R2 Ledger Truth v2 — ACTIVE**
- **R2.1 Event / Timeline Contract Audit — CONTRACT BASELINE WRITTEN; merge gates pending**
- **R2.2 Capture / Persistence Foundation — NEXT after R2.1 closeout**

---

## 2. Roadmap V2

The previous independent audits were consolidated into four dependency-ordered product capabilities to minimize rework.

### R1 — Decision Cockpit — DONE

Purpose: make the Overview answer the most frequent user questions without repeating the same facts in multiple dashboard blocks.

Final information hierarchy:

```text
現在 / Overview headline
→ 今日脈絡 / reasons
→ 待處理 / exception-driven actions
→ 趨勢 / PerformanceChart
```

#### Final information ownership

- `持倉市值` — one primary headline owner;
- `今日損益` — one primary headline owner;
- `累計損益` — one primary headline owner;
- `持倉成本 / 未實現 / 已實現` — breakdown beneath the headline;
- `TWR / XIRR` — secondary long-term performance context, preserving reliability caveats;
- Daily P&L contributor/detractor — context only, never another primary total;
- concentration — context only;
- pending dividends — rendered only when an action is actually required;
- PerformanceChart — trend/time-series role only.

#### Architecture

```text
Pinia authoritative data
→ OverviewPage (only page-level store/orchestration owner)
→ reviewed domain services
   - dailyPnlExplainability
   - portfolioConcentration
   - dividendAttention
   - twrState
→ overviewProjection (pure UI read-model projection)
→ props-only OverviewHeadline / OverviewContext
→ optional DailyPnlExplanation detail
→ PerformanceChart
```

`overviewProjection.js` must not become a second store/accounting engine. It may compose and format already-reviewed facts and preserve existing presentation compatibility, but must not fetch, mutate, calculate portfolio accounting, invent FX, or establish another financial authority.

#### Retired by R1

Removed rather than hidden:

- `DailyCommandCenter.vue`
- `StatsGrid.vue`
- `StatsGridSkeleton.vue`
- `dailyCommandCenter.js`
- obsolete Daily Command contract
- stale `.daily-command / .command-card / .stats-grid / .stat-block` layout selectors

Do not recreate these as a parallel Overview summary system.

#### R1 regression lessons

Two root-cause issues were caught before merge and now have prevention:

1. Phase-13 product-consistency regression still required retired command/stats selectors. The old test contract was corrected to protect the current IA rather than force dead architecture to remain.
2. JavaScript `Number(null) === 0` could make missing Overview values appear as false zeroes. New Overview numeric formatters accept only actual finite numbers; missing values display fail-closed as `—`.

Legacy daily-return presentation fallback is preserved: published `daily_pnl_roi_percent` wins; older snapshots may fall back to reviewed daily P&L ÷ published `daily_pnl_base_value` exactly as the former StatsGrid did.

---

### R2 — Ledger Truth v2 — ACTIVE

Purpose: establish a truthful account/event foundation before building account-level analytics, universal restore/import, or AI portfolio interpretation.

R2 combines two previously separate proposals because they are the same domain problem:

- **Transaction Timeline Integrity**
- **Account / Cash Ledger Foundation**

#### R2 target event contract

Design one backward-compatible canonical event model able to represent:

- trade date;
- optional authoritative execution timestamp and/or stable sequence;
- symbol/instrument identity;
- transaction type;
- quantity / price / fee / tax / currency;
- source/import provenance;
- explicit cash events;
- deterministic event identity/idempotency;
- compatibility with existing BUY / SELL / DIV records.

Do not make exact time mandatory for old/manual records. Existing records must remain valid.

#### R2.1 — Event / Timeline Contract Audit

Detailed contract: `docs/engineering/R2_LEDGER_TRUTH_V2_EVENT_CONTRACT_AUDIT_2026-08-16.md`.

Primary evidence:

- durable `records` schema remains date-level plus create-idempotency hashes;
- Worker create/update validation still accepts only the legacy transaction payload;
- `main.prepare_transactions()` supplies `Date -> id` deterministic ingest order but no first-class execution metadata;
- Gate C already proved that `Date -> id` is a deterministic ledger order, not broker chronology, and explicitly rejected reconstructing execution order from free-form `note`;
- IBKR parsing already sees `Currency`, `DateTime`, `OrderID` and `TradeID`, but current persistence sanitization removes the legacy machine-note envelope before the user Journal Note is stored.

Root cause:

> the project lacks one canonical optional transaction-event metadata envelope between import adapters, Worker/D1, Python and presentation.

R2.1 accepted contract:

- existing BUY / SELL / DIV records remain valid without new metadata;
- future transaction metadata is additive and nullable;
- first implementation candidates are `currency`, `executed_at`, `execution_sequence`, `event_source`;
- no fabricated timestamp/default timezone for legacy/manual records;
- aggregated multi-fill imports do not invent one exact timestamp unless the adapter has a reviewed unambiguous policy;
- individual timestamps may be captured/displayed, but **partial timestamp coverage must not activate authoritative calculation chronology**;
- capture/persistence and calculation-order activation are separate gates;
- future create payload hashing must include metadata that changes durable event meaning;
- legacy-compatible updates must not silently erase metadata, and amended records must not leave stale ordering evidence trusted by calculation;
- cash event storage remains a later R2.3 decision instead of widening the current `records.txn_type` constraint in this batch.

R2.1 scope classification:

- NOW: contract, backward compatibility, coverage-aware ordering, mutation/idempotency gates;
- NEXT: additive capture/persistence + timeline/detail presentation + shadow Python transport;
- BACKLOG: broker background sync and richer provenance references until R3 reconciliation needs them;
- REJECT: parsing `note`, fake timestamps, partial-coverage chronology, early NAV cutover, unrelated cleanup.

No Worker/D1/Python/UI runtime behavior changes belong to R2.1.

#### R2 cash/account truth

Explicit cash must be event-driven and multi-currency. Candidate event classes require design/review before schema activation, including:

- opening cash balance;
- deposit;
- withdrawal;
- trade-related cash movement derived from authoritative transaction semantics;
- dividend cash movement derived from confirmed DIV records;
- narrowly defined adjustment only if an auditable use case is proven.

Do not infer historical cash as zero. Do not backfill a fake account NAV from securities-only history.

Expected eventual semantics after reconciliation:

```text
Account NAV = securities market value + explicit cash
Contributed capital = explicit external cash flows
Securities market value = current holdings market value
Cash = currency-aware ledger balance
```

Current UI continues to say `持倉市值 / 持倉成本` until account coverage is sufficiently authoritative for a reviewed NAV cutover.

#### R2 rollout principle

Prefer additive/shadow computation and reconciliation first. Do not immediately replace the current production summary with account-level numbers.

A safe R2 sequence is:

1. canonical event/timeline contract + backward compatibility — **R2.1 current**;
2. capture/persist optional transaction execution metadata and timeline presentation without calculation ordering switch — **R2.2 next**;
3. explicit cash event storage/model;
4. shadow cash ledger calculation;
5. reconciliation and migration UX;
6. only then review account NAV / account-level performance cutover.

R2.2 must itself keep execution-order activation behind a later evidence gate; storing a timestamp does not automatically authorize the accounting engine to use it.

---

### R3 — Universal Data Gateway — AFTER R2 FOUNDATION

Consolidates:

- broker-neutral import;
- user export / backup / restore;
- existing IBKR file importer as Adapter #1;
- future broker APIs/Flex sync as adapters rather than direct ledger bypasses.

Target flow:

```text
external file/API/export
→ parse
→ normalize to canonical events
→ column/source mapping
→ local preview
→ deterministic validation
→ duplicate/conflict reconciliation
→ authenticated idempotent create
```

AI may suggest mappings; deterministic validation decides whether data can enter the ledger.

Backup/restore should use a versioned canonical export schema and the same preview/reconciliation engine rather than direct database replacement.

---

### R4 — Portfolio Intelligence — AFTER R2/R3 TRUST FOUNDATION

Consolidates:

- account-level advanced analytics;
- authoritative historical lot/trade lifecycle analytics;
- AI Journal Intelligence.

Order:

1. reviewed account-value/performance methodology;
2. historical lot producer from authoritative transaction events;
3. Sharpe / Sortino / MDD / rolling/benchmark analytics with explicit methodology;
4. AI summarization and behavioral insight over deterministic facts.

AI must never become a second accounting, FX, tax, lot-matching or market-data engine.

---

## 3. Stable authority boundaries

### Mutation / calculation

```text
record durable intent
→ tenant-scoped idempotent Worker write
→ committed mutation/readback
→ durable dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser verification/presentation
```

No browser-local accounting or recovery authority.

### R2 transaction event metadata

```text
source/manual facts
→ adapter/form validation
→ optional durable event metadata
→ read/presentation
→ shadow calculation transport
→ separate ordering-activation review
```

`note` is user Journal content, not execution chronology/provenance storage. `id`/`created_at` remain deterministic database facts but must not be presented as broker execution time.

### Overview presentation

```text
OverviewPage
→ existing reviewed domain services
→ overviewProjection
→ props-only Headline / Context
```

One fact has one primary owner on Overview. A second appearance is allowed only if it adds decomposition, trend, comparison, causal explanation or action context.

### Design system / typography

```text
src/style.css
→ font source + semantic --type-* / --icon-* roles
→ Vue consumers
→ designTypography.js bridge for canvas/Chart.js only
```

`src/styles/product-consistency.css` remains layout/density only.

### Financial terminology

Until R2 provides explicit cash/account truth:

- `summary.total_value` → user-facing `持倉市值`;
- `summary.invested_capital` → user-facing `持倉成本`;
- generic cash-inclusive `總資產淨值 / NAV` is invalid;
- generic whole-account ROI language is invalid for the current unrealized-only ratio.

### Dividend

- actual same-tenant DIV record is the only `已入帳` authority;
- pending attention reconciles snapshot candidates against records-authoritative DIV confirmation;
- no browser-local confirmation authority;
- no inferred pay date or unreviewed tax policy.

### Journal / history

- Journal summary placement is presentation only;
- full Journal Note remains in `RecordDetailPanel`;
- no historical lot inference from current-day `day_ledger`;
- records remain authoritative transaction history.

### Portfolio concentration

- weights consume reconciled holdings market values + summary total;
- cash is not inferred;
- sector/industry remains deferred until authoritative classification metadata exists.

---

## 4. Intentional legacy / forensic material

Do not blanket-delete:

- `cloudflare worker/` forensic Worker archive;
- deployment tombstones/historical pointers;
- serialized compatibility field names such as `total_value` / `invested_capital`;
- migration readers / recovery state without production evidence that removal is safe;
- compatibility readers required for existing snapshots/records.

Do not use `npm audit fix --force` or blanket dependency upgrades as generic cleanup.

---

## 5. REJECT / DO NOT DO WITHOUT NEW EVIDENCE

- no second Overview read-model owner for the same reviewed facts;
- no second browser valuation/accounting/FX engine;
- no cash-inclusive `NAV/總資產淨值` claim before R2 establishes explicit cash truth;
- no guessed historical cash;
- no mandatory fabricated execution timestamps for legacy records;
- no reconstruction of financial chronology from free-form `note`;
- no use of `created_at` or record `id` as fake execution timestamp;
- no calculation-order activation from partial timestamp coverage;
- no historical lot attribution from current-day `day_ledger`;
- no sector/industry classification guessed from symbol names, frontend maps or strategy Tags;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no new arbitrary numeric Vue/CSS or Chart.js typography scale;
- no blanket deletion of forensic archives, tombstones or compatibility fields;
- no IBKR-specific automation path that bypasses the future Universal Data Gateway.

---

## 6. Current Phase / Batch / Next Actions

### Primary Goal

**R2 Ledger Truth v2: make account/event data truthful enough that future timeline, cash, import/restore and intelligence features do not depend on inferred chronology or fake NAV.**

### Current Phase

`R2 — Ledger Truth v2`

### Current Batch

`R2.1 — Event / Timeline Contract Audit`

In scope:

- architecture/data-flow evidence;
- first-class optional transaction metadata contract;
- backward compatibility and activation gates;
- handoff/update documentation.

Out of scope:

- D1/Worker deployment;
- cash events/NAV;
- calculation ordering changes;
- broker sync;
- unrelated refactoring.

Verification required before closeout:

- exact-head CI;
- frozen independent review;
- exact-head merge;
- post-main CI/Pages verification.

### Next Action after R2.1 closeout

`R2.2 — Capture / Persistence Foundation`

Narrow objective:

> add backward-compatible optional event metadata through D1/Worker/import/manual-compatible paths and transaction detail/timeline presentation, while leaving authoritative portfolio calculation ordering unchanged until a separate coverage/amendment gate proves it safe.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh `main`, open PRs, CI and Pages before modification.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. Overview changes must preserve `OverviewPage` as the page-level orchestration boundary and reuse reviewed domain services.
8. Typography changes must extend semantic roles at the design-system authority; canvas uses the approved bridge.
9. R2 is active. R2.1 establishes the event/timeline contract; after its merge gates close, continue only with **R2.2 Capture / Persistence Foundation** before any cash/NAV or calculation-order activation.
