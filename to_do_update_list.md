# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote main/open PR/CI/Pages and machine-readable contracts override prose.
>
> Detailed Phase 1–6 chronology remains at `docs/archive/to_do_update_list_through_phase6.md`. Do not restart closed work from archive plans.

Last updated: **2026-08-16 Asia/Taipei**  
Current line: **Independent technical-debt root-cause review/cleanup is CLOSED / PRODUCTION VERIFIED after TD-A and TD-B. No runtime batch is active. The proposed Phase 14 Overview redesign remains a product proposal only and has NOT been started.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical cleanup is justified only when evidence shows it causes product, correctness, maintainability or repeated-debug risk.
3. Debug by evidence and root cause. Inspect same-class impact and add regression/prevention rather than symptom-only patches.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses exact-head CI, recovery point, frozen review and permanent handoff.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Do not delete old code/files merely because they look old; first prove they are neither compatibility surface nor forensic/governance evidence.
8. Do not reopen closed phases without fresh material user/production evidence.
9. Phase numbering is not priority. Rank future work by cross-user applicability, frequency, product/UX impact and evidence.
10. When no approved runtime direction remains, stop instead of inventing cleanup.

---

## 1. Current authoritative state

### Production checkpoints

Production Pages runtime after technical-debt cleanup:

`f176b06e38cb0fb351ea9d59a7ccecbf29db2ae5`

Production Worker runtime remains unchanged:

`9b9f09f5079c59750219c73e23002a7ab8d2f33e`

Phase 9.2 production activation control plane:

`3e1ef4e5f7d2db7bf18db80bd946f93106a71f6e`

A later docs-only closeout merge may advance repository `main` without changing product runtime. Always re-read fresh remote truth.

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
- Phase 13 Cross-Page UX Consistency & Holdings Visualization — OPTIMIZED FOR CURRENT REQUIREMENTS
- Independent technical-debt root-cause cleanup TD-A / TD-B — **CLOSED / PRODUCTION VERIFIED**
- **No runtime batch active; next product phase intentionally unselected**

---

## 2. Independent technical-debt root-cause cleanup

This review deliberately separated real root-cause debt from intentional legacy/forensic material. The goal was not repository neatness; it was to remove architecture paths that could recreate user-visible inconsistency or conflicting presentation truth.

### TD-A — Presentation Authority Closure

#### Root cause

The financial/domain source of truth was not duplicated, but Overview composition was:

- `App.vue` directly composed `DailyCommandCenter + StatsGrid + PerformanceChart`;
- `DailyCommandCenter.vue` independently rebuilt reviewed Daily P&L explainability and concentration;
- `StatsGrid.vue` independently rebuilt Daily P&L explainability;
- navigation pending-dividend badge used raw snapshot count while Daily Command / Dividend workflow reconciled pending events against authoritative DIV records.

This created multiple Overview read-model owners and allowed the same fact/attention state to diverge even though Python/Worker accounting remained authoritative.

#### Root fix

- added `OverviewPage.vue` as the Overview page-controller boundary;
- reviewed Daily P&L explainability and concentration are built once at that boundary and passed to child surfaces;
- `StatsGrid` and `DailyCommandCenter` consume reviewed props instead of rebuilding the same domain projection;
- added shared `dividendAttention.js` using pending snapshot events + records-authoritative DIV confirmation;
- App navigation badge and Daily Command snapshot now consume the same pending-dividend attention semantics;
- App remains the application shell rather than owning Overview-specific derivation.

No Worker, D1, Python accounting, FX, mutation or Router behavior changed.

Evidence:

- PR #298 final exact head `91eb987df8030e58f763cc62b76f3a10e2a03594`
- exact-head CI #1047 / run `31925773400`: **SUCCESS**
- frozen review `4945365973`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `36a6aa9a1daffff539acbb6323b368c885f87d13`
- post-main CI #1048: **SUCCESS**
- Pages #1580: **SUCCESS**

### TD-B — Design-System Escape & Portfolio Semantic Authority Closure

#### Root cause A — Chart.js typography bypass

