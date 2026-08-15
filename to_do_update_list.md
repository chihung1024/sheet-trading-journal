# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose.
>
> The complete pre-Phase-7 verbose handoff is preserved byte-for-byte at `docs/archive/to_do_update_list_through_phase6.md`. Use that archive only when historical Root Cause / PR chronology is needed; do not restart closed work from archived plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Phase 10 product roadmap remains 10.1 Transaction Entry UX Convergence → 10.2 Dividend Workflow Productization → 10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support. Phase 10.1 is OPTIMIZED FOR CURRENT REQUIREMENTS. Phase 10.2A Dividend Gross/Tax/Net Semantics & Confirmation Clarity is CLOSED / PRODUCTION PAGES VERIFIED. No runtime batch is active. Phase 10.2 remains the current product line; NEXT is a bounded audit of dividend queue prioritization / confirmed-history density before deciding whether a 10.2B runtime batch is justified. Phase 7.2 background Flex sync, Action Center and other new directions remain deferred until the approved Phase 10 roadmap is re-evaluated.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. One Primary Active Batch at a time; every batch must be independently verifiable, committable and rollbackable.
3. Debug by evidence: Reproduce → Evidence → Hypotheses → Trace → Isolate → Root Cause → Impact → Fix → Regression → Prevention.
4. Financial/data correctness is fail-closed. Browser presentation must not create a second accounting or FX engine.
5. R2+ work requires exact-head CI, rollback/recovery, frozen independent review and permanent handoff.
6. Prefer invisible deterministic automation. **AI 管流程，不管帳**; do not request/store broker or login secrets when an existing user-auth boundary can be reused.
7. Technical work belongs in NOW only when it directly supports functionality, correctness, reliability, performance, security or maintainability required by the active product goal.
8. Do not reopen closed phases without new material production/user evidence.

---

## 1. Current authoritative stable state

Current protected-main / production Pages checkpoint:

`7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`

Current production Worker runtime checkpoint:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Current Phase 9.2 production-activation control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

Production verification for Phase 10.2A:

- PR #279 final exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`
- exact-head canonical CI #998 / run `31892772530`: **SUCCESS**
- frozen review `4944126543`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk classification: **R2 Moderate**
- merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`
- post-main CI #999 / run `31892844446`: **SUCCESS**
- Pages #1561 / run `31892844089`: **SUCCESS**
- Phase 10.2A changed only frontend dividend-entry presentation/validation, the shared dividend presentation helper and focused regression coverage
- persisted deterministic automatic-DIV payload semantics remain qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`; existing tax-note token format remains unchanged for cross-version payload-hash compatibility
- no Worker, D1, Python, auth, IBKR, reviewed withholding policy, event identity, schema or financial-methodology change; no production Worker deployment was required
- production Worker therefore remains exact runtime `9b9f09f5079c59750219c73e23002a7ab8d2f33e`, release `4.08`, API `2.61`, schema `3`

Production verification for Phase 10.1B remains:

- PR #277 final exact head `991969064b7fb07ded36c0783de80e81d9da30f5`
- exact-head canonical CI #994 / run `31892093012`: **SUCCESS**
- frozen review `4944098383`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk classification: **R1 Local / Low Risk**
- merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`
- post-main CI #995 / run `31892175857`: **SUCCESS**
- Pages #1559 / run `31892175529`: **SUCCESS**
- Phase 10.1B changed only frontend Symbol suggestion presentation, a pure known-symbol projection and focused regression coverage

Production verification for Phase 10.1A remains:

- PR #275 final exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`
- exact-head canonical CI #990 / run `31891157545`: **SUCCESS**
- frozen review `4944065869`: **PASS / BLOCKER 0**
- merge `0ca4f890c0771755d907d725069612dc62e6e774`
- post-main CI #991 / run `31891228649`: **SUCCESS**
- Pages #1557 / run `31891227897`: **SUCCESS**

Production verification for Phase 9.2 remains:

- runtime PR #272 final exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`; exact-head canonical CI #982: **SUCCESS**
- frozen R2 review `4943920254`: **PASS / BLOCKER 0**
- runtime merge `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- runtime post-main CI #983: **SUCCESS**
- runtime Pages #1554: **SUCCESS**
- Production Identity Evidence #18 / run `31888643879`: **SUCCESS**; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`; exact-head CI #984: **SUCCESS**; frozen review `4943976191`: **PASS / BLOCKER 0**
- activation merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- activation post-main CI #985 / run `31888823633`: **SUCCESS**
- activation Pages #1555 / run `31888823270`: **SUCCESS**
- Production Deployment Dispatch Broker #4 / run `31888823649`: **SUCCESS**
- Deploy Worker #7 / run `31888830988`: **SUCCESS**
- post-deploy evidence artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- deployed Worker evidence reports exact `source_commit=9b9f09f5079c59750219c73e23002a7ab8d2f33e`, version/health HTTP 200, anonymous records HTTP 401, production origins allowed, staging/localhost origins rejected
- production Worker remains release `4.08`, API `2.61`, schema `3`; Phase 9.2 required no D1 schema migration

Current product state:

