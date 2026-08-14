# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Phase 3 Explainability, Phase 4 Strategy Analytics, and Phase 6 UX Convergence are OPTIMIZED FOR CURRENT REQUIREMENTS; Batch 6.1 Data Sync Status UX and Batch 6.2 Operation/Recovery Toast Convergence are CLOSED / PRODUCTION PAGES VERIFIED — next action is a new product-function gap audit; Phase 5 lot/trade analytics remains BACKLOG until an authoritative production lot-ledger producer exists**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback/recovery, independent/frozen review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.
7. Do not create infrastructure or retry machinery for theoretical edge cases without production/user evidence.
8. Explainability/analytics may expose authoritative data, but must not create a second accounting engine in the browser.

---

## 1. Closed product automation chain

| Area | State | Closure evidence |
|---|---|---|
| Market-data malformed-row incident | CLOSED / PRODUCTION VERIFIED | passive watch only |
| NOW-1B-A rollback-safe record-create transport | CLOSED / PRODUCTION VERIFIED | `/api/records/idempotent` live |
| NOW-1B-B durable record-create intent | CLOSED | PR #231 `e7c94adc...`; CI #791 + Pages #1514 |
| Phase 2 Automatic Recalculation | CLOSED | PR #232 `a458966...`; CI #799 + Pages #1515 |
| Phase 3 Self-healing Snapshot | CLOSED | PR #233 `5706cb7463ad1e6e433ca9e852ff728ba0cc9c0e`; CI #807 + Pages #1516 |
| Phase 4 terminal calculation failure recovery | CLOSED | PR #234 `3ed4711af539b7d60657adbec177607014b7a0e4`; CI #818 + Pages #1517 |
| Phase 4 trigger outcome ambiguity replay | CLOSED | PR #235 `b8d412559ef684bfb2b9197480898f140a92bd43`; CI #823 + Pages #1518 |
| Phase 5 bounded data-read self-recovery | CLOSED | PR #236 `80abac173a5b5a5c75c5420af11d92480407180b`; CI #825 + Pages #1519 |
| Phase 5 GroupManager batch mutation lifecycle | CLOSED | PR #237 `98b2f2e1c765d020065a7b0493a304042455bf71`; CI #832 + Pages #1520 |
| Phase 5 dirty standalone record readback recovery | CLOSED | PR #238 `0cd9353232b26924d509fa75f5bc45ead24cb10c`; CI #838 + Pages #1521 |
| Phase 5 same-page record-create ambiguity reconciliation | CLOSED / PRODUCTION PAGES VERIFIED | PR #239 `b45505dc9d532ea076d9fcebabd65ef65e39c312`; CI #842 + Pages #1522 |
| Product handoff convergence | CLOSED | PR #240 `4a4fa7c753b7b0e38c9eeaf44eeaab0d928d9120`; CI #844 + Pages #1523 |
| Recovery-copy UX convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #241 `d80f10394d5fe7d325d96b1c9802139c22711498`; CI #848 + Pages #1524 |
| Record-create recovery UI completion | CLOSED / PRODUCTION PAGES VERIFIED | PR #242 `268a7b31c1354da67857c910b7dbea7f4d602112`; final PR CI #854, post-main CI #855 + Pages #1525 SUCCESS |
| Phase 5 closure handoff | CLOSED | PR #243 `74351c863bcceb061a10d85ed673f6611d2e1faa`; post-main CI #857 + Pages #1526 SUCCESS |
| Restored-session read recovery copy | CLOSED / PRODUCTION PAGES VERIFIED | PR #244 `f00c5616a1d9eca819e6c7cccda181fe6be322e8`; final PR CI #858, post-main CI #859 + Pages #1527 SUCCESS |
| Three user-reported product defects | CLOSED / PARTIALLY SUPERSEDED | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; layout + TWR remain closed; stale-snapshot item was reopened by new production evidence and superseded by PR #247 |
| Snapshot freshness API/manifest record contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #247 merged as `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`; final PR CI #871, post-main CI #872 + Pages #1530 SUCCESS; Independent Review Gate PASS |
| Phase 1 / Batch 1.1 frontend native-currency contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #249 merged as `4ce9c8fc1b390db77587f50f59a3f3d251b1a107`; final PR CI #878, post-main CI #879 + Pages #1532 SUCCESS; R2 review BLOCKER 0 |
| Phase 1 / Batch 1.2 authoritative transaction valuation | CLOSED / PRODUCTION PAGES VERIFIED | PR #251 merged as `92f78af6c77506ea310a046c9f96ee6130fd9c24`; final PR CI #891, post-main CI #892 + Pages #1534 SUCCESS; frozen-diff R2 review BLOCKER 0 |
| Phase 2 / Batch 2.1 Trading Journal Note UX | CLOSED / PRODUCTION PAGES VERIFIED | PR #254 final head `e72f37a3e4c562db403d933f0e6b0c5837af49e4`; exact-head CI #898 SUCCESS; independent review BLOCKER 0; merge `7d0dbe2d0203ce1efbb0d992d2ec9df2942eddde`; post-main CI #899 + Pages #1536 SUCCESS |
| Phase 3 / Batch 3.1 Daily P&L Explainability | CLOSED / PRODUCTION PAGES VERIFIED | PR #256 final head `fc57b221a9b2c0e3adf6c929c1db6caf5e6c9c22`; exact-head CI #904 SUCCESS; frozen review BLOCKER 0; merge `2f46516e2eee7f9ec653587bef8987260dfffb65`; post-main CI #905 + Pages #1538 SUCCESS |
| Phase 3 Explainability Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | Current P&L explainability, holding-level P&L, TWR/XIRR reliability, and data-reliability UX cover the existing authoritative evidence; historical lot/trade attribution remains blocked on missing production producer |
| Phase 4 / Batch 4.1 Strategy Group Overview | CLOSED / PRODUCTION PAGES VERIFIED | PR #258 final head `65e6e2710dc7a01cb17b5ee2d74ae91fe79136a1`; exact-head CI #911 SUCCESS; frozen R2 review BLOCKER 0; merge `6d0c7708e08bba41231063c6ca765b29c41766b6`; post-main CI #912 + Pages #1540 SUCCESS |
| Phase 4 / Batch 4.2 Exact Common-Period TWR | CLOSED / PRODUCTION PAGES VERIFIED | PR #260 final head `8c6d34d818662474c0db34abb93dee5af57b4808`; final exact-head CI #917 SUCCESS; frozen R2 review BLOCKER 0; merge `6137030afe43a7dc2a4a3c8b813584fbd7144cae`; post-main CI #918 + Pages #1542 SUCCESS |
| Phase 4 Strategy Analytics Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | Full-history descriptive overview + exact common-period reliable TWR cover the high-value strategy comparison that can be derived from existing authoritative outputs without new financial methodology |
| **Phase 6 / Batch 6.1 Data Sync Status UX** | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #262 final head `f50287da41dcc07023c5cb63f12e53c6e24883a6`; final exact-head CI #925 SUCCESS; frozen R2 review BLOCKER 0; merge `eab6a2e325238fc068b843d3218fdadd0705cf0e`; post-main CI #926 + Pages #1544 SUCCESS |
| **Phase 6 / Batch 6.2 Operation/Recovery Toast Convergence** | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #263 final head `f2ae75bbc4fe5950648d477e351e96d7329545aa`; final exact-head CI #931 SUCCESS; frozen R2 review BLOCKER 0; merge `b922851cafd699193fe0b5f96d07178703eca96a`; post-main CI #932 + Pages #1545 SUCCESS |
| **Phase 6 UX Convergence** | **OPTIMIZED FOR CURRENT REQUIREMENTS** | persistent status/reliability surfaces and transient global Toasts now use one product-level data-sync language while existing recovery/calculation state machines remain authoritative and unchanged |

Do not reopen closed phases/batches without new material evidence.

---

## 2. Project Status / Stable State

Current verified runtime merge checkpoint:

`b922851cafd699193fe0b5f96d07178703eca96a`

- **Phase 3 Explainability is OPTIMIZED FOR CURRENT REQUIREMENTS.**
- **Phase 4 Strategy Analytics is OPTIMIZED FOR CURRENT REQUIREMENTS.**
- **Phase 6 UX Convergence is OPTIMIZED FOR CURRENT REQUIREMENTS.** No Phase 6.3 runtime batch is currently justified.
- **Phase 6 / Batch 6.1 Data Sync Status UX is CLOSED / PRODUCTION PAGES VERIFIED.** Header and persistent reliability surfaces use product-level data freshness language instead of exposing `GitHub Actions`, trigger/polling/snapshot implementation terms.
- `資料已同步` is not optimistic copy: it requires the existing exact-object `isSnapshotVerificationCurrent(rawData, records)` proof. `snapshotFreshness='loaded'` alone only produces `驗證資料中`.
- Read-specific `portfolioReadStatus='error'` is authoritative over global connection recovery and any prior memory-only verification proof, preventing a contradictory green `資料已同步` state after the latest full portfolio read has failed.
- **Phase 6 / Batch 6.2 Operation/Recovery Toast Convergence is CLOSED / PRODUCTION PAGES VERIFIED.** All global Toast producers still keep their existing internal lifecycle/error semantics; a single `useToast()` presentation boundary now converts normal user-visible snapshot/job/backend-calculation/trigger/idempotency terminology into data-update and safe-confirmation language.
- The Toast adapter preserves actionable instructions such as `請勿重複送出`, automatic retry, reload/manual fallback, and maintenance escalation; it does not change controller decisions, retry counts, idempotency keys, polling, dirty generation, calculation jobs, or mutation lifecycle.
- No Worker/API/auth change, D1/schema/migration/data change, Python financial-methodology change, calculation/recovery state-machine change, broad store refactor, or production Worker deployment was required for either Phase 6 batch.
- Batch 6.1 final PR head `f50287da41dcc07023c5cb63f12e53c6e24883a6`; final exact-head CI #925 / run `31832923996`: **SUCCESS**; merge `eab6a2e325238fc068b843d3218fdadd0705cf0e`; post-main CI #926 + Pages #1544 SUCCESS.
- Batch 6.2 final PR head `f2ae75bbc4fe5950648d477e351e96d7329545aa`; final exact-head CI #931 / run `31834418498`: **SUCCESS**; merge `b922851cafd699193fe0b5f96d07178703eca96a`; post-main CI #932 / run `31834581878` + Pages #1545 / run `31834580855`: **SUCCESS**.
- Production Worker remains release `4.08`, API `2.61`, schema `3`.
- Rollback is a normal revert of PR #263 / merge `b922851c...` and/or PR #262 / merge `eab6a2e3...`, or restore the prior Pages deployment. No schema/data/Python rollback is required.

