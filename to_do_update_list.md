# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, open PRs, CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-15 Asia/Taipei**  
Current line: **The user-approved Phase 10 roadmap is COMPLETE / OPTIMIZED FOR CURRENT REQUIREMENTS: 10.1 Transaction Entry UX Convergence → 10.2 Dividend Workflow Productization → 10.3 Journal / Transaction History UX Convergence → 10.4 Portfolio Decision Support. No runtime batch is active. No new product direction is selected. Per user instruction, all remaining directions are deferred until later discussion. Reopen a completed Phase 10 product line only for fresh material production/user evidence.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. One Primary Active Batch. Read-only supporting audit may run while gates execute, but no second implementation batch.
3. Debug by evidence and root cause; inspect same-class impact and add regression/prevention.
4. Financial/data correctness is fail-closed. Browser presentation must not become a second accounting, FX, tax or market-data engine.
5. R2+ requires exact-head CI, recovery point, frozen review and permanent handoff. High-consequence R1 surfaces still use canonical CI.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Technical work belongs in NOW only when required by the active product goal; optional cleanup/debug must converge.
8. Do not reopen closed phases without new material user/production evidence.
9. Preserve recovery points; never use destructive git against unknown work.
10. When no approved runtime direction remains, stop rather than inventing technical work.

---

## 1. Current authoritative state

### Current production checkpoints

Production Pages runtime after Phase 10.4A:

`6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a`

Production Worker runtime:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Phase 9.2 production activation control-plane checkpoint:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

A docs-only closeout merge may advance repository `main` without changing product runtime. Always read fresh remote truth before future work.

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
- **Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.2 Dividend Workflow Productization — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.3 Journal / Transaction History UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Phase 10.4 Portfolio Decision Support — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **User-approved Phase 10 roadmap — COMPLETE / NO RUNTIME BATCH ACTIVE**

### Recent immutable evidence

#### Phase 10.4A — Portfolio Concentration Decision Snapshot

- PR #287 final exact head `0912147c671e3afea005af4e8dd0c37f5f1d9b3d`
- exact-head canonical CI #1018 / run `31895710611`: **SUCCESS**
- frozen review `4944247685`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk: **R1 Local / Low Risk**
- merge `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a`
- post-main CI #1019 / run `31895795774`: **SUCCESS**
- Pages #1569 / run `31895794975`: **SUCCESS**
- changed only Holdings presentation, pure concentration projection and focused regression coverage
- no Worker/D1/Python/auth/IBKR/dividend/financial-methodology change; no Worker deployment

#### Phase 10.3B / 10.3A

- 10.3B PR #285 exact head `99713d2d90d20c8b9e8175c62db1e0de3e6dd686`; CI #1014; review `4944221472`; merge `e30433b260dc928c067f0c5c0721bd22ad89d216`; post-main CI #1015 + Pages #1567: **SUCCESS**
- 10.3A PR #283 exact head `ff22b79a34da6b3386dc87740e74b53abf7e7000`; CI #1008; review `4944195104`; merge `d1e799570c70381864db3ed4cfe0e9129d2a6bac`; post-main CI #1009 + Pages #1565: **SUCCESS**

#### Phase 10.2B / 10.2A

- 10.2B PR #281 exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`; CI #1004; review `4944167995`; merge `7c670a6c9c015c689add4ce742a4941d74e76e38`; post-main CI #1005 + Pages #1563: **SUCCESS**
- 10.2A PR #279 exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`; CI #998; review `4944126543`; merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`; post-main CI #999 + Pages #1561: **SUCCESS**

#### Phase 10.1B / 10.1A

- 10.1B PR #277 exact head `991969064b7fb07ded36c0783de80e81d9da30f5`; CI #994; review `4944098383`; merge `7e3dd9e5cf1ea4ec19ddcc6e4f8ed5aaf713b32a`; post-main CI #995 + Pages #1559: **SUCCESS**
- 10.1A PR #275 exact head `db9f448e8598edec7cc362f4c1e9539aecbec7a9`; CI #990; review `4944065869`; merge `0ca4f890c0771755d907d725069612dc62e6e774`; post-main CI #991 + Pages #1557: **SUCCESS**

