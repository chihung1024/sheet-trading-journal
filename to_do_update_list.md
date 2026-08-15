# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, open PRs, current CI/Pages and machine-readable contracts override prose.
>
> The complete pre-Phase-7 verbose handoff remains at `docs/archive/to_do_update_list_through_phase6.md`. Use it only when historical Phase 1–6 root-cause/PR chronology is needed; do not restart closed work from archived plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Approved Phase 10 order remains 10.1 Transaction Entry UX Convergence → 10.2 Dividend Workflow Productization → 10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support. Phase 10.1 and 10.2 are OPTIMIZED FOR CURRENT REQUIREMENTS. Phase 10.3A Transaction History Strategy Context & Filter Clarity is CLOSED / PRODUCTION PAGES VERIFIED. Phase 10.3 remains the current product line. No runtime batch is active. NEXT is a bounded audit for full-journal readability / transaction detail expansion before deciding whether Phase 10.3B is justified. All other directions remain deferred.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. One Primary Active Batch at a time. Supporting read-only research may continue while CI/deploy gates run, but do not open a second implementation batch.
3. Debug by evidence: Reproduce → Evidence → Hypotheses → Trace → Isolate → Root Cause → Impact → Fix → Regression → Prevention.
4. Fix the root cause and inspect same-class impact; do not patch only one symptom.
5. Financial/data correctness is fail-closed. Browser presentation must not become a second accounting, FX, tax or market-data engine.
6. R2+ work requires exact-head CI, rollback/recovery, frozen review and permanent handoff. Lower-risk work still uses canonical CI when it touches high-consequence product surfaces.
7. Prefer invisible deterministic automation. **AI 管流程，不管帳**.
8. Technical work belongs in NOW only when directly required by the active product goal. Optional refactors/debug work must converge instead of becoming a roadmap.
9. Do not reopen closed phases without new material user/production evidence.
10. Preserve a recovery point before code-bearing work and never use destructive git against unknown work.

---

## 1. Current authoritative stable state

### 1A. Current checkpoints

Current production Pages runtime checkpoint after Phase 10.3A:

`d1e799570c70381864db3ed4cfe0e9129d2a6bac`

Current production Worker runtime checkpoint:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Current Phase 9.2 production-activation control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

A docs-only stable-checkpoint merge after `d1e79957...` may advance repository `main` without changing product runtime/Worker behavior. Always read fresh remote truth before new work.

### 1B. Product state index

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
- **Phase 10.1A Entry Information Hierarchy & Validation — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.1B Known Symbol Suggestions & Entry Feedback — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.2A Dividend Gross/Tax/Net Semantics — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.2B Dividend Action Queue & Confirmed History Density — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.2 Dividend Workflow Productization — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.3A Transaction History Strategy Context & Filter Clarity — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.3 Journal / Transaction History UX Convergence — ACTIVE PRODUCT LINE / NO RUNTIME BATCH ACTIVE**

### 1C. Recent immutable verification evidence

#### Phase 10.3A

- PR #283 final exact head `ff22b79a34da6b3386dc87740e74b53abf7e7000`
- exact-head canonical CI #1008 / run `31894465820`: **SUCCESS**
- frozen review `4944195104`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk: **R1 Local / Low Risk**
- merge `d1e799570c70381864db3ed4cfe0e9129d2a6bac`
- post-main CI #1009 / run `31894538466`: **SUCCESS**
- Pages #1565 / run `31894537919`: **SUCCESS**
- changed only RecordList presentation/filtering, a pure history presentation service, focused regression coverage, and minimal Journal Note regression adaptation
- no Worker/D1/Python/auth/IBKR/dividend/financial-methodology change; no Worker deployment

#### Phase 10.2B

- PR #281 exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`
- CI #1004 / run `31893757694`: **SUCCESS**
- review `4944167995`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `7c670a6c9c015c689add4ce742a4941d74e76e38`
- post-main CI #1005 + Pages #1563: **SUCCESS**

#### Phase 10.2A

- PR #279 exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`
- CI #998: **SUCCESS**
- review `4944126543`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`
- post-main CI #999 + Pages #1561: **SUCCESS**

#### Phase 10.1B / 10.1A

- 10.1B PR #277 exact head `991969064b7fb07ded36c0783de80e81d9da30f5`; CI #994; review `4944098383`; merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`; post-main CI #995 + Pages #1559: **SUCCESS**
- 10.1A PR #275 exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`; CI #990; review `4944065869`; merge `0ca4f890c0771755d907d725069612dc62e6e774`; post-main CI #991 + Pages #1557: **SUCCESS**