Stable product lifecycle remains:

```text
record create durable intent
→ rollback-safe idempotent endpoint
→ mutation commit/readback
→ durable dirty generation
→ calculation job lifecycle
→ snapshot publication
→ browser source/benchmark integrity verification
→ bounded self-healing only when integrity evidence proves repair is safe
```

User-facing data-sync presentation boundary now remains:

```text
existing portfolio/recovery authorities
→ portfolioReadStatus / connectionStatus / snapshotFreshness / isPolling
→ exact snapshot+record verification proof
→ pure persistent dataSyncPresentation state
→ global useToast presentation adapter for transient messages
→ product language only
→ no duplicate lifecycle or optimistic freshness state
```

Explainability / analytics authority boundary remains:

```text
Python canonical calculation / reconciliation
→ published snapshot group summary / holdings / history / day_ledger
→ frontend fail-closed structural/reliability validation
→ existing reviewed TWR rebasing helper for interval presentation only
→ presentation-only sorting / labels / responsive UI
→ no browser accounting, XIRR reconstruction, or risk-scoring methodology
```

Phase-1 presentation invariant remains:

```text
symbol
→ shared frontend native-currency detection aligned with Python CurrencyDetector
→ native transaction settlement semantics aligned with current PortfolioCalculator
→ TWD base-currency value directly for TWD
→ foreign TWD value only after exact snapshot + exact record integrity proof
→ exact transaction-date history._raw_fx_rates[currency]
→ legacy exact-date scalar history.fx_rate only for USD-compatible old snapshots
→ no nearest-date/as-of guessing in browser
→ no hard-coded FX fallback
→ missing/unverified evidence fails closed
```

### User-facing verification boundary

Repository CI, production build, and Pages deployment are verified. No real-user ledger mutation was created solely for smoke testing. Phase 6 changes are presentation-only over existing authoritative runtime states: they do not create a second freshness/recovery state machine and do not modify financial or persistence authority.

### 2A. Closed Batch — Phase 1 / Batch 1.1 Frontend Native Currency Contract

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Transaction entry and transaction-history presentation use the same supported native-currency suffix contract as the Python engine instead of the old `TW/TWO => TWD; everything else => USD` assumption.

Runtime:

- `src/services/instrumentCurrency.js`
- `src/components/TradeForm.vue`
- `src/components/RecordList.vue`

Regression:

- `tests/frontend_instrument_currency.test.mjs`
- `tests/frontend_residual_correctness.test.mjs`

Behavior locked:

- `.TW/.TWO` → TWD
- `.KS/.KQ` → KRW
- `.HK/.HKG` → HKD
- `.SS/.SZ` → CNY
- `.T` → JPY
- `.L` → GBp
- `.PA/.DE` → EUR
- unknown/unmapped suffix → existing Python-compatible USD behavior
- no `32.0` fallback
- missing/null/blank native amount → `—` rather than JavaScript coercion to zero

Verification chronology:

- initial CI #875 exposed one stale implementation-shape regression; runtime mapping tests passed;
- root cause was test coupling to inline TradeForm literals; test was updated to verify shared-service delegation rather than reintroducing hardcoding;
- CI #876 full success;
- R2 review found missing-value `Number(null) === 0` risk; fixed and regressed;
- final CI #878 SUCCESS;
- R2 review PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- merge `4ce9c8fc...`; post-main CI #879 + Pages #1532 SUCCESS.

### 2B. Closed Batch — Phase 1 / Batch 1.2 Authoritative Transaction Valuation

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

RecordList now uses the exact transaction-date currency-aware FX context that Python already calculated and published, rather than doing browser-side backward-date selection or treating the scalar USD/TWD reference as a generic foreign-currency rate.

**Audit convergence**

The initial candidate was a new Python `transaction_presentations` projection. Deeper audit found this would duplicate existing authoritative output:

- `PortfolioCalculator` history rows already serialize `_raw_fx_rates`, the exact TWD/native context used on each valuation date;
- `CloudflareClient.upload_portfolio()` uploads the full `PortfolioSnapshot.model_dump(mode="json")`;
- `day_ledger` is latest-day / symbol aggregated and cannot map historical records;
- `lot_ledger` has no current production producer.

The provisional Python projection was therefore **REJECTED before PR creation**. It is absent from the final PR diff. This decision reduced impact radius while preserving Python as FX authority.

**Runtime scope**

- `src/services/transactionValuation.js` — pure cash-flow/FX presentation adapter
- `src/services/snapshotVerification.js` — memory-only exact snapshot/record verification signal
- `src/components/RecordList.vue`
- `src/services/snapshotSelfHealing.js` — publishes existing Phase 3 FRESH/EMPTY proof only

**Regression scope**

- `tests/frontend_transaction_valuation.test.mjs`
- `tests/frontend_instrument_currency.test.mjs`
- `tests/frontend_snapshot_self_healing.test.mjs`

**Explicitly unchanged**

- Python financial calculations and FX derivation
- Worker API/auth/routing
- D1 schema/migrations/data
- snapshot fields / calculation manifest methodology
- calculation-job / retry / recovery authority
- holdings, TWR, XIRR, Daily P&L
- Journal / strategy / analytics features

**Behavior now locked**

- BUY cash flow follows current calculator: `-(qty * price + fee + tax)`.
- SELL cash flow follows current calculator: `qty * price - fee - tax`.
- confirmed DIV cash flow follows current calculator: `qty * price`.
- Browser uses normalized record fee/tax values in the same arithmetic as the calculator and does **not** create a second `abs()` transformation. Normal Worker record writes already enforce non-negative fee/tax via `optionalFiniteNumber(..., { minInclusive: 0 })`; preserving supplied values still prevents projection drift for historical/direct-import ledger rows and keeps frontend semantics identical to the calculation source it receives.
- TWD records use base-currency multiplier `1`.
- foreign records require existing Phase 3 cryptographic proof for the exact snapshot object and exact record object.
- verified foreign FX uses only the exact transaction-date `history._raw_fx_rates[currency]`.
- older verified USD-only snapshots may use the exact same date `history.fx_rate` compatibility value.
- no nearest-date/backward scan, no as-of policy invented in browser, no `32.0` fallback.
- replaced snapshot/record objects cannot reuse an old integrity proof.
- TWD sorting leaves unverified/missing foreign valuations unvalued rather than coercing them to zero.

**CI / Debug / Review chronology**

- CI #882: Worker + Python passed; Frontend failed because Batch 1.1 regression still required RecordList to own the old `canConvertWithLegacyUsdTwdRate` implementation shape.
- Root cause: valuation authority had moved into `transactionValuation.js`; the regression was updated to verify delegation and continued prohibition of non-TWD-as-USD / `32.0` fallback. Runtime was not weakened.
- **R2 BLOCKER 1:** first helper version added an extra `abs()` transform for fee/tax. Normal Worker writes are non-negative, but Python preparation/calculator do not introduce that frontend-only transform and historical/direct-import rows cannot be assumed to have only UI provenance. Helper + regressions were corrected to mirror the calculator’s supplied-value arithmetic exactly.
- **R2 BLOCKER 2:** `snapshotFreshness='loaded'` occurs before Phase 3 cryptographic integrity verification. A memory-only proof bound to the exact assessed snapshot + records was added; foreign monetary FX now requires that actual proof.
- Oversell review: production runner already executes split-adjusted transaction-prefix integrity validation before `PortfolioCalculator`; a published snapshot cannot depend on partial oversell clamp to hide invalid source data.
- **Evidence correction recorded during Phase 2 preflight:** re-reading `optionalFiniteNumber()` confirmed current Worker normal writes enforce `fee/tax >= 0`; earlier review prose saying Worker “accepts any finite fee/tax” was inaccurate. Runtime choice remains unchanged because the correct invariant is calculator parity without a second frontend-only sign transform.
- final exact-head `7bf436849e985eaa51263f22fd75d6973d0b0833`;
- final exact-head CI #891 / `31816830443`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment tests + Recovery Evidence Gate + local D1 baseline: PASS;
- final compare: `behind_by=0`, exactly 7 focused frontend/lifecycle/regression files;
- frozen-diff independent review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 0**;
- main merge `92f78af6c77506ea310a046c9f96ee6130fd9c24`;
- post-main CI #892 / `31817053580`: **SUCCESS**;
- Pages #1534 / `31817052263`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #251 / merge `92f78af6...` or restore previous Pages deployment;
- no Worker/schema/data/Python rollback required;
- memory-only verification proof disappears naturally on reload/revert.

