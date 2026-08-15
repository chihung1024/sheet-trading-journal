# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, current PR/CI/Pages status and machine-readable contracts override prose.
>
> The complete pre-Phase-7 verbose handoff is preserved at `docs/archive/to_do_update_list_through_phase6.md`. Use that archive only when historical Root Cause / PR chronology is needed; do not restart closed work from archived plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Approved Phase 10 order is 10.1 Transaction Entry UX Convergence → 10.2 Dividend Workflow Productization → 10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support. Phase 10.1 and Phase 10.2 are OPTIMIZED FOR CURRENT REQUIREMENTS. No runtime batch is active. NEXT is a bounded product-first Phase 10.3 audit, starting from verified Transaction History information-hierarchy / filtering gaps. Phase 7.2 background broker sync, Action Center and all other directions remain deferred until the approved Phase 10 roadmap is completed or explicitly reprioritized.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; supporting read-only research may proceed while a gate is running, but do not open a second implementation batch.
3. Debug by evidence: Reproduce → Evidence → Hypotheses → Trace → Isolate → Root Cause → Impact → Fix → Regression → Prevention.
4. Fix root causes and inspect the same class of failure; do not patch only the reported point.
5. Financial/data correctness is fail-closed. Browser presentation must not become a second accounting, FX, tax or market-data engine.
6. R2+ work requires exact-head CI, rollback/recovery, frozen review and permanent handoff. Lower-risk work still needs canonical CI when it sits on a high-consequence workflow.
7. Prefer invisible deterministic automation. **AI 管流程，不管帳**; do not request/store broker or login secrets when an existing user-auth boundary can be reused.
8. Technical work belongs in NOW only when it directly supports the active product goal. Nonessential refactors/cleanup must converge instead of becoming a roadmap.
9. Do not reopen closed phases without new material user/production evidence.
10. Preserve a recovery point before code-bearing work; never use destructive git against unknown work.

---

## 1. Current authoritative stable state

### 1A. Current product/runtime checkpoints

Current production Pages runtime checkpoint after Phase 10.2B:

`7c670a6c9c015c689add4ce742a4941d74e76e38`

Current production Worker runtime checkpoint:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Current Phase 9.2 production-activation control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

The stable-checkpoint documentation merge after `7c670a6c...` may advance repository `main` without changing runtime/Worker behavior. Always read fresh remote `main` before new work.

### 1B. Current product states

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
- **Phase 10.2B Dividend Action Queue & Confirmed History Density — CLOSED / PRODUCTION PAGES VERIFIED**
- **Phase 10.2 Dividend Workflow Productization — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **No runtime batch is currently active.**

### 1C. Most recent verification evidence

Phase 10.2B:

- PR #281 final exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`
- exact-head canonical CI #1004 / run `31893757694`: **SUCCESS**
- frozen review `4944167995`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk classification: **R1 Local / Low Risk**
- merge `7c670a6c9c015c689add4ce742a4941d74e76e38`
- post-main CI #1005 / run `31893865494`: **SUCCESS**
- Pages #1563 / run `31893864842`: **SUCCESS**
- changed only `DividendManager.vue`, a pure dividend-workflow presentation projection, and focused frontend regression coverage
- no Worker, D1, Python, auth, IBKR, schema, reviewed withholding-policy or financial-methodology change
- no production Worker deployment; Worker remains `9b9f09f5...`, release `4.08`, API `2.61`, schema `3`

Phase 10.2A:

- PR #279 final exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`
- exact-head CI #998 / run `31892772530`: **SUCCESS**
- frozen review `4944126543`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- risk: **R2 Moderate**
- merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`
- post-main CI #999 / run `31892844446`: **SUCCESS**
- Pages #1561 / run `31892844089`: **SUCCESS**

Phase 10.1B:

- PR #277 exact head `991969064b7fb07ded36c0783de80e81d9da30f5`
- CI #994 / run `31892093012`: **SUCCESS**
- frozen review `4944098383`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`
- post-main CI #995 + Pages #1559: **SUCCESS**

