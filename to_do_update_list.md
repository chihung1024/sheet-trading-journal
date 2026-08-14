# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 1 CLOSED / PRODUCTION PAGES VERIFIED — Batch 1.1 native-currency UX + Batch 1.2 authoritative transaction-date FX complete; next primary phase is Phase 2 / Batch 2.1 Trading Journal note UX**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Fix generic root causes; parallel investigation must converge.
3. Financial/data correctness is fail-closed.
4. Keep one primary active batch.
5. R2+ work requires exact-head CI, rollback/recovery, independent review and permanent handoff.
6. Prefer invisible deterministic automation; **AI 管流程，不管帳**.
7. Do not create infrastructure or retry machinery for theoretical edge cases without production/user evidence.

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
| Recovery-copy UX convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #241 `d80f10394d5fe7d0b928d9120`; CI #848 + Pages #1524 |
| Record-create recovery UI completion | CLOSED / PRODUCTION PAGES VERIFIED | PR #242 `268a7b31c1354da67857c910b7dbea7f4d602112`; final PR CI #854, post-main CI #855 + Pages #1525 SUCCESS |
| Phase 5 closure handoff | CLOSED | PR #243 `74351c863bcceb061a10d85ed673f6611d2e1faa`; post-main CI #857 + Pages #1526 SUCCESS |
| Restored-session read recovery copy | CLOSED / PRODUCTION PAGES VERIFIED | PR #244 `f00c5616a1d9eca819e6c7cccda181fe6be322e8`; final PR CI #858, post-main CI #859 + Pages #1527 SUCCESS |
| Three user-reported product defects | CLOSED / PARTIALLY SUPERSEDED | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; layout + TWR remain closed; stale-snapshot item was reopened by new production evidence and superseded by PR #247 |
| Snapshot freshness API/manifest record contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #247 merged as `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`; final PR CI #871, post-main CI #872 + Pages #1530 SUCCESS; Independent Review Gate PASS |
| Phase 1 / Batch 1.1 frontend native-currency contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #249 merged as `4ce9c8fc1b390db77587f50f59a3f3d251b1a107`; final PR CI #878, post-main CI #879 + Pages #1532 SUCCESS; R2 review BLOCKER 0 |
| Phase 1 / Batch 1.2 authoritative transaction valuation | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #251 merged as `92f78af6c77506ea310a046c9f96ee6130fd9c24`; final PR CI #891, post-main CI #892 + Pages #1534 SUCCESS; frozen-diff R2 review BLOCKER 0 |

Do not reopen closed phases without new material evidence.

---

## 2. Project Status / Stable State

Current verified runtime merge checkpoint:

`92f78af6c77506ea310a046c9f96ee6130fd9c24`

- **Phase 1 is CLOSED / PRODUCTION PAGES VERIFIED.**
- Batch 1.1 closed the frontend native-currency contract gap.
- Batch 1.2 closed the historical transaction TWD valuation gap without adding Python, Worker, D1, schema, or manifest-methodology changes.
- PR #251 final exact head `7bf436849e985eaa51263f22fd75d6973d0b0833`; final exact-head CI #891 / run `31816830443`: **SUCCESS**.
- Exact merge-SHA post-main CI #892 / run `31817053580`: **SUCCESS**.
- Exact merge-SHA Pages #1534 / run `31817052263`: **SUCCESS**.
- Production Worker remains release `4.08`, API `2.61`, schema `3`; no Worker deployment or D1 migration was required for Phase 1.
- Batch 1.2 recovery point was branch `feat/phase1-authoritative-transaction-valuation`, created from stable `main@0ae02373e550206bc3af7604f72521ce89b9fe88`.
- Rollback is a normal revert of PR #251 / merge `92f78af6...` or previous Pages deployment. `snapshotVerification` is memory-only and has no persisted rollback state.
- Repository policy does not allow squash merge. PR #251 therefore used the already-established normal exact-head merge path without changing repository policy.

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