### 2C. Closed Batch — Phase 2 / Batch 2.1 Trading Journal Note UX

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

The product now exposes its existing `records.note` field as an actual trading-journal function without creating a second write authority or broad architecture change.

Runtime:

- `src/components/TradeForm.vue`
- `src/components/RecordList.vue`

Regression:

- `tests/frontend_journal_note.test.mjs`
- all existing frontend mutation/idempotency/recovery contracts remain green unchanged.

Behavior locked:

- note input/edit/reset is available in the established trade form;
- UI input is bounded to 2000 characters and the test verifies the existing Worker validation bound behavior rather than a specific internal constant name;
- notes render on desktop and mobile transaction history;
- search matches symbol, tag, or note;
- Vue interpolation remains the rendering boundary; no raw HTML path was added;
- note metadata remains financially neutral to canonical snapshot source identity;
- existing record mutation/recalculation lifecycle is reused; no note-only bypass exists.

Verification chronology:

- v1 PR #253 was closed without merge after its test strategy overbound itself to internal implementation shape;
- v2 PR #254 restarted from verified `main@9df351c883226c5d667d243ef565ba87d7b716a9` with narrower scope;
- initial CI #897: Worker + Python passed; Frontend failed 335/336 because the new regression required a nonexistent `MAX_NOTE_LENGTH` symbol even though Worker already enforced `sanitizeText(..., 2_000)`;
- failure classified as test-contract drift, not runtime defect;
- correction changed the regression to verify the actual 2000-character Worker behavior without modifying Worker/API/D1 runtime;
- final head `e72f37a3e4c562db403d933f0e6b0c5837af49e4`;
- exact-head CI #898 / `31824375970`: **SUCCESS**;
- final compare: `behind_by=0`, exactly 3 focused files;
- independent frozen-diff review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**;
- merge `7d0dbe2d0203ce1efbb0d992d2ec9df2942eddde`;
- post-main CI #899 / `31824494110`: **SUCCESS**;
- Pages #1536 / `31824492603`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #254 / merge `7d0dbe2d...` or restore previous Pages deployment;
- no Worker/schema/data/Python rollback required;
- persisted notes remain compatible with previous frontend versions.

### 2D. Closed Batch — Phase 3 / Batch 3.1 Daily P&L Explainability

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Users can answer “今天是哪一檔、哪一類因素造成損益？” directly from the overview on desktop and mobile, using only the Python engine's already-reconciled published data.

Runtime:

- `src/services/dailyPnlExplainability.js`
- `src/components/DailyPnlExplanation.vue`
- `src/components/StatsGrid.vue`

Regression:

- `tests/frontend_daily_pnl_explainability.test.mjs`

Behavior locked:

- current-group `day_ledger` selection is exact and fail-closed;
- no explanation is synthesized from holdings, summary, another group, or guessed values;
- every row requires finite published total and all five published components;
- five components must reconcile to the row total within display-validation tolerance;
- duplicate symbol rows are rejected as ambiguous evidence;
- per-symbol raw total must reconcile to published rounded `summary.daily_pnl_twd` within the Python publication rounding boundary;
- rows are ranked by absolute contribution only after validation;
- the detail control is a native button with `aria-controls` / `aria-expanded` and works on touch devices;
- values are rendered with Vue interpolation only;
- UI tells the user integer TWD display is rounded while raw values remain the reconciliation source;
- no browser fetch/API mutation is added by the detail component.

Verification chronology:

- audit confirmed `PortfolioGroupData.day_ledger` is already a production snapshot field;
- Python `DailyPnLReconciler` already produces per-symbol price/FX/dividend/execution/fee-tax components and fails closed when canonical group total does not reconcile to history;
- existing StatsGrid exposed only TW/overseas/FX via hover `title`, leaving touch users and per-symbol questions underserved;
- audit rejected a new Worker/D1/Python explainability projection because authoritative data already exists;
- audit also confirmed `lot_ledger` has no current production producer, so historical per-trade attribution remains out of scope;
- initial exact-head CI #902 / `31826178991`: **SUCCESS**;
- R2 frozen review then identified one Closely Related integrity edge: duplicate-symbol rows could remain numerically reconciled while producing ambiguous attribution / duplicate Vue keys;
- duplicate evidence was changed to fail closed and a regression was added;
- final exact head `fc57b221a9b2c0e3adf6c929c1db6caf5e6c9c22`;
- final exact-head CI #904 / `31826358947`: **SUCCESS**;
- final compare: `behind_by=0`, exactly 4 focused frontend/test files;
- frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**;
- merge `2f46516e2eee7f9ec653587bef8987260dfffb65`;
- post-main CI #905 / `31826520662`: **SUCCESS**;
- Pages #1538 / `31826519726`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #256 / merge `2f46516e...` or restore previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### 2E. Closed Batch — Phase 4 / Batch 4.1 Strategy Group Overview

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Users can view all named strategy groups side by side from the Group Management page without converting different histories or overlapping tags into a misleading leaderboard.

Runtime:

- `src/services/strategyGroupOverview.js`
- `src/components/StrategyGroupOverview.vue`
- `src/components/GroupManager.vue` — integration only

Regression:

- `tests/frontend_strategy_group_overview.test.mjs`

Behavior locked:

- `all` is excluded; named groups are ordered alphabetically only;
- published total value, invested capital and total P&L require actual finite numbers;
- TWR/XIRR honor explicit reliability status; unavailable metrics display `—` instead of numeric compatibility sentinels;
- legacy snapshots with finite TWR/XIRR but no reliability status remain display-compatible;
- the displayed date span is explicitly **歷史資料範圍**, not strategy inception;
- UI states that histories can differ and this is not same-period performance ranking;
- UI states that transactions may belong to multiple groups and group values are not additive;
- no best/winner/Sharpe/Sortino/MDD/score logic exists;
- abnormal snapshot group keys with leading/trailing whitespace fail closed rather than being normalized into a potentially nonexistent store key;
- selecting a group delegates to existing `store.setGroup(group.name)`;
- no API fetch or new calculation happens in the overview component;
- existing GroupManager mutation lifecycle remains unchanged.

Verification chronology:

- audit confirmed each tag group already has an independently calculated authoritative `summary / holdings / history` in the published snapshot;
- audit rejected direct performance ranking because group histories may begin at different times;
- audit identified that calculator history starts with a baseline row before first activity, so first history date is not a truthful strategy-inception date;
- audit identified tag groups can overlap because one transaction can contain multiple tags, so group monetary values cannot be summed safely;
- initial exact-head CI #909 / `31828383904`: **SUCCESS**;
- R2 review found the noncanonical group-key navigation edge (`" Core "` displayed as `Core` but no exact store key); fixed to fail closed with regression;
- final exact head `65e6e2710dc7a01cb17b5ee2d74ae91fe79136a1`;
- final exact-head CI #911 / `31828606975`: **SUCCESS**;
- final compare: `behind_by=0`, exactly 4 focused files; GroupManager integration `+3 / -0`;
- frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**;
- merge `6d0c7708e08bba41231063c6ca765b29c41766b6`;
- post-main CI #912 / `31828773310`: **SUCCESS**;
- Pages #1540 / `31828772380`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #258 / merge `6d0c7708...` or restore previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### 2F. Closed Batch — Phase 4 / Batch 4.2 Exact Common-Period TWR

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Users can compare named strategy groups over one exact, auditable common period without turning the browser into a second return-calculation engine.

Runtime:

- `src/services/strategyGroupOverview.js`
- `src/components/StrategyGroupOverview.vue`

Regression:

- `tests/frontend_strategy_common_period_twr.test.mjs`
- existing `tests/frontend_twr_reliability.test.mjs` remains the shared TWR rebasing contract.

Behavior locked:

- requires at least two named groups;
- every compared group must have valid history rows with unique ISO dates;
- common endpoints are chosen only from dates that exist in every group and pass existing `isTwrPointReliable()`;
- at least two exact common reliable dates are required;
- start = first exact common reliable date; end = last exact common reliable date;
- interval TWR uses existing `relativeTwrValue(end, start)` only;
- no nearest-date/as-of/interpolation/calendar-fill alignment;
- unreliable/malformed/duplicate evidence makes common-period output unavailable rather than guessed;
- common-period unavailability does not hide the safe full-history descriptive overview;
- group metric lookup is prototype-safe for exact user-defined keys such as `__proto__` and `constructor`;
- UI explicitly distinguishes complete-history TWR/XIRR from common-period TWR;
- no performance sorting, best/winner label, XIRR recomputation, risk score, API fetch, or accounting recomputation.

Verification chronology:

- methodology audit proved `twrState.js` already contains reviewed `isTwrPointReliable()` and `relativeTwrValue()` used by production PerformanceChart;
- Python `annotate_twr_history()` publishes sticky reliability: once an undefined subperiod occurs, later cumulative TWR remains undefined, so a reliable endpoint cannot silently bridge a later reliability gap;
- initial exact head `a454b541c2c060bf5ecd4260f7ebdd31fec36e14`;
- initial CI #915 / `31830587856`: **SUCCESS**;
- R2 review identified prototype-like user group names colliding with a normal JavaScript metric dictionary; classified Closely Related / NOW and fixed with `Object.create(null)` plus regression;
- final exact head `8c6d34d818662474c0db34abb93dee5af57b4808`;
- final exact-head CI #917 / `31830778223`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- final compare: `behind_by=0`, exactly 3 focused frontend/test files;
- frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**;
- merge `6137030afe43a7dc2a4a3c8b813584fbd7144cae`;
- post-main CI #918 / `31830934523`: **SUCCESS**;
- Pages #1542 / `31830933197`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #260 / merge `6137030a...` or restore previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### 2G. Closed Batch — Phase 6 / Batch 6.1 Data Sync Status UX

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Normal users now see one truthful product-level data-sync state instead of having to interpret connection, snapshot, trigger and polling implementation details.