Phase 10.1A:

- PR #275 exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`
- CI #990: **SUCCESS**
- frozen review `4944065869`: **PASS / BLOCKER 0**
- merge `0ca4f890c0771755d907d725069612dc62e6e774`
- post-main CI #991 + Pages #1557: **SUCCESS**

Phase 9.2 production activation remains:

- runtime PR #272 final exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`
- exact-head CI #982: **SUCCESS**
- frozen review `4943920254`: **PASS / BLOCKER 0**
- runtime merge `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- post-main CI #983 + Pages #1554: **SUCCESS**
- Production Identity Evidence #18 / run `31888643879`: **SUCCESS**; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`; CI #984 **SUCCESS**; review `4943976191` **PASS / BLOCKER 0**
- activation merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- post-main CI #985 + Pages #1555: **SUCCESS**
- Production Deployment Dispatch Broker #4 / run `31888823649`: **SUCCESS**
- Deploy Worker #7 / run `31888830988`: **SUCCESS**
- post-deploy evidence artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- deployed evidence reports exact Worker source `9b9f09f5...`, version/health 200, anonymous records 401, production origins allowed and staging/localhost rejected

---

## 2. Closed / optimized product index

| Product area | State | Primary evidence |
|---|---|---|
| Durable record-create + automatic recalculation/recovery chain | CLOSED / PRODUCTION VERIFIED | PRs #231–#245; detailed chronology in archive |
| Snapshot freshness API/manifest contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #247 merge `cc51ebc2...`; CI #872 + Pages #1530 |
| Phase 1.1 Native Currency Contract | CLOSED / PRODUCTION PAGES VERIFIED | PR #249 merge `4ce9c8fc...`; CI #879 + Pages #1532 |
| Phase 1.2 Authoritative Transaction Valuation | CLOSED / PRODUCTION PAGES VERIFIED | PR #251 merge `92f78af6...`; CI #892 + Pages #1534 |
| Phase 2.1 Trading Journal Note UX | CLOSED / PRODUCTION PAGES VERIFIED | PR #254 merge `7d0dbe2d...`; CI #899 + Pages #1536 |
| Phase 3.1 Daily P&L Explainability | CLOSED / PRODUCTION PAGES VERIFIED | PR #256 merge `2f46516e...`; CI #905 + Pages #1538 |
| Phase 4.1 Strategy Group Overview | CLOSED / PRODUCTION PAGES VERIFIED | PR #258 merge `6d0c7708...`; CI #912 + Pages #1540 |
| Phase 4.2 Exact Common-Period TWR | CLOSED / PRODUCTION PAGES VERIFIED | PR #260 merge `6137030a...`; CI #918 + Pages #1542 |
| Phase 6.1 Data Sync Status UX | CLOSED / PRODUCTION PAGES VERIFIED | PR #262 merge `eab6a2e3...`; CI #926 + Pages #1544 |
| Phase 6.2 Operation/Recovery Toast Convergence | CLOSED / PRODUCTION PAGES VERIFIED | PR #263 merge `b922851c...`; CI #932 + Pages #1545 |
| Phase 7.1 IBKR Stock Trade File Import | PRODUCTION CODE/PAGES VERIFIED | PR #265 merge `b925b1b8...`; CI #959 + Pages #1547 |
| Phase 7.1A Stable Import Profile Scope | CLOSED / PRODUCTION PAGES VERIFIED | PR #266 merge `df2c383a...`; CI #961/#962 + Pages #1548 |
| Phase 7.1B Metadata / Journal-Note Separation | CLOSED / PRODUCTION PAGES VERIFIED | PR #267 merge `1f82c9c5...`; CI #966/#967 + Pages #1549 |
| Phase 8.1 Responsive Daily P&L Density | CLOSED / PRODUCTION PAGES VERIFIED | PR #269 merge `f7e47744...`; CI #971 + Pages #1551 |
| Phase 9.1 Dividend Confirmation Source of Truth | CLOSED / PRODUCTION PAGES VERIFIED | PR #270 merge `6bc509e4...`; CI #974/#975 + Pages #1552; review `4943784529` |
| Phase 9.2 Deterministic Dividend Event Identity | CLOSED / PRODUCTION VERIFIED | PR #272 merge `9b9f09f5...`; production activation via PR #273 + Deploy Worker #7 |
| Phase 10.1A Entry Hierarchy & Validation | CLOSED / PRODUCTION PAGES VERIFIED | PR #275 merge `0ca4f890...`; CI #990/#991 + Pages #1557 |
| Phase 10.1B Known Symbol Suggestions | CLOSED / PRODUCTION PAGES VERIFIED | PR #277 merge `7e3dd9e5...`; CI #994/#995 + Pages #1559 |
| Phase 10.1 Transaction Entry UX Convergence | OPTIMIZED FOR CURRENT REQUIREMENTS | 10.1A + 10.1B |
| Phase 10.2A Dividend Gross/Tax/Net Semantics | CLOSED / PRODUCTION PAGES VERIFIED | PR #279 merge `7fbdc86e...`; CI #998/#999 + Pages #1561 |
| Phase 10.2B Dividend Action Queue & Confirmed History Density | CLOSED / PRODUCTION PAGES VERIFIED | PR #281 merge `7c670a6c...`; CI #1004/#1005 + Pages #1563 |
| Phase 10.2 Dividend Workflow Productization | OPTIMIZED FOR CURRENT REQUIREMENTS | 10.2A + 10.2B; no evidence justifies a 10.2C |