- **Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED**
- **Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED**
- **Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 5 historical lot/trade analytics — BACKLOG** until an authoritative production lot-ledger producer exists
- **Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED**
- **Phase 7.1A Stable Import Profile Scope — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 7.1B IBKR Metadata / Journal-Note Separation — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED**
- **Phase 10.1A Transaction Entry Information Hierarchy & Validation Clarity — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.1B Known Symbol Suggestions & Entry Feedback — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.2A Dividend Gross/Tax/Net Semantics & Confirmation Clarity — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.2 Dividend Workflow Productization — ACTIVE PRODUCT LINE / NO RUNTIME BATCH ACTIVE**

Important production verification boundaries:

- Repository contracts, exact-head CI, post-main CI and Pages deployment are verified.
- The assistant also read real IBKR executions through the connected IBKR connector and confirmed real multi-fill orders are available, but that connector does not expose the broker Account ID.
- Phase 7.1A was added so account-less sources can use an explicit non-sensitive Import Profile as stable replay scope without fabricating Account ID.
- A real authenticated browser write using the new importer has **not** been falsely claimed where no such write evidence exists. Treat user-browser import/write smoke as an optional production evidence point.
- Phase 9.1 established authoritative `DIV` records as confirmation truth. Phase 9.2 closes the independent reload/tab/device create race with deterministic event identity while preserving that same confirmation authority; browser-local confirmation state is still not authoritative.
- Phase 10.1A preserves the existing record-create/recovery lifecycle and existing `buildRecordPayload()` price/amount derivation semantics.
- Phase 10.1B suggestions are derived only from already-loaded `store.records`; they are convenience presentation, not ticker validity or market authority.
- Phase 10.2A does not change the reviewed withholding model. Pending `total_gross`, published net, currency and tax provenance still come from the existing engine. The UI now labels the editable amount according to its real gross semantics and validates gross/tax combinations before producing the same net DIV payload.
- Current pending producer does not populate a usable `pay_date` in the confirmation workflow. README was corrected rather than adding or guessing a payment date.

---

## 2. Closed / optimized product index

| Product area | State | Primary closure evidence |
|---|---|---|
| Durable record-create + automatic recalculation/recovery chain | CLOSED / PRODUCTION VERIFIED | PRs #231–#245; detailed chronology preserved in archive |
| Snapshot freshness API/manifest contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #247 merge `cc51ebc2...`; post-main CI #872 + Pages #1530 |
| Phase 1.1 Native Currency Contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #249 merge `4ce9c8fc...`; CI #879 + Pages #1532 |
| Phase 1.2 Authoritative Transaction Valuation | CLOSED / PRODUCTION PAGES VERIFIED | PR #251 merge `92f78af6...`; CI #892 + Pages #1534 |
| Phase 2.1 Trading Journal Note UX | CLOSED / PRODUCTION PAGES VERIFIED | PR #254 merge `7d0dbe2d...`; CI #899 + Pages #1536 |
| Phase 3.1 Daily P&L Explainability | CLOSED / PRODUCTION PAGES VERIFIED | PR #256 merge `2f46516e...`; CI #905 + Pages #1538 |
| Phase 3 Explainability Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | authoritative current-day/holding/TWR-XIRR reliability surfaces complete |
| Phase 4.1 Strategy Group Overview | CLOSED / PRODUCTION PAGES VERIFIED | PR #258 merge `6d0c7708...`; CI #912 + Pages #1540 |
| Phase 4.2 Exact Common-Period TWR | CLOSED / PRODUCTION PAGES VERIFIED | PR #260 merge `6137030a...`; CI #918 + Pages #1542 |
| Phase 4 Strategy Analytics Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | no new financial methodology justified |
| Phase 6.1 Data Sync Status UX | CLOSED / PRODUCTION PAGES VERIFIED | PR #262 merge `eab6a2e3...`; CI #926 + Pages #1544 |
| Phase 6.2 Operation/Recovery Toast Convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #263 merge `b922851c...`; CI #932 + Pages #1545 |
| Phase 6 UX Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | persistent + transient sync language converged without lifecycle duplication |
| Phase 7.1 IBKR Stock Trade File Import | PRODUCTION CODE/PAGES VERIFIED | PR #265 merge `b925b1b8...`; post-main CI #959 + Pages #1547 |
| Phase 7.1A Stable Import Profile Scope | CLOSED / PRODUCTION PAGES VERIFIED | PR #266 merge `df2c383a...`; exact-head CI #961; post-main CI #962 + Pages #1548 |
| Phase 7.1B Metadata / Journal-Note Separation | CLOSED / PRODUCTION PAGES VERIFIED | PR #267 merge `1f82c9c5...`; exact-head CI #966; post-main CI #967 + Pages #1549 |
| Phase 8.1 Responsive Daily P&L Density | CLOSED / PRODUCTION PAGES VERIFIED | PR #269 merge `f7e47744...`; post-main CI #971 + Pages #1551 |
| Phase 9.1 Dividend Confirmation Source of Truth | CLOSED / PRODUCTION PAGES VERIFIED | PR #270 merge `6bc509e4...`; exact-head CI #974; review `4943784529`; post-main CI #975 + Pages #1552 |
| Phase 9.2 Deterministic Dividend Event Identity | CLOSED / PRODUCTION VERIFIED | PR #272 merge `9b9f09f5...`; CI #982/#983; Pages #1554; review `4943920254`; Evidence #18; PR #273 merge `3e1ef4e5...`; CI #984/#985; Pages #1555; Deploy Worker #7 SUCCESS |
| Phase 10.1A Transaction Entry Information Hierarchy & Validation Clarity | CLOSED / PRODUCTION PAGES VERIFIED | PR #275 exact head `db9f448e...`; CI #990; review `4944065869`; merge `0ca4f890...`; post-main CI #991 + Pages #1557 |
| Phase 10.1B Known Symbol Suggestions & Entry Feedback | CLOSED / PRODUCTION PAGES VERIFIED | PR #277 exact head `99196906...`; CI #994; review `4944098383`; merge `7e3dd9e5...`; post-main CI #995 + Pages #1559 |
| Phase 10.1 Transaction Entry UX Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | hierarchy/validation + known-symbol suggestion gaps closed without new transaction/market authority |
| Phase 10.2A Dividend Gross/Tax/Net Semantics & Confirmation Clarity | CLOSED / PRODUCTION PAGES VERIFIED | PR #279 exact head `c383e4aa...`; CI #998; review `4944126543`; merge `7fbdc86e...`; post-main CI #999 + Pages #1561 |

