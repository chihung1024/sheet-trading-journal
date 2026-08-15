# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state and machine-readable contracts override prose.
>
> The complete pre-Phase-7 verbose handoff is preserved byte-for-byte at `docs/archive/to_do_update_list_through_phase6.md`. Use that archive only when historical Root Cause / PR chronology is needed; do not restart closed work from archived plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Phase 3 Explainability, Phase 4 Strategy Analytics, and Phase 6 UX Convergence are OPTIMIZED FOR CURRENT REQUIREMENTS. Phase 7.1/7.1A/7.1B, Phase 8.1, Phase 9.1, and Phase 9.2 Deterministic Dividend Event Identity are CLOSED / PRODUCTION VERIFIED. No runtime batch is active. Phase 7.2 background Flex sync remains separately gated on credential/security design; no next runtime batch is selected without a product-first audit.**

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

Current verified runtime merge checkpoint:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Current protected-main control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

Production verification for Phase 9.2:

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
- **No runtime batch is currently active.**

Important production verification boundaries:

- Repository contracts, exact-head CI, post-main CI and Pages deployment are verified.
- The assistant also read real IBKR executions through the connected IBKR connector and confirmed real multi-fill orders are available, but that connector does not expose the broker Account ID.
- Phase 7.1A was added so account-less sources can use an explicit non-sensitive Import Profile as stable replay scope without fabricating Account ID.
- A real authenticated browser write using the new importer has **not** been falsely claimed where no such write evidence exists. Treat user-browser import/write smoke as an optional production evidence point.
- Phase 9.1 established authoritative `DIV` records as confirmation truth. Phase 9.2 closes the independent reload/tab/device create race with deterministic event identity while preserving that same confirmation authority; browser-local confirmation state is still not authoritative.

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
| Phase 9.1 Dividend Confirmation Source of Truth | CLOSED / PRODUCTION PAGES VERIFIED | PR #270 merge `6bc509e4...`; exact-head CI #974; frozen review `4943784529`; post-main CI #975 + Pages #1552 |
| Phase 9.2 Deterministic Dividend Event Identity | CLOSED / PRODUCTION VERIFIED | PR #272 merge `9b9f09f5...`; CI #982/#983; Pages #1554; review `4943920254`; Evidence #18; PR #273 merge `3e1ef4e5...`; CI #984/#985; Pages #1555; Deploy Worker #7 SUCCESS |

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

### 3E. Dividend confirmation authority

```text
Python pending dividend event (symbol + ex_date)
→ deterministic automatic-create event identity (`dividend.v1.<sha256>`)
→ tenant-scoped durable record-create path
→ authoritative browser store.records
→ DIV record with normalized symbol + txn_date
→ confirmed / 已入帳
```

- `confirmed_dividend_keys` is not a product authority.
- DividendManager does not use record-create recovery signals as a second confirmation state.
- A definitely committed create whose records readback is not yet visible may enter only a current-page memory lock: `已保存，等待同步`.
- Ambiguous POST outcomes remain owned by the existing durable record-create recovery lifecycle.
- Automatic confirmation create identity is deterministic and versioned as `dividend.v1.<sha256>` from normalized `Symbol + ex_date`; tenant scoping is enforced by the authenticated record-create path.
- A current same-tenant `DIV Symbol + txn_date` record blocks a second automatic dividend row, including independent reload/tab/device attempts.
- The actual `DIV` row remains the only `已入帳` authority; deterministic idempotency is replay protection, not confirmation state.
- Existing manual DIV records also block a second automatic row; different payload conflicts fail closed instead of silently merging cashflows.
- Deleting or editing away the event row releases only the stale row-backed semantic reservation needed for a legitimate later reconfirmation.
- Do not restore localStorage confirmation fallback.

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

## 6. NOW / NEXT / BACKLOG / REJECT

### NOW

No runtime batch is active.

Useful user-browser evidence points, not coding blockers:

1. normal reload of the production Pages bundle;
2. verify dividend rows already represented by authoritative DIV records show `已入帳` consistently;
3. verify a committed write with temporarily unavailable readback shows `已保存，等待同步` rather than falsely claiming confirmation;
4. optionally verify legacy IBKR machine-only notes no longer occupy the Journal column and exercise one real importer preview/write/replay flow when a safe sample is available.

Only reopen closed batches if fresh production evidence contradicts the deployed contracts.

### NEXT — product-first audit before any new runtime implementation

No new runtime batch is selected at this checkpoint. Phase 9.2 is closed.

**Phase 7.2 — IBKR Flex/background synchronization feasibility** remains a separate candidate, gated on an independent audit of credential ownership, secret storage, account identity, write authority, scheduling/retry ownership, and user-visible reconciliation policy. Prefer user-auth/on-demand sync if it can deliver equivalent UX without a privileged background writer.

Any other next batch must first demonstrate a concrete product/UX gap or fresh production evidence. Do not create maintenance work merely to keep development moving.

### BACKLOG

- physical D1 cleanup of legacy IBKR machine-only `note` values: only after explicit dry-run → count → representative sample → user approval; current browser projection already solves UX without destructive mutation
- Phase 5 historical lot/trade attribution: blocked until authoritative production lot-ledger producer exists
- common-period XIRR / Sharpe / Sortino / MDD / strategy scoring: requires a separately reviewed financial methodology; not justified by current product evidence
- richer broker types (DIV/options/futures/FX) only after STK import usage proves value

### REJECT / DO NOT DO NOW

- do not restore `confirmed_dividend_keys` or another browser-local value as confirmation authority
- do not reopen Phase 9.2 with retry loops, UI-only duplicate checks, or browser-local confirmation authority without new contradictory production evidence
- do not store IBKR password/token in D1 or frontend localStorage
- do not give the current Worker system principal record-write authority merely to automate Phase 7.2
- do not guess broker account identity or Yahoo market suffix
- do not use `note` as replay/idempotency identity
- do not bulk-delete legacy note metadata simply because the UI no longer needs it
- do not rebuild Worker/Python/store architecture without evidence

---

## 7. Fresh-session startup checklist

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this current handoff.
4. Read `docs/archive/to_do_update_list_through_phase6.md` only when historical details are needed.
5. Re-read fresh GitHub `main`, open PRs, latest CI and Pages before modifying anything.
6. If user reports an active production symptom, treat that screenshot/log/runtime result as newer evidence than this prose.
7. Keep one Primary Active Batch and preserve the recovery point before code-bearing work.

---

## 8. Current stable recovery points

| Purpose | Checkpoint |
|---|---|
| Current protected-main control plane after Phase 9.2 activation | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Current production runtime / Phase 9.2 | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |
| Before Phase 9.2 / Phase 9.1 stable runtime | `6bc509e4e0fd6671b036cb63ea8e210152609f8c` |
| Before Phase 9.1 / Phase 8.1 stable runtime | `f7e47744399ed31a701f67f8d7e52ab393c2c6b2` |
| Before Phase 8.1 / Phase 7.1B stable runtime | `1f82c9c5e5033e3d51cfb94267982d3fad7d618e` |
| Before 7.1B note separation | `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838` |
| Before 7.1A import profile | `b925b1b80c852008e8eaf95bbb21cada874be070` |
| Phase 6 stable runtime | `b922851cafd699193fe0b5f96d07178703eca96a` |

Historical recovery points through Phase 6 are preserved in the archived handoff.