Runtime:

- `src/services/dataSyncPresentation.js`
- `src/App.vue`
- `src/services/dataReliability.js`

Regression:

- `tests/frontend_data_sync_presentation.test.mjs`
- `tests/frontend_data_reliability.test.mjs`

Behavior locked:

- `載入資料中` while the full read is loading;
- `最新資料讀取失敗` when `portfolioReadStatus='error'`, regardless of later unrelated API success or a prior verification proof;
- `資料更新中` while calculation polling is active;
- `連線異常` on global connection error when no read-specific error overrides it;
- `資料待更新` on stale source evidence;
- `資料已同步` only when the exact current snapshot+record pair has the existing verification proof;
- `驗證資料中` for connected + loaded-but-unverified data;
- no new persistent freshness state, timer, queue or recovery authority;
- manual `觸發` action becomes `立即更新`; normal-flow `GitHub Actions`, polling and snapshot terminology is removed from App-level presentation;
- persistent stale/read banner keeps fail-closed warning and actionable fallback but uses data-language rather than backend/snapshot language.

Verification chronology:

- initial CI #921: Worker + Python passed; Frontend failed 360/361 because an old reliability regression still required the wording `上一次成功載入的快照`; classified as stale copy-contract drift and corrected without runtime rollback;
- R2 review found a real BLOCKER: global `connectionStatus` can return to `connected` after an unrelated API success even while `portfolioReadStatus='error'` remains authoritative for the failed latest full portfolio read; an old memory-only verification proof could otherwise contradict the persistent reliability banner;
- fix: read-specific status now precedes polling/global connection/stale/verified presentation and has regression coverage;
- empty accounts remain verifiable through the existing `EMPTY` snapshot integrity publication; no special-case freshness logic was added;
- final exact head `f50287da41dcc07023c5cb63f12e53c6e24883a6`;
- final exact-head CI #925 / `31832923996`: **SUCCESS**;
- exact diff: 5 focused frontend/test files, `behind_by=0`;
- frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**;
- merge `eab6a2e325238fc068b843d3218fdadd0705cf0e`;
- post-main CI #926: **SUCCESS**;
- Pages #1544: **SUCCESS**;
- Worker deploy/D1 migration/Python runtime change: NONE / NOT REQUIRED.

Rollback:

- revert PR #262 / merge `eab6a2e3...` or restore previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### 2H. Closed Batch — Phase 6 / Batch 6.2 Operation/Recovery Toast Convergence

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Normal transaction/update/recovery Toasts now use the same product-level data-sync language without rewriting the internal lifecycle producers that own debug and recovery evidence.

Runtime:

- `src/services/toastPresentation.js`
- `src/composables/useToast.js`

Regression:

- `tests/frontend_operation_toast_presentation.test.mjs`

Behavior locked:

- all existing global controllers continue using the same `useToast().addToast` boundary;
- the boundary transforms user-facing phrases such as snapshot/job/backend calculation/trigger/idempotency wording into data-update or safe-confirmation language;
- mutation success, first-trade update, polling timeout/dedup, manual update, GroupManager fallback, calculation-complete/reload-failure, trigger ambiguity, record-create/dividend ambiguity, and calculation-failure recovery are covered;
- actionable instructions remain: users are still told not to repeat uncertain writes, when automatic retry is occurring, when reload/manual fallback is available, and when maintenance contact is appropriate;
- ordinary nontechnical messages pass through unchanged;
- no producer/controller state or conditional branch was modified.

Verification chronology:

- initial exact head `22babe71a1a96c430e42c4aeecb72a37cdc27c4d`; CI #927: SUCCESS;
- pre-freeze review found calculation-failure recovery paths still exposing `計算服務 / 持倉快照 / 現有快照`; added at the central presentation boundary with expanded regression;
- follow-up review found GroupManager `後端重算觸發失敗`, dynamic `formatRequestError(action='觸發重算')`, and `計算已完成` reload-failure copy; added at the same boundary;
- final exact head `f2ae75bbc4fe5950648d477e351e96d7329545aa`;
- final exact-head CI #931 / `31834418498`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- final compare: `behind_by=0`, exactly 3 focused files;
- frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 0**;
- merge `b922851cafd699193fe0b5f96d07178703eca96a`;
- post-main CI #932 / `31834581878`: **SUCCESS**;
- Pages #1545 / `31834580855`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE.

Rollback:

- revert PR #263 / merge `b922851c...` or restore previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

---

## 3. Closed Batch — PR #247 Snapshot Integrity Record Contract

### Primary Goal — SATISFIED BY CODE/DEPLOYMENT EVIDENCE

Every legal transaction set returned by the real Worker `/api/records` contract is canonicalized through the same API→calculation field boundary used by Python before comparison with `calculation_manifest`. A matching source/benchmark can converge to verified/non-stale state; true mismatches and malformed/unknown contracts remain fail-closed.

Runtime:

- `src/services/snapshotIntegrity.js`

Regression:

- `tests/frontend_snapshot_integrity.test.mjs`
- `tests/frontend_snapshot_self_healing.test.mjs`
- `tests/frontend_user_reported_product_defects.test.mjs`

Explicitly unchanged:

- Worker API/auth
- D1 schema/migrations/data
- Python financial calculations / manifest methodology
- retry/timer policy
- `portfolio.js` orchestration
- UI copy/components
- production Worker deployment architecture

---

## 4. Root Cause Log

### 2026-08-15 — Internal lifecycle terminology leaked through the global Toast boundary

**Symptom / Product Gap**  
After the persistent header/banner status had been converged to `資料已同步 / 更新中 / 待更新`, common transaction and recovery Toasts could still say `持倉快照待重新計算`, `後端計算工作`, `觸發重算`, `原交易識別碼`, or `計算服務`, creating a mixed mental model during the most frequent user workflows.

**Evidence**

- portfolio mutations, calculation recovery, trigger ambiguity, record-create ambiguity, dividend ambiguity and data-read recovery all ultimately share `useToast().addToast`;
- producer strings also serve useful internal/debug/audit purposes and are protected by existing tests;
- editing every producer would touch the 40KB portfolio store and several mature recovery controllers solely for presentation.

**Failure Point**  
The global Toast presentation boundary rendered internal lifecycle messages verbatim.

**Root Cause**  
Presentation and operational/debug wording had no explicit boundary. Mature internal terminology therefore became user copy by accident.

**Permanent Fix**

- keep producer/controller control flow and internal wording intact;
- add one pure deterministic `toastPresentation` adapter at `useToast()`;
- cover common mutation/update/recovery paths while preserving actionable instructions;
- ordinary product-language messages pass through unchanged.

**Prevention**

- new internal lifecycle Toast wording should either already be user-readable or add a presentation regression at the shared boundary;
- do not edit recovery state machines merely to change wording.

### 2026-08-15 — Header freshness language could overstate trust if it relied on loaded/global connection state

**Symptom / Product Gap**  
The Header exposed implementation terms such as `GitHub Actions`, `觸發`, polling and snapshot state. More importantly, using `snapshotFreshness='loaded'` or global connection state as “healthy” could overstate trust before cryptographic source verification completed.

**Evidence**

- Phase 1.2 already proved `loaded` occurs before source/benchmark integrity verification;
- exact snapshot+records memory-only verification proof already exists;
- `portfolioReadStatus` is deliberately separate from global `connectionStatus` because an unrelated API success can restore global connection state after a failed latest full portfolio read.

**Failure Point**  
Header presentation consumed infrastructure-oriented states directly instead of composing them into one product-level truth model.

**Root Cause**  
The application accumulated reliable internal state machines faster than the user-facing status model was simplified.

**Permanent Fix**

- pure `dataSyncPresentation` adapter over existing authorities;
- only exact current verification proof can produce `資料已同步`;
- read-specific failure prevents old proof/global connection recovery from creating false green status;
- normal manual action becomes `立即更新`; stale/read copy is converged without changing recovery behavior.

**Review finding / prevention**

- R2 review specifically regressed `connected + portfolioReadStatus=error + verified=true` and `read error + polling` so read-specific failure cannot be masked.

### 2026-08-15 — Different strategy histories prevented a truthful same-period comparison

**Symptom / Product Gap**  
Phase 4.1 made all strategy groups visible side by side but correctly refused to call full-history TWR/XIRR directly comparable because groups can start at different times. Users still lacked a truthful same-period return field.

**Evidence**

- every group already publishes cumulative linked TWR history;
- production frontend already uses `relativeTwrValue()` to rebase cumulative linked TWR for PerformanceChart;
- `isTwrPointReliable()` and Python sticky `twr_status` provide existing reliability authority;
- groups can have different market-date sets, so nearest-date alignment would create a new policy;
- common-period XIRR would require reconstructing interval cash flows and terminal value, which is materially broader than presentation.

**Failure Point**  
The product had authoritative per-group histories and a reviewed interval-TWR rebasing primitive but no cross-group exact-date intersection layer.

