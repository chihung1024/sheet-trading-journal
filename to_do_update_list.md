# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, open PRs, CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **Phase 11 Daily Portfolio Command Center / Action Center is OPTIMIZED FOR CURRENT REQUIREMENTS after Phase 11.1 Daily Command Snapshot. No runtime batch is active. The user explicitly deprioritized the former Phase 12 IBKR Sync Automation because IBKR is broker-specific and not relevant to every user. IBKR automation is now an optional broker-integration backlog item, not the default next phase. The next product direction must be re-ranked by cross-user coverage, usage frequency and core UX value rather than phase-number sequence.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. One Primary Active Batch. Read-only supporting audit may run while gates execute, but no second implementation batch.
3. Debug by evidence and root cause; inspect same-class impact and add regression/prevention.
4. Financial/data correctness is fail-closed. Browser presentation must not become a second accounting, FX, tax or market-data engine.
5. R2+ requires exact-head CI, recovery point, frozen review and permanent handoff. High-consequence R1 surfaces still use canonical CI.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Technical work belongs in NOW only when required by the active product goal; optional cleanup/debug must converge.
8. Do not reopen closed phases without fresh material user/production evidence.
9. Preserve recovery points; never use destructive git against unknown work.
10. When no approved runtime direction remains, stop rather than inventing technical work.
11. **Do not treat phase numbering as automatic priority.** Rank new product work by cross-user applicability, frequency of use, product/UX impact and evidence. Broker-specific integrations must not displace higher-value universal functionality merely because they are next numerically.

---

## 1. Current authoritative state

### Current production checkpoints

Production Pages runtime after Phase 11.1:

`cb4ae5d09753d0b559b33e3c7448e857cf0016e9`

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
- **Phase 10 roadmap — COMPLETE**
- **Phase 11 Daily Portfolio Command Center / Action Center — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **Former Phase 12 IBKR Sync Automation — SKIPPED AS DEFAULT NEXT PHASE / OPTIONAL BROKER-SPECIFIC BACKLOG**
- **No runtime batch active; next product phase not yet selected**

### Recent immutable evidence

#### Phase 11.1 — Daily Command Snapshot

- PR #289 final exact head `3680d1b1749a552056c9910a0d6a3e616120f4cc`
- exact-head canonical CI #1022 / run `31897365290`: **SUCCESS**
- frozen review `4944307999`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- final risk: **R1 Local / Low Risk**
- merge `cb4ae5d09753d0b559b33e3c7448e857cf0016e9`
- post-main CI #1023 / run `31897451236`: **SUCCESS**
- Pages #1571 / run `31897450481`: **SUCCESS**
- App integration is +6 lines only; runtime branch changed exactly App + new command component + pure composition service + focused test
- no Worker/D1/Python/auth/IBKR/mutation/calculation-lifecycle/market-data change; no Worker deployment

#### Phase 10.4A — Portfolio Concentration Decision Snapshot

- PR #287 exact head `0912147c671e3afea005af4e8dd0c37f5f1d9b3d`
- exact-head CI #1018 / run `31895710611`: **SUCCESS**
- review `4944247685`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a`
- post-main CI #1019 + Pages #1569: **SUCCESS**

#### Phase 10.3 / 10.2 / 10.1

- 10.3B PR #285 exact head `99713d2d90d20c8b9e8175c62db1e0de3e6dd686`; CI #1014; review `4944221472`; merge `e30433b260dc928c067f0c5c0721bd22ad89d216`; post-main CI #1015 + Pages #1567: **SUCCESS**
- 10.3A PR #283 exact head `ff22b79a34da6b3386dc87740e74b53abf7e7000`; CI #1008; review `4944195104`; merge `d1e799570c70381864db3ed4cfe0e9129d2a6bac`; post-main CI #1009 + Pages #1565: **SUCCESS**
- 10.2B PR #281 exact head `2449ede597c5cc3a6eadd3e698b4c17a63b172a5`; CI #1004; review `4944167995`; merge `7c670a6c9c015c689add4ce742a4941d74e76e38`; post-main CI #1005 + Pages #1563: **SUCCESS**
- 10.2A PR #279 exact head `c383e4aa4c7a26d88890189f4f48c0e3f4105bc2`; CI #998; review `4944126543`; merge `7fbdc86e9b59861ba9c33ba8e145913fcbe225e6`; post-main CI #999 + Pages #1561: **SUCCESS**
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

Earlier Phase 7–9 evidence remains recoverable from repository history and prior checkpoints. Phase 1–6 chronology remains in the archive.

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

### Dividend

- actual same-tenant DIV row is the only `已入帳` authority;
- no browser-local confirmation authority;
- event identity remains versioned `dividend.v1.<sha256>` from normalized Symbol + ex_date;
- automatic DIV remains qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`;
- no inferred pay-date or unreviewed tax policy;
- confirmed-history presentation never reconstructs actual cashflow from market estimates.

