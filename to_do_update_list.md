# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote main/open PR/CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains archived at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **R2.1 Canonical Event Contract baseline is CLOSED / VERIFIED on substantive head `f522ce52fbb96d868a1183d90ba31d99426ad5a9`. R2.2 Timeline / Provenance Implementation Foundation is NEXT; no production schema/write activation is authorized yet.**

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

### Current repository / R2 recovery point

Fresh remote truth at R2.1 start:

- `main`: `6a50e3d3d69906ab891e27ed6a37211f8b786a67` — docs-only R1 checkpoint merge;
- latest main CI #1065 / run `31929100112`: **SUCCESS**;
- latest Pages #1584 / run `31929101168`: **SUCCESS**;
- open PRs at R2.1 start: **none**;
- R2.1 feature/recovery branch: `feat/r2-ledger-truth-contract`, created from exact `main@6a50e3d3d69906ab891e27ed6a37211f8b786a67`.

R2.1 substantive contract checkpoint:

- contract baseline commit `6f6198d7328de95bf0267151600140769cae6910`;
- hardened substantive contract head `f522ce52fbb96d868a1183d90ba31d99426ad5a9`;
- PR #304 exact-head CI #1068 / run `31932004840`: **SUCCESS**;
- CI jobs: Frontend contracts/build **SUCCESS**; Python tests **SUCCESS**; Worker security/deployment tests + local D1 baseline **SUCCESS**;
- frozen substantive review `4945608733`: **PASS / BLOCKER 0 / FOLLOW-UP 3**;
- FOLLOW-UP items are scoped to R2.2: numeric/sign semantics, privacy-safe source identity rules, canonical correction/update/audit semantics;
- no Worker/D1/Python/frontend runtime or production deployment behavior changed in R2.1.

The handoff closeout commit after `f522ce52...` is documentation-only and must still pass final exact-head CI/review before PR #304 merge. Do not confuse that final PR head with the already-reviewed substantive contract head.

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
- **R2.1 Canonical Event Contract baseline — CLOSED / VERIFIED**
- **R2.2 Timeline / Provenance Implementation Foundation — NEXT**

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

1. canonical event/timeline contract + backward compatibility;
2. execution timestamp/sequence support through manual/import paths;
3. explicit cash event storage/model;
4. shadow cash ledger calculation;
5. reconciliation and migration UX;
6. only then review account NAV / account-level performance cutover.

#### R2.1 — Canonical Event Contract baseline — CLOSED / VERIFIED

Primary Goal: freeze the minimum truthful data contract and compatibility architecture before any schema change.

Scope lock:

- **In Scope:** manual record path, Worker records/idempotency, IBKR source identity/provenance, dividend semantic identity, record ordering/pagination, Python ingestion and ledger-integrity compatibility.
- **Out of Scope:** D1 migration, Worker/API behavior changes, production deploy, cash/NAV UI, broker automation.
- **Allowed Investigation:** same-class identity/timeline/currency/provenance contracts.
- **Expansion Trigger:** only data-corruption, duplicate-event, privacy/auth or production-accounting risk.
- **Risk Class:** R2.

Root-cause findings:

1. `records` is a trade-specific production projection: database/Worker/Python all assume `BUY/SELL/DIV`; direct cash types would break current accounting ingestion.
2. Current same-day deterministic ordering uses date + record ID but explicitly is not broker chronology; R2 must preserve date-only truth where exact sequence is unknown.
3. IBKR already observes structured account/profile scope, Order/Trade IDs, currency and execution DateTime before projecting into legacy records; a timezone-less source clock is not by itself an authoritative instant.
4. IBKR machine provenance is intentionally stripped from journal `note` for privacy; future provenance must be structured and privacy-safe.
5. Dividend flow already demonstrates that domain/source identity and transport idempotency are related but distinct concerns.
6. Current record-create safety hashes the accepted legacy payload; future canonical authoritative fields cannot be silently dual-written outside a versioned idempotency/fingerprint contract.
7. A future canonical + legacy transition can create split financial authority unless writes are atomic or explicitly detectable/recoverable/reconcilable.

Decision baseline:

- introduce a future additive canonical ledger-event plane rather than extending cash subtypes into `records`;
- keep `records` as the production BUY/SELL/DIV compatibility projection until explicit cutover gates pass;
- separate canonical `event_id`, source identity and HTTP/write idempotency;
- exact execution timestamp/sequence remains optional and authoritative-only;
- a timezone-less clock value remains source metadata and must not be converted to an authoritative instant by guessing browser/Taipei/UTC/market timezone;
- new native cash/value events require explicit currency; unresolved legacy facts remain unresolved rather than guessed;
- provenance is structured/privacy-safe, not a machine envelope in journal notes;
- cash events never masquerade as legacy trade records;
- future canonical/legacy transition writes must be atomic or explicitly recoverable/reconcilable, and every authoritative field written by a request must participate in a versioned idempotency/fingerprint contract;
- current `持倉市值 / 持倉成本` terminology remains unchanged until account cash coverage/reconciliation gates pass.