---

## 3. Stable authority boundaries

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

Do not create a parallel broker-, dividend- or UI-specific calculation/recovery state machine.

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

`資料已同步` requires existing exact-object verification proof. `snapshotFreshness='loaded'` alone is not sufficient.

### 3D. Explainability / strategy analytics authority

```text
Python canonical calculation/reconciliation
→ published summary / holdings / history / day_ledger
→ frontend fail-closed structural/reliability validation
→ reviewed TWR interval rebasing where already justified
→ presentation only
```

No browser XIRR reconstruction, new accounting method or risk score without a separately approved methodology batch.

### 3E. Dividend confirmation / entry / workflow authority

```text
Python pending dividend event + reviewed policy
→ published ex_date / gross / net / currency
→ frontend entry contract: gross − withholding tax = net
→ validate gross > 0, tax >= 0, tax <= gross
→ deterministic automatic-create identity (`Symbol + ex_date`)
→ existing DIV payload (qty=1, price=net, fee/tax=0, Auto-Dividend)
→ tenant-scoped durable record-create path
→ authoritative store.records DIV row
→ confirmed / 已入帳
→ pure workflow projection for queue/history presentation
```

Rules:

- `confirmed_dividend_keys` / localStorage is not product authority.
- The actual same-tenant `DIV Symbol + txn_date` row remains the only `已入帳` authority.
- A definitely committed create whose records readback is not yet visible may use only the existing current-page memory lock `已保存，等待同步`.
- Ambiguous POST outcomes remain owned by durable record-create same-key recovery.
- Automatic event identity remains `dividend.v1.<sha256>` from normalized `Symbol + ex_date`; gross/tax/net/currency/shares are payload/derived values, not event identity.
- Existing manual DIV rows block a second automatic row; different payload conflicts fail closed via `DIVIDEND_EVENT_CONFLICT`.
- Deleting or editing away the event row releases only its stale row-backed semantic reservation for legitimate reconfirmation.
- `amount` means gross; `tax` means withholding tax; persisted automatic `DIV price` remains resulting net cashflow.
- Persisted automatic-DIV tax-note token format remains stable because Phase 9.2 payload hashing includes note.
- `pay_date` is not guessed or added to event identity when current producer does not publish it.
- Phase 10.2B queue/history state is a pure projection: pending + awaiting rows are recent-first in the active queue; confirmed rows are recent-first and default-collapsed.
- Confirmed-history display deliberately does **not** reconstruct actual cashflow from market estimates; exact amount/note remains the authoritative DIV transaction in Transaction History.
- Do not add another persisted filter/status authority merely for presentation convenience.

