# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote state, open PRs, CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **Phase 13 Cross-Page UX Consistency & Holdings Visualization is OPTIMIZED FOR CURRENT REQUIREMENTS after 13.1A–13.1C. No runtime batch is active. Holdings now has reconciled bar + donut allocation views; transaction Note density and cross-page typography/spacing are converged. Sector / industry / sub-industry allocation is intentionally not implemented until an authoritative metadata producer exists. Former Phase 12 IBKR Sync Automation remains optional broker-specific backlog, not the default next phase.**

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
11. Do not treat phase numbering as automatic priority. Rank work by cross-user applicability, frequency of use, product/UX impact and evidence. Broker-specific integrations must not displace higher-value universal functionality merely because they are next numerically.

---

## 1. Current authoritative state

### Production checkpoints

Production Pages runtime after Phase 13.1C:

`1d94596f4711027eae2b91343ea77b62aa87f715`

Production Worker runtime remains:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Phase 9.2 production activation control plane:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

A docs-only closeout merge may advance repository `main` without changing product runtime. Always read fresh remote truth before future work.

### Product state

- Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED
- Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED
- Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 5 Historical Lot / Trade Analytics — BACKLOG until authoritative production lot-ledger exists
- Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED
- Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED
- Phase 10 roadmap — COMPLETE / OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 11 Daily Portfolio Command Center / Action Center — OPTIMIZED FOR CURRENT REQUIREMENTS
- Former Phase 12 IBKR Sync Automation — SKIPPED AS DEFAULT NEXT PHASE / OPTIONAL BROKER-SPECIFIC BACKLOG
- **Phase 13 Cross-Page UX Consistency & Holdings Visualization — OPTIMIZED FOR CURRENT REQUIREMENTS**
- **No runtime batch active; next product phase is intentionally unselected**

---

## 2. Phase 13 immutable evidence

### Phase 13.1A — Cross-Page Visual Consistency Foundation

Product result:

- shared typography, spacing, control-height, card and table-density tokens in `src/styles/product-consistency.css`;
- consistent rhythm across Overview / Chart shell / Holdings / Records / Dividends, with global card/input/button scale also inherited by the transaction side panel;
- Daily Command Center and Stats cards use one visual hierarchy;
- Record History Note width was initially bounded and full-note authority remained the existing read-only detail panel;
- no financial/data/mutation authority changed.

Evidence:

- PR #292 final exact head `e6e5ca009542e6367e0148d461ed047e18be7790`
- exact-head CI #1028 / run `31900437897`: **SUCCESS**
- frozen review `4944420384`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `0714ac880d28a5ecacd8fa57e8fb1c40b7e0937f`
- post-main CI #1029 / run `31900492133`: **SUCCESS**
- Pages #1574 / run `31900491307`: **SUCCESS**

### Phase 13.1B — Holdings Allocation Visualization

Product result:

- existing Top-holdings bar ranking is preserved;
- new accessible donut visualization gives a whole-portfolio composition view;
- donut consumes only Phase 10.4A reconciled `concentration.weightsBySymbol`;
- projection validates non-negative finite weights and total ~=100%; otherwise fails closed;
- default presentation shows up to 7 named holdings plus one explicit `其他（N 檔）` remainder;
- concentration panel is responsive across wide desktop / laptop / tablet / mobile;
- no raw-holdings recalculation, cash inference, risk score or recommendation.

Evidence:

- PR #293 final exact head `d74e6a7a5a733e47454770fd934250747fad2217`
- exact-head CI #1030 / run `31900699522`: **SUCCESS**
- frozen review `4944429266`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `7d0558a176fd6088acb3d32ae49a250bf9b53034`
- post-main CI #1031 / run `31900753660`: **SUCCESS**
- Pages #1575 / run `31900752622`: **SUCCESS**

### Phase 13.1C — Record / Group Density Convergence

Product result:

- desktop Transaction History Note column reduced from 22% to 14%; freed width goes to Symbol / Strategy and transaction-value fields;
- desktop Note summary becomes one-line scan text; mobile remains two lines;
- full Journal Note remains available in `RecordDetailPanel`; no note content is hidden from the deliberate read path;
- Group Management uses the shared title / helper / control / table-density scale without changing its mutation behavior;
- no RecordList / GroupManager business logic changed.

Evidence:

- PR #294 final exact head `f5675766a248d920f26bd8c3c61b68c6c2ab9596`
- exact-head CI #1032 / run `31900878683`: **SUCCESS**
- frozen review `4944435897`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `1d94596f4711027eae2b91343ea77b62aa87f715`
- post-main CI #1033 / run `31900926986`: **SUCCESS**
- Pages #1576 / run `31900926571`: **SUCCESS**

### Phase 13 bounded post-audit

No further runtime batch is justified now.

- Overview / chart shell / holdings / records / dividends / groups share the same global visual tokens and responsive rhythm.
- Transaction side panel inherits the global card / input / button scale; no structural mismatch justifies a separate rewrite.
- Record Note layout now addresses the supplied production screenshot root cause without mixing read and edit intent.
- Holdings allocation now has both precise rank comparison (bars) and whole-composition view (donut).
- sector / industry / sub-industry is a **data-contract gap, not a chart gap**: current `HoldingPosition` / snapshot publishes no such fields, and repository audit found no authoritative sector/industry producer or metadata profile path.

**Phase 13 is OPTIMIZED FOR CURRENT REQUIREMENTS. Reopen for fresh production/user evidence or when authoritative classification metadata exists.**

---

## 3. Stable authority boundaries

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

No nearest-date guessing or hard-coded browser FX fallback.

### Dividend

- actual same-tenant DIV row is the only `已入帳` authority;
- no browser-local confirmation authority;
- event identity remains versioned `dividend.v1.<sha256>` from normalized Symbol + ex_date;
- automatic DIV remains qty=1, price=net, fee/tax=0, tag=`Auto-Dividend`;
- no inferred pay-date or unreviewed tax policy.

### Journal / Transaction History

```text
store.records
→ global currentGroup scope
→ pure Symbol/Tag/Note query + type + inclusive date range
→ compact desktop/mobile summary
→ optional page-memory full detail
→ existing Edit/Delete lifecycle
```

- desktop Note one-line summary and mobile two-line summary are presentation only;
- `RecordDetailPanel` remains the deliberate full-note read surface;
- no note-only persistence bypass or filter/detail localStorage authority;
- no historical lot inference from current-day `day_ledger`;
- no second valuation engine.

### Portfolio concentration / allocation presentation

```text
current-group holdings[].market_value_twd
+ authoritative summary.total_value
→ Phase 10.4A reconciliation gate
→ weightsBySymbol / largest / Top-3 / top positions
→ bar ranking + Phase 13 donut presentation
```

Rules:

- donut does not independently calculate holding weights;
- donut fails closed when concentration is unavailable or weights do not reconcile;
- holdings percentages exclude cash because no explicit cash asset exists;
- no risk threshold, score, target allocation, forecast or buy/sell recommendation;
- no sector / industry allocation until classification metadata has an authoritative producer, provenance, coverage and update policy.

### Daily Command Center

Existing reviewed Daily P&L explanation + reconciled concentration + pending dividend candidates + authoritative records → pure summary/navigation only. Global reliability/retry authority remains `DataReliabilityBanner`; Command Center does not create another state machine.

### IBKR import

User-provided file → local preview/validation → stable broker account or explicit non-sensitive Import Profile → deterministic replay key → existing authenticated record-create. No IBKR credentials in D1/localStorage and no system-principal record writes. IBKR automation remains optional integration work.

---

## 4. Sector / industry visualization decision

User requested discussion of parent-sector / sub-sector proportions.

Current evidence:

- `HoldingPosition` does not publish `sector`, `industry`, `sub_industry` or equivalent classification metadata;
- repo-wide audit found no authoritative sector/industry enrichment producer;
- current market-data path is valuation / price / FX oriented, not a classified security-master contract.

Therefore do **not** hard-code Symbol → sector mappings in the browser and do not infer classifications from strategy Tags.

