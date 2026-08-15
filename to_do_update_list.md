# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, open PRs, CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **Approved Phase 10 order remains 10.1 Transaction Entry UX Convergence → 10.2 Dividend Workflow Productization → 10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support. Phase 10.1, 10.2 and 10.3 are OPTIMIZED FOR CURRENT REQUIREMENTS. No runtime batch is active. NEXT is a bounded product-first audit for Phase 10.4 Portfolio Decision Support. All other directions remain deferred.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. One Primary Active Batch. Read-only supporting audit may run while gates execute, but no second implementation batch.
3. Debug by evidence and root cause; inspect same-class impact and add regressions/prevention.
4. Financial/data correctness is fail-closed. Browser presentation must not become a second accounting, FX, tax or market-data engine.
5. R2+ requires exact-head CI, recovery point, frozen review and permanent handoff. High-consequence R1 surfaces still use canonical CI.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Technical work belongs in NOW only when required by the active product goal; optional cleanup/debug must converge.
8. Do not reopen closed phases without new material user/production evidence.
9. Preserve recovery points; never use destructive git against unknown work.

---

## 1. Current authoritative state

### Current production checkpoints

Production Pages runtime after Phase 10.3B:

`e30433b260dc928c067f0c5c0721bd22ad89d216`

Production Worker runtime:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Phase 9.2 production activation control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

A docs-only merge may advance repository `main` without changing product runtime. Always read fresh remote truth before new code.

### Product state

- Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED
- Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED
- Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 5 historical lot/trade analytics — BACKLOG until authoritative production lot-ledger exists
- Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED
- Phase 7.1A Stable Import Profile Scope — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 7.1B IBKR Metadata / Journal-Note Separation — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED
- Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 10.2 Dividend Workflow Productization — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 10.3A Transaction History Strategy Context & Filter Clarity — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 10.3B Readable Transaction Detail & Full Journal Review — CLOSED / PRODUCTION PAGES VERIFIED
- **Phase 10.3 Journal / Transaction History UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.4 Portfolio Decision Support — NEXT**

### Recent immutable evidence

#### Phase 10.3B

- PR #285 exact head `99713d2d90d20c8b9e8175c62db1e0de3e6dd686`
- exact-head CI #1014 / run `31895135196`: **SUCCESS**
- frozen review `4944221472`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk: **R1 Local / Low Risk**
- merge `e30433b260dc928c067f0c5c0721bd22ad89d216`
- post-main CI #1015 / run `31895208528`: **SUCCESS**
- Pages #1567 / run `31895207875`: **SUCCESS**
- no Worker/D1/Python/auth/IBKR/dividend/financial-methodology change; no Worker deployment

#### Phase 10.3A

- PR #283 exact head `ff22b79a34da6b3386dc87740e74b53abf7e7000`
- CI #1008 / run `31894465820`: **SUCCESS**
- review `4944195104`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `d1e799570c70381864db3ed4cfe0e9129d2a6bac`
- post-main CI #1009 / run `31894538466`: **SUCCESS**
- Pages #1565 / run `31894537919`: **SUCCESS**

#### Phase 10.2B / 10.2A

- 10.2B PR #281 exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`; CI #1004; review `4944167995`; merge `7c670a6c9c015c689add4ce742a4941d74e76e38`; post-main CI #1005 + Pages #1563: **SUCCESS**
- 10.2A PR #279 exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`; CI #998; review `4944126543`; merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`; post-main CI #999 + Pages #1561: **SUCCESS**

#### Phase 10.1B / 10.1A

- 10.1B PR #277 exact head `991969064b7fb07ded36c0783de80e81d9da30f5`; CI #994; review `4944098383`; merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`; post-main CI #995 + Pages #1559: **SUCCESS**
- 10.1A PR #275 exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`; CI #990; review `4944065869`; merge `0ca4f890c0771755d907d725069612dc62e6e774`; post-main CI #991 + Pages #1557: **SUCCESS**

#### Phase 9.2 production activation

- runtime PR #272 exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`; CI #982; review `4943920254`; runtime merge / Worker source `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- post-main CI #983 + Pages #1554: SUCCESS
- Production Identity Evidence #18 run `31888643879`: SUCCESS; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`; CI #984; review `4943976191`; merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- post-main CI #985 + Pages #1555: SUCCESS
- Deployment Dispatch Broker #4 run `31888823649`: SUCCESS
- Deploy Worker #7 run `31888830988`: SUCCESS
- post-deploy artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- Worker release `4.08`, API `2.61`, schema `3`