### 3F. Transaction-entry UX authority

```text
already-loaded tenant-scoped store.records
→ pure recent-first known-Symbol suggestions
→ user selects known Symbol OR freely enters new Symbol
→ existing TradeForm acceptance predicates
→ existing buildRecordPayload() normalization / price derivation
→ existing store.addRecord() / updateRecord()
→ durable mutation / recovery / recalculation lifecycle
```

- BUY/SELL actions are journal recording, not broker order submission.
- `total_amount` is `成交金額（未含費稅）`; existing payload price precedence is unchanged.
- Known-Symbol suggestions are convenience only: no ticker validity, suffix guessing, currency authority or remote symbol database.
- No Symbol suggestion list is persisted into localStorage.

### 3G. IBKR import authority

```text
user-provided IBKR CSV / Flex-style trade file
→ local preview/validation
→ stable account or explicit non-sensitive Import Profile scope
→ deterministic opaque source replay key
→ existing authenticated record-create path
→ existing calculation lifecycle
```

- No IBKR password/token storage.
- No system-principal record-write authority.
- STK execution import only unless a future product batch explicitly expands scope.
- Do not guess Account ID or Yahoo suffix.

---

## 4. Phase 7 — IBKR import product line

### 4A. Phase 7.1 — Safe IBKR Stock Trade File Import

**State: PRODUCTION CODE/PAGES VERIFIED**

Implemented product contract:

- direct CSV and IBKR `Trades,Header` / `Trades,Data`
- STK BUY/BOT and SELL/SLD only
- order-level multi-fill aggregation with quantity-weighted average price
- commission/tax aggregation
- exact ticker/currency mapping; unsupported mapping fails closed
- invalid fill taints whole order; duplicate TradeID deduplicates only when identical
- deterministic broker-source replay identity → SHA-256 durable `Idempotency-Key`
- logged-in user `POST /api/records` only
- replay-only batch is a no-op; new writes converge to at most one final readback/update lifecycle
- partial write failure reports committed/replayed counts and supports safe replay

Evidence: PR #265 merge `b925b1b80c852008e8eaf95bbb21cada874be070`; exact-head/post-main CI #958/#959; Pages #1547.

### 4B. Phase 7.1A — Stable Import Profile Scope

**State: CLOSED / PRODUCTION PAGES VERIFIED**

When Account ID is unavailable, an explicit non-sensitive Import Profile may provide stable replay scope. It is normalized and hashed into an opaque versioned profile identity; the raw label remains memory-only. No account + no profile fails closed. Multiple distinct real accounts + one profile fails closed.

Evidence: PR #266 merge `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838`; CI #961/#962; Pages #1548.

### 4C. Phase 7.1B — Metadata / Journal-Note Separation

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Machine IBKR provenance no longer occupies user-visible Journal Note. A pure projection strips only known `source=IBKR` machine fields and preserves unknown/human text. New imports apply the same projection before persistence. Legacy raw D1 notes were intentionally not bulk-mutated.

Evidence: PR #267 merge `1f82c9c5e5033e3d51cfb94267982d3fad7d618e`; CI #966/#967; Pages #1549; review `4943370397`.

Deferred: Phase 7.2 background Flex synchronization. Do not move it ahead of current Phase 10 roadmap.

---

## 5. Phase 8–9 — UX density and dividend authority

### 5A. Phase 8.1 — Responsive Daily P&L Density

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Responsive Daily P&L explainability density was improved without changing accounting values/methodology.

Evidence: PR #269 merge `f7e47744399ed31a701f67f8d7e52ab393c2c6b2`; post-main CI #971; Pages #1551.

### 5B. Phase 9.1 — Dividend Confirmation Source of Truth

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Root cause: browser-local `confirmed_dividend_keys` could diverge from Python/server DIV truth across devices/reloads.

