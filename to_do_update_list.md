# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose. Historical plans are provenance, not instructions to restart closed work.

Last updated: **2026-08-14 Asia/Taipei**  
Current line: **Phase 1 / Batch 1.1 CLOSED / PRODUCTION PAGES VERIFIED — frontend native-currency contract aligned with Python; next primary batch is 1.2 authoritative transaction valuation audit**

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
| Recovery-copy UX convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #241 `d80f10394d5fe7d325d96b1c9802139c22711498`; CI #848 + Pages #1524 |
| Record-create recovery UI completion | CLOSED / PRODUCTION PAGES VERIFIED | PR #242 `268a7b31c1354da67857c910b7dbea7f4d602112`; final PR CI #854, post-main CI #855 + Pages #1525 SUCCESS |
| Phase 5 closure handoff | CLOSED | PR #243 `74351c863bcceb061a10d85ed673f6611d2e1faa`; post-main CI #857 + Pages #1526 SUCCESS |
| Restored-session read recovery copy | CLOSED / PRODUCTION PAGES VERIFIED | PR #244 `f00c5616a1d9eca819e6c7cccda181fe6be322e8`; final PR CI #858, post-main CI #859 + Pages #1527 SUCCESS |
| Three user-reported product defects | CLOSED / PARTIALLY SUPERSEDED | PR #245 `112c9b7b0d93ea49547f3cd005f4a5024f152bd5`; layout + TWR remain closed; stale-snapshot item was reopened by new production evidence and superseded by PR #247 |
| Snapshot freshness API/manifest record contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #247 merged as `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`; final PR CI #871, post-main CI #872 + Pages #1530 SUCCESS; Independent Review Gate PASS |
| Phase 1 / Batch 1.1 frontend native-currency contract | **CLOSED / PRODUCTION PAGES VERIFIED** | PR #249 merged as `4ce9c8fc1b390db77587f50f59a3f3d251b1a107`; final PR CI #878, post-main CI #879 + Pages #1532 SUCCESS; R2 review BLOCKER 0 |

Do not reopen closed phases without new material evidence.

---

## 2. Project Status / Stable State

Current verified runtime merge checkpoint:

`4ce9c8fc1b390db77587f50f59a3f3d251b1a107`

- Phase 1 / Batch 1.1 is merged through PR #249 and deployed through Pages production deployment #1532.
- Exact final PR head `08d9466b37197304a86cca77d94eea874064f99e`; final exact-head CI #878 / run `31813848874`: **SUCCESS**.
- Exact merge-SHA post-main CI #879 / run `31813958877`: **SUCCESS**.
- Exact merge-SHA Pages #1532 / run `31813957653`: **SUCCESS**.
- Production Worker remains release `4.08`, API `2.61`, schema `3`; Batch 1.1 changed no Worker source, D1 schema/migration/data, Python calculation methodology, authentication, calculation-job lifecycle, or deployment workflow. No Worker deployment was required.
- Recovery point was branch `feat/phase1-native-currency-contract`, created from `main@1bf0a492d843859151e787c3bc59370ad02f0aad`.
- Rollback is a normal revert of PR #249 / merge `4ce9c8fc...` or previous Pages deployment; no schema/data rollback is required.
- Squash merge was attempted once against exact head `08d9466b...` and GitHub returned HTTP 405 `Squash merges are not allowed on this repository`; repository policy was not modified, and a normal exact-head merge was used.

Stable product invariants remain:

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

New Phase-1 presentation invariant:

```text
symbol
→ shared frontend native-currency detection aligned with Python CurrencyDetector
→ native amount/unit-price presentation
→ TWD direct for TWD
→ legacy scalar history FX only for actual USD
→ KRW/HKD/CNY/JPY/GBp/EUR TWD presentation fails closed until authoritative valuation exists
```

### User-facing verification boundary

Repository CI, production build, and Pages deployment are verified. Batch 1.1 deliberately performs no real-user ledger mutation solely for smoke testing. Native-currency mapping and fail-closed missing-amount behavior are locked by executable frontend regressions. Batch 1.2 must not infer authoritative non-USD historical TWD values in the browser; it must first audit existing snapshot/ledger data for a reusable authoritative projection.