**Root Cause**  
Strategy comparison presentation stopped at descriptive full-history metrics because no common-period methodology had yet been audited.

**Permanent Fix**

- intersect exact reliable history dates across every displayed named group;
- require at least two common reliable dates;
- use the existing reviewed `relativeTwrValue(end, start)` helper;
- fail closed on malformed/duplicate/insufficient evidence;
- keep XIRR/P&L/risk-adjusted methods out of this batch.

**Review finding / prevention**

- user-defined Tag names can be JavaScript prototype-like keys; metric maps now use a null-prototype dictionary and a hostile-key regression;
- future strategy analytics must prove that the required methodology already exists or undergo a separate financial-methodology review before implementation.

### 2026-08-15 — Strategy groups had authoritative snapshots but no truthful cross-group overview

**Symptom / Product Gap**  
Users could select one strategy group at a time and manage group tags, but could not see named strategy groups side by side without manually switching back and forth.

**Evidence**

- Python already calculates each named tag group independently and publishes group `summary`, `holdings`, and `history`.
- Group histories may cover different date ranges.
- Calculator history includes a baseline row before first activity, so history start is not the same thing as strategy inception.
- A transaction can contain multiple tags and therefore participate in multiple groups.
- Existing GroupManager is a tag/membership editor rather than a strategy-performance overview.

**Failure Point**  
Authoritative per-group snapshot outputs existed, but frontend exposed only a single selected group at a time.

**Root Cause**  
Strategy analytics presentation had not yet been built on top of the already-published group snapshot contract.

**Impact Analysis**

- No backend or accounting defect.
- Manual cross-group comparison was inefficient.
- A naïve leaderboard would be misleading because date ranges differ and groups can overlap.

**Permanent Fix**

- Add an alphabetic side-by-side overview using only published group summary/history/holdings.
- Show history-data range and reliability states explicitly.
- State that the page is not a same-period ranking and group amounts are not additive.
- Keep common-period normalization and new analytics methodology out of this batch.

**Review finding / prevention**

- Do not normalize malformed group keys into a different store-selection key; reject them.
- Future cross-group comparison must first define a reviewed common-period methodology before ranking or scoring strategies.

### 2026-08-15 — Daily P&L had authoritative per-symbol causes but the UI exposed only a coarse hover summary

**Symptom / Product Gap**  
The overview showed Daily P&L and a TW / overseas / FX hover tooltip, but users could not answer which symbol or which published component caused the current Daily P&L. Touch/mobile users had no dependable hover interaction.

**Evidence**

- `PortfolioGroupData.day_ledger` already exists in the production snapshot contract.
- Python `DailyPnLReconciler` publishes per-symbol price, FX, dividend, execution, fee/tax and total P&L components.
- Python reconciles canonical group total against history and fails closed before publication on material mismatch.
- Existing `StatsGrid.vue` consumed only `daily_pnl_breakdown` for a coarse `title` tooltip.
- `lot_ledger` currently has no production producer, so historical lot/trade attribution is not yet an authoritative product contract.

**Failure Point**  
Authoritative explainability data stopped at the snapshot boundary; frontend presentation did not expose it as a touch-accessible, per-symbol user feature.

**Root Cause**  
Presentation lagged behind the calculation engine's already-published explainability contract. The missing feature was not a data or accounting-engine gap.

**Systemic Cause**  
Historically, correctness work prioritized calculation/reconciliation and reliability before building an explicit UX layer over the resulting ledger evidence.

**Permanent Fix**

- Build a pure frontend explainability adapter over the exact current group's published `day_ledger`.
- Validate evidence before display; do not derive new accounting numbers.
- Add a responsive explicit detail control and per-symbol/component view.
- Suppress explanation when evidence is missing or inconsistent.

**Review finding / prevention**

- R2 review identified duplicate-symbol evidence as an ambiguity even if arithmetic still reconciles.
- Duplicate symbols now fail closed and have a regression.
- Future explainability features must use authoritative producer fields, provenance, fail-closed unavailable states, and must not infer historical attribution from insufficient data.

### 2026-08-15 — Journal-note CI regression tested an invented Worker implementation shape

**Symptom**  
PR #254 exact-head CI #897 failed only the new journal-note contract test while the other 335 frontend tests, Worker suite and Python suite remained healthy.

**Failure Point**  
`tests/frontend_journal_note.test.mjs` required `const MAX_NOTE_LENGTH = 2000` and required `sanitizeText(..., MAX_NOTE_LENGTH)`. Current Worker instead directly uses `sanitizeText(body.note || "", 2_000)`.

**Root Cause**  
The regression encoded an assumed internal symbol name rather than the product contract: D1 has `note`, Worker validates it to 2000 characters, persists it on create/update, and returns it. This repeated the same class of implementation-shape coupling already rejected during the v1 convergence review.

**Impact Analysis**

- No production runtime defect.
- No note length or persistence gap.
- No Worker/API/D1/Python change was justified.
- Merging was correctly blocked until the regression itself represented the real contract.

**Permanent Fix**

- Test now extracts the Worker `sanitizeText()` numeric note bound and asserts the normalized value equals `2000`.
- Keep persistence/read contract assertions.
- Do not introduce a Worker constant solely to satisfy a test.

**Prevention**

- Prefer behavior/contract assertions over private symbol/implementation-shape assertions.
- When CI conflicts with audited source evidence, classify runtime vs test-contract drift before editing production code.

### 2026-08-14 — Historical transaction TWD presentation did not consume already-published authoritative FX

**Symptom / Risk**  
After Batch 1.1, non-USD records correctly stopped using the USD/TWD scalar but remained `TWD 尚無可靠換算`, even though the Python snapshot already carried exact-date currency-aware FX. The old RecordList path also applied one total formula to all transaction types and had historically searched backward through FX dates.

**Evidence**

- Python history already stores exact date `_raw_fx_rates` from the calculator’s effective FX context.
- API client uploads the full snapshot model dump, so no new backend field was required.
- `day_ledger` cannot map old records; `lot_ledger` currently has no producer.
- current calculator BUY/SELL/DIV cash-flow formulas differ by transaction type.
- current Worker normal record writes enforce non-negative fee/tax through `optionalFiniteNumber`, while Python preparation/calculator consume supplied ledger values without adding a second sign-normalization layer; historical/direct-import provenance must therefore remain compatible with the calculator rather than a frontend-only transform.
- `fetchSnapshot()` sets `snapshotFreshness='loaded'` before Phase 3 later proves source identity.

**Failure Points**

1. Browser did not consume the available exact-date currency-aware FX evidence.
2. Browser cash-flow presentation was not aligned with SELL/DIV calculator semantics.
3. Read-success (`loaded`) was initially mistaken for sufficient monetary authorization.

**Root Cause**  
Frontend presentation had evolved separately from the authoritative Python snapshot contract. Existing accounting/FX evidence and existing Phase 3 integrity proof were not connected to RecordList.

**Impact Analysis**

- No D1 corruption or Python accounting defect.
- Multi-currency records could lack valid TWD presentation unnecessarily.
- SELL displayed amount could differ from calculator cash-flow semantics.
- Without the Phase 3 proof guard, a newly read but not-yet-verified snapshot could theoretically supply foreign FX during a short cross-device/stale window.

**Permanent Fix**

- Reuse exact-date `history._raw_fx_rates[currency]` after Phase 3 verifies the exact snapshot/record pair.
- Keep legacy scalar `fx_rate` USD-only and exact-date.
- Mirror current calculator BUY/SELL/DIV cash-flow arithmetic on supplied normalized record values; do not add an independent frontend `abs()` rule.
- Add memory-only `snapshotVerification` rather than a second persistent freshness state or new recovery controller.
- Remove RecordList backward-date FX lookup.

**Prevention**

- executable KRW/exact-date/missing-date/legacy-USD tests;
- supplied-value fee/tax parity regression against actual calculator source shape;
- replacement snapshot/record object invalidation tests;
- source-contract tests forbid browser nearest-date logic, `32.0`, and frontend-only `abs()` normalization drift;
- Phase 3 self-healing regression proves FRESH publishes the UI proof and stale repair does not.

### 2026-08-14 — Frontend transaction currency contract narrower than Python

**Symptom / Risk**  
TradeForm treated every non-Taiwan symbol as USD, while RecordList reused one USD/TWD scalar FX path for every non-Taiwan market and could fall back to hard-coded `32.0`. Backend/Python already supported KRW/HKD/CNY/JPY/GBp/EUR native currencies.

**Evidence**

- Python `CurrencyDetector` contains the reviewed market-suffix native-currency contract and fails closed when currency-aware FX is unavailable.
- Pre-Batch-1.1 TradeForm only distinguished `.TW/.TWO` from everything else.
- Pre-Batch-1.1 RecordList treated every non-Taiwan record as USD for TWD conversion and used `32.0` when scalar history FX was unavailable.
- Holdings already consumed backend `currency` and TWD market-value fields, proving the product had a cross-page presentation split rather than a Python-engine capability gap.

**Failure Point**  
Frontend presentation code duplicated a simplified two-currency assumption instead of sharing the actual supported market contract.

**Root Cause**  
The product evolved from TW/US usage into a broader multi-currency engine without converging the transaction-entry and transaction-history UI contract.

**Permanent Fix**

- shared frontend native-currency detection aligned with Python suffix rules;
- TradeForm derives label/affix from the shared contract;
- RecordList native presentation no longer assumes all non-TWD are USD;
- removed `32.0` fallback;
- missing values fail closed instead of JS-zero coercion.