Solution: confirmed/pending state derives from `store.records` DIV rows matching normalized `Symbol + txn_date`; localStorage authority and recovery-signal confirmation authority were removed. Definite commit/readback delay uses only memory lock.

Evidence: PR #270 exact head `d503d43f9d489935f28528126479b36935315cfe`; CI #974; review `4943784529`; merge `6bc509e4e0fd6671b036cb63ea8e210152609f8c`; CI #975 + Pages #1552.

### 5C. Phase 9.2 — Deterministic Dividend Event Identity

**State: CLOSED / PRODUCTION VERIFIED**

Root cause: generic per-intent idempotency did not prevent two independent clients creating distinct automatic intents for the same semantic dividend before either observed the DIV row.

Solution: normalized `Symbol + ex_date` → versioned `dividend.v1.<sha256>` semantic identity, tenant-scoped durable create, transactional D1 absence gate, replay success, different-payload/manual conflict fail-closed, edit-away/delete reconfirm support. Confirmation truth remains the DIV row.

Production evidence is preserved in §1C. No D1 schema migration was required.

---

## 6. Phase 10 — Approved Product UX roadmap

Approved order:

1. **Phase 10.1 — Transaction Entry UX Convergence — OPTIMIZED**
2. **Phase 10.2 — Dividend Workflow Productization — OPTIMIZED**
3. **Phase 10.3 — Journal / Transaction History UX Convergence — CURRENT NEXT**
4. **Phase 10.4 — Portfolio Decision Support**
5. Everything else waits for later discussion.

The sequence remains intentional: **entry → dividend workflow → history/journal management → decision support**.

### 6A. Phase 10.1A — Transaction Entry Information Hierarchy & Validation Clarity

**State: CLOSED / PRODUCTION PAGES VERIFIED**

- BUY/SELL actions changed to journal-recording language.
- Core execution fields precede Tag/Journal Note.
- amount surface clarified as `成交金額（未含費稅）` without changing price/amount payload semantics.
- field-specific validation reuses existing predicates.
- mobile Qty/Fee/Tax density improved.

Evidence: PR #275 / `0ca4f890...`; CI #990/#991; Pages #1557; review `4944065869`.

### 6B. Phase 10.1B — Known Symbol Suggestions & Entry Feedback

**State: CLOSED / PRODUCTION PAGES VERIFIED**

- suggestions derive only from already-loaded tenant records
- trim+uppercase, recent-first dedupe, prefix matching, bounded list
- accessible pointer/touch/keyboard listbox interaction
- new Yahoo Symbol remains freely enterable
- no remote ticker service, suffix guessing or ticker-validity authority

Evidence: PR #277 / `7e3dd9e5...`; CI #994/#995; Pages #1559; review `4944098383`.

Stable result: **Phase 10.1 OPTIMIZED FOR CURRENT REQUIREMENTS.**

### 6C. Phase 10.2A — Dividend Gross/Tax/Net Semantics & Confirmation Clarity

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Root cause:

- editable `amount` came from engine `total_gross`, `tax` from gross-minus-net, and persisted DIV price was `amount - tax`, but UI labeled amount `實發總額`.
- entering a broker net receipt into that field could subtract tax twice.
- browser also allowed negative tax / tax > gross before the Worker rejected resulting invalid semantics.

Solution:

- explicit `稅前配息總額 − 預扣稅金 = 實際入帳淨額`
- gross > 0, tax >= 0, tax <= gross
- desktop/mobile terminology converged
- confirmation shows ex-date/gross/tax/net and explicit DIV outcome
- payload/event/tax-policy/accounting authorities remain unchanged

Evidence: PR #279 / `7fbdc86e...`; CI #998/#999; Pages #1561; review `4944126543`.

### 6D. Phase 10.2B — Dividend Action Queue & Confirmed History Density

**State: CLOSED / PRODUCTION PAGES VERIFIED**

Primary product evidence:

- engine dividend history accumulates across historical ex-dates;
- DividendManager previously rendered pending, awaiting-readback and confirmed events in one full table/card stream;
- confirmed rows are non-actionable yet consumed full desktop rows/mobile cards, so current work becomes harder to find as history grows.