Phase 13.2 made `src/style.css` the single semantic typography authority for Vue/CSS, but Chart.js canvas configuration still hard-coded JavaScript pixel sizes (`10/11/12/13/14px` and direct `ctx.font`). That path was outside the existing typography regression gate and could drift independently again.

#### Root fix A

- added `designTypography.js` as a narrow bridge from approved `--type-*` CSS semantic tokens to computed pixel values needed by canvas/Chart.js;
- PerformanceChart legend, x-axis ticks, tooltip typography and final-value canvas label consume the existing design-system roles;
- unknown/unavailable token resolution fails closed to Chart.js/browser defaults rather than inventing fallback font sizes;
- focused regression prevents hard-coded canvas font pixels from re-entering PerformanceChart.

#### Root cause B — UI terminology stronger than the data model

Python calculator semantics are:

```text
summary.total_value
= sum(current holdings market_value_twd)
= securities-holdings market value, not cash-inclusive brokerage NAV

summary.invested_capital
= current positive holdings cost basis
= not lifetime deposits / contributed capital
```

The UI nevertheless used labels such as `總資產淨值`, `總資產`, `投入資本` and generic `ROI`, overstating what the model actually represents.

#### Root fix B

Current user-facing terminology now uses:

- `持倉市值` for current securities market value;
- `持倉成本` for current positive-holding cost basis;
- `未實現報酬率` for `unrealized P&L ÷ current holding cost`;
- PerformanceChart asset-series label is `持倉市值`.

Legacy backend/API field names `total_value` and `invested_capital` are intentionally retained for compatibility; `journal_engine/models.py` now documents their actual semantics. No financial formula changed.

Evidence:

- PR #299 final exact head `84989b008807c26f7dcc451fd5a6093ce182a096`
- exact-head CI #1049 / run `31926639689`: **SUCCESS**
- frozen review `4945392698`: **PASS / BLOCKER 0 / FOLLOW-UP 0**
- merge `f176b06e38cb0fb351ea9d59a7ccecbf29db2ae5`
- post-main CI #1050 / run `31926701707`: **SUCCESS**
- Pages #1581 / run `31926700885`: **SUCCESS**
- no production Worker deployment and no accounting/FX behavior change

#### Migration/preflight hygiene

Branch-only one-time codemods/workflows were used to apply and diagnose the bounded migration. Several preflight failures correctly stopped before any permanent candidate was committed; they exposed migration-test escaping and touched-line whitespace issues rather than product defects. All temporary workflow/codemod/fixer files were removed before PR #299, and the final PR diff contained only 10 permanent source/test/documentation files.

---

## 3. What was intentionally NOT cleaned

The independent review found several items that look old but are not proven dead code.

### Forensic Worker archive

`cloudflare worker/` contains historical Worker versions and is explicitly treated as non-production forensic history. Deployment contracts preserve this archive. Do not delete it as generic dead code without a deliberate archival-policy change.

### Deployment tombstones / historical pointers

Files such as `DEPLOYMENT_FINAL.md` exist as historical/tombstone navigation and are referenced by current documentation/governance. Do not remove them merely because current deployment authority lives elsewhere.

### Legacy API field names

Compatibility fields such as `summary.total_value` and `summary.invested_capital` remain serialized/public contract names. Correct the presentation/documentation semantics first; physical field migration requires separate compatibility evidence and consumer migration.

### Compatibility / recovery state

Legacy-compatible fields, migration readers and recovery state machines are not cleanup candidates until production evidence proves their read/write paths can be removed safely.

### Dependency cleanup

Do not run blanket dependency upgrades or `npm audit fix --force` as technical-debt cleanup. Security/dependency changes require a separate evidence-based batch with regression and deployment compatibility review.

---

## 4. Stable authority boundaries after cleanup

### Overview presentation

```text
Pinia authoritative data
→ OverviewPage page controller
→ existing reviewed domain services
→ reviewed Daily P&L / concentration / dividend-attention facts
→ child presentation components
```

Do not let sibling Overview components independently rebuild the same reviewed domain projection.

### Design system / typography