Detailed contract: `docs/R2_LEDGER_TRUTH_V2_CONTRACT.md`.

R2.1 files changed:

- `docs/R2_LEDGER_TRUTH_V2_CONTRACT.md`
- `to_do_update_list.md`

R2.1 implementation / verification:

- recovery branch from exact `main@6a50e3d3d69906ab891e27ed6a37211f8b786a67`: `feat/r2-ledger-truth-contract`;
- initial contract commit: `6f6198d7328de95bf0267151600140769cae6910`;
- substantive hardened contract head: `f522ce52fbb96d868a1183d90ba31d99426ad5a9`;
- Draft PR: #304;
- exact substantive-head CI #1068 / run `31932004840`: **SUCCESS**;
- Frontend contracts/build: **SUCCESS**;
- Python tests / compile / measured coverage gate: **SUCCESS**;
- Worker test suites / deployment metadata / Recovery Evidence Gate / local D1 baseline: **SUCCESS**;
- frozen substantive review `4945608733`: **PASS / BLOCKER 0 / FOLLOW-UP 3**;
- production deployment: **NOT APPLICABLE / NONE**;
- schema activation: **NOT APPLICABLE / NONE**;
- rollback: close PR #304 / remove branch; production state is untouched.

R2.1 review FOLLOW-UP classification:

- **NEXT / R2.2:** freeze numeric/sign semantics for trade notional, fee, tax, dividend amount and cash amount before schema/write activation;
- **NEXT / R2.2:** define `source_scope_ref` / provider identity generation, uniqueness, privacy threat model and rotation rules;
- **NEXT / R2.2:** define canonical correction/update/audit semantics before canonical writes are exposed;
- **BLOCKER:** none;
- **BACKLOG:** none created by R2.1;
- **REJECT:** scope expansions already listed below remain rejected without new evidence.

R2.1 is optimized for its contract-only requirement. Do not reopen it for schema aesthetics or unrelated cleanup. Final PR-head CI/review and post-main verification are merge mechanics, not a reason to change the frozen substantive contract.

#### R2.2 — Timeline / Provenance Implementation Foundation — NEXT

Primary Goal: turn the frozen R2.1 semantics into an additive, testable implementation foundation without activating production account/cash truth.

Working entry criteria / scope:

- start only after PR #304 is merged and post-main CI/Pages are verified;
- design additive canonical event schema/migration + rollback and local migration tests;
- define one deterministic event validator/normalizer boundary for future adapters;
- preserve optional authoritative timestamp/sequence/provenance without fabricating missing data;
- freeze numeric/sign semantics and privacy-safe source identity rules;
- freeze canonical correction/update/audit semantics;
- version idempotency/fingerprints for any endpoint that persists new authoritative canonical fields;
- prove atomic or explicitly recoverable/reconcilable canonical/legacy transition semantics;
- add compatibility projection/parity tests;
- **Out of Scope:** cash/NAV UI cutover, guessed historical cash, production schema activation before its own reviewed gate, broker-specific automation bypasses.

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
- no historical lot attribution from current-day `day_ledger`;
- no sector/industry classification guessed from symbol names, frontend maps or strategy Tags;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no new arbitrary numeric Vue/CSS or Chart.js typography scale;
- no blanket deletion of forensic archives, tombstones or compatibility fields;
- no IBKR-specific automation path that bypasses the future Universal Data Gateway;
- no direct `CASH_*` expansion inside legacy `records.txn_type` without reopening the R2.1 architecture decision with materially new evidence;
- no use of record ID / `created_at` as claimed broker execution chronology;
- no promotion of a timezone-less source clock to `occurred_at` using a guessed/default timezone;
- no reuse of transport `Idempotency-Key` as the universal canonical economic event ID;
- no authoritative canonical field persisted outside the versioned request idempotency/fingerprint contract;
- no best-effort independent canonical + legacy financial writes without an atomic or deterministic recovery/reconciliation invariant.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh `main`, open PRs, CI and Pages before modification.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. Overview changes must preserve `OverviewPage` as the page-level orchestration boundary and reuse reviewed domain services.
8. Typography changes must extend semantic roles at the design-system authority; canvas uses the approved bridge.
9. R1 is closed and R2.1 contract semantics are frozen. **R2.2 Timeline / Provenance Implementation Foundation is NEXT after PR #304 merge + post-main verification.** Read `docs/R2_LEDGER_TRUTH_V2_CONTRACT.md`; do not activate production schema/write behavior until the R2.2 migration, idempotency, rollback and reconciliation gates are independently reviewed.