Implementation:

- pure workflow projection partitions pending / awaiting-readback / authoritative confirmed rows using existing identity/confirmation keys.
- active queue combines pending + awaiting and sorts the combined collection by ex-date recent-first.
- a review found and fixed the first candidate's inconsistency where pending rows were concatenated before awaiting rows despite UI promising `最新除息日優先`; focused regression locks the corrected combined ordering.
- desktop/mobile editable workflow renders only active rows.
- confirmed rows move to a default-collapsed compact history, recent-first.
- history explicitly directs exact DIV amount/note to Transaction History; it does not reuse market estimates as confirmed cashflow.
- no persisted new status/filter authority.

Compatibility:

- `store.records` DIV row still owns `已入帳`.
- current-page awaiting readback remains memory-only.
- deterministic event identity/payload/tax-note token unchanged.
- existing create/conflict/readback/recovery/recalculation unchanged.
- no Python/Worker/D1/auth/IBKR/financial methodology change.

Evidence:

- PR #281 exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`
- CI #1004 / run `31893757694`: SUCCESS
- frozen review `4944167995`: PASS / BLOCKER 0 / FOLLOW-UP 0
- merge `7c670a6c9c015c689add4ce742a4941d74e76e38`
- post-main CI #1005 / run `31893865494`: SUCCESS
- Pages #1563 / run `31893864842`: SUCCESS

Stable result:

**Phase 10.2 Dividend Workflow Productization is OPTIMIZED FOR CURRENT REQUIREMENTS.** The evidence-backed input-semantic and queue/history-density gaps are closed. Do not invent Phase 10.2C without fresh production/user evidence.

---

## 7. NOW / NEXT / BACKLOG / REJECT

### NOW

No runtime batch is active. Phase 10.2 is closed/optimized; production Pages runtime is `7c670a6c...`; production Worker remains `9b9f09f5...`.

Optional user-browser evidence, not coding blockers:

1. confirm latest pending/awaiting dividend rows appear first on desktop/mobile;
2. confirm `已入帳歷史` is collapsed by default and expands cleanly;
3. confirm gross/tax/net labels and invalid-tax blocking remain clear;
4. confirm existing DIV rows still control `已入帳` after reload;
5. optionally exercise one real IBKR file preview/write/replay flow when convenient.

### NEXT — Phase 10.3 bounded product-first audit

Proceed to **Phase 10.3 — Journal / Transaction History UX Convergence**.

Already verified from current `RecordList.vue`:

- desktop table currently renders Date / Symbol / Type / Qty / Unit Price / Total / Note / Actions;
- mobile cards render Date / Type / Symbol / Amount / Qty@Price / Fee+Tax / optional Note / Edit/Delete;
- **Tag / strategy context is not visibly rendered in either desktop or mobile record rows**, even though search already matches `r.tag` and group membership is central to portfolio strategy workflow;
- current RecordList controls provide text search, transaction type, **year** and page size; README currently says `日期區間篩選`, which is not the implemented RecordList control;
- current group filtering is applied implicitly through `store.currentGroup`, rather than being explained as a RecordList-local control;
- edit/delete already reuse existing mutation lifecycle and must remain authoritative; do not rebuild them merely for redesign.

Audit questions before selecting 10.3A:

1. What is the minimum information hierarchy that makes Symbol + Type + Strategy Tag + Journal Note readable without overloading desktop/mobile?
2. Is the first high-value fix `Tag/Journal Context visibility + accurate filter controls`, rather than a broad visual rewrite?
3. Does a real date-from/date-to filter materially improve common journal retrieval versus simply correcting README to `年份`? Implement functionality only if workflow value is demonstrated.
4. Should active filters have a visible summary/clear action so users know why records disappeared, especially on mobile?
5. Can DIV history's “go to Transaction History” need be served by existing type/search controls or a small presentation affordance without creating cross-component hidden state?
6. Preserve transaction valuation/FX fail-closed rules; redesign must not recalculate financial values.
7. Avoid bulk mutation/export/lot analytics unless a separate evidence-backed product batch justifies them.