The detailed pre-Phase-7 PR-by-PR Root Cause / Decision / Verification / Rollback ledger remains at `docs/archive/to_do_update_list_through_phase6.md`.

---

## 3. Stable product lifecycle and authority boundaries

### 3A. Mutation / calculation lifecycle

```text
record create durable intent
→ tenant-scoped idempotent Worker write
→ committed mutation/readback
→ durable dirty generation
→ calculation job lifecycle
→ Python snapshot publication
→ browser source/benchmark integrity verification
→ bounded self-healing only when evidence proves repair is safe
```

Do not create a parallel broker-specific calculation or recovery state machine.

### 3B. Financial / FX presentation authority

```text
symbol
→ shared native-currency contract aligned with Python CurrencyDetector
→ current PortfolioCalculator transaction semantics
→ TWD direct for TWD
→ foreign TWD only after exact snapshot+records verification proof
→ exact transaction-date published FX
→ no nearest-date guessing
→ no hard-coded FX fallback
```

### 3C. Data sync UX authority

```text
portfolioReadStatus / connectionStatus / snapshotFreshness / isPolling
→ exact snapshot+record verification proof
→ pure persistent data-sync presentation
→ global Toast presentation adapter
→ product language only
```

`資料已同步` requires the existing exact-object verification proof. `snapshotFreshness='loaded'` alone is not sufficient.

### 3D. Explainability / strategy analytics authority

```text
Python canonical calculation/reconciliation
→ published summary / holdings / history / day_ledger
→ frontend fail-closed structural/reliability validation
→ reviewed TWR interval rebasing where already justified
→ presentation only
```

No browser XIRR reconstruction, new accounting method or risk score without a separately approved methodology batch.

### 3E. Dividend confirmation / entry authority

```text
Python pending dividend event + reviewed policy
→ published gross / net / currency / ex_date
→ frontend entry contract: gross − withholding tax = net
→ validate gross > 0, tax >= 0, tax <= gross
→ deterministic automatic-create identity (`Symbol + ex_date`)
→ existing DIV payload (qty=1, price=net, fee/tax=0, Auto-Dividend)
→ tenant-scoped durable record-create path
→ authoritative browser store.records
→ DIV record with normalized symbol + txn_date
→ confirmed / 已入帳
```

- `confirmed_dividend_keys` is not a product authority.
- DividendManager does not use record-create recovery signals as a second confirmation state.
- A definitely committed create whose records readback is not yet visible may enter only a current-page memory lock: `已保存，等待同步`.
- Ambiguous POST outcomes remain owned by the existing durable record-create recovery lifecycle.
- Automatic confirmation create identity remains versioned `dividend.v1.<sha256>` from normalized `Symbol + ex_date`; gross/tax/net remain payload values, not event identity.
- The actual `DIV` row remains the only `已入帳` authority; deterministic idempotency is replay protection, not confirmation state.
- Phase 10.2A is a UI/input contract correction, not a new tax engine: default values still originate in the reviewed Python output.
- `amount` is gross, `tax` is withholding tax, and persisted automatic `DIV price` remains the resulting net cashflow.
- The persisted tax-note token format is intentionally stable across 10.2A because Phase 9.2 payload hashing includes note.
- `pay_date` is not guessed, inferred or added to event identity when the current producer does not publish it.
- Do not restore localStorage confirmation fallback or invent browser-side dividend accounting.

### 3F. Transaction-entry UX authority

```text
already-loaded tenant-scoped store.records
→ pure recent-first known-Symbol suggestion projection (presentation only)
→ user selects a known Symbol OR freely enters a new Symbol
→ existing TradeForm acceptance predicates
→ existing buildRecordPayload() normalization / price derivation
→ existing store.addRecord() / updateRecord()
→ durable record-create / recovery / recalculation lifecycle
```