### Journal / Transaction History

```text
store.records
→ global currentGroup scope
→ pure Symbol/Tag/Note query + type + inclusive date range
→ compact summary / optional page-memory full detail
→ existing Edit/Delete lifecycle
```

No note-only persistence bypass, no localStorage filter/detail authority, no historical lot inference from current-day `day_ledger`, and no second valuation engine.

### Portfolio concentration

```text
current-group holdings[].market_value_twd
+ authoritative summary.total_value
→ reconciliation gate
→ factual holding weights / largest holding / Top-3 concentration
→ presentation only
```

No cash inference, risk threshold, risk score, target allocation, forecast or buy/sell recommendation.

### Daily Command Center after Phase 11.1

```text
existing reviewed Daily P&L explanation
+ Phase 10.4A reconciled concentration
+ current-group pending dividend candidates
+ all authoritative records
→ pure dailyCommandCenter composition
→ Overview summary + navigation only
```

Rules:

- daily contributor/detractor is selected only from `buildDailyPnlExplanation()` rows after its existing day-ledger and summary reconciliation;
- if daily explanation is unavailable, Command Center does not infer drivers;
- concentration is shown only when Phase 10.4A projection is `ok`;
- pending dividend attention uses current-group pending candidates but confirmation remains all-records authoritative DIV event identity;
- Command Center does not copy DividendManager page-memory awaiting-readback state;
- recent transaction follows existing deterministic recent-first records and current-group Tag semantics;
- no new durable attention/task state, localStorage, retry engine or mutation path;
- navigation reuses App `activeView` only;
- global reliability/retry authority remains `DataReliabilityBanner`; do not duplicate it as another Command Center state machine;
- no risk score, forecast, target allocation, rebalance advice or AI-generated ledger facts.

### IBKR import

User-provided file → local preview/validation → stable broker account or explicit non-sensitive Import Profile → deterministic replay key → existing authenticated record-create. No IBKR credentials in D1/localStorage and no system-principal record writes.

IBKR-specific automation remains optional integration work. It must not become a prerequisite for core journal functionality or the default product roadmap because users may use other brokers or manual entry/import workflows.

---

## 3. Product roadmap status

### Phase 10 — COMPLETE

1. Transaction Entry UX Convergence — OPTIMIZED
2. Dividend Workflow Productization — OPTIMIZED
3. Journal / Transaction History UX Convergence — OPTIMIZED
4. Portfolio Decision Support — OPTIMIZED

### Phase 11 — Daily Portfolio Command Center / Action Center — OPTIMIZED

#### 11.1 Daily Command Snapshot — CLOSED / PRODUCTION PAGES VERIFIED

Overview now answers four daily questions from existing authoritative facts:

1. **What drove today?** — published/reconciled Daily P&L + strongest positive/negative Symbol.
2. **Where am I concentrated?** — largest holding + Top-3 concentration from Phase 10.4A.
3. **What dividend still lacks an authoritative DIV record?** — current-group pending candidate count and latest candidate.
4. **What was my latest transaction in this strategy scope?** — recent-first record using existing group semantics.

Navigation leads to Holdings / Dividends / Records through the existing view state. Desktop uses a compact 2-column grid; mobile uses one column.

#### Post-11.1 bounded audit — no 11.2 justified now