If the audit confirms one bounded high-value gap, define **Phase 10.3A** with explicit UX scope and no financial-methodology changes. Do not pre-approve a multi-feature rewrite simply because the user called the product line a “大改版”; deliver it through independently testable batches.

After Phase 10.3, proceed to **Phase 10.4 Portfolio Decision Support**.

### BACKLOG

- physical D1 cleanup of legacy IBKR machine-only notes: only after explicit dry-run → count → sample → approval; browser projection already solves UX without destructive mutation
- Phase 5 historical lot/trade attribution: blocked until authoritative production lot-ledger producer exists
- common-period XIRR / Sharpe / Sortino / MDD / strategy scoring: separate reviewed financial methodology required
- richer IBKR types (DIV/options/futures/FX) only after current import usage proves value
- Phase 7.2 background Flex sync feasibility
- Action Center / Daily Command Center

### REJECT / DO NOT DO NOW

- do not restore `confirmed_dividend_keys` or any browser-local confirmation authority
- do not reopen Phase 9.2 with retry loops or UI-only duplicate checks without contradictory production evidence
- do not invent/infer pay-date
- do not reinterpret dividend gross as net and subtract tax again
- do not change reviewed withholding policy as part of UX work
- do not casually change automatic-DIV tax-note token; it participates in deterministic payload hashing
- do not store IBKR credentials/tokens in D1/localStorage
- do not give the Worker system principal record-write authority merely for background sync
- do not guess broker account identity or Yahoo suffix
- do not turn known-Symbol suggestions into ticker validity
- do not use Note as replay/idempotency identity
- do not bulk-delete legacy metadata merely because UI hides it
- do not rebuild Worker/Python/store architecture without evidence
- do not turn Transaction History redesign into a second valuation/accounting/FX engine
- do not implement historical lot attribution from current-day `day_ledger`

---

## 8. Fresh-session startup checklist

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this handoff.
4. Read `docs/archive/to_do_update_list_through_phase6.md` only when historical Phase 1–6 detail is needed.
5. Re-read fresh GitHub `main`, open PRs, latest CI and Pages before modifying anything.
6. If the user reports a production symptom, treat that screenshot/log/runtime result as newer evidence than prose.
7. Keep one Primary Active Batch and preserve the recovery point.
8. Follow approved Phase 10 order unless user explicitly reprioritizes.
9. When debugging, inspect same-class impact and add regression prevention.
10. Close technically optional work once the product goal is verified; do not let process/debug become the product roadmap.

---

## 9. Current stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 10.2B runtime / production Pages | `7c670a6c9c015c689add4ce742a4941d74e76e38` |
| Before Phase 10.2B / Phase 10.2A docs checkpoint | `d2bc8cea8b036f6153ccfd533e5ab22f2d78e491` |
| Phase 10.2A runtime / production Pages | `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6` |
| Before Phase 10.2A / Phase 10.1B docs checkpoint | `639ffe06f7e13ecc42063115e40dbd0de57aff5a` |
| Phase 10.1B runtime / production Pages | `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a` |
| Phase 10.1A runtime / production Pages | `0ca4f890c0771755d907d725069612dc62e6e774` |
| Phase 9.2 production activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Production Worker / Phase 9.2 runtime | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |
| Phase 9.1 stable runtime | `6bc509e4e0fd6671b036cb63ea8e210152609f8c` |
| Phase 8.1 stable runtime | `f7e47744399ed31a701f67f8d7e52ab393c2c6b2` |
| Phase 7.1B runtime | `1f82c9c5e5033e3d51cfb94267982d3fad7d618e` |
| Before 7.1B | `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838` |
| Phase 7.1 runtime | `b925b1b80c852008e8eaf95bbb21cada874be070` |
| Phase 6 stable runtime | `b922851cafd699193fe0b5f96d07178703eca96a` |

Historical recovery points through Phase 6 remain in the archive.