A future implementation becomes valid only after one of these contracts is deliberately selected:

1. authoritative metadata producer publishes `sector`, `industry`, source, as-of and coverage with each holding or a versioned security master;
2. explicit user-owned classifications are introduced and clearly labeled as user taxonomy rather than market truth;
3. an external enrichment provider is reviewed, cached with provenance, and missing coverage remains explicit `未分類`.

Once that data contract exists, sector parent / industry child visualization can be added without changing portfolio accounting.

---

## 5. NOW / DEFERRED

### NOW

No runtime batch active.

Production Pages runtime: `1d94596f4711027eae2b91343ea77b62aa87f715`  
Production Worker: `9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Optional browser evidence, not blockers:

1. verify new donut density and legend with real 19+ position account on wide desktop and mobile;
2. verify Record History Note column no longer dominates empty rows and full detail remains readable;
3. verify Group Management controls remain comfortable on tablet/mobile;
4. verify group switching updates concentration bars and donut from the same reconciled projection.

### Universal product candidates for future discussion

Re-rank rather than blindly advancing phase numbers:

- **Account / Cash Ledger Foundation** — explicit cash, deposits, withdrawals and truthful account NAV semantics;
- **Transaction Timeline Integrity** — authoritative same-day execution timestamp / sequence;
- **User Data Portability / Backup** — user-facing export, backup/restore and data-rights workflows;
- **Broker-neutral Universal Import** — CSV mapping / preview / validation / deterministic create independent of a specific broker;
- **Authoritative Historical Lot Ledger** — only after a trustworthy producer exists;
- **Advanced Portfolio Analytics** — Sharpe / Sortino / MDD etc. only after methodology and account-value scope are reviewed;
- **AI Journal Intelligence** — interpretation/summarization over deterministic facts, never AI accounting.

### Optional / broker-specific backlog

- IBKR background / Flex sync automation;
- richer IBKR transaction types.

---

## 6. REJECT / DO NOT DO WITHOUT NEW EVIDENCE

- no browser-local dividend confirmation authority;
- no inferred pay-date or unreviewed dividend tax policy;
- no casual automatic-DIV tax-note-token changes;
- no IBKR credential storage or system-principal record writes;
- no account/suffix guessing;
- no ticker-validity promotion from suggestions;
- no Journal Note replay identity;
- no Worker/Python/store rebuild without product evidence;
- no second browser valuation/accounting/FX engine;
- no historical lot attribution from current-day `day_ledger`;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no strategy allocation percentages from overlapping groups unless non-overlap semantics are proven;
- no sector/industry classification guessed from symbol names, frontend hard-coded maps or strategy Tags;
- no second reliability/action-state machine inside Daily Command Center.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh main / open PR / CI / Pages before modifications.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen Phase 10/11/13 only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. Do not start IBKR automation merely because it was formerly numbered Phase 12.
8. If adding sector/industry charts, first prove the classification metadata authority and coverage.

---

## 8. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 13.1C runtime / production Pages | `1d94596f4711027eae2b91343ea77b62aa87f715` |
| Phase 13.1B runtime / production Pages | `7d0558a176fd6088acb3d32ae49a250bf9b53034` |
| Phase 13.1A runtime / production Pages | `0714ac880d28a5ecacd8fa57e8fb1c40b7e0937f` |
| Phase 12-skip roadmap docs checkpoint | `6af1ec3c84a10ee049c6b5440a14e5eb8cb6567c` |
| Phase 11.1 runtime / production Pages | `cb4ae5d09753d0b559b33e3c7448e857cf0016e9` |
| Completed Phase 10 docs checkpoint | `c0773fbc4c63397262e0889b0466c280ca36b7ae` |
| Phase 10.4A runtime | `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a` |
| Phase 10.3B runtime | `e30433b260dc928c067f0c5c0721bd22ad89d216` |
| Phase 9.2 activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Production Worker / Phase 9.2 runtime | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |

Earlier recovery points remain recoverable from repository history and the Phase 1–6 archive.