Phase-1 presentation invariant is now:

```text
symbol
→ shared frontend native-currency detection aligned with Python CurrencyDetector
→ native transaction settlement semantics aligned with current PortfolioCalculator
→ TWD base-currency value directly for TWD
→ foreign TWD value only after Phase 3 verifies the exact snapshot + exact record objects
→ exact transaction-date history._raw_fx_rates[currency]
→ legacy exact-date scalar history.fx_rate only for USD-compatible old snapshots
→ no nearest-date/as-of guessing in browser
→ no hard-coded FX fallback
→ missing/unverified evidence fails closed
```

### User-facing verification boundary

Repository CI, production build, and Pages deployment are verified. No real-user ledger mutation was created solely for smoke testing. Phase 1 does not move financial/accounting authority into the browser: Python still produces the market/FX context and financial snapshots; frontend code only consumes already-published exact-date evidence after existing Phase 3 source verification authorizes the corresponding snapshot/record objects.

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
- fee/tax signs are preserved exactly; browser does not add an `abs()` normalization that production does not have.
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
- **R2 BLOCKER 1:** first helper version applied `abs()` to fee/tax. Worker accepts any finite values, `prepare_transactions()` preserves sign, and current calculator uses those signs. Helper + regressions were corrected to mirror production exactly.
- **R2 BLOCKER 2:** `snapshotFreshness='loaded'` occurs before Phase 3 cryptographic integrity verification. A memory-only proof bound to the exact assessed snapshot + records was added; foreign monetary FX now requires that actual proof.
- Oversell review: production runner already executes split-adjusted transaction-prefix integrity validation before `PortfolioCalculator`; a published snapshot cannot depend on partial oversell clamp to hide invalid source data.
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

### 2026-08-14 — Historical transaction TWD presentation did not consume already-published authoritative FX

**Symptom / Risk**  
After Batch 1.1, non-USD records correctly stopped using the USD/TWD scalar but remained `TWD 尚無可靠換算`, even though the Python snapshot already carried exact-date currency-aware FX. The old RecordList path also applied one total formula to all transaction types and had historically searched backward through FX dates.

**Evidence**

- Python history already stores exact date `_raw_fx_rates` from the calculator’s effective FX context.
- API client uploads the full snapshot model dump, so no new backend field was required.
- `day_ledger` cannot map old records; `lot_ledger` currently has no producer.
- current calculator BUY/SELL/DIV cash-flow formulas differ by transaction type.
- Worker validates fee/tax as finite but does not force non-negative; `prepare_transactions()` preserves their sign.
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
- Mirror current calculator BUY/SELL/DIV cash-flow rules exactly, including fee/tax sign behavior.
- Add memory-only `snapshotVerification` rather than a second persistent freshness state or new recovery controller.
- Remove RecordList backward-date FX lookup.

**Prevention**

- executable KRW/exact-date/missing-date/legacy-USD tests;
- negative fee/tax parity regression against actual calculator source shape;
- replacement snapshot/record object invalidation tests;
- source-contract tests forbid browser nearest-date logic, `32.0`, and `abs()` normalization drift;
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

### Phase 1 / Batch 1.2 — PR #251

Implementation branch: `feat/phase1-authoritative-transaction-valuation`  
Base/recovery point: `0ae02373e550206bc3af7604f72521ce89b9fe88`  
Final PR head: `7bf436849e985eaa51263f22fd75d6973d0b0833`  
Main merge: `92f78af6c77506ea310a046c9f96ee6130fd9c24`

Verification:

- audit rejected redundant Python projection after proving root snapshot already carries authoritative per-date currency-aware FX;
- CI #882 exposed one stale Batch-1.1 implementation-shape test while Worker/Python passed;
- stale test corrected at the contract boundary, not by restoring old runtime logic;
- R2 BLOCKER 1 fee/tax sign parity fixed;
- R2 BLOCKER 2 loaded-vs-verified monetary authorization fixed;
- production prefix-integrity preflight reviewed for SELL/oversell boundary: PASS;
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