```text
src/style.css
→ base palette/surfaces/radius/shadows
→ font source
→ semantic --type-* / --icon-* roles
→ Vue component styles consume roles
→ designTypography.js bridges approved roles only when canvas requires computed px
```

`src/styles/product-consistency.css` remains layout/density only.

Do not:

- introduce arbitrary numeric component font sizes;
- hard-code a second Chart.js/canvas typography scale;
- redefine base design tokens in App/components;
- create another typography override stylesheet;
- use `!important` as the normal typography convergence mechanism.

### Financial / presentation semantics

Current UI must not describe securities-only `total_value` as cash-inclusive NAV. Until an explicit cash/account ledger exists:

- `total_value` → user-facing `持倉市值`;
- `invested_capital` → user-facing `持倉成本`;
- generic whole-account `ROI` language is not valid for the current unrealized-only ratio.

### Mutation / calculation

```text
record durable intent
→ tenant-scoped idempotent Worker write
→ committed mutation/readback
→ durable dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser verification/presentation
```

No browser-local accounting or recovery authority.

### Dividend

- actual same-tenant DIV record is the only `已入帳` authority;
- shared pending attention must reconcile snapshot candidates against records-authoritative confirmation;
- no inferred pay-date or unreviewed tax policy;
- deterministic dividend event identity remains unchanged.

### Journal / Transaction History

- Journal summary placement is presentation only;
- full Journal Note remains in `RecordDetailPanel`;
- no note-only persistence bypass;
- no historical lot inference from current-day `day_ledger`;
- no second browser valuation engine.

### Portfolio concentration / allocation

- weights consume reconciled holdings market values + summary total;
- cash is not inferred;
- sector/industry remains deferred until authoritative classification metadata exists.

---

## 5. Bounded post-cleanup conclusion

No additional technical-debt runtime batch is justified by the evidence from this review.

Items remaining for future discussion are product/model capabilities, not excuses for perpetual cleanup:

- **Overview Information Architecture redesign** — prior Phase 14 proposal to reduce duplicate homepage numerals and assign one primary owner per fact; proposal only, not started;
- **Account / Cash Ledger Foundation** — explicit cash, deposits, withdrawals and truthful account NAV semantics;
- **Transaction Timeline Integrity** — authoritative same-day execution timestamp / sequence;
- **User Data Portability / Backup** — user-facing export, backup/restore and data-rights workflows;
- **Broker-neutral Universal Import** — CSV mapping / preview / validation / deterministic create independent of one broker;
- **Authoritative Historical Lot Ledger** — only after a trustworthy producer exists;
- **Advanced Portfolio Analytics** — Sharpe / Sortino / MDD etc. only after methodology/account-value scope are reviewed;
- **AI Journal Intelligence** — interpretation/summarization over deterministic facts, never AI accounting.

Optional broker-specific backlog remains IBKR background/Flex sync and richer IBKR transaction types.

---

## 6. REJECT / DO NOT DO WITHOUT NEW EVIDENCE

- no browser-local dividend confirmation authority;
- no second Overview read-model owner for the same reviewed facts;
- no second browser valuation/accounting/FX engine;
- no cash-inclusive `NAV/總資產淨值` claim while cash is not explicitly modeled;
- no new arbitrary numeric Vue/CSS or Chart.js typography scale;
- no historical lot attribution from current-day `day_ledger`;
- no sector/industry classification guessed from symbol names, frontend maps or strategy Tags;
- no invented risk score, forecast or investment recommendation without reviewed methodology;
- no blanket deletion of forensic archives, tombstones or compatibility fields;
- no blanket dependency force-upgrade as cleanup;
- no IBKR automation priority merely because it once had a phase number.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this handoff.
2. Re-read fresh main / open PR / CI / Pages before modifications.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. For Overview changes, keep `OverviewPage` as the page-level orchestration boundary and reuse existing domain services.
8. For typography changes, extend semantic roles at the design-system authority; canvas consumers use the approved bridge.
9. Do not start the proposed Overview redesign, cash ledger, IBKR automation or other product direction unless selected by the user.
