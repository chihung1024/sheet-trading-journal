# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote main/open PR/CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **Phase 13 Cross-Page UX Consistency is OPTIMIZED FOR CURRENT REQUIREMENTS after Phase 13.2 completed the typography root fix. No runtime batch is active. Daily Command Center is compact-by-default, Transaction History no longer reserves a standalone empty Note column, and `src/style.css` is now the single base design-system / typography authority. Sector / industry allocation remains intentionally deferred until authoritative classification metadata exists. Former Phase 12 IBKR Sync Automation remains optional broker-specific backlog.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Read-only audit may run while gates execute, but do not implement a second batch in parallel.
3. Debug by evidence and root cause. Inspect same-class impact and add regression/prevention rather than symptom-only patches.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses exact-head CI, recovery point, frozen review and permanent handoff.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Technical work belongs in NOW only when required by the active product goal; optional cleanup/debug must converge.
8. Do not reopen closed phases without fresh material user/production evidence.
9. Do not treat phase numbering as priority. Rank by cross-user applicability, frequency, product/UX impact and evidence.
10. When no approved runtime direction remains, stop instead of inventing technical work.

---

## 1. Current authoritative state

### Production checkpoints

Production Pages runtime after Phase 13.2:

`dc5abadf4012234233f43ccb05f2f986effc4c2c`

Production Worker runtime remains unchanged:

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
- **No runtime batch active; next product phase intentionally unselected**

---

## 2. Phase 13 immutable evidence

### Phase 13.1A — Initial Cross-Page Visual Consistency Foundation

What it achieved:

- introduced a cross-page presentation layer for spacing, card density, controls and table density;
- improved visual rhythm across Overview / Charts / Holdings / Records / Dividends / Groups;
- did not change financial/data authorities.

Important correction from later production evidence:

- 13.1A did **not** fully solve typography architecture;
- `App.vue`, component-scoped CSS and `product-consistency.css` still simultaneously controlled font sizes;
- the later consistency stylesheet relied on `!important` overrides, so typography authority remained split.

Evidence:

- PR #292 merge `0714ac880d28a5ecacd8fa57e8fb1c40b7e0937f`
- exact-head CI #1028 SUCCESS
- post-main CI #1029 SUCCESS
- Pages #1574 SUCCESS

### Phase 13.1B — Holdings Allocation Visualization

Product result:

- existing Top-holdings bar ranking preserved;
- accessible donut provides whole-portfolio composition;
- donut consumes only Phase 10.4A reconciled `weightsBySymbol`;
- invalid/unreconciled weights fail closed;
- no cash inference, risk score, target allocation or recommendation.

Evidence:

- PR #293 merge `7d0558a176fd6088acb3d32ae49a250bf9b53034`
- exact-head CI #1030 SUCCESS
- post-main CI #1031 SUCCESS
- Pages #1575 SUCCESS

### Phase 13.1C — Initial Record / Group Density Convergence

Product result:

- desktop Note column initially narrowed;
- desktop summary reduced to one line, mobile retained two lines;
- full Note remained in `RecordDetailPanel`;
- Group Management adopted shared spacing/table density.

Production evidence then showed the standalone Note column still produced a visually unbalanced empty band. This was subsequently root-fixed in 13.2 rather than receiving another width-only patch.

Evidence:

- PR #294 merge `1d94596f4711027eae2b91343ea77b62aa87f715`
- exact-head CI #1032 SUCCESS
- post-main CI #1033 SUCCESS
- Pages #1576 SUCCESS

### Phase 13.2 — Typography Authority Root Fix & Information Density Convergence

#### Root cause

Production screenshots showed the apparent font-size problem was architectural, not a few bad selectors:

1. `src/style.css` was nominally the design-token file but originally had no semantic typography scale;
2. `App.vue` independently redefined base colors/surfaces/shadows and body typography;
3. individual Vue scoped styles hard-coded many arbitrary numeric font sizes;
4. `product-consistency.css` later tried to normalize them with selector overrides and `!important`.

This created multiple simultaneous sources of truth and guaranteed future drift.

#### Root fix

`src/style.css` is now the **single base design-system / font-source / typography authority**.

Semantic type roles:

```text
caption      13px
label        14px
body         15px
control      16px
emphasis     16px
section      18px
page         18px
metric-sm    20px
metric       responsive ~23–28px
```

Rules now enforced:

- all Vue component `font-size` declarations consume approved `--type-*` or `--icon-*` semantic tokens;
- Vue component scoped CSS may not invent numeric `font-size` values;
- `App.vue` may keep layout variables only and may not redefine base design tokens/body typography;
- Google font source belongs to `src/style.css`, not App/component styles;
- `product-consistency.css` is layout/density only: **no `font-size`, no `--ui-font-*`, no `!important`**;
- primary data tables use label-scale headers and body-scale rows;
- controls/input text stay at 16px for readability and mobile-browser zoom safety;
- `tests/frontend_typography_authority.test.mjs` prevents regression of the split-authority architecture.

#### Daily Command Center

- default state is now compact rather than permanently occupying the top half of Overview;
- compact row exposes four high-value facts: daily P&L, Top-3 concentration, pending dividends, recent transaction;
- details remain available through an accessible inline disclosure with `aria-expanded` / controlled region;
- group change collapses stale expanded detail;
- no localStorage or new decision/accounting authority.

#### Transaction History journal layout

Desktop changed from 8 columns to 7:

```text
日期 | 代碼/策略/備註 | 類型 | 股數 | 單價 | 總額 | 操作
```

- standalone Note column removed;
- one-line Journal summary is colocated with Symbol / Strategy context;
- no note means no reserved empty visual band;
- full Journal Note remains in existing read-only `RecordDetailPanel`;
- mobile retains compact two-line Note summary;
- search/filter/edit/delete/detail/valuation authorities remain unchanged.

#### Migration hygiene

One-time branch-only codemods/workflows were used to mechanically migrate existing numeric styles and validate semantics. They were deleted before the final PR candidate. No migration workflow/tool and no boot-screen side effect entered the final PR/main.

#### Evidence

- PR #296 final exact head `6cf9b8f77a7b0ac125766cb49c8ce7f4575415a3`
- exact-head CI #1043 / run `31903218119`: **SUCCESS**
- frozen review `4944535588`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `dc5abadf4012234233f43ccb05f2f986effc4c2c`
- post-main CI #1044 / run `31903346284`: **SUCCESS**
- Pages #1578 / run `31903345303`: **SUCCESS**
- no Worker/D1/Python/accounting/FX runtime change

### Phase 13 closeout conclusion

**Phase 13 is OPTIMIZED FOR CURRENT REQUIREMENTS.**

Do not reopen typography by adding another cross-page override layer. Future visual changes must use/extend semantic design tokens at the single authority, then consume those roles in components.

---

## 3. Stable authority boundaries

### Design system / typography

```text
src/style.css
→ base palette/surfaces/radius/shadows
→ font source
→ semantic --type-* / --icon-* roles
→ component-scoped presentation consumes roles

src/styles/product-consistency.css
→ spacing / dimensions / responsive density only
```

Do not:

- introduce arbitrary numeric component font sizes;
- redefine base design tokens inside `App.vue` or components;
- create another typography override stylesheet;
- use `!important` as the normal typography convergence mechanism.

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
→ desktop Symbol/Strategy/Journal summary or mobile card
→ optional page-memory full detail
→ existing Edit/Delete lifecycle
```

- Journal summary placement is presentation only;
- `RecordDetailPanel` remains the deliberate full-note read surface;
- no note-only persistence bypass or filter/detail localStorage authority;
- no historical lot inference from current-day `day_ledger`;
- no second valuation engine.

### Portfolio concentration / allocation

```text
current-group holdings[].market_value_twd
+ authoritative summary.total_value
→ Phase 10.4A reconciliation gate
→ weightsBySymbol / largest / Top-3 / top positions
→ bar ranking + donut presentation
```

- donut does not independently calculate weights;
- percentages exclude cash because no explicit cash asset exists;
- no risk threshold, score, target allocation, forecast or recommendation;
- no sector / industry allocation until classification metadata has authoritative provenance and coverage.

### Daily Command Center

Existing reviewed Daily P&L explanation + reconciled concentration + pending dividend candidates + authoritative records → compact summary/navigation only. Global reliability/retry authority remains `DataReliabilityBanner`.

### IBKR

IBKR file import remains supported, but background/Flex automation is optional broker-specific backlog. Do not prioritize it over universal user functionality solely because of phase numbering.

---

## 4. Sector / industry visualization decision

Current `HoldingPosition` / snapshot does not publish authoritative `sector`, `industry` or `sub_industry`, and repository audit found no trustworthy classification producer.

Therefore do not hard-code Symbol → sector maps in the browser and do not infer classifications from strategy Tags.

A future implementation is valid only after one of these contracts is deliberately selected:

1. authoritative security metadata producer publishes classification + source + as-of + coverage;
2. explicit user-owned taxonomy is introduced and clearly labeled as user-defined;
3. reviewed external enrichment provider is cached with provenance and uncovered holdings remain explicit `未分類`.

Once that authority exists, sector donut / treemap / parent→child drill-down can be added without changing portfolio accounting.

---

## 5. NOW / DEFERRED

### NOW

No runtime batch active.

Production Pages runtime: `dc5abadf4012234233f43ccb05f2f986effc4c2c`  
Production Worker: `9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Optional browser evidence, not blockers:

1. compare Overview compact Daily Command density on wide desktop / tablet / mobile;
2. verify semantic type scale on Overview / Charts / Holdings / Records / Dividends / Groups / transaction panel;
3. confirm Transaction History has no empty Note band and full Note remains readable in detail;
4. confirm holdings donut/bar and group switching still use the same reconciled projection.

### Universal product candidates for future discussion

Re-rank rather than blindly advancing phase numbers:

- **Account / Cash Ledger Foundation** — explicit cash, deposits, withdrawals and truthful account NAV semantics;
- **Transaction Timeline Integrity** — authoritative same-day execution timestamp / sequence;
- **User Data Portability / Backup** — user-facing export, backup/restore and data-rights workflows;
- **Broker-neutral Universal Import** — CSV mapping / preview / validation / deterministic create independent of one broker;
- **Authoritative Historical Lot Ledger** — only after a trustworthy producer exists;
- **Advanced Portfolio Analytics** — Sharpe / Sortino / MDD etc. only after methodology/account-value scope are reviewed;
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
- no sector/industry classification guessed from symbol names, frontend maps or strategy Tags;
- no second reliability/action-state machine inside Daily Command Center;
- no new arbitrary numeric component `font-size` or typography `!important` override layer.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh main / open PR / CI / Pages before modifications.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen Phase 10/11/13 only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. If changing typography, edit/extend semantic roles in `src/style.css`; do not create another override authority.
8. Do not start IBKR automation merely because it was formerly numbered Phase 12.
9. If adding sector/industry charts, first prove classification metadata authority and coverage.

---

## 8. Stable recovery points

| Purpose | Checkpoint |
|---|---|
| Phase 13.2 typography root fix / production Pages | `dc5abadf4012234233f43ccb05f2f986effc4c2c` |
| Phase 13.1C runtime | `1d94596f4711027eae2b91343ea77b62aa87f715` |
| Phase 13.1B runtime | `7d0558a176fd6088acb3d32ae49a250bf9b53034` |
| Phase 13.1A runtime | `0714ac880d28a5ecacd8fa57e8fb1c40b7e0937f` |
| Phase 12-skip roadmap docs checkpoint | `6af1ec3c84a10ee049c6b5440a14e5eb8cb6567c` |
| Phase 11.1 runtime | `cb4ae5d09753d0b559b33e3c7448e857cf0016e9` |
| Completed Phase 10 docs checkpoint | `c0773fbc4c63397262e0889b0466c280ca36b7ae` |
| Phase 10.4A runtime | `6e1f3207bc8e9aa778ebe819f4a053d08cc66f1a` |
| Phase 10.3B runtime | `e30433b260dc928c067f0c5c0721bd22ad89d216` |
| Phase 9.2 activation control plane | `3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e` |
| Production Worker / Phase 9.2 runtime | `9b9f09f5079c59750219c73e23002a7ab8d2f33e` |

Earlier recovery points remain recoverable from repository history and the Phase 1–6 archive.