- BUY / SELL actions are journal-recording actions, not broker order submission.
- The editable `total_amount` surface is labeled `成交金額（未含費稅）`; if both price and amount are present, existing payload logic keeps price authoritative.
- Field-specific errors preserve prior required-input predicates rather than introducing a second validation/accounting engine.
- Phase 10.1B known-Symbol suggestions use `trim + uppercase`, recent-first deduplication and case-insensitive prefix matching only for the suggestion surface.
- Suggestions do not validate a ticker, infer a market suffix, choose a currency, or block a new non-empty Symbol.
- No Symbol suggestion list is persisted into localStorage or fetched from a new remote service.

---

## 4. Phase 7 — IBKR import product line

### 4A. Batch 7.1 — Safe IBKR Stock Trade File Import

**State: PRODUCTION CODE/PAGES VERIFIED**

Primary product goal:

Replace manual D1/SQL entry of IBKR stock executions with a preview-first, replay-safe logged-in browser import while reusing existing durable record-create and calculation authorities.

Implemented contract:

- direct CSV and IBKR sectioned `Trades,Header` / `Trades,Data`
- STK BUY/BOT and SELL/SLD only
- order-level multi-fill aggregation with quantity-weighted average price
- commission/tax aggregation
- exact ticker/currency contract; unsupported market mapping fails closed rather than guessing Yahoo suffixes
- execution rows only; order summary rows excluded
- invalid fill taints the whole order
- duplicate TradeID deduplicates only when identical; conflicting TradeID blocks the related order
- deterministic broker-source replay identity → SHA-256 opaque durable `Idempotency-Key`
- logged-in user `POST /api/records` only; no system-principal write authority added
- replay-only batch is a true no-op: no records-array replacement and no unnecessary calculation
- new writes converge to at most one final readback/update lifecycle
- post-commit readback/update warning is distinct from ledger-write failure
- partial write failure reports committed/replayed counts and permits safe same-file replay
- Account ID and import-profile labels do not persist in journal note/body metadata

Production evidence:

- PR #265 merged as `b925b1b80c852008e8eaf95bbb21cada874be070`
- final exact-head CI #958 SUCCESS before merge
- independent frozen R2/R3 review: BLOCKER 0
- post-main CI #959 SUCCESS
- Pages #1547 SUCCESS

Out of scope retained:

- IBKR credential/token storage
- scheduled/background Flex sync
- system-principal record writes
- options/futures/FX/DIV import
- exchange/suffix guessing
- bulk Worker endpoint

### 4B. Batch 7.1A — Stable Import Profile Scope

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Root cause:

The connected IBKR ChatGPT/API surface exposes real executions/order/trade IDs but does not expose broker Account ID, while IBKR OrderId alone is not a safe durable cross-account identity.

Solution:

- optional explicit user Import Profile acts as a non-sensitive account-scope alias
- normalized profile is SHA-256-derived into a versioned opaque `PROFILE_<32hex>` scope
- raw profile label remains memory-only
- no account + no profile → fail closed
- no account + profile → allowed
- one real account + profile → profile may intentionally provide a common replay scope
- multiple distinct real accounts + one profile → fail closed
- changing profile invalidates current preview until the file is rechecked
- no profile→broker-account database or new credential architecture

Evidence:

- PR #266 exact head `34438203c99c7de7a8b82a291b7ee0a34610c325`
- exact-head CI #961 SUCCESS
- frozen independent review BLOCKER 0
- merge `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838`
- post-main CI #962 + Pages #1548 SUCCESS

Accepted limitation:

Reusing the same Import Profile name for two different single-account sources explicitly declares them the same replay scope. Persisting a profile/account mapping is not currently justified.

### 4C. Batch 7.1B — IBKR Metadata / Journal-Note Separation

**State: CLOSED / PRODUCTION PAGES VERIFIED**

User evidence:

Transaction History showed long strings such as:

```text
source=IBKR; currency=USD; security_type=STK; aggregation=order;
trade_date=...; order_id=...; fill_count=...; ...
```

These are import-machine metadata, not useful Journal notes. Earlier D1 Console imports also stored equivalent provenance in `records.note`.

Root cause:

`records.note` was serving two unrelated roles: human journal note and IBKR provenance. Durable replay safety has already moved to the Worker/D1 idempotency contract, so provenance does not need to occupy user-visible note.

Solution:

- new pure `ibkrJournalNote` projection is anchored by an exact `source=IBKR` segment
- only a known whitelist of machine fields is removed
- unknown/human text is always preserved
- real `executed_at=YYYYMMDD;HHMMSS(|...)` tokens are removed before general semicolon parsing so time fragments cannot leak as fake user text
- all records pass through this projection once at the API-records→browser boundary; display, search, edit and other consumers therefore agree without component-specific hacks
- IBKR writer applies the same projection before durable intent/POST persistence
- durable pending body, first POST body and ambiguous replay body all contain the same cleaned note
- ordinary non-IBKR notes are untouched
- no production D1 bulk update was performed

Expected user-visible behavior after the deployed bundle is loaded:

- legacy pure IBKR machine note → UI displays `—`
- legacy machine metadata + human text → UI displays only the human text
- new IBKR imports → machine provenance is not persisted in `records.note`
- old raw D1 metadata remains server-side until an explicit future cleanup decision; this is intentional and does not affect financial snapshot identity

Evidence:

- PR #267 final exact head `a5efaa712690ea49fafc3c109aa2e70ac914aebf`
- final exact-head CI #966 / run `31874807899`: SUCCESS
- frozen independent R2 review `4943370397`: BLOCKER 0 / FOLLOW-UP 0
- merge `1f82c9c5e5033e3d51cfb94267982d3fad7d618e`
- post-main CI #967 / run `31874893699`: SUCCESS
- Pages #1549 / run `31874893468`: SUCCESS

Rollback:

Revert PR #267 / merge `1f82c9c5...` or restore prior Pages deployment. No Worker/schema/data/Python rollback is required. Because this batch did not bulk-edit D1, rollback does not need a data repair procedure.

---

## 5. Phase 8–9 — UX density and dividend authority

### 5A. Batch 8.1 — Responsive Daily P&L Density

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Product goal:

Improve responsive daily P&L explainability density without changing accounting values or financial methodology.

Evidence:

- PR #269 merged as `f7e47744399ed31a701f67f8d7e52ab393c2c6b2`
- post-main CI #971: SUCCESS
- Pages #1551: SUCCESS

### 5B. Batch 9.1 — Dividend Confirmation Source of Truth

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Root cause:

The Python engine already treats a dividend as confirmed when an authoritative `DIV` transaction exists for the same normalized `Symbol + Date`, while DividendManager separately persisted `confirmed_dividend_keys` and consumed a recovery signal as browser-local confirmation state. That created a second, device-local authority which could diverge from the journal across reloads/devices.

Solution:

- added a pure dividend confirmation projection matching the existing engine `DIV record → Symbol + txn_date` identity
- `DividendManager` derives confirmed/pending/disabled state from `store.records`
- removed localStorage confirmed-dividend reads/writes from product logic
- removed DividendManager recovery-signal confirmation authority
- committed-but-not-yet-observed records use only a memory-only `已保存，等待同步` safety lock
- ambiguous POST remains owned by existing durable record-create same-key recovery
- no dividend amount/tax calculation, XIRR/TWR, Worker, D1, schema, or Python financial methodology change

Verification:

- PR #270 final exact head `d503d43f9d489935f28528126479b36935315cfe`
- exact-head canonical CI #974 / run `31879309549`: SUCCESS
- frozen independent R2 review `4943784529`: BLOCKER 0 / FOLLOW-UP 1
- merge `6bc509e4e0fd6671b036cb63ea8e210152609f8c`
- post-main CI #975 / run `31883287847`: SUCCESS
- Pages #1552 / run `31883287083`: SUCCESS

Accepted follow-up:

Phase 9.1 deliberately did not provide durable event-level deduplication across a page reload, another tab, or another device before the authoritative DIV record was observed. Generic record-create idempotency protected one durable create intent, not the semantic dividend event across independent new intents. This follow-up is closed by Phase 9.2 below.

Rollback:

Revert PR #270 / merge `6bc509e4...` or restore the prior Pages build. No Worker/schema/data/Python rollback is required.

### 5C. Batch 9.2 — Deterministic Dividend Event Identity

**State: CLOSED / PRODUCTION VERIFIED**

Primary product goal:

Prevent two independent browser sessions/devices from creating duplicate automatic `DIV` rows for the same pending dividend event before either client observes the authoritative server record.

Root cause:

Phase 9.1 correctly made `store.records` / server `DIV` rows the only confirmation authority, but generic durable record-create intentionally generates a new idempotency key for every independent create intent. Therefore two devices could each create a distinct intent for the same semantic dividend event during the readback/synchronization window.

Scope-locked identity:

- canonical event = normalized `Symbol + ex_date`
- identity is versioned and hashed as `dividend.v1.<sha256>`
- this matches the existing Python confirmed-dividend `Symbol + Date` semantics
- shares, amount/gross/net, withholding/tax, currency and FX are derived/mutable values and are not part of immutable event identity
- tenant scoping remains the verified authenticated user boundary and existing idempotency hash
- invalid/insufficient event identity fails closed

Implementation:

- shared dividend-event identity module used by browser and Worker semantic path
- non-enumerable record-create transport metadata carries the deterministic key through the existing durable intent lifecycle without entering the JSON record body
- generic/manual record creates retain their existing random per-intent identity
- deployment-entry semantic handler reuses canonical Google authentication/origin policy
- one transactional D1 `batch()` gates insertion on absence of an existing same-tenant `DIV Symbol + txn_date`
- exact replay succeeds idempotently
- same event with a different payload or an existing manual DIV fails closed with `DIVIDEND_EVENT_CONFLICT` and creates no duplicate
- an edited-away deterministic row releases only its stale semantic reservation; delete then reconfirm remains possible
- conflict reconciliation performs record-scoped `fetchRecords()` only, avoiding unrelated snapshot/settings/recovery/recalculation work

Explicitly unchanged:

- no D1 schema migration or global `(user,symbol,date)` unique constraint
- no Python dividend/tax/TWR/XIRR/accounting methodology change
- no localStorage confirmation authority
- no retry loop or second browser confirmation state
- no IBKR DIV importer/background broker synchronization

Verification and production activation:

- PR #272 final exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`
- exact-head canonical CI #982: SUCCESS
- frozen R2 review `4943920254`: PASS / BLOCKER 0
- runtime merge `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- post-main CI #983 + Pages #1554: SUCCESS
- Production Identity Evidence #18 / run `31888643879`: SUCCESS; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`
- activation exact-head CI #984: SUCCESS
- activation frozen review `4943976191`: PASS / BLOCKER 0
- activation merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- post-main CI #985 + Pages #1555: SUCCESS
- Production Deployment Dispatch Broker #4 / run `31888823649`: SUCCESS
- Deploy Worker #7 / run `31888830988`: SUCCESS
- post-deploy artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- production evidence: exact runtime source `9b9f09f5079c59750219c73e23002a7ab8d2f33e`, release `4.08`, API `2.61`, schema `3`, version/health 200, anonymous records 401, production CORS allowed and staging/localhost CORS rejected

Rollback:

- frontend/runtime rollback: revert PR #272 and restore the prior Pages build
- Worker rollback: redeploy the prior last-known-good main-reachable Worker source through the existing protected production activation/deployment flow
- no schema/data rollback is required because Phase 9.2 added no D1 migration

Stable checkpoint result:

**Phase 9.2 is CLOSED / PRODUCTION VERIFIED.** The cross-session/device duplicate-confirmation gap identified by Phase 9.1 is closed without restoring browser-local authority or changing financial methodology.

---

## 6. Phase 10 — Product UX roadmap

Approved product order:

1. **Phase 10.1 — Transaction Entry UX Convergence**
2. **Phase 10.2 — Dividend Workflow Productization**
3. **Phase 10.3 — Journal / Transaction History UX Convergence**
4. **Phase 10.4 — Portfolio Decision Support**
5. All other new directions are deferred until this roadmap is re-evaluated.

The sequence is intentional: **entry → dividend workflow → history/journal management → decision support**. Do not insert a broad Action Center or privileged broker-background architecture ahead of this roadmap without fresh product evidence and an explicit roadmap decision.

### 6A. Batch 10.1A — Transaction Entry Information Hierarchy & Validation Clarity

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Primary product goal:

Improve the highest-frequency manual transaction-entry flow while preserving established record persistence, accounting semantics, durable create/recovery and automatic recalculation.

Verified product gaps:

- BUY / SELL submit labels sounded like real broker order placement even though the UI records journal transactions.
- Tags interrupted the primary execution-data flow.
- `total_amount` was labeled as a generic transaction total even though current frontend behavior uses it as an alternative execution subtotal for price derivation when price is absent; D1 persists qty/price/fee/tax, not `total_amount`.
- one generic `請填寫完整資料` toast did not identify the missing input.
- mobile stacked Qty/Fee/Tax as three full-width rows, unnecessarily lengthening the trade sheet.

Implementation:

- BUY / SELL actions are now `記錄買進` / `記錄賣出`, with an explicit note that this UI does not send broker orders.
- core execution fields and the execution-amount surface precede Tags and Journal Note.
- amount is labeled `成交金額（未含費稅）` and explains the existing price-vs-amount precedence.
- field-specific error presentation reuses the existing required-input predicates for Symbol, Qty, price-or-amount and SELL group selection.
- mobile keeps Qty full-width and Fee/Tax side-by-side at normal mobile widths, with a <=380px single-column fallback.
- focused regression coverage locks terminology, amount semantics, DOM information hierarchy, validation predicates and mobile layout.

Explicitly unchanged:

- `buildRecordPayload()` price/amount derivation logic
- `store.addRecord()` / `store.updateRecord()`
- durable record-create intent, recovery and automatic recalculation
- Worker, D1 schema/data, authentication and Python financial methodology
- dividend event identity / confirmation authority
- IBKR importer

Verification:

- PR #275 final exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`
- exact-head CI #990 / run `31891157545`: SUCCESS
- frozen review `4944065869`: PASS / BLOCKER 0
- merge `0ca4f890c0771755d907d725069612dc62e6e774`
- post-main CI #991 / run `31891228649`: SUCCESS
- Pages #1557 / run `31891227897`: SUCCESS

Rollback:

Revert PR #275 / merge `0ca4f890...` or restore the previous Pages build. No Worker, schema, D1-data, or Python rollback is required.

### 6B. Batch 10.1B — Known Symbol Suggestions & Entry Feedback

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Primary product goal:

Close the documented Symbol-entry suggestion gap using information already available to the signed-in user, while preserving unrestricted entry of new Yahoo Symbols and every existing transaction/accounting authority.

Root cause / evidence:

- README documented Symbol autocomplete suggestions.
- `TradeForm.vue` was still a plain text Symbol input with no suggestion surface.
- the existing authenticated records load already supplies tenant-scoped records in deterministic recent-first order, so a new ticker-search API, credential, market database or browser-local symbol cache was unnecessary.

Implementation:

- added pure `symbolSuggestions.js` projection over already-loaded `store.records`.
- known Symbols are `trim + uppercase` normalized for suggestion comparison/display, deduplicated by first occurrence and kept in record/recent order.
- query matching is case-insensitive prefix matching only; it never guesses or appends a market suffix.
- empty input may show the most recent known Symbols; the default list is bounded to eight entries.
- Symbol input now exposes an accessible combobox/listbox/option surface with pointer/touch selection and ArrowUp / ArrowDown / Enter / Escape keyboard interaction.
- helper text explicitly states suggestions come from existing transaction history and that a new Yahoo Symbol may still be typed directly.
- choosing a suggestion invokes the existing SELL holding-group check; it does not create a separate validation or mutation path.