#### Phase 9.2 production activation

- runtime PR #272 exact head `82be8f48daa95765c7052d304e6d1db3f98b8d08`; CI #982; review `4943920254`; runtime merge / Worker source `9b9f09f5079c59750219c73e23002a7ab8d2f33e`
- Production Identity Evidence #18 run `31888643879`: SUCCESS; artifact `9247940460`; digest `sha256:0cdf3e83ff2450ba3aa83ffa226ac9df9b61980421372520e3e4e1379de54f7a`
- activation PR #273 exact head `fda54c6c3c9b4f045a3e51976d076e742f850f30`; CI #984; review `4943976191`; merge `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`
- Deployment Dispatch Broker #4 run `31888823649`: SUCCESS
- Deploy Worker #7 run `31888830988`: SUCCESS
- post-deploy artifact `9248000489`; digest `sha256:912d203dc8e692a3c403a7efa22653276b3f5dc10adeec85810303fc4358c08c`
- Worker release `4.08`, API `2.61`, schema `3`

Earlier Phase 7–9 closure evidence remains recoverable from repository history and prior handoff checkpoints. Detailed Phase 1–6 chronology remains in the archive.

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

No nearest-date guessing or hard-coded FX fallback.

### Transaction entry

Known-Symbol suggestions are convenience from already-loaded records only. No ticker-validity authority, suffix guessing, remote Symbol database or localStorage Symbol cache. Existing TradeForm/buildRecordPayload/add-update mutation lifecycle remains authoritative.

### Dividend