Repository policy rejects squash merges (HTTP 405 observed on earlier exact-head attempts). Repository policy was never modified or bypassed. Phase 1 PRs used normal exact-head merges once this policy was established.

### Deployment

- Frontend Pages: **DEPLOYED / VERIFIED through #1534** for runtime merge `92f78af6...`.
- Production Worker: **NOT REQUIRED / NOT DEPLOYED** for Phase 1.
- D1 migration: **NOT REQUIRED / NOT RUN** for Phase 1.

---

## 6. Decision Log

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

### Current product gap

Phase 1 multi-market transaction presentation is closed. The next high-value product gap is that the product is named a Trading Journal but the normal frontend UX still does not expose the already-stored `note` field as a first-class journal function.

Known repository evidence to re-audit before Phase 2 implementation:

- Worker/D1 record contract already stores and returns `note`;
- TradeForm currently has no note input;
- RecordList search currently centers on symbol/filter controls rather than journal text;
- financial snapshot source identity intentionally does not use `note`.

Do **not** assume note-only edits can skip recalculation until the mutation path is audited. Current generic update flow marks snapshots stale and schedules recalculation; a safe note-only path must not create a hidden stale/concurrency bug merely to save compute.

### Current risk

Cross-layer source and presentation contracts can drift if Worker/Python semantics change. Existing source-shape and cross-language regressions materially reduce this risk; future changes must update contracts deliberately rather than weakening tests.

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
9. new public transaction-presentation snapshot projection while existing verified exact-date FX remains sufficient.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- Phase 1 is **CLOSED / PRODUCTION PAGES VERIFIED**.
- Merge this docs-only Stable Checkpoint and verify exact-main CI/Pages if triggered.
- Then open exactly one Primary Active Batch: **Phase 2 / Batch 2.1 — Trading Journal Note UX**.

**NEXT — Phase 2 / Batch 2.1 audit before implementation**

1. Reconfirm current Worker/D1 `note` validation/storage/read contract.
2. Trace TradeForm create/edit payload and RecordList display/search data flow.
3. Audit snapshot deterministic identity and automatic recalculation mutation path.
4. Decide the smallest safe note-write architecture:
   - reuse existing record mutation if recalculation is necessary for correctness; or
   - if note-only mutation can be proved financially non-material, implement a safe server-authoritative note-only path that cannot accidentally overwrite concurrent financial fields and does not falsely skip required recalculation.
5. Add note input/edit/display/search only after the write/recalc boundary is proven.

**BACKLOG**

- Phase 3 portfolio explainability using existing day ledger;
- Phase 4 strategy analytics using group snapshots;
- Phase 5 trading analytics after lot-ledger semantics are proven;
- Phase 6 UX convergence;
- unrelated technical candidates above.

**REJECT**

- copy/reimplement Python FX engine in browser;
- browser nearest-date/as-of FX guessing or hard-coded FX fallback;
- redundant Python transaction-presentation projection without new evidence;
- broad frontend refactor / TypeScript / framework migration during product batches;
- staging/retry/governance expansion without product evidence;
- force-clearing snapshot stale state because a job succeeded;
- caller-declared “note-only” flags that can skip recalculation without server/data proof;
- modifying repository merge policy merely to obtain squash history.

---

## 9. Next Actions

1. Merge this docs-only Phase-1 Stable Checkpoint and verify exact-main CI/Pages if triggered.
2. Re-read remote `main`, open PRs, recent commits, `AI_PROJECT_PLAYBOOK.md`, `README.md`, and this handoff.
3. Scope-lock Phase 2 / Batch 2.1 before any runtime change.
4. Start with evidence audit of `note` storage/write/read semantics and financial identity/recalculation boundaries.
5. Choose one narrow implementation path; do not simultaneously open portfolio explainability, strategy analytics, or architecture refactoring.
6. Require exact-head CI + independent review + post-main deployment verification before Phase 2 / Batch 2.1 closure.