### 2026-08-14 — Snapshot remains stale after successful calculation

**Symptom**  
User observed both `快照待重算` and `持倉與績效快照待重新計算` after a calculation job completed successfully.

**Evidence / Root Cause**

- Worker `/api/records` returns API/D1 fields (`txn_date`, `symbol`, `txn_type`, `qty`, `price`, `fee`, `tax`, `tag`).
- Python `prepare_transactions()` converts them to calculation fields before deterministic source identity.
- pre-PR-247 browser integrity code omitted that boundary and expected calculation-field names directly.
- real production records therefore became `UNVERIFIABLE_RECORDS`, causing correct fail-closed stale state even after a valid new snapshot.

**Permanent Fix**

- explicit API-record → manifest-source adapter in `snapshotIntegrity.js` matching Python normalization;
- mixed schemas remain fail-closed;
- API-shaped regressions must equal the established Python canonical SHA;
- successful job status alone never force-clears stale state.

---

## 5. Change Log / Verification

### Phase 6 / Batch 6.2 — PR #263

Implementation branch: `feat/phase6-operation-copy-convergence`  
Base/recovery point: `eab6a2e325238fc068b843d3218fdadd0705cf0e`  
Final PR head: `f2ae75bbc4fe5950648d477e351e96d7329545aa`  
Main merge: `b922851cafd699193fe0b5f96d07178703eca96a`

Scope:

- `src/services/toastPresentation.js`
- `src/composables/useToast.js`
- `tests/frontend_operation_toast_presentation.test.mjs`

Verification:

- audit identified the single global Toast boundary and rejected direct edits to portfolio/recovery producers;
- initial CI #927: SUCCESS;
- pre-freeze review expanded complete calculation-failure recovery copy coverage;
- follow-up review added GroupManager recalculation failure, dynamic trigger-recalculation error, and calculation-complete/reload-failure paths;
- final exact-head CI #931 / `31834418498`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 3 focused files, `behind_by=0` before merge;
- frozen-diff R2 review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 0;
- post-main exact merge-SHA CI #932 / `31834581878`: **SUCCESS**;
- Pages #1545 / `31834580855`: **SUCCESS**;
- Worker deploy/D1 migration/Python runtime change: NONE / NOT REQUIRED.

Rollback:

- revert PR #263 / merge `b922851c...` or prior Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### Phase 6 / Batch 6.1 — PR #262

Implementation branch: `feat/phase6-data-sync-status-ux`  
Base/recovery point: `1d84574fdd6cfc3307aa926fe7c867af25f742b9`  
Final PR head: `f50287da41dcc07023c5cb63f12e53c6e24883a6`  
Main merge: `eab6a2e325238fc068b843d3218fdadd0705cf0e`

Scope:

- `src/services/dataSyncPresentation.js`
- `src/App.vue`
- `src/services/dataReliability.js`
- `tests/frontend_data_sync_presentation.test.mjs`
- `tests/frontend_data_reliability.test.mjs`

Verification:

- initial CI #921 isolated a stale copy-contract test; Worker/Python remained green;
- R2 review found read-specific failure could be masked by global connection recovery plus prior verification proof; fixed without adding store state;
- final exact-head CI #925 / `31832923996`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 5 focused frontend/test files, `behind_by=0` before merge;
- frozen-diff R2 review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main CI #926: **SUCCESS**;
- Pages #1544: **SUCCESS**;
- Worker deploy/D1 migration/Python runtime change: NONE / NOT REQUIRED.

Rollback:

- revert PR #262 / merge `eab6a2e3...` or prior Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### Phase 4 / Batch 4.2 — PR #260

Implementation branch: `feat/phase4-common-period-twr`  
Base/recovery point: `6e2a589b9b3dfe871d82363e2dcdacf49535c311`  
Final PR head: `8c6d34d818662474c0db34abb93dee5af57b4808`  
Main merge: `6137030afe43a7dc2a4a3c8b813584fbd7144cae`

Scope:

- `src/services/strategyGroupOverview.js`
- `src/components/StrategyGroupOverview.vue`
- `tests/frontend_strategy_common_period_twr.test.mjs`

Verification:

- methodology audit reused the existing production TWR reliability and interval-rebasing contract rather than introducing a new financial formula;
- exact common reliable dates only; nearest/as-of/interpolation is prohibited;
- initial exact-head CI #915 / `31830587856`: SUCCESS;
- R2 review found prototype-key collision risk for user-defined strategy names; classified Closely Related / NOW, fixed with null-prototype metric dictionary and regression;
- final exact-head CI #917 / `31830778223`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 3 focused files, `behind_by=0` before merge;
- frozen-diff R2 review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main exact merge-SHA CI #918 / `31830934523`: **SUCCESS**;
- Pages production deployment #1542 / `31830933197`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #260 / merge `6137030a...` or previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### Phase 4 / Batch 4.1 — PR #258

Implementation branch: `feat/phase4-strategy-group-overview`  
Base/recovery point: `636aac48626067a72b679452134896b9055f1a08`  
Final PR head: `65e6e2710dc7a01cb17b5ee2d74ae91fe79136a1`  
Main merge: `6d0c7708e08bba41231063c6ca765b29c41766b6`

Scope:

- `src/services/strategyGroupOverview.js`
- `src/components/StrategyGroupOverview.vue`
- `src/components/GroupManager.vue` — integration only
- `tests/frontend_strategy_group_overview.test.mjs`

Verification:

- audit proved named strategy groups already have authoritative independent `summary / holdings / history` snapshots;
- no new Python/Worker/D1 projection or analytics formula was required;
- current history min/max is labeled history-data range rather than inception because history includes a baseline row;
- overlap/non-additivity warning added because transactions may have multiple tags;
- initial exact-head CI #909 / `31828383904`: SUCCESS;
- R2 review found noncanonical group-key/store-selection mismatch; classified Closely Related / NOW, fixed fail-closed, regression added;
- final exact-head CI #911 / `31828606975`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 4 focused files, `behind_by=0` before merge; GroupManager `+3 / -0`;
- frozen-diff R2 review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main exact merge-SHA CI #912 / `31828773310`: **SUCCESS**;
- Pages production deployment #1540 / `31828772380`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #258 / merge `6d0c7708...` or previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### Phase 3 / Batch 3.1 — PR #256

Implementation branch: `feat/phase3-daily-pnl-explainability`  
Base/recovery point: `0feef486766397bdacd90ece00e569d3931195e4`  
Final PR head: `fc57b221a9b2c0e3adf6c929c1db6caf5e6c9c22`  
Main merge: `2f46516e2eee7f9ec653587bef8987260dfffb65`

Scope:

- `src/services/dailyPnlExplainability.js`
- `src/components/DailyPnlExplanation.vue`
- `src/components/StatsGrid.vue`
- `tests/frontend_daily_pnl_explainability.test.mjs`

Verification:

- audit proved per-group `day_ledger` already contains authoritative per-symbol Daily P&L components;
- no new Python/Worker/D1 projection was required;
- initial exact-head CI #902 / `31826178991`: SUCCESS;
- R2 review found duplicate-symbol ambiguity; classified Closely Related / NOW, fixed fail-closed, regression added;
- final exact-head CI #904 / `31826358947`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 4 focused files, `behind_by=0` before merge;
- frozen-diff R2 review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main exact merge-SHA CI #905 / `31826520662`: **SUCCESS**;
- Pages production deployment #1538 / `31826519726`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #256 / merge `2f46516e...` or previous Pages deployment;
- no Worker/schema/data/Python/persisted-state rollback required.

### Phase 2 / Batch 2.1 — PR #254

Implementation branch: `feat/phase2-trading-journal-note-v2`  
Base/recovery point: `9df351c883226c5d667d243ef565ba87d7b716a9`  
Final PR head: `e72f37a3e4c562db403d933f0e6b0c5837af49e4`  
Main merge: `7d0dbe2d0203ce1efbb0d992d2ec9df2942eddde`

Verification:

- audit confirmed baseline D1 already has `records.note TEXT` and Worker already validates/persists/returns note;
- note remains outside financial snapshot source identity;
- dedicated note-only Worker route investigated then BACKLOGGED because existing mutation lifecycle is correct and lower-risk for current UX;
- v1 PR #253 closed unmerged after implementation/test shape expanded unnecessarily;
- v2 narrowed to additive journal metadata while preserving established financial form declaration;
- CI #897 exposed one test-contract drift only: regression required nonexistent `MAX_NOTE_LENGTH` symbol;
- root-cause correction verified actual `sanitizeText(..., 2_000)` behavior without runtime change;
- final exact-head CI #898 / `31824375970`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 3 focused files, `behind_by=0` before merge;
- independent frozen-diff review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main exact merge-SHA CI #899 / `31824494110`: **SUCCESS**;
- Pages production deployment #1536 / `31824492603`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #254 / merge `7d0dbe2d...` or previous Pages deployment;
- no Worker/schema/data/Python rollback required.

### Phase 1 / Batch 1.2 — PR #251

Implementation branch: `feat/phase1-authoritative-transaction-valuation`  
Base/recovery point: `0ae02373e550206bc3af7604f72521ce89b9fe88`  
Final PR head: `7bf436849e985eaa51263f22fd75d6973d0b0833`  
Main merge: `92f78af6c77506ea310a046c9f96ee6130fd9c24`

Verification:

- audit rejected redundant Python projection after proving root snapshot already carries authoritative per-date currency-aware FX;
- CI #882 exposed one stale Batch-1.1 implementation-shape test while Worker/Python passed;
- stale test corrected at the contract boundary, not by restoring old runtime logic;
- R2 BLOCKER 1 frontend-only fee/tax sign normalization removed in favor of exact calculator supplied-value arithmetic;
- R2 BLOCKER 2 loaded-vs-verified monetary authorization fixed;
- production prefix-integrity preflight reviewed for SELL/oversell boundary: PASS;
- Phase 2 preflight later corrected the review prose: normal Worker writes already enforce non-negative fee/tax; the runtime parity decision remains valid for calculator consistency and legacy/direct-import provenance;
- final exact-head CI #891 / `31816830443`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 7 focused frontend/lifecycle/test files, `behind_by=0` before merge;
- independent frozen-diff review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 0;
- post-main exact merge-SHA CI #892 / `31817053580`: **SUCCESS**;
- Pages production deployment #1534 / `31817052263`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- Python runtime change: NONE;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #251 / merge `92f78af6...` or previous Pages deployment;
- no Worker/schema/data/Python rollback required.

### Phase 1 / Batch 1.1 — PR #249

Implementation branch: `feat/phase1-native-currency-contract`  
Base/recovery point: `1bf0a492d843859151e787c3bc59370ad02f0aad`  
Final PR head: `08d9466b37197304a86cca77d94eea874064f99e`  
Main merge: `4ce9c8fc1b390db77587f50f59a3f3d251b1a107`

Verification:

- dedicated native-currency mapping/presentation regressions: PASS;
- initial CI #875 exposed one stale residual source-shape test only;
- CI #876 after root-cause test correction: SUCCESS;
- final review hardened missing native amounts against zero coercion;
- final exact-head CI #878 / `31813848874`: SUCCESS;
- independent review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main CI #879 / `31813958877`: SUCCESS;
- Pages #1532 / `31813957653`: SUCCESS;
- Worker/D1 changes: NONE.

### PR #247

Implementation branch: `fix/snapshot-integrity-record-contract`  
Final PR head: `09486cfb4a9422a070d17ae8a2a8943c7f41159f`  
Main merge: `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`

Verification:

- canonical SHA/integrity regressions: PASS;
- final PR CI #871 / `31800465725`: SUCCESS;
- independent review PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main CI #872 / `31801023106`: SUCCESS;
- Pages #1530 / `31801022403`: SUCCESS.

### Merge-method note

Repository policy rejects squash merges (HTTP 405 observed on earlier exact-head attempts). Repository policy was never modified or bypassed. Phase 1, Phase 2.1, Phase 3.1, Phase 4.1, Phase 4.2, Phase 6.1 and Phase 6.2 PRs used normal exact-head merges once this policy was established.

### Deployment

- Frontend Pages: **DEPLOYED / VERIFIED through #1545** for runtime merge `b922851c...`.
- Production Worker: **NOT REQUIRED / NOT DEPLOYED** for Phase 6.1/6.2.
- D1 migration: **NOT REQUIRED / NOT RUN** for Phase 6.1/6.2.

---

## 6. Decision Log

### D-2026-08-15-09 — Phase 6 UX Convergence is optimized for current requirements

- **Evidence:** Batch 6.1 converged persistent Header/reliability status onto verified product-level data-sync truth; Batch 6.2 converged transient operation/recovery Toasts at the shared presentation boundary. Remaining UX candidates are isolated visual/copy refinements rather than material workflow gaps.
- **Alternatives:** continue opening copy/style batches; broadly refactor store/controller messaging; stop and run a new product-function gap audit.
- **Decision:** no Phase 6.3. Mark Phase 6 `OPTIMIZED FOR CURRENT REQUIREMENTS` and return to product-function discovery.
- **Trade-off:** minor wording/visual polish remains possible, but product development is not delayed for diminishing-return UX work.
- **Status:** LOCKED / CONVERGED.
- **Reopen Condition:** new user evidence exposes a material workflow/status comprehension problem.

### D-2026-08-15-08 — Internal operation messages remain producer-owned; Toast product copy is a presentation boundary

- **Evidence:** all recovery/controllers share `useToast().addToast`; producer messages also serve debug/audit evidence; direct edits would span the large portfolio store and several mature recovery controllers solely for wording.
- **Alternatives:** rewrite each producer; add a second recovery messaging state machine; central pure presentation adapter.
- **Decision:** apply deterministic internal→product-language transformation only at the global Toast boundary. Do not alter control flow or internal evidence.
- **Trade-off:** new internal terms may require adding a presentation mapping, but operational logic and debug provenance remain stable.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** Toast architecture changes or messages acquire structured semantic payloads that supersede text presentation mapping.

### D-2026-08-15-07 — “Data synchronized” requires current verification proof and no read-specific failure

- **Evidence:** `snapshotFreshness='loaded'` precedes cryptographic integrity proof; `connectionStatus` is global and may become connected after unrelated API success while the latest full portfolio read remains failed; current exact-object verification already exists.
- **Alternatives:** show loaded/connected as healthy; create new persisted freshness state; derive presentation from existing authorities.
- **Decision:** use a pure presentation truth table. `資料已同步` requires current exact snapshot+records verification proof; `portfolioReadStatus='error'` overrides prior proof/global connection recovery.
- **Trade-off:** UI may stay in `驗證資料中` briefly after load, but never creates false confidence.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** snapshot/read authority model materially changes.

### D-2026-08-15-06 — Phase 4 Strategy Analytics is optimized for current requirements

- **Evidence:** Phase 4.1 exposes truthful full-history group metrics; Phase 4.2 adds exact common-period reliable TWR using existing authority. Remaining candidates—common-period XIRR/P&L, Sharpe/Sortino/MDD, strategy scores—require new financial/risk methodology or interval cash-flow reconstruction rather than presentation of existing authoritative fields.
- **Alternatives:** continue into risk-adjusted analytics; implement common-period XIRR; stop and shift to higher-value UX/product work.
- **Decision:** no Phase 4.3. Mark Phase 4 `OPTIMIZED FOR CURRENT REQUIREMENTS`.
- **Trade-off:** advanced strategy scoring remains deferred, while current users get both descriptive full-history context and an auditable exact same-period TWR.
- **Status:** LOCKED / CONVERGED.
- **Reopen Condition:** new user requirements justify a specific advanced metric and its methodology is separately reviewed, or the backend publishes a new authoritative comparison field.

### D-2026-08-15-05 — Common-period strategy comparison is exact-date TWR only

- **Evidence:** existing `twrState.js` already provides reviewed reliability and interval-rebasing helpers; Python publishes sticky TWR reliability. Different group market calendars make nearest-date alignment a new policy, while XIRR/P&L would require new interval cash-flow/value reconstruction.
- **Alternatives:** full-history ranking; nearest-date alignment; common-period TWR; common-period XIRR; new risk score.
- **Decision:** compare only TWR from the first to last exact calendar dates shared and reliable across every displayed named group; require at least two exact dates; fail closed otherwise.
- **Trade-off:** comparison availability is intentionally conservative, but every displayed common-period value has the same auditable start/end dates.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** market-calendar alignment or interval-return methodology materially changes, or an authoritative backend common-period contract supersedes the current frontend selection layer.

### D-2026-08-15-04 — Strategy group overview is descriptive, not a cross-period leaderboard

- **Evidence:** each tag group is independently calculated; history ranges may differ; history includes a pre-activity baseline row; transactions can belong to multiple tag groups.
- **Alternatives:** direct TWR/XIRR ranking; common-period rebase; new strategy score; descriptive same-snapshot overview.
- **Decision:** show alphabetic published group metrics with explicit history range and overlap/non-additivity warnings. Do not rank or score strategies in Batch 4.1.
- **Trade-off:** users gain immediate cross-group visibility without a false claim that different-period/overlapping groups are directly comparable.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** a separate Phase 4 methodology audit defines and verifies a safe common-period comparison contract.

### D-2026-08-15-03 — Phase 3 Explainability is optimized for current requirements

- **Evidence:** current Daily P&L has per-symbol/component explainability; Holdings already exposes per-symbol P&L; TWR/XIRR expose reliability/unavailable semantics; DataReliabilityBanner exposes persistent anomalies/read/stale states; historical lot/trade attribution lacks a production `lot_ledger` producer.
- **Alternatives:** continue adding incremental explainability UI; create new backend projection; stop and advance to higher-value strategy analytics.
- **Decision:** no Phase 3.2. Mark Phase 3 `OPTIMIZED FOR CURRENT REQUIREMENTS` and move to Phase 4 strategy analytics.
- **Trade-off:** richer historical attribution remains deferred until authoritative producer semantics exist.
- **Status:** LOCKED / CONVERGED.
- **Reopen Condition:** new user evidence exposes a material explainability gap or a reviewed authoritative lot/trade producer becomes available.

### D-2026-08-15-02 — Daily P&L explainability consumes reconciled day_ledger; browser does not become accounting authority

- **Evidence:** Python already publishes per-group per-symbol `day_ledger` with price/FX/dividend/execution/fee-tax/total components and performs canonical reconciliation before publication.
- **Alternatives:** new Python presentation projection; Worker/D1 explainability endpoint; browser recomputation from holdings/history; consume existing reconciled ledger.
- **Decision:** consume existing exact-group ledger through a pure fail-closed frontend validation/presentation adapter.
- **Trade-off:** old/insufficient snapshots without valid ledger evidence simply do not expose detailed attribution; this is preferred to guessed or synthesized explanations.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** authoritative day-ledger semantics materially change or a reviewed versioned producer supersedes the current fields.