### 2A. Closed Batch — Phase 1 / Batch 1.1 Frontend Native Currency Contract

**Primary Goal — SATISFIED / PRODUCTION PAGES VERIFIED**

Transaction entry and transaction-history presentation now use the same supported native-currency market suffix contract as the Python engine instead of the old frontend-only `TW/TWO => TWD; everything else => USD` assumption.

**Scope completed**

Runtime:

- `src/services/instrumentCurrency.js`
- `src/components/TradeForm.vue`
- `src/components/RecordList.vue`

Regression:

- `tests/frontend_instrument_currency.test.mjs`
- `tests/frontend_residual_correctness.test.mjs`

Explicitly unchanged:

- Worker API/auth/record mutation contract
- D1 schema/migrations/data
- Python financial calculations / FX methodology
- snapshot accounting formulas
- calculation jobs / recovery lifecycle
- Journal / strategy / analytics features
- broad frontend architecture

**Behavior now locked**

- `.TW/.TWO` → TWD
- `.KS/.KQ` → KRW
- `.HK/.HKG` → HKD
- `.SS/.SZ` → CNY
- `.T` → JPY
- `.L` → GBp
- `.PA/.DE` → EUR
- unknown/unmapped suffix → existing Python-compatible USD behavior
- RecordList no longer invents a `32.0` TWD/USD fallback.
- The scalar `history.fx_rate` compatibility path is retained only for actual USD/TWD records.
- Non-USD historical TWD transaction presentation is explicit `TWD 尚無可靠換算` instead of a fabricated USD conversion.
- Missing/null/empty native amounts fail closed as `—` rather than JavaScript-coercing to zero.

**Verification / Debug chronology**

- Initial code-bearing PR CI #875: Worker and the new native-currency regressions passed; Frontend job failed 1/325 because an existing residual source-contract test still required literal `.TW`, `TWD`, and `USD` strings inside `TradeForm.vue`.
- Root cause: the regression was coupled to the superseded inline implementation shape. The product contract had intentionally moved to `instrumentCurrency.js`.
- Fix: update only that existing test to verify shared-service delegation; do not reintroduce hardcoded currency literals in the component and do not weaken the executable mapping tests.
- CI #876: full Frontend/Worker/Python SUCCESS after root-cause test correction.
- R2 review found one closely related prevention issue: generic `Number(null) === 0` coercion in the new formatter. It was fixed to fail closed for null/undefined/blank/boolean/non-finite input and covered by regression.
- Final exact-head CI #878 / run `31813848874`: **SUCCESS**.
- Independent adversarial review: **PASS** — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1.
- Post-main CI #879 / run `31813958877`: **SUCCESS**.
- Pages #1532 / run `31813957653`: **SUCCESS**.

**Backlog from review**

- Batch 1.2 authoritative transaction valuation: determine whether existing snapshot `lot_ledger`, `day_ledger`, history, or another current projection can provide record-linked native/TWD presentation. Add an additive presentation projection only if existing authoritative data is insufficient. Do not copy the Python multi-currency FX engine into the browser.

---

## 3. Closed Batch — PR #247 Snapshot Integrity Record Contract

### Primary Goal — SATISFIED BY CODE/DEPLOYMENT EVIDENCE

Every legal transaction set returned by the real Worker `/api/records` contract is now canonicalized through the same API→calculation field boundary used by Python before comparison with `calculation_manifest`. A matching source/benchmark can converge to verified/non-stale state; true mismatches and malformed/unknown contracts remain fail-closed.

### Scope completed

Runtime:

- `src/services/snapshotIntegrity.js`

Regression:

- `tests/frontend_snapshot_integrity.test.mjs`
- `tests/frontend_snapshot_self_healing.test.mjs`
- `tests/frontend_user_reported_product_defects.test.mjs`

Handoff:

- `to_do_update_list.md`

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

**Impact Analysis**

- Could mislabel KRW/HKD/CNY/JPY/GBp/EUR order-entry units as USD.
- Could display false TWD transaction totals by multiplying a non-USD native amount by USD/TWD.
- No evidence of D1 corruption or incorrect Python portfolio accounting; this was a frontend presentation/entry-unit correctness gap.

**Permanent Fix**

