# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Phase 3 / Batch 3.1 Daily P&L Explainability CLOSED / PRODUCTION PAGES VERIFIED — next action is a Phase 3 Convergence Review; open Batch 3.2 only if another existing-data explainability slice has material user value, otherwise mark Phase 3 OPTIMIZED FOR CURRENT REQUIREMENTS and advance to Phase 4 strategy analytics audit**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback/recovery, independent/frozen review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.
7. Do not create infrastructure or retry machinery for theoretical edge cases without production/user evidence.
8. Explainability may expose authoritative data, but must not create a second accounting engine in the browser.

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
| **Phase 3 / Batch 3.1 Daily P&L Explainability** | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #256 final head `fc57b221a9b2c0e3adf6c929c1db6caf5e6c9c22`; exact-head CI #904 SUCCESS; frozen review BLOCKER 0; merge `2f46516e2eee7f9ec653587bef8987260dfffb65`; post-main CI #905 + Pages #1538 SUCCESS |

Do not reopen closed phases/batches without new material evidence.

---

## 2. Project Status / Stable State

Current verified runtime merge checkpoint:

`2f46516e2eee7f9ec653587bef8987260dfffb65`

- **Phase 3 / Batch 3.1 is CLOSED / PRODUCTION PAGES VERIFIED.**
- The overview Daily P&L card now has an explicit, touch/keyboard-accessible `查看損益來源` control when trustworthy explainability evidence exists.
- The detail view exposes the currently selected group's already-published per-symbol `day_ledger` contribution and five existing calculation components: price, FX, dividend, execution, and fee/tax.
- Frontend does **not** recalculate portfolio accounting. It validates published component/row/summary consistency and then only sorts/labels the existing values.
- Missing ledger, missing current group, malformed/non-finite row, row-component mismatch, summary mismatch, or duplicate-symbol evidence fails closed and suppresses the explanation control rather than guessing.
- Group selection is exact. When a `groups` object exists, the selector does not fall through to another group or an unrelated root ledger.
- UI explicitly states that displayed values are rounded to integer TWD while reconciliation uses raw unrounded values, preventing false on-screen rounding expectations.
- No Worker/API/auth change, D1/schema/migration/data change, Python financial-methodology change, retry/recovery change, or store orchestration refactor was required.
- PR #256 final exact head `fc57b221a9b2c0e3adf6c929c1db6caf5e6c9c22`.
- Final exact-head CI #904 / run `31826358947`: **SUCCESS**.
- Frozen-diff R2 review: **PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1**.
- Runtime merge: `2f46516e2eee7f9ec653587bef8987260dfffb65`.
- Exact merge-SHA post-main CI #905 / run `31826520662`: **SUCCESS**.
- Exact merge-SHA Pages #1538 / run `31826519726`: **SUCCESS**.
- Final compare before merge: `behind_by=0`; runtime scope remained exactly four focused frontend/test files.
- Production Worker remains release `4.08`, API `2.61`, schema `3`; Worker deploy and D1 migration were not required.
- Rollback is a normal revert of PR #256 / merge `2f46516e...` or restore the previous Pages deployment.

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

Explainability authority boundary now remains:

```text
Python canonical calculation / reconciliation
→ published group day_ledger + summary
→ exact current-group selection
→ frontend fail-closed structural/reconciliation validation
→ presentation-only sorting / labels / responsive UI
→ no browser accounting recomputation
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

Repository CI, production build, and Pages deployment are verified. No real-user ledger mutation was created solely for smoke testing. Phase 3.1 is presentation-only over authoritative published snapshot data: Python remains accounting authority; Worker/D1 remain persistence/API authority; frontend is only a fail-closed evidence consumer.

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

Repository policy rejects squash merges (HTTP 405 observed on earlier exact-head attempts). Repository policy was never modified or bypassed. Phase 1, Phase 2.1 and Phase 3.1 PRs used normal exact-head merges once this policy was established.

### Deployment

- Frontend Pages: **DEPLOYED / VERIFIED through #1538** for runtime merge `2f46516e...`.
- Production Worker: **NOT REQUIRED / NOT DEPLOYED** for Phase 3.1.
- D1 migration: **NOT REQUIRED / NOT RUN** for Phase 3.1.

---

## 6. Decision Log

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

Phase 3 / Batch 3.1 Daily P&L Explainability is closed and production Pages verified. The product can now explain current Daily P&L per symbol and published component without adding a second accounting engine.

Before opening another explainability implementation batch, perform a **Phase 3 Convergence Review**:

- identify remaining user questions that current authoritative snapshot fields can answer truthfully;
- reject questions that require historical lot/trade attribution until an authoritative producer exists;
- compare marginal UX value against moving to Phase 4 strategy analytics;
- if no remaining explainability candidate has material value, mark **Phase 3 OPTIMIZED FOR CURRENT REQUIREMENTS** and stop.

### Current risk

Cross-layer source and presentation contracts can drift if Worker/Python semantics change. Existing source-shape, cross-language and explainability regressions materially reduce this risk; future changes must update contracts deliberately rather than weakening tests.

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
11. historical/lot-level attribution until `lot_ledger` has a reviewed production producer and semantics.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- Phase 3 / Batch 3.1 runtime is **CLOSED / PRODUCTION PAGES VERIFIED**.
- Complete this docs-only Stable Checkpoint and verify exact-main CI/Pages if triggered.
- Do not modify Batch 3.1 runtime during documentation closure.

**NEXT — Phase 3 Convergence Review, not automatic implementation**

1. Re-read current published snapshot/group/day-ledger fields and the current UI after Batch 3.1.
2. List remaining high-value explainability questions users actually need answered.
3. Classify each candidate by whether existing authoritative evidence is sufficient.
4. Reject or backlog historical/lot questions without a production producer.
5. Select **at most one** Batch 3.2 only if Benefit materially exceeds added UX/maintenance surface.
6. If no such candidate exists, record `Phase 3 OPTIMIZED FOR CURRENT REQUIREMENTS` and advance to a Phase 4 strategy analytics audit.

**BACKLOG**

- historical/lot attribution after authoritative producer semantics exist;
- Phase 4 strategy analytics using group snapshots;
- Phase 5 trading analytics after lot-ledger semantics are proven;
- Phase 6 UX convergence;
- note-only mutation / skipped recalculation optimization if real usage demonstrates material value;
- unrelated technical candidates above.

**REJECT**

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

1. Merge this Phase-3.1 Stable Checkpoint documentation PR and verify exact-main CI/Pages if triggered.
2. Re-read remote `main`, open PRs, recent commits, `AI_PROJECT_PLAYBOOK.md`, `README.md`, and this handoff.
3. Run one **Phase 3 Convergence Review** before creating any new runtime branch.
4. Converge remaining explainability candidates into NOW / NEXT / BACKLOG / REJECT.
5. If a material existing-data explainability gap remains, open exactly one narrowly scoped Batch 3.2 with explicit provenance and unavailable states.
6. Otherwise mark `Phase 3 OPTIMIZED FOR CURRENT REQUIREMENTS` and move to a Phase 4 strategy analytics audit rather than continuing low-value explainability work.
7. Any next R2+ runtime Batch again requires recovery point, focused diff, exact-head CI, frozen review, rollback and post-main verification.