Earlier Phase 7–9 closure evidence remains recoverable from repository history and prior handoff checkpoints; detailed Phase 1–6 chronology remains in the archive.

---

## 2. Stable authority boundaries

### Mutation / calculation

```text
record durable intent
→ tenant-scoped idempotent Worker write
→ committed mutation/readback
→ durable dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser source/benchmark verification
```

Do not create parallel broker/dividend/journal/UI accounting or recovery state machines.

### Financial / FX

```text
symbol
→ shared native-currency contract
→ PortfolioCalculator transaction semantics
→ verified snapshot/record identity
→ exact transaction-date published FX
→ presentation
```

No nearest-date guessing or hard-coded FX fallback. Transaction History summary continues to use existing `resolveSettlementAmountNative()` and verified `resolveTransactionValuation()`.

### Journal / Transaction History after Phase 10.3

```text
store.records
→ global store.currentGroup scope
→ pure local Symbol/Tag/Note query + type + inclusive date range
→ sort / pagination
→ compact desktop/mobile summary
→ optional page-memory read-only full detail
→ separate existing edit/delete lifecycle
```

Rules:

- `record.tag` remains strategy metadata/current-group input; Tag chips are presentation only.
- search covers Symbol + Tag + Journal Note.
- date range is calendar-valid, inclusive and fail-closed for invalid/reversed ranges.
- local clear resets only query/type/date; never silently changes global `store.currentGroup`.
- global strategy scope is visible.
- filter and detail-expansion state are not persisted to localStorage.
- `顯示筆數` is the filtered result count.
- Journal Note persistence remains Worker/D1; no note-only mutation path.
- note changes remain excluded from financial snapshot source identity.
- `RecordDetailPanel` is read-only: no store/API/mutation/TWD-valuation dependency.
- full detail shows stored date/type/Symbol/qty/price, separate fee/tax, strategy tags and full Journal Note.
- for DIV, stored `price` is labeled as DIV入帳金額; detail does not reconstruct dividend accounting.
- detail explicitly states performance/TWD valuation remain existing calculation/snapshot authorities.
- View / Edit / Delete remain separate intents.
- no historical lot attribution may be inferred from current-day `day_ledger`.

### Dividend