- Added shared frontend native-currency detection aligned with Python suffix rules.
- TradeForm derives label/affix from the shared contract.
- RecordList always displays native amount and unit price.
- USD scalar history FX is used only for actual USD records; unsupported non-USD TWD transaction valuation fails closed.
- Removed the `32.0` fallback.
- Added missing-value fail-closed formatting and executable contract regressions.

**Prevention**

- Frontend mapping tests assert all currently supported Python suffix groups.
- TradeForm residual contract now asserts delegation rather than inline implementation literals.
- RecordList regression forbids return of the old `isTaiwanStock`, `calculateTotalAmountUSD`, and `32.0` patterns.

### 2026-08-14 — Snapshot remains stale after successful calculation

**Symptom**  
User observed both `快照待重算` and `持倉與績效快照待重新計算` after a calculation job completed successfully.

**Reproduce / Evidence**

- Production calculation run #3276 succeeded end-to-end, including snapshot upload and terminal `succeeded` callback.
- Worker `/api/records` returns the persisted API/D1 field contract: `txn_date`, `symbol`, `txn_type`, `qty`, `price`, `fee`, `tax`, `tag`.
- Browser pagination passes those record objects into Pinia without converting field names.
- Python `prepare_transactions()` explicitly converts that API schema to `Date`, `Symbol`, `Type`, `Qty`, `Price`, `Commission`, `Tax`, `Tag` before building deterministic source-record identity.
- Pre-PR-247 `snapshotIntegrity.js` skipped that boundary and read browser records directly as the Python field names.

**Failure Point**  
`buildSourceRecordsIdentity(records)` could not construct a valid canonical projection from real Worker records; `assessSnapshotIntegrity()` therefore classified legitimate production records as `UNVERIFIABLE_RECORDS`. Snapshot self-healing correctly treated that as fail-closed and called `markSnapshotStale()`.

**Contributing Factor**  
PR #245 fixed a separate real post-terminal/full-read scheduling race, but its regression fixtures used calculation-schema records (`Date`, `Symbol`, etc.) rather than the actual Worker API record shape. The lifecycle test therefore passed while the schema-boundary defect remained invisible.

**Root Cause**  
The browser integrity layer independently implemented Python manifest canonicalization but omitted the API-record → calculation-record normalization boundary used by the authoritative Python engine.

**Systemic Cause**  
The same source-record contract existed across Worker/API, Python preprocessing, frontend integrity logic, and tests without a regression that fed the real Worker API shape through the browser canonicalizer and compared it with the established Python canonical SHA fixture.

**Impact Analysis**

- No evidence of D1 data corruption or incorrect Python financial calculation.
- A correctly published snapshot could be falsely marked stale in the browser.
- Re-triggering calculation could not permanently solve the defect because the same frontend integrity check rejected the next correct snapshot again.
- The warning was truthful relative to frontend verification state, but that verification state was wrong.

**Permanent Fix**

- Added an explicit internal schema-boundary adapter in `snapshotIntegrity.js` matching Python `prepare_transactions()` field normalization.
- Preserved calculation-schema input for the existing pure manifest projection contract/tests.
- Mixed API/calculation schema objects are rejected as ambiguous and fail-closed.
- Optional API `fee`, `tax`, and `tag` use Python-compatible defaults.
- Regression coverage now uses real Worker API-shaped records across identity, self-healing, and the user-reported terminal-success lifecycle.
- No stale state is force-cleared; successful job status alone never proves freshness.

**Prevention**

The regression suite now requires:

1. Worker API shape and calculation shape produce the same source projection;
2. both produce the exact pre-existing Python canonical SHA fixture;
3. symbol/type trim + uppercase normalization remains stable;
4. non-manifest fields such as `user_id` / `note` do not affect identity;
5. matching API records classify as `FRESH`;
6. true record edits remain `STALE_SOURCE`;
7. malformed or mixed schemas remain fail-closed;
8. fresh proof does not invoke self-healing repair.

---

## 5. Change Log / Verification

### Phase 1 / Batch 1.1 — PR #249

Implementation branch: `feat/phase1-native-currency-contract`  
Base/recovery point: `1bf0a492d843859151e787c3bc59370ad02f0aad`  
Final PR head: `08d9466b37197304a86cca77d94eea874064f99e`  
Main merge: `4ce9c8fc1b390db77587f50f59a3f3d251b1a107`