Explicitly unchanged:

- the Symbol required predicate remains only non-empty input; suggestion selection is not mandatory.
- no ticker validity assertion, Yahoo search, remote symbol service, suffix guessing or new native-currency authority.
- no localStorage Symbol suggestion/cache authority.
- no `buildRecordPayload()` price/amount or Symbol persistence semantic change.
- no `store.addRecord()` / `store.updateRecord()` / durable recovery / automatic recalculation change.
- no Worker, D1 schema/data, authentication, Python financial methodology, dividend event identity or IBKR importer change.

Verification:

- branch final exact head `991969064b7fb07ded36c0783de80e81d9da30f5`; diff exactly `TradeForm.vue` + pure service + focused test file, behind by 0.
- PR #277 exact-head canonical CI #994 / run `31892093012`: SUCCESS.
- frozen review `4944098383`: PASS / BLOCKER 0 / FOLLOW-UP 0; final risk R1.
- merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`.
- post-main CI #995 / run `31892175857`: SUCCESS.
- Pages #1559 / run `31892175529`: SUCCESS.

Stable checkpoint result:

**Phase 10.1 Transaction Entry UX Convergence is OPTIMIZED FOR CURRENT REQUIREMENTS.** Reopen only for fresh user/production evidence.

### 6C. Batch 10.2A — Dividend Gross/Tax/Net Semantics & Confirmation Clarity

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Primary product goal:

Prevent correct broker dividend data from being converted into an incorrect journal cashflow because the editable gross field was labeled as though it were already the actual paid amount.

Root cause:

- `DividendManager` initialized editable `amount` from engine `total_gross`.
- editable `tax` defaulted from `total_gross - published net`.
- persisted automatic DIV `price` was `amount - tax`.
- desktop and mobile nevertheless labeled `amount` as `實發總額`, which strongly implies a net/paid value and could cause a user to enter broker net receipt there and then have withholding subtracted a second time.
- the same missing entry contract allowed negative tax or tax greater than gross in the browser even though the semantic Worker requires automatic DIV price to be non-negative.

Implementation:

- one shared frontend entry contract now projects gross, withholding tax, net and displayed tax rate.
- desktop and mobile use explicit `稅前配息總額` / `預扣稅金` / `實際入帳淨額` language.
- helper copy states that defaults are system estimates and should be checked against broker actuals.
- validation blocks gross <= 0, tax < 0 and tax > gross before confirmation.
- tax == gross remains allowed, matching the existing Worker non-negative-price contract rather than inventing a new tax policy.
- the confirmation dialog now shows ex-date, gross, withholding tax and net, and says the DIV journal row is created using ex-date + net amount.
- the action is named `確認建立 DIV 交易`, making the authoritative outcome explicit.

Compatibility / authority preservation:

- default pending values still come from existing reviewed Python dividend output.
- reviewed withholding rates are unchanged.
- deterministic event identity remains normalized `Symbol + ex_date`.
- automatic DIV body remains qty=1, price=net, fee=0, tax=0, tag=`Auto-Dividend`.
- persisted `稅金:<currency> <amount>` note token format remains unchanged; this prevents cross-version ambiguous replay from drifting the Phase 9.2 payload hash.
- actual DIV record remains the sole confirmed/`已入帳` authority.
- existing conflict/readback/memory-lock/durable recovery lifecycle is unchanged.
- existing post-save recalculation lifecycle is unchanged because no product evidence justified widening this batch into a lifecycle refactor.
- no pay-date is guessed or introduced; README was corrected to current producer/UI truth.

Verification:

- branch final exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`; diff exactly DividendManager + dividendPresentation helper + focused tests, behind by 0.
- exact-head canonical CI #998 / run `31892772530`: SUCCESS.
- frozen review `4944126543`: PASS / BLOCKER 0 / FOLLOW-UP 0; final risk R2 Moderate.
- merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`.
- post-main CI #999 / run `31892844446`: SUCCESS.
- Pages #1561 / run `31892844089`: SUCCESS.
- no production Worker deployment or D1 migration was required.

Rollback:

Revert PR #279 / merge `7fbdc86e...` or restore the previous Pages build. No Worker, schema, D1-data, Python or financial-data rollback is required.

Stable checkpoint result:

**Phase 10.2A is CLOSED / PRODUCTION PAGES VERIFIED.** The gross/tax/net ambiguity and the matching frontend/server validation gap are closed without changing dividend accounting, reviewed tax policy or deterministic event identity.

---

## 7. NOW / NEXT / BACKLOG / REJECT

### NOW

No runtime batch is active. Phase 10.2A is closed / production Pages verified. Phase 10.2 remains the current product line pending one more bounded workflow audit.

Useful user-browser evidence points, not coding blockers:

1. reload production Pages and verify dividend confirmation labels clearly read as gross / withholding tax / actual net;
2. verify entering negative tax or tax greater than gross is blocked before any DIV journal write;
3. verify the confirmation prompt shows ex-date + gross + tax + net and makes clear that a DIV transaction will be created;
4. verify previously confirmed rows remain `已入帳` based on records and ambiguous/reload flows do not invite duplicate submission;
5. optionally exercise one real IBKR importer preview/write/replay flow when a safe sample is available.

Only reopen closed batches if fresh production evidence contradicts the deployed contracts.

### NEXT — bounded Phase 10.2 queue/history audit

Audit whether the current dividend work queue remains efficient as history grows before selecting any Phase 10.2B runtime scope.

Verified audit context so far:

- the engine's dividend history is accumulated over historical ex-dates and includes both pending and confirmed semantic events;
- `DividendManager` currently maps that published list directly and renders pending, confirmed and awaiting-readback states in one collection;
- the component exposes counts but no explicit pending-first projection, status filter, collapse policy or confirmed-history density control.

Questions to answer before implementation:

- do unconfirmed actionable rows remain immediately visible when confirmed history becomes long, especially on mobile;
- should presentation order be pending/awaiting first and recent-first within state, without mutating engine order or authority;
- is a minimal `待處理 / 已入帳` filter or collapsed confirmed-history section materially better than adding a broader dividend dashboard;
- can this remain a pure presentation projection over the existing list and record truth, with no new persistence or financial state;
- is there enough product value to justify a 10.2B, or should Phase 10.2 close and advance to 10.3.

Do not implement sorting/filtering merely because the capability is absent. Select a 10.2B only if the audit demonstrates concrete workflow benefit with bounded scope.

After Phase 10.2, the approved roadmap remains:

`10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support`

**Phase 7.2 IBKR Flex/background synchronization**, Action Center / Daily Command Center and other new directions are deferred for later discussion; they are not current NEXT work.

### BACKLOG

- physical D1 cleanup of legacy IBKR machine-only `note` values: only after explicit dry-run → count → representative sample → user approval; current browser projection already solves UX without destructive mutation
- Phase 5 historical lot/trade attribution: blocked until authoritative production lot-ledger producer exists
- common-period XIRR / Sharpe / Sortino / MDD / strategy scoring: requires a separately reviewed financial methodology; not justified by current product evidence
- richer broker types (DIV/options/futures/FX) only after STK import usage proves value
- Phase 7.2 background Flex sync feasibility and an eventual Action Center remain deferred roadmap candidates, not active implementation work

### REJECT / DO NOT DO NOW

- do not restore `confirmed_dividend_keys` or another browser-local value as confirmation authority
- do not reopen Phase 9.2 with retry loops, UI-only duplicate checks, or browser-local confirmation authority without new contradictory production evidence
- do not invent or infer pay-date when the current producer does not publish one
- do not reinterpret `amount` as net while also subtracting tax; gross/tax/net must remain explicit
- do not change reviewed dividend withholding policy as part of UX work
- do not change the persisted automatic-DIV tax-note token casually; it participates in deterministic payload hashing
- do not store IBKR password/token in D1 or frontend localStorage
- do not give the current Worker system principal record-write authority merely to automate Phase 7.2
- do not guess broker account identity or Yahoo market suffix
- do not turn known-Symbol suggestions into ticker-validity authority or require suggestion selection before entry
- do not use `note` as replay/idempotency identity
- do not bulk-delete legacy note metadata simply because the UI no longer needs it
- do not rebuild Worker/Python/store architecture without evidence

---

## 8. Fresh-session startup checklist

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this current handoff.
4. Read `docs/archive/to_do_update_list_through_phase6.md` only when historical details are needed.
5. Re-read fresh GitHub `main`, open PRs, latest CI and Pages before modifying anything.
6. If user reports an active production symptom, treat that screenshot/log/runtime result as newer evidence than this prose.
7. Keep one Primary Active Batch and preserve the recovery point before code-bearing work.
8. Follow the approved Phase 10 order unless the user explicitly reprioritizes it.

---

## 9. Current stable recovery points

| Purpose | Checkpoint |
|---|---|
| Current protected main / production Pages after Phase 10.2A | `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6` |
| Before Phase 10.2A / Phase 10.1B docs stable checkpoint | `639ffe06f7e13ecc42063115e40dbd0de57aff5a` |
| Phase 10.1B runtime / production Pages | `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a` |
| Before Phase 10.1B / Phase 10.1A stable docs checkpoint | `b6c48bd0f0979a5889f7f34d008004f67556b5bb` |
| Phase 10.1A runtime / production Pages | `0ca4f890c0771755d907d725069612dc62e6e774` |
| Before Phase 10.1A / Phase 9.2 docs stable checkpoint | `11c832c9a21b68bd7a2bd5a472b073239975a4be` |
| Phase 9.2 production activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Current production Worker runtime / Phase 9.2 | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |
| Before Phase 9.2 / Phase 9.1 stable runtime | `6bc509e4e0fd6671b036cb63ea8e210152609f8c` |
| Before Phase 9.1 / Phase 8.1 stable runtime | `f7e47744399ed31a701f67f8d7e52ab393c2c6b2` |
| Before Phase 8.1 / Phase 7.1B stable runtime | `1f82c9c5e5033e3d51cfb94267982d3fad7d618e` |
| Before 7.1B note separation | `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838` |
| Before 7.1A import profile | `b925b1b80c852008e8eaf95bbb21cada874be070` |
| Phase 6 stable runtime | `b922851cafd699193fe0b5f96d07178703eca96a` |

Historical recovery points through Phase 6 are preserved in the archived handoff.