- actual same-tenant DIV row is the only `已入帳` authority.
- no browser-local confirmation authority.
- definite commit/readback delay uses only page-memory lock.
- automatic event identity remains versioned `dividend.v1.<sha256>` from normalized Symbol + ex_date.
- gross/tax/net/currency/shares are payload/derived values, not event identity.
- automatic DIV remains qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`.
- tax-note token remains stable because payload hashing includes note.
- no pay-date inference.
- confirmed-history presentation never reconstructs actual cashflow from market estimates.

### Transaction entry

Known-Symbol suggestions are pure convenience from loaded records; no ticker-validity authority, suffix guessing, remote symbol database or localStorage cache. Existing TradeForm/buildRecordPayload/add-update mutation lifecycle remains authoritative.

### IBKR import

User-provided file → local preview/validation → stable account or explicit non-sensitive Import Profile → deterministic replay key → existing authenticated record-create. No IBKR credentials in D1/localStorage and no system-principal record writes.

---

## 3. Phase 10 roadmap status

1. **Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED**
2. **Phase 10.2 Dividend Workflow Productization — OPTIMIZED**
3. **Phase 10.3 Journal / Transaction History UX Convergence — OPTIMIZED**
4. **Phase 10.4 Portfolio Decision Support — NEXT**
5. Everything else waits for later discussion.

### Phase 10.3A summary

Closed the retrieval/context gap: visible strategy Tags, inclusive date-range filters, explicit global-group/filter context, accurate filtered-count language, date-only handling without timezone roundtrip. Preserved valuation and mutation authorities.

### Phase 10.3B summary

Closed the journal-readability gap: explicit accessible read-only record expansion on desktop/mobile, full Journal Note, full Tags, separate fee/tax and stored transaction facts without entering Edit mode. Detail state is page-memory only and collapses on retrieval/sort/page/edit/delete context changes. An accessibility review added explicit `aria-label` to glyph-only detail toggles before merge.

### Phase 10.3 closure decision

Bounded post-10.3B audit found no remaining high-frequency core journal gap that justifies a 10.3C. Bulk edit/export, lot analytics and cross-component hidden navigation would expand authority/operation surface without current usage evidence. They remain deferred rather than being added merely to make the redesign larger.

**Phase 10.3 is OPTIMIZED FOR CURRENT REQUIREMENTS. Reopen only for fresh user/production evidence.**

---

## 4. NOW / NEXT / BACKLOG / REJECT

### NOW

No runtime batch active. Production Pages runtime is `e30433b...`; production Worker remains `9b9f09f5...`.

Optional browser evidence, not blockers:

1. verify Tag chips/date filters/filter context remain comfortable on desktop/mobile;
2. verify `查看明細` exposes full Note and separate fee/tax without entering Edit;
3. verify sorting/filtering/page changes close stale detail expansion;
4. verify Edit/Delete behavior and TWD summary valuation remain unchanged.

### NEXT — Phase 10.4 bounded product-first audit

Proceed to **Portfolio Decision Support** using existing authoritative portfolio facts first.

Audit questions:

1. Which existing published facts are decision-useful but currently scattered across Stats Grid, Holdings, strategy groups and explainability?
2. Can a compact decision-support surface answer **what is concentrated / what drove results / what needs attention** without inventing a browser risk score?
3. Prefer deterministic projections over authoritative `summary`, `holdings`, `day_ledger`, strategy/group metrics and reliability metadata; AI may summarize structured facts, but **AI does not calculate the ledger**.
4. Concentration/weight, contribution, strategy exposure and data-reliability signals are candidates only where source fields are already authoritative and semantically clear.
5. Do not create Sharpe/Sortino/MDD/forecast/target-price/rebalancing recommendations unless separately reviewed financial methodology and data support them.
6. Do not infer cash exposure because the current accounting model has no explicit cash asset.
7. Select only one highest-value bounded Phase 10.4A after audit evidence.

### BACKLOG

- physical cleanup of legacy IBKR machine notes only after dry-run/count/sample/approval
- Phase 5 historical lot/trade attribution until authoritative producer exists
- common-period XIRR / Sharpe / Sortino / MDD / scoring: separate methodology review
- richer IBKR types after current STK import usage proves value
- Phase 7.2 background Flex sync feasibility
- Action Center / Daily Command Center
- Transaction History bulk edit/export unless fresh usage evidence

### REJECT / DO NOT DO NOW

- no browser-local dividend confirmation authority
- no UI-only duplicate/retry state replacing Phase 9.2
- no inferred pay-date or unreviewed tax policy
- no casual automatic-DIV tax-note-token changes
- no IBKR credential storage/system-principal record writes
- no account/suffix guessing
- no ticker-validity promotion from suggestions
- no Journal Note replay identity
- no Worker/Python/store rebuild without evidence
- no second browser valuation/accounting/FX engine
- no historical lot attribution from current-day `day_ledger`
- no invented portfolio risk score or investment forecast in Phase 10.4 without reviewed methodology

---

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Read Phase 1–6 archive only when needed.
3. Re-read fresh main/open PR/CI/Pages before modifications.
4. Treat new user screenshots/logs/production symptoms as newer than prose.
5. Keep one Primary Active Batch and recovery point.
6. Follow approved Phase 10 order unless user explicitly reprioritizes.
7. Debug same-class impact + regression prevention.
8. Close optional technical work once product goal is verified.

---

## 6. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 10.3B runtime / production Pages | `e30433b260dc928c067f0c5c0721bd22ad89d216` |
| Before Phase 10.3B / Phase 10.3A docs checkpoint | `19adcd6f8927d793776e9d9f8a80e474aad6d3b7` |
| Phase 10.3A runtime / production Pages | `d1e799570c70381864db3ed4cfe0e9129d2a6bac` |
| Before Phase 10.3A / Phase 10.2 docs checkpoint | `22f5d48ab2bc1ec37c0d707605c13e4733bd4bb2` |
| Phase 10.2B runtime | `7c670a6c9c015c689add4ce742a4941d74e76e38` |
| Phase 10.2A runtime | `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6` |
| Phase 10.1B runtime | `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a` |
| Phase 10.1A runtime | `0ca4f890c0771755d907d725069612dc62e6e774` |
| Phase 9.2 activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Production Worker / Phase 9.2 runtime | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |
| Phase 9.1 runtime | `6bc509e4e0fd6671b036cb63ea8e210152609f8c` |
| Phase 8.1 runtime | `f7e47744399ed31a701f67f8d7e52ab393c2c6b2` |
| Phase 7.1B runtime | `1f82c9c5e5033e3d51cfb94267982d3fad7d618e` |
| Phase 7.1A runtime | `df2c383a447ca1ea058b46ee4dc3a4e7dfd62838` |
| Phase 7.1 runtime | `b925b1b80c852008e8eaf95bbb21cada874be070` |
| Phase 6 stable runtime | `b922851cafd699193fe0b5f96d07178703eca96a` |

Historical recovery points through Phase 6 remain in the archive.