Verification:

- dedicated native-currency mapping/presentation regressions: PASS;
- initial CI #875 exposed one stale residual source-shape test only; new feature regressions passed;
- CI #876 after root-cause test correction: SUCCESS;
- final review hardening: missing native amounts fail closed instead of coercing to zero;
- final exact-head PR CI #878 / `31813848874`: **SUCCESS**;
- Frontend contracts + production build: PASS;
- Python tests + branch coverage: PASS;
- Worker security/deployment tests + Recovery Evidence Gate + local D1 baseline: PASS;
- exact diff: 5 expected files only, `behind_by=0` before merge;
- independent adversarial review: PASS — BLOCKER 0 / FOLLOW-UP 0 / BACKLOG 1;
- post-main exact merge-SHA CI #879 / `31813958877`: **SUCCESS**;
- Pages production deployment #1532 / `31813957653`: **SUCCESS**;
- Worker deploy: NOT REQUIRED / NOT RUN;
- D1 migration: NOT REQUIRED / NOT RUN;
- real-user ledger mutation smoke: NOT REQUIRED / NOT RUN.

Rollback:

- revert PR #249 / merge `4ce9c8fc...` or restore previous Pages deployment;
- no Worker/schema/data rollback required.

### PR #247

Implementation branch: `fix/snapshot-integrity-record-contract`  
Final PR head: `09486cfb4a9422a070d17ae8a2a8943c7f41159f`  
Main merge: `cc51ebc2b0f020e23c2efbf2cdcb7c2102c7d0a9`

Verification:

- targeted canonical SHA/integrity regression: PASS;
- code-head CI #870 / `31800319339`: SUCCESS;
- final exact-head PR CI #871 / `31800465725`: **SUCCESS**;
- Python tests + branch coverage: PASS;
- frontend contracts + production build: PASS;
- Worker security/deployment tests: PASS;
- Worker config / Recovery Evidence Gate / local D1 schema: PASS;
- independent frozen-diff review on exact head: **PASS**;
  - BLOCKER: 0;
  - FOLLOW-UP: 0;
  - BACKLOG: 1 — if the source-record/API/manifest contract materially versions in the future, consider generated/versioned cross-language mapping instead of duplicated mapping;
- post-main exact merge-SHA CI #872 / `31801023106`: **SUCCESS**;
- Pages production deployment #1530 / `31801022403`: **SUCCESS**.

### Merge-method note

For PR #249, the intended squash merge was attempted once against exact PR head `08d9466b...`; GitHub returned HTTP 405 `Squash merges are not allowed on this repository`. For PR #247 the same repository policy had previously returned HTTP 405. Repository merge policy was **not** modified or bypassed. Normal exact-head merges were used consistently.

### Deployment

- Frontend Pages: **DEPLOYED / VERIFIED** through #1532 for current runtime merge `4ce9c8fc...`.
- Production Worker: **NOT REQUIRED / NOT DEPLOYED** for Batch 1.1.
- D1 migration: **NOT REQUIRED / NOT RUN** for Batch 1.1.

---

## 6. Decision Log

### D-2026-08-14-03 — Native currency is shared presentation contract; authoritative FX stays outside browser

- **Original problem:** frontend transaction pages had a narrower TW/US currency model than the Python engine.
- **Decision:** share only symbol→native-currency/presentation semantics in frontend; do not copy the Python FX engine or fabricate non-USD historical TWD values.
- **Evidence:** Python already owns multi-currency FX and fail-closed semantics; current `history.fx_rate` is only a legacy scalar USD/TWD reference.
- **Trade-off:** KRW/HKD/CNY/JPY/GBp/EUR records show correct native amounts immediately, while their historical TWD transaction amount remains unavailable until Batch 1.2 supplies authoritative data.
- **Status:** LOCKED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** backend publishes a reviewed authoritative record-linked valuation contract, or supported market/currency rules materially change.

### D-2026-08-14-01 — Fix the schema boundary, not the stale UI symptom