- Data reliability, stale/read failures and retry actions already have a dedicated global authority: `DataReliabilityBanner`.
- Repeating those states inside the Command Center would create duplicate attention semantics without product benefit.
- Missing Journal Note / optional metadata is not automatically an actionable defect; no proven user rule says every record requires a note.
- Existing daily explainability, concentration, dividend queue and recent transaction now cover the evidence-backed daily command use cases.

**Phase 11 is OPTIMIZED FOR CURRENT REQUIREMENTS. Reopen only for fresh user/production evidence.**

### Former Phase 12 — IBKR Sync Automation — SKIPPED AS DEFAULT NEXT PHASE

User decision on 2026-08-16:

- IBKR is not used by every user;
- broker-specific automation therefore does not justify default next-phase priority;
- existing IBKR file-import functionality remains intact and supported;
- background/Flex automation may be revisited later only as an optional integration when there is explicit user demand;
- skipping this roadmap slot does **not** mean the next project must be renamed Phase 13. The next phase should be selected and numbered after product re-prioritization.

**Next-phase selection principle:** prefer functionality that benefits the broad user base and materially improves frequent journal/portfolio workflows before broker-specific integrations.

---

## 4. NOW / DEFERRED

### NOW

No runtime batch active. Production Pages runtime is `cb4ae5d09753d0b559b33e3c7448e857cf0016e9`; production Worker remains `9b9f09f5079c59750219c73e23002a7ab8d2f33e`.

Next runtime direction is intentionally unselected. Before opening a new batch, perform a bounded product audit and rank candidates by:

1. cross-user applicability;
2. frequency / friction in normal use;
3. direct product-functionality or UX improvement;
4. ability to reuse authoritative existing facts without adding unnecessary financial methodology;
5. implementation risk and maintenance cost only after the product-value criteria above.

Optional browser evidence, not blockers:

1. verify Daily Command Center density on desktop/mobile with real account data;
2. verify group switching updates daily drivers, concentration, pending dividends and latest record consistently;
3. verify command cards navigate to Holdings / Dividends / Records without altering calculation state;
4. verify unavailable daily/concentration facts remain fail-closed rather than showing guessed values.

### OPTIONAL / DEFERRED — discuss/reprioritize before starting

- **IBKR Sync Automation / former Phase 12 / former Phase 7.2 background Flex feasibility — broker-specific optional backlog, not next by default**;
- Transaction History Power Tools / bulk edit-export only with usage evidence;
- Authoritative Historical Lot Ledger after a trustworthy producer exists;
- Advanced Portfolio Analytics (Sharpe/Sortino/MDD etc.) after methodology review;
- AI Portfolio / Journal Intelligence over deterministic structured facts only;
- richer IBKR transaction types;
- physical cleanup of legacy machine notes.

Do not infer priority from the old Phase 12/13/14/15/16 numbering. Re-rank future work from current product evidence and user coverage before assigning the next phase number.

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
- no strategy allocation percentages from overlapping groups unless non-overlap semantics are explicitly proven;
- no second reliability/action-state machine inside Daily Command Center while DataReliabilityBanner owns that concern;
- no broker-specific integration promoted to core-roadmap priority solely because of phase numbering.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Read Phase 1–6 archive only when needed.
3. Re-read fresh main/open PR/CI/Pages before modifications.
4. Treat new user screenshots/logs/production symptoms as newer than prose.
5. If the user selects a new product direction, keep one Primary Active Batch and preserve its recovery point.
6. Reopen completed Phase 10/11 work only for fresh material evidence.
7. Debug same-class impact + regression prevention.
8. Treat IBKR Sync Automation as optional broker-specific backlog unless the user explicitly reprioritizes it.
9. Select the next phase from current cross-user product evidence; do not auto-advance old numerical roadmap labels.

---

## 7. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 11.1 runtime / production Pages | `cb4ae5d09753d0b559b33e3c7448e857cf0016e9` |
| Before Phase 11.1 / completed Phase 10 docs checkpoint | `c0773fbc4c63397262e0889b0466c280ca36b7ae` |
| Phase 10.4A runtime / production Pages | `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a` |
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