### D-2026-08-15-01 — Journal note reuses the established mutation lifecycle

- **Evidence:** D1/Worker already persist `note`; financial snapshot source identity excludes note; existing create/update lifecycle already owns idempotency, ambiguity recovery, dirty generation and recalculation.
- **Alternatives:** dedicated note-only endpoint; caller flag to skip recalculation; reuse established mutation path.
- **Decision:** reuse established record mutation lifecycle for Batch 2.1. Do not create a second write authority or recalculation bypass solely to optimize compute.
- **Trade-off:** note-only edits may still trigger the existing recalculation lifecycle, but current correctness, concurrency and recovery semantics remain unified.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** measured usage proves material UX/compute cost and a server-authoritative note-only path can preserve concurrent financial fields and data integrity.

### D-2026-08-14-05 — Loaded snapshot is not monetary authorization

- **Original assumption challenged:** a successful `/api/portfolio` read sets `snapshotFreshness='loaded'`.
- **New evidence:** Phase 3 cryptographic source/benchmark verification runs after that read transition.
- **Decision:** foreign-currency monetary presentation may use snapshot FX only after Phase 3 has verified the exact snapshot object and exact record objects assessed together.
- **Implementation:** memory-only `snapshotVerification`; no persistent key, retry, queue, backend state, or new financial authority.
- **Trade-off:** foreign TWD value may briefly remain unavailable while integrity verification completes; false confidence is rejected.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** snapshot integrity lifecycle or record object identity model materially changes.

### D-2026-08-14-04 — Reuse published per-date FX; reject redundant Python presentation projection

- **Original candidate:** add a versioned Python `record_id → currency/fx/TWD` presentation projection.
- **New evidence:** root snapshot history already carries the exact per-date `_raw_fx_rates` produced by Python and is already uploaded in full.
- **Alternatives:** new Python projection; browser FX derivation; reuse current history evidence.
- **Decision:** reuse current authoritative exact-date snapshot FX after Phase 3 proof; do not add a duplicate Python/Worker/schema contract.
- **Migration Risk avoided:** no model/version/schema/deployment expansion.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** `_raw_fx_rates` ceases to be published, becomes explicitly internal-only/removed, or a reviewed public presentation contract supersedes it.

### D-2026-08-14-03 — Native currency is shared presentation contract; authoritative FX remains Python-owned

- **Decision:** frontend may share symbol→native-currency/presentation semantics, but must not copy Python’s multi-currency FX derivation or fabricate values.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** supported market/currency contract materially changes.

### D-2026-08-14-02 — Keep fail-closed snapshot integrity semantics

A successful job status alone is not proof that displayed snapshot data matches current records. Freshness requires source/benchmark integrity evidence.

Status: **LOCKED**.

### D-2026-08-14-01 — Fix schema boundary, not stale UI symptom

- **Rejected:** force freshness, hide warning, add blind retry, change Worker API fields, change manifest format.
- **Decision:** normalize the real API record shape at the integrity boundary and keep true mismatches fail-closed.
- **Status:** CLOSED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.

---

## 7. Known Issues / Risks / Technical Debt

### Current product status

- Phase 3 Explainability: **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Phase 4 Strategy Analytics: **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Phase 6 UX Convergence: **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Phase 5 historical/lot-level trading analytics remains blocked from NOW because `lot_ledger` still lacks a reviewed production producer/semantics.

The next step is a **new product-function gap audit**, not another infrastructure or UX-refactor phase. Candidate areas must be compared by real user value and existing evidence, including broker/transaction import automation, journal workflow depth, multi-market dividend workflow, and other daily-use product gaps. The audit must select at most one narrow next Batch; it must not assume any candidate is already approved.

### Current risk

Cross-layer source and presentation contracts can drift if Worker/Python semantics change. Existing source-shape, cross-language, explainability, strategy-overview, common-period, sync-presentation and Toast-presentation regressions materially reduce this risk; future changes must update contracts deliberately rather than weakening tests.

### Known non-blocking documentation/status drift

- `docs/DEPLOYMENT.md` live-state prose can lag remote Actions truth; deployment methodology remains useful but runtime identity must be revalidated from Actions/contracts.
- Issue #97 staging infrastructure remains intentionally deferred behind product functionality.

### Technical Debt / Deferred Candidates

Do not promote without new evidence:

1. generalized UPDATE / DELETE outcome-ambiguity durable intents;
2. calculation polling beyond 20 minutes;
3. broad cross-group dividend pending filtering;
4. broad `portfolio.js` refactor;
5. Worker/D1 changes for closed snapshot incidents;
6. generated/versioned cross-language source-record mapping before a real contract-version change;
7. TypeScript/framework/state-manager migration without a product blocker;
8. staging Issue #97 until product/release risk requires it;
9. new public transaction-presentation snapshot projection while existing verified exact-date FX remains sufficient;
10. note-only mutation / skipped recalculation optimization without measured product or compute evidence;
11. historical/lot-level attribution until `lot_ledger` has a reviewed production producer and semantics;
12. Sharpe/Sortino/MDD/strategy scoring until a separate product and financial-methodology requirement justifies them;
13. common-period XIRR/P&L until an authoritative interval cash-flow/value contract or explicit methodology requirement exists;
14. broad rewrite of store/recovery producer messages when the current shared presentation boundaries are sufficient.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- Phase 3 Explainability is **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Phase 4 Strategy Analytics is **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Phase 6 UX Convergence is **OPTIMIZED FOR CURRENT REQUIREMENTS**.
- Batch 6.1 and 6.2 runtime are **CLOSED / PRODUCTION PAGES VERIFIED**.
- Complete this docs-only Stable Checkpoint and verify exact-main CI/Pages if triggered.
- Do not modify Phase 6 runtime during documentation closure.

**NEXT — Product Function Gap Audit, not automatic implementation**

1. Re-read current end-to-end user journeys after Phase 1–6: manual transaction entry/import, journal use, dividend workflow, holdings/analytics, group strategy workflow, automatic update/recovery, and mobile behavior.
2. Compare candidate gaps by frequency, user time saved, correctness risk, automation leverage, required new backend authority, and migration cost.
3. Explicitly evaluate broker/transaction import automation, deeper journal workflow, and multi-market dividend workflow, but do not privilege them without evidence.
4. Keep Phase 5 historical lot/trade analytics in BACKLOG unless an authoritative producer contract now exists.
5. Converge all findings into NOW / NEXT / BACKLOG / REJECT and select exactly one next Primary Batch only if it has material product value.
6. Prefer using existing authoritative contracts and automation; add backend/schema infrastructure only when the selected feature demonstrably requires it.

**BACKLOG**

- historical/lot attribution after authoritative producer semantics exist;
- Phase 5 trading analytics after lot-ledger semantics are proven;
- common-period XIRR/P&L unless an authoritative interval contract becomes available;
- Sharpe/Sortino/MDD or strategy scoring only after a specific user/product requirement and methodology review;
- note-only mutation / skipped recalculation optimization if real usage demonstrates material value;
- staging/retry/governance candidates above;
- minor Phase 6 wording/visual polish without new user evidence.

**REJECT**

- reopen Phase 6 merely to standardize every internal log/source string;
- direct best/winner ranking using full-history metrics from different group ranges;
- rank common-period TWR as a product “winner” without a separate product requirement;
- nearest-date/as-of/interpolated strategy alignment when exact common dates are unavailable;
- sum overlapping tag-group values as if groups are disjoint portfolios;
- call the first history row a strategy inception date;
- reconstruct common-period XIRR/P&L in browser solely to extend Phase 4;
- create a browser-side strategy score or new financial/risk methodology without review;
- copy/reimplement Python FX or Daily P&L accounting engine in browser;
- synthesize current Daily P&L attribution from holdings/summary when `day_ledger` is missing;
- use another group's ledger as fallback;
- infer historical lot/trade attribution from current-day `day_ledger`;
- add Worker/D1/Python explainability projection for data already published and reconciled;
- browser nearest-date/as-of FX guessing or hard-coded FX fallback;
- redundant Python transaction-presentation projection without new evidence;
- broad frontend refactor / TypeScript / framework migration during product batches;
- staging/retry/governance expansion without product evidence;
- force-clear snapshot stale state because a job succeeded;
- caller-declared “note-only” flags that skip recalculation without server/data proof;
- modify repository merge policy merely to obtain squash history.

---

## 9. Next Actions

1. Merge this Phase-6 Stable Checkpoint documentation PR and verify exact-main CI/Pages if triggered.
2. Re-read remote `main`, open PRs, recent commits, `AI_PROJECT_PLAYBOOK.md`, `README.md`, and this handoff.
3. Run one **Product Function Gap Audit** before creating another runtime branch.
4. Compare daily user workflows and candidate features by actual product benefit, automation leverage, correctness impact and implementation radius.
5. Converge candidates into NOW / NEXT / BACKLOG / REJECT and choose one Primary Goal; Phase 5 remains blocked unless lot-level producer semantics materially change.
6. Open exactly one narrow feature Batch after the audit, with explicit In Scope / Out of Scope / Expansion Trigger and Recovery Point.
7. Any next R2+ runtime Batch again requires focused diff, exact-head CI, frozen review, rollback and post-main verification.
8. If no candidate has material value, record `OPTIMIZED FOR CURRENT REQUIREMENTS` for the current product scope and stop rather than doing technical refactors for their own sake.