- **Alternatives rejected:** force `snapshotFreshness` to fresh; hide warning after `succeeded`; add another calculation retry; change Worker API field names; change Python manifest format.
- **Reason:** those alternatives either conceal unverifiable data or broaden impact without addressing the mismatched contract.
- **Trade-off:** frontend accepts two explicit source input shapes at the canonicalization boundary (real API shape and calculation projection shape) and rejects mixed objects.
- **Status:** CLOSED / IMPLEMENTED / PRODUCTION PAGES VERIFIED.
- **Reopen Condition:** fresh production evidence proves another valid Worker record shape or manifest contract that is not represented by this boundary, or the user reproduces the stale state after loading the deployed frontend bundle.

### D-2026-08-14-02 — Keep fail-closed integrity semantics

A successful job status alone is not proof that the displayed snapshot matches current records. Freshness still requires source SHA/count/max-id and benchmark agreement. Job success must never directly clear the stale warning.

Status: **LOCKED**.

---

## 7. Known Issues / Risks / Technical Debt

### Current product gap

RecordList now refuses to fabricate non-USD historical TWD transaction values, but it also does not yet have an authoritative record-linked TWD valuation for KRW/HKD/CNY/JPY/GBp/EUR. This is the intentional Batch 1.1 fail-closed boundary and the primary input to Batch 1.2.

### Current risk

Cross-layer canonicalization could drift if Worker/Python field contracts materially change in the future. The API-shaped SHA parity tests reduce this risk; versioning discipline remains required.

### Known non-blocking documentation/status drift

- `docs/DEPLOYMENT.md` historical/current-live text can lag remote deployment truth; deployment methodology remains authoritative but live identity must be revalidated from Actions/contracts.
- Issue #97 contains historical staging status wording and is not a blocker for current product functionality.

### Technical Debt / Deferred Candidates

Do not promote without new evidence:

1. generalized UPDATE / DELETE outcome-ambiguity durable intents;
2. calculation polling beyond 20 minutes;
3. broad cross-group dividend pending filtering;
4. broad `portfolio.js` refactor;
5. Worker/D1 changes for the closed snapshot incident;
6. generated/versioned cross-language source-record mapping contract before an actual contract-version change;
7. TypeScript/framework/state-manager migration without a product blocker;
8. staging Issue #97 until a product/release risk actually requires it.

---

## 8. NOW / NEXT / BACKLOG / REJECT

**NOW**

- Phase 1 / Batch 1.1 is CLOSED / PRODUCTION PAGES VERIFIED.
- Establish this documentation merge as the Stable Checkpoint, then open exactly one new Primary Active Batch: **Phase 1 / Batch 1.2 — Authoritative Transaction Valuation Audit**.

**NEXT**

- Audit existing `PortfolioSnapshot`, group data, `lot_ledger`, `day_ledger`, and history contracts for record-linked native/TWD transaction presentation.
- Prefer reusing existing authoritative calculation output.
- Only if current authoritative data cannot support the product requirement, propose a minimal additive presentation projection with explicit version/ownership; do not add schema or Worker/Python changes before the audit proves they are necessary.

**BACKLOG**

- Phase 2 Trading Journal note UX after Phase 1 closes;
- Phase 3 portfolio explainability using existing day ledger;
- Phase 4 strategy analytics using group snapshots;
- Phase 5 trading analytics after lot-ledger semantics are proven;
- Phase 6 UX convergence;
- unrelated deferred technical candidates above.

**REJECT**

- copy/reimplement the Python multi-currency FX engine in browser;
- hard-coded FX fallback or treating every non-TWD market as USD;
- broad frontend refactor/TypeScript/framework migration during Phase 1;
- staging/retry/governance expansion without product evidence;
- force-clearing stale state because the job says `succeeded`;
- adding retries to mask integrity verification failure.

---

## 9. Next Actions

1. Merge this docs-only Stable Checkpoint and verify exact-main CI/Pages if triggered.
2. Re-read remote `main`, current PRs, and this handoff before opening Batch 1.2.
3. Batch 1.2 starts as an **audit**, not a schema change: map current transaction record identity to `lot_ledger`, `day_ledger`, history, and snapshot fields.
4. Decide NOW/NEXT/BACKLOG/REJECT from evidence:
   - reuse existing projection if sufficient;
   - add the smallest authoritative presentation projection only if necessary;
   - reject browser-side guessed FX.
5. Keep Journal/Insights/Strategy work closed until Phase 1 reaches a new Stable Checkpoint.