#### Phase 9.2 production activation

- runtime PR #272 final exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`
- CI #982: **SUCCESS**; review `4943920254`: **PASS / BLOCKER 0**
- runtime merge / current Worker source `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- post-main CI #983 + Pages #1554: **SUCCESS**
- Production Identity Evidence #18 / run `31888643879`: **SUCCESS**; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`; CI #984; review `4943976191`; merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- post-main CI #985 + Pages #1555: **SUCCESS**
- Production Deployment Dispatch Broker #4 / run `31888823649`: **SUCCESS**
- Deploy Worker #7 / run `31888830988`: **SUCCESS**
- post-deploy evidence artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- deployed Worker: release `4.08`, API `2.61`, schema `3`; version/health 200, anonymous records 401, production CORS allowed, staging/localhost rejected

### 1D. Earlier Phase 7–9 closure evidence

| Product area | Primary closure evidence |
|---|---|
| Phase 7.1 IBKR Stock Trade Import | PR #265 merge `b925b1b80c852008e8eaf95bbb21cada874be070`; exact/post-main CI #958/#959; Pages #1547 |
| Phase 7.1A Stable Import Profile | PR #266 merge `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838`; CI #961/#962; Pages #1548 |
| Phase 7.1B Metadata / Journal-Note Separation | PR #267 merge `1f82c9c5e5033e3d51cfb94267982d3fad7d618e`; CI #966/#967; Pages #1549; review `4943370397` |
| Phase 8.1 Responsive Daily P&L Density | PR #269 merge `f7e47744399ed31a701f67f8d7e52ab393c2c6b2`; CI #971; Pages #1551 |
| Phase 9.1 Dividend Confirmation Source of Truth | PR #270 merge `6bc509e4e0fd6671b036cb63ea8e210152609f8c`; CI #974/#975; Pages #1552; review `4943784529` |

---

## 2. Stable authority boundaries

### 2A. Mutation / calculation lifecycle

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

Do not create a parallel broker-, dividend-, journal- or UI-specific calculation/recovery state machine.

### 2B. Financial / FX authority

```text
symbol
→ shared native-currency contract aligned with Python CurrencyDetector
→ PortfolioCalculator transaction semantics
→ TWD direct for TWD
→ foreign TWD only after exact snapshot+records verification proof
→ exact transaction-date published FX
→ no nearest-date guessing / no hard-coded FX fallback
```

Transaction History must continue to use existing `resolveSettlementAmountNative()` and verified `resolveTransactionValuation()`; it is presentation/retrieval, not an accounting engine.

### 2C. Journal / Transaction History authority

```text
store.records
→ current global store.currentGroup scope
→ pure local query / type / inclusive date-range projection
→ sort / pagination
→ desktop/mobile presentation
→ existing edit/delete mutation lifecycle
```

Rules after Phase 10.3A:

- `record.tag` remains strategy metadata and current group authority input; Tag chips are a display projection only.
- search still covers Symbol + Tag + Journal Note.
- local date range uses calendar-valid `YYYY-MM-DD`, inclusive boundaries and fail-closed invalid/reversed input.
- local clear resets only query/type/date filters; it does **not** silently change `store.currentGroup`.
- active global strategy group is now visible in the history filter context.
- filter state is not persisted into localStorage.
- `顯示筆數` describes the filtered result, avoiding the prior misleading `總交易` label.
- Journal Note persistence remains the existing Worker/D1 contract; no note-only mutation path exists.
- desktop/mobile Tag and Note presentation must not alter financial snapshot source identity.
- edit/delete continue through existing `emit('edit', record)` / `store.deleteRecord()` lifecycle.
- no historical lot attribution may be inferred from current-day `day_ledger`.

### 2D. Dividend authority

```text
Python pending dividend + reviewed policy
→ ex_date / gross / net / currency
→ frontend gross − withholding = net validation
→ deterministic event identity (`Symbol + ex_date`)
→ existing automatic DIV payload
→ tenant-scoped durable record-create
→ authoritative store.records DIV row
→ pure active-queue / confirmed-history presentation
```

Key rules:

- actual same-tenant DIV row is the only `已入帳` authority.
- no `confirmed_dividend_keys` / localStorage confirmation authority.
- definite commit/readback delay may use only current-page memory lock.
- event identity remains versioned `dividend.v1.<sha256>` from normalized Symbol + ex_date.
- gross/tax/net/currency/shares are mutable/derived payload values, not event identity.
- existing manual DIV blocks second automatic row; different payload conflicts fail closed.
- automatic DIV remains qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`.
- tax-note token remains stable because payload hashing includes note.
- no pay-date inference.
- confirmed-history view does not reconstruct actual cashflow from market estimates.

### 2E. Transaction entry authority

```text
already-loaded store.records
→ pure recent known-Symbol suggestions
→ user selects known Symbol OR types new Symbol
→ existing TradeForm predicates / buildRecordPayload()
→ existing add/update durable mutation lifecycle
```

No ticker-validity authority, suffix guessing, remote symbol database or localStorage Symbol cache.

### 2F. IBKR import authority

```text
user-provided IBKR file
→ local preview/validation
→ stable broker account or explicit non-sensitive Import Profile scope
→ deterministic opaque source replay key
→ existing authenticated record-create
→ existing calculation lifecycle
```

No IBKR password/token storage, no system-principal record-write authority, and no Account ID/Yahoo suffix guessing.

---

## 3. Phase 10 approved roadmap

Approved order:

1. **Phase 10.1 — Transaction Entry UX Convergence — OPTIMIZED**
2. **Phase 10.2 — Dividend Workflow Productization — OPTIMIZED**
3. **Phase 10.3 — Journal / Transaction History UX Convergence — CURRENT**
4. **Phase 10.4 — Portfolio Decision Support**
5. Everything else waits for later discussion.

### 3A. Phase 10.1 summary

10.1A closed entry hierarchy/validation clarity without changing transaction accounting. 10.1B added recent known-Symbol suggestions from loaded records without creating ticker validity/market authority.

Stable result: **Phase 10.1 OPTIMIZED FOR CURRENT REQUIREMENTS.**

### 3B. Phase 10.2 summary

10.2A corrected the gross/tax/net input contract and blocked invalid tax combinations while preserving dividend accounting/event identity. 10.2B separated the recent active dividend queue from default-collapsed authoritative confirmed history.

Stable result: **Phase 10.2 OPTIMIZED FOR CURRENT REQUIREMENTS.**

### 3C. Phase 10.3A — Transaction History Strategy Context & Filter Clarity

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Verified root causes:

- search/group behavior already depended on Tag, but Tag was invisible in both desktop and mobile history rows.
- local filter UI offered a year selector while product documentation promised date-range retrieval.
- current global strategy group silently reduced results with no RecordList-local indication.
- `總交易` actually showed the filtered result count.
- existing date display/sort used browser `Date` round-trips even though transaction dates are date-only values.

Implementation:

- preserved the existing eight desktop columns and changed Symbol information hierarchy to `代碼 / 策略`; Tag chips render under Symbol on desktop/mobile.
- replaced year-only filtering with inclusive Start Date → End Date.
- added pure `recordHistoryPresentation.js` for calendar-valid date normalization, Tag parsing, query/type/date/group matching and local-filter detection.
- impossible dates and reversed ranges fail closed and surface a clear error.
- active local filter chips plus global strategy-group scope are visible; clear action resets only local query/type/date.
- filtered total is labeled `顯示筆數`.
- date-only formatting/sorting no longer round-trips through local timezone.
- existing Journal Note regression was minimally adapted so Symbol/Tag/Note search remains explicitly protected through the shared filter service.

Explicitly unchanged:

- Worker/D1 note schema/persistence
- store.records / store.currentGroup authority
- native/TWD valuation and verified FX behavior
- edit/delete lifecycle
- IBKR/dividend workflows
- financial methodology
- no localStorage filter state
- no bulk edit/export/lot analytics

Evidence is in §1C.

Rollback: revert PR #283 / merge `d1e79957...` or restore the prior Pages deployment. No Worker/schema/data/Python rollback is required.

---

## 4. NOW / NEXT / BACKLOG / REJECT

### NOW

No runtime batch is active. Phase 10.3A is closed / production Pages verified. Production Worker remains Phase 9.2 runtime `9b9f09f5...`.

Useful browser evidence, not coding blockers:

1. verify strategy Tag chips are readable on desktop/mobile without making rows excessively tall;
2. verify Start/End date filters include both boundary dates;
3. verify global strategy-group scope appears clearly and `清除篩選` does not change the selected global group;
4. verify long Journal Notes remain searchable and edit/delete behavior is unchanged.

### NEXT — bounded Phase 10.3 journal-readability audit

Current evidence suggests one plausible next product gap, but **Phase 10.3B is not pre-approved until the bounded audit is complete**:

- desktop Journal Note is visually clamped to two lines; complete text is primarily available through the HTML `title` hover behavior, which is weak for keyboard/touch journal review;
- mobile shows the full note, but desktop/mobile detail density is inconsistent;
- desktop table omits fee/tax detail while mobile shows fee+tax only as one combined value;
- repository search found no existing read-only transaction-detail / expandable-record surface to reuse;
- using the edit form merely to read full journal details would mix read and mutation intent.

Audit questions:

1. Does a compact, accessible **read-only expandable transaction detail** materially improve journal review without bloating the main table?
2. Should expanded detail show full Journal Note, full strategy tags and separate native fee/tax values using only the existing record fields?
3. Can desktop/mobile share one pure detail projection while keeping valuation/accounting untouched?
4. Should expansion be page-memory presentation state only, with no persistence or new authority?
5. Can edit/delete remain separate explicit actions so viewing never implies mutation?
6. Avoid adding bulk edit/export/lot analytics to this batch.

If evidence remains positive, define **Phase 10.3B — Readable Transaction Detail & Full Journal Review** as a bounded frontend-only batch. Otherwise close the gap as unnecessary and continue the Phase 10.3 audit.

After Phase 10.3 is optimized, proceed to **Phase 10.4 Portfolio Decision Support**.

### BACKLOG

- physical D1 cleanup of legacy IBKR machine-only notes: only after explicit dry-run → count → representative sample → approval
- Phase 5 historical lot/trade attribution: blocked until authoritative production lot-ledger producer exists
- common-period XIRR / Sharpe / Sortino / MDD / scoring: requires a separate reviewed financial methodology
- richer IBKR types only after current STK import usage proves value
- Phase 7.2 background Flex sync feasibility
- Action Center / Daily Command Center

### REJECT / DO NOT DO NOW

- do not restore browser-local dividend confirmation authority
- do not reopen Phase 9.2 with UI-only duplicate checks/retry loops without contradictory production evidence
- do not infer pay-date or change reviewed dividend withholding policy as UX work
- do not casually change automatic-DIV tax-note token
- do not store IBKR credentials/tokens in D1/localStorage
- do not grant the Worker system principal record-write authority merely for background sync
- do not guess broker account identity or Yahoo suffix
- do not turn known-Symbol suggestions into ticker validity
- do not use Journal Note as replay/idempotency identity
- do not rebuild Worker/Python/store architecture without evidence
- do not turn Transaction History into a second valuation/accounting/FX engine
- do not implement historical lot attribution from current-day `day_ledger`

---

## 5. Fresh-session startup checklist

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this handoff.
4. Read `docs/archive/to_do_update_list_through_phase6.md` only when old Phase 1–6 details are needed.
5. Re-read fresh GitHub `main`, open PRs, latest CI and Pages before modifications.
6. Treat new user screenshots/logs/production symptoms as newer evidence than prose.
7. Keep one Primary Active Batch and preserve its recovery point.
8. Follow approved Phase 10 order unless user explicitly reprioritizes.
9. During debug, inspect same-class impact and add regression prevention.
10. Close optional technical work once the product goal is verified.

---

## 6. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 10.3A runtime / production Pages | `d1e799570c70381864db3ed4cfe0e9129d2a6bac` |
| Before Phase 10.3A / Phase 10.2 docs checkpoint | `22f5d48ab2bc1ec37c0d707605c13e4733bd4bb2` |
| Phase 10.2B runtime / production Pages | `7c670a6c9c015c689add4ce742a4941d74e76e38` |
| Before Phase 10.2B / Phase 10.2A docs checkpoint | `d2bc8cea8b036f6153ccfd533e5ab22f2d78e491` |
| Phase 10.2A runtime / production Pages | `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6` |
| Before Phase 10.2A / Phase 10.1B docs checkpoint | `639ffe06f7e13ecc42063115e40dbd0de57aff5a` |
| Phase 10.1B runtime / production Pages | `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a` |
| Phase 10.1A runtime / production Pages | `0ca4f890c0771755d907d725069612dc62e6e774` |
| Phase 9.2 activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Production Worker / Phase 9.2 runtime | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |
| Phase 9.1 stable runtime | `6bc509e4e0fd6671b036cb63ea8e210152609f8c` |
| Phase 8.1 stable runtime | `f7e47744399ed31a701f67f8d7e52ab393c2c6b2` |
| Phase 7.1B runtime | `1f82c9c5e5033e3d51cfb94267982d3fad7d618e` |
| Phase 7.1A runtime | `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838` |
| Phase 7.1 runtime | `b925b1b80c852008e8eaf95bbb21cada874be070` |
| Phase 6 stable runtime | `b922851cafd699193fe0b5f96d07178703eca96a` |

Historical recovery points through Phase 6 remain in the archive.