- actual same-tenant DIV row is the only `已入帳` authority;
- no browser-local confirmation authority;
- event identity remains versioned `dividend.v1.<sha256>` from normalized Symbol + ex_date;
- automatic DIV remains qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`;
- tax-note token remains stable because payload hashing includes note;
- no pay-date inference;
- confirmed-history presentation never reconstructs actual cashflow from market estimates.

### Journal / Transaction History

```text
store.records
→ global currentGroup scope
→ pure Symbol/Tag/Note query + type + inclusive date range
→ sort / pagination
→ compact summary
→ optional page-memory read-only full detail
→ separate existing Edit/Delete lifecycle
```

No note-only persistence bypass, no localStorage filter/detail authority, no historical lot inference from current-day `day_ledger`, and no second valuation engine.

### Portfolio Decision Support after Phase 10.4A

```text
current-group published holdings[].market_value_twd
+ authoritative summary.total_value
→ browser reconciliation gate
→ factual holding weights / largest holding / Top-3 concentration
→ presentation only
```

Rules:

- positive holding market values must reconcile to authoritative summary total or concentration is unavailable;
- duplicate normalized Symbols and invalid/negative market values fail closed;
- zero market-value residual rows are excluded from the denominator and are not treated as cash;
- figures explicitly exclude cash because the current model has no explicit cash asset;
- desktop/mobile holding weights use the same pure projection;
- no threshold such as “overweight” or “dangerous concentration” is encoded;
- no risk score, target allocation, rebalance advice, forecast, expected return, Sharpe/Sortino/MDD or buy/sell recommendation;
- existing Daily P&L explainability remains the authority for current-day contribution facts;
- existing Strategy Analytics remains the authority for reviewed group-performance facts;
- strategy tags may overlap, so group current values must not be silently converted into mutually-exclusive allocation percentages without a separately proven semantic contract.

### IBKR import

User-provided file → local preview/validation → stable broker account or explicit non-sensitive Import Profile → deterministic replay key → existing authenticated record-create. No IBKR credentials in D1/localStorage and no system-principal record writes.

---

## 3. User-approved Phase 10 roadmap — closure

1. **Phase 10.1 Transaction Entry UX Convergence — OPTIMIZED**
   - 10.1A: recording terminology, information hierarchy, field-specific validation, mobile density.
   - 10.1B: recent known-Symbol suggestions without new market/ticker authority.

2. **Phase 10.2 Dividend Workflow Productization — OPTIMIZED**
   - 10.2A: explicit gross / withholding / net entry contract and safe validation.
   - 10.2B: recent actionable dividend queue + default-collapsed authoritative confirmed history.

3. **Phase 10.3 Journal / Transaction History UX Convergence — OPTIMIZED**
   - 10.3A: visible strategy context, inclusive date retrieval, active filter/group transparency.
   - 10.3B: accessible read-only full transaction/journal detail without entering Edit mode.

4. **Phase 10.4 Portfolio Decision Support — OPTIMIZED**
   - 10.4A: fail-closed current-group holding weights and concentration snapshot.
   - Post-10.4A bounded audit found no additional high-frequency gap that can be added without duplicating existing explainability/strategy analytics or introducing unreviewed financial methodology.

### Phase 10.4 closure decision

- “Where am I concentrated?” is now answered from reconciled published holding values.
- “What drove today?” is already answered by existing Daily P&L explainability.
- “How are strategy groups performing?” is already answered by Strategy Analytics.
- Advanced risk scores, forecasts, target allocation/rebalancing and Sharpe/Sortino/MDD require separate reviewed methodology and are not justified merely to enlarge decision support.
- Strategy tags can overlap; no mutually-exclusive strategy allocation chart is inferred without a proven non-overlap contract.
- Cash exposure is not inferred because there is no explicit cash asset.

**Phase 10.4 is OPTIMIZED FOR CURRENT REQUIREMENTS. The complete user-approved Phase 10 roadmap is now COMPLETE.**

---

## 4. NOW / DEFERRED

### NOW

No runtime batch active. Production Pages runtime is `6e1f3207...`; production Worker remains `9b9f09f5...`.

Optional browser evidence, not blockers:

1. verify Holdings shows desktop/mobile weights and concentration snapshot for normal reconciled data;
2. verify current-group switching updates the concentration scope;
3. verify no concentration percentage is shown when holdings/summary cannot reconcile;
4. verify Transaction History and Dividend Workflow remain comfortable after their Phase 10 changes.

### DEFERRED — discuss before starting

Per user instruction, no new runtime direction is selected after Phase 10. Remaining candidates require later discussion/reprioritization, including:

- Phase 7.2 background IBKR/Flex sync feasibility;
- Action Center / Daily Command Center;
- Transaction History bulk edit/export;
- richer IBKR types;
- physical cleanup of legacy machine notes;
- Phase 5 historical lot/trade attribution after authoritative producer exists;
- common-period Sharpe/Sortino/MDD/scoring or other new financial methodology;
- portfolio forecasts, target allocation or rebalancing recommendations.

Do not autonomously start any of these solely because Phase 10 is complete.

---

## 5. REJECT / DO NOT DO WITHOUT NEW EVIDENCE

- no browser-local dividend confirmation authority;
- no UI-only duplicate/retry replacement for Phase 9.2;
- no inferred pay-date or unreviewed dividend tax policy;
- no casual automatic-DIV tax-note-token changes;
- no IBKR credential storage/system-principal record writes;
- no account/suffix guessing;
- no ticker-validity promotion from suggestions;
- no Journal Note replay identity;
- no Worker/Python/store rebuild without product evidence;
- no second browser valuation/accounting/FX engine;
- no historical lot attribution from current-day `day_ledger`;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no strategy allocation percentages from overlapping groups unless non-overlap semantics are explicitly proven.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Read Phase 1–6 archive only when needed.
3. Re-read fresh main/open PR/CI/Pages before modifications.
4. Treat new user screenshots/logs/production symptoms as newer than prose.
5. If the user selects a new product direction, keep one Primary Active Batch and preserve its recovery point.
6. Reopen completed Phase 10 work only for fresh material evidence.
7. Debug same-class impact + regression prevention.
8. Do not start deferred work until the user discusses/reprioritizes it.

---

## 7. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 10.4A runtime / production Pages | `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a` |
| Before Phase 10.4A / Phase 10.3 docs checkpoint | `ec0eb8277442c14b1290e887c0b92957af6392ee` |
| Phase 10.3B runtime | `e30433b260dc928c067f0c5c0721bd22ad89d216` |
| Phase 10.3A runtime | `d1e799570c70381864db3ed4cfe0e9129d2a6bac` |
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
