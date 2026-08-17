# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. GitHub / CI / deployment remote truth overrides this snapshot.
>
> Historical chronology is preserved, not deleted:
> - Phase 1–6: `docs/archive/to_do_update_list_through_phase6.md`
> - Full pre-R2.4-closeout live-status snapshot: `docs/archive/to_do_update_list_pre_r2_4_closeout_snapshot.md` — historical only; do not follow its stale Current Batch sections.
> - R2.4 production closeout: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R2.5A production closeout: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**  
Current line: **R1 and R2.1–R2.5A are closed at their reviewed boundaries. R2.5A Transaction Currency Reconciliation UX is CLOSED / PRODUCTION PAGES VERIFIED at merge `7acb01717395b09a0b4e09b24af8733e60a0a8cb`; post-main CI #1134 and Pages #1610 succeeded. Production Worker remains unchanged at exact runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. The reconciliation product defect is closed, but authoritative production data still requires the user to confirm legacy missing transaction currencies before the next shadow-readiness issue can be observed. Cash-inclusive NAV/performance remains explicitly disabled. The single Primary Active Batch is R2.5B Post-Reconciliation Shadow Readiness Evidence, currently BLOCKED ON USER AUTHORITATIVE INPUT rather than code.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists to enable product correctness, maintainability and UX; do not create perpetual cleanup phases.
3. Debug by evidence and root cause. Inspect same-class impact and add regression/prevention rather than symptom-only patches.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Do not delete compatibility/forensic material without proof that removal is safe.
8. Rank work by cross-user applicability, frequency, product/UX value and dependency order, not phase number.
9. Do not infer cash, transaction currency, historical lots, classifications, risk scores or financial facts that authoritative data does not provide.
10. When a product batch closes, stop its technical work instead of expanding scope for neatness.

---

## 1. Current authoritative state

### Recovery checkpoint before Roadmap V2

GitHub Release `backup-2026-08-16-tech-debt-closeout` targets `13b6558e48fc703afc8b9d1572ec696d104eccb2`. This is a recovery/governance checkpoint, not a Worker/API/schema version.

### Current protected main / production runtime

At this closeout checkpoint:

- protected `main`: `7acb01717395b09a0b4e09b24af8733e60a0a8cb` before this docs-only closeout;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- production D1 remains the reviewed additive schema-v3 database with `0004_record_timeline_metadata_expand.sql` and `0005_cash_events_expand.sql` already applied;
- R2.5A changes frontend reconciliation behavior only and does not activate cash-inclusive snapshots, NAV, Overview totals, TWR, XIRR, FX conversion or transaction chronology.

Always re-read remote main before new work because docs-only closeouts can advance repository main without changing production Worker source.

### R2.4 repository / production closeout

- R2.4A deterministic shadow cash ledger — PR #326, exact head `0035de2c009611621ec6e8dc227aad9004c09eec`, merge `717866ee489aee938fbb8954d071b582e9b6752c`.
- R2.4B targeted read-only cash shadow feed — PR #327, exact head `da9b26f2d7ba28fda1d5eeb160060ff704288a47`, runtime merge/source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- PR #327 exact-head CI #1124: SUCCESS; frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0.
- System/API-secret authority is read-only and single-target for `GET /api/cash-events`; user cash CRUD remains the only mutation authority.
- Production Identity Evidence #26 / run `31984262043`: SUCCESS for exact source `f93dbbed...`.
- Activation/control-plane merge `9bd3d1fe3f92376f7e922df7a37eb738963de136`; post-main CI #1127 and Pages #1608: SUCCESS.
- Deploy Worker #13 / run `31984738416`: SUCCESS after the protected `production` approval gate.
- Normal production `Update Portfolio Data` #3291 / run `31985211893`: SUCCESS. The trusted calculation path executed the targeted cash shadow feed without disrupting the securities-only snapshot path.
- Real shadow evidence identified `TRANSACTION_CURRENCY_MISSING` as the first account-readiness issue; this was a data-reconciliation gap, not a Worker deployment failure.

### R2.5A repository / production Pages closeout — 2026-08-17

- PR #330 — `feat: add transaction currency reconciliation UX`.
- Base: `4bf91cfbd381e2b147eb89aeab4c3d77e3feeedd`.
- Frozen exact head: `2bfa16c26f6848caf3fd5241def2ed7159702e71`.
- Exact-head CI #1133 / run `31996866556`: SUCCESS.
- Frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0.
- Merge: `7acb01717395b09a0b4e09b24af8733e60a0a8cb` using expected-head protection.
- Post-main CI #1134 / run `31996960247`: SUCCESS.
- Pages #1610 / run `31996959451`: SUCCESS on the same merge SHA; Pages state `built`, source `main` `/`, HTTPS enforced.
- No Worker deployment or D1 migration was required or performed.
- R2.5A closeout details, root causes, regression evidence and rollback are recorded in `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`.

### Product state

- Phase 1 Multi-Market Transaction Experience — CLOSED / PRODUCTION VERIFIED
- Phase 2 Trading Journal Note UX — CLOSED / PRODUCTION VERIFIED
- Phase 3 Explainability — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 4 Strategy Analytics — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 5 Historical Lot / Trade Analytics — BACKLOG until an authoritative historical lot producer exists
- Phase 6 UX Convergence — OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 7.1 IBKR Stock Trade File Import — PRODUCTION CODE/PAGES VERIFIED
- Phase 8.1 Responsive Daily P&L Density — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.1 Dividend Confirmation Source of Truth — CLOSED / PRODUCTION PAGES VERIFIED
- Phase 9.2 Deterministic Dividend Event Identity — CLOSED / PRODUCTION VERIFIED
- Phase 10 roadmap — COMPLETE / OPTIMIZED FOR CURRENT REQUIREMENTS
- Phase 11 Daily Portfolio Command Center — SUBSUMED by R1 Decision Cockpit
- Former Phase 12 IBKR Sync Automation — OPTIONAL BROKER-SPECIFIC BACKLOG
- Phase 13 Cross-Page UX Consistency & Holdings Visualization — OPTIMIZED FOR CURRENT REQUIREMENTS
- Technical-debt root-cause cleanup TD-A / TD-B — CLOSED / PRODUCTION VERIFIED
- **R1 Decision Cockpit — CLOSED / PRODUCTION VERIFIED**
- **R2 Ledger Truth v2 — ACTIVE**
- **R2.1 Event / Timeline Contract Audit — CLOSED / VERIFIED**
- **R2.2A Nullable Timeline Metadata Storage Expansion — CLOSED / PRODUCTION VERIFIED**
- **R2.2B Metadata API Activation + Writer Semantics — CLOSED / PRODUCTION VERIFIED**
- **R2.2C Transaction Timeline Detail + Source Metadata Capture — CLOSED / VERIFIED**
- **R2.3A Explicit Cash Event Storage / Model — CLOSED / PRODUCTION VERIFIED**
- **R2.3B Authenticated Cash Event CRUD — CLOSED / PRODUCTION VERIFIED**
- **R2.3C Cash Management UI — CLOSED / PRODUCTION PAGES VERIFIED**
- **R2.4 Shadow Cash Ledger — CLOSED / PRODUCTION VERIFIED at shadow-only boundary**
- **R2.5 Reconciliation & Migration UX — ACTIVE**
- **R2.5A Transaction Currency Reconciliation UX — CLOSED / PRODUCTION PAGES VERIFIED**
- **R2.5B Post-Reconciliation Shadow Readiness Evidence — PRIMARY ACTIVE BATCH / BLOCKED ON USER AUTHORITATIVE INPUT**

---

## 2. Current Primary Active Batch

### Phase

`R2 — Ledger Truth v2`

### Batch

`R2.5B — Post-Reconciliation Shadow Readiness Evidence`

### Primary Goal

> Convert the now-deployed reconciliation UX into fresh authoritative production evidence: first let the authenticated user confirm legacy missing transaction currencies, then rerun the existing shadow-readiness path and select the next product work only from the next observed issue.

### Entry truth

- R2.5A is CLOSED / PRODUCTION PAGES VERIFIED.
- Legacy currency repair is a user financial-data authority decision; Symbol detection remains suggestion-only and cannot be automated into durable truth.
- Production Worker, D1 schema and shadow cash engine are unchanged from the R2.4 verified boundary.
- The previous production observation reported `TRANSACTION_CURRENCY_MISSING`; that observation must not be treated as already resolved until the user actually confirms affected records.
- The next issue is unknown until corrected data is observed. Opening balance is a candidate, not a fact.

### In Scope

1. User completes the production Transaction History reconciliation surface for missing currency records.
2. After user completion, rerun/observe the existing production shadow completeness path without changing accounting authority.
3. Capture the next observed deterministic readiness issue and its scope.
4. If the next issue is missing explicit opening balance, create a separate, narrow R2.5 product batch for that UX/API path.
5. Preserve securities-only snapshot behavior and all existing authority boundaries.

### Out of Scope

- automatic approval of Symbol-derived currency;
- guessing or bulk-writing financial facts without user confirmation;
- assuming missing opening cash equals zero;
- pre-implementing opening-balance UX before evidence identifies it as the next blocker;
- FX methodology, account NAV/TWR/XIRR cutover or chronology activation;
- unrelated cleanup/refactor.

### Expansion Trigger

Re-plan only if fresh production evidence shows a different high-impact/critical issue, or if reconciliation itself fails in production despite the verified Pages/CI state.

### Exit Criteria

R2.5B evidence gate may close only when:

1. affected production currency records have been explicitly reviewed/confirmed by the authenticated user;
2. a fresh production shadow run observes corrected data;
3. the next readiness issue is recorded from deterministic evidence, or shadow completeness is confirmed for this stage;
4. no inferred financial fact is introduced to force the gate green;
5. the next product batch is selected from that evidence and documented.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** user-authoritative currency confirmation, then fresh shadow-readiness evidence.
- **NEXT:** only the first observed post-reconciliation readiness issue; explicit opening-balance UX if and only if evidence identifies it.
- **BACKLOG:** reviewed FX/account-value methodology and account-level performance cutover until R2 coverage is demonstrably sufficient; broker-neutral restore/import belongs to R3.
- **REJECT:** guessed currency authority, fake zero cash, partial-data NAV cutover, chronology inference, parallel accounting engines, unrelated cleanup.

---

## 3. Stable authority boundaries

### Transaction mutation / calculation

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

### Transaction event metadata

```text
source/manual facts
→ adapter/form validation
→ optional durable event metadata
→ read/presentation
→ shadow calculation transport
→ separate ordering-activation review
```

`note` is user Journal content, not execution chronology/provenance storage. `id` / `created_at` are deterministic database facts, not broker execution time. Current production runtime can capture/read optional metadata, but Python calculation ordering remains disabled until a separate full-coverage/source-comparator evidence gate.

### Cash authority

```text
user cash CRUD
→ explicit cash_events
→ targeted trusted-system read
→ shadow cash derivation + completeness issues
→ reconciliation UX
→ later explicit account-value cutover review
```

- user CRUD is the only cash mutation authority;
- system/API-secret cash reads require one explicit target tenant;
- no system cash writer;
- transaction cash currency must be explicitly persisted; Symbol inference is suggestion-only and forbidden as durable authority;
- opening balance must be explicit; absence never means zero;
- multi-currency cash remains separate until a reviewed FX/account-value methodology exists;
- shadow balances/evidence do not enter current snapshots or performance.

### Financial terminology

Until a later R2 cutover is separately reviewed:

- `summary.total_value` → user-facing `持倉市值`;
- `summary.invested_capital` → user-facing `持倉成本`;
- generic cash-inclusive `總資產淨值 / NAV` is invalid;
- generic whole-account ROI language is invalid for the current securities-only calculation scope.

### Dividend

- actual same-tenant DIV record is the only `已入帳` authority;
- pending attention reconciles snapshot candidates against records-authoritative DIV confirmation;
- no browser-local confirmation authority;
- no inferred pay date or unreviewed tax policy.

### Overview / Journal / concentration

- `OverviewPage` remains the page-level orchestration boundary; no parallel Overview accounting/read-model owner.
- Full Journal Note remains in `RecordDetailPanel`; records remain authoritative transaction history.
- Portfolio concentration consumes reconciled holdings market values; cash and sector/industry are not inferred.

---

## 4. Roadmap V2

R2 safe dependency order:

1. R2.1 canonical event/timeline contract — CLOSED / VERIFIED.
2. R2.2A nullable transaction metadata storage — CLOSED / PRODUCTION VERIFIED.
3. R2.2B metadata API/write semantics — CLOSED / PRODUCTION VERIFIED.
4. R2.2C detail presentation, shadow metadata transport and safe source enrichment — CLOSED / VERIFIED.
5. R2.3A/B/C explicit cash storage, authenticated CRUD and management UX — CLOSED / VERIFIED at their production boundaries.
6. R2.4 deterministic shadow cash ledger + targeted production feed — CLOSED / PRODUCTION VERIFIED at shadow-only boundary.
7. R2.5A transaction currency reconciliation UX — CLOSED / PRODUCTION PAGES VERIFIED.
8. **R2.5B post-reconciliation shadow readiness evidence — CURRENT / waiting for user-authoritative currency confirmation.**
9. Address the next observed reconciliation gap in a separate bounded product batch.
10. Only after sufficient authoritative coverage: separately review account NAV / account-level performance / FX methodology and cutover.

After R2 foundation:

- **R3 Universal Data Gateway:** broker-neutral import/export/backup/restore and adapters; AI may suggest mappings, deterministic validation decides what enters the ledger.
- **R4 Portfolio Intelligence:** account-level analytics, authoritative historical-lot lifecycle, then AI summarization over deterministic facts. AI never becomes accounting/FX/tax/lot/market-data authority.

---

## 5. Current risk / decision / technical-debt register

### Active blocker / user dependency

- The R2.5A software defect is closed and deployed.
- Production data may still contain legacy rows with missing `currency` until an authenticated user confirms them through the new reconciliation surface.
- Until that user-authoritative input exists, a fresh shadow run would only reproduce the known `TRANSACTION_CURRENCY_MISSING` issue and would not provide new evidence.
- This blocks progression of R2 cash-readiness evidence but does **not** invalidate existing securities accounting.

### R2.5A Change / Root Cause Log

- Product change: safe missing-currency reconciliation UX + explicit currency on new manual transactions.
- CI root cause 1: stale implementation-bound currency test; fixed at the semantic authority contract.
- CI root cause 2: Journal test accidentally froze unrelated form field ordering; narrowed to the intended additive-`note` contract.
- Frozen-review blocker: direct regression coverage for 401 + mixed USD/GBp + partial repair + 409 conflict; added and exact-head CI remained green.
- Merge: `7acb01717395b09a0b4e09b24af8733e60a0a8cb`.
- Verification: exact-head CI #1133, post-main CI #1134, Pages #1610 — all SUCCESS.
- Rollback: revert PR #330 / merge `7acb0171`; no D1 or Worker rollback required.
- Full detail: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`.

### Decisions carried forward

- do not infer currency from Symbol as durable truth;
- do not infer historical/opening cash as zero;
- do not use partial timestamp coverage or generic `execution_sequence` sorting as chronology authority;
- do not widen R2.5 into FX/NAV/performance cutover;
- do not create a second browser valuation/accounting/reconciliation authority;
- preserve additive D1 history and compatibility readers unless a separate evidence-backed cleanup is justified;
- do not assume opening balance is the next blocker until fresh post-reconciliation evidence says so.

### Known Issues / Technical Debt / Deferred Candidates

- Known data readiness issue: production legacy currency confirmation remains user-dependent until completed.
- No unresolved R2.5A software BLOCKER or FOLLOW-UP remains at closeout.
- FX/account-value methodology remains BACKLOG, not hidden technical debt.
- Broker-neutral restore/import remains R3 BACKLOG.
- No new unrelated technical-debt work is authorized by this closeout.

### Handoff drift root cause / prevention

The previous live handoff accumulated detailed history plus duplicate Current Batch sections, allowing the top status and lower startup instructions to diverge. Closed-batch detail belongs in versioned `docs/engineering/` closeout/contract records; this live file points to those records instead of duplicating stale current-state prose in multiple locations.

Documentation closeouts do not change runtime, schema, API, frontend or Python accounting behavior.

---

## 6. Current Phase / Batch / Next Actions

### Primary Goal

**R2 Ledger Truth v2: make account/event data truthful enough that future timeline, cash, import/restore and intelligence features do not depend on inferred chronology, guessed currency or fake NAV.**

### Current Phase

`R2 — Ledger Truth v2`

### Current Batch

`R2.5B — Post-Reconciliation Shadow Readiness Evidence`  
Status: **BLOCKED ON USER AUTHORITATIVE INPUT**

### Immediate next actions

1. Authenticated user opens the production Trading Journal → Transaction History.
2. In the `現金帳本準備` / missing-currency reconciliation panel, review each suggested quote unit; edit any incorrect suggestion.
3. Select only records whose currency has been reviewed, then use `確認並儲存` and ensure the UI reports server-readback confirmation.
4. Repeat until the missing-currency panel has no affected records that the user can authoritatively resolve.
5. User reports completion to the project agent; do not paste tokens, passwords or financial secrets.
6. Agent reruns/observes the existing production shadow completeness path and records the next deterministic readiness issue.
7. Open a new bounded product batch only for that observed issue; if it is missing explicit opening balance, design that UX then.
8. Keep cash-inclusive NAV/performance, FX valuation and transaction chronology disabled until a separate reviewed evidence gate explicitly authorizes them.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this live handoff.
2. Re-read fresh `main`, open PRs, CI, Pages and production runtime truth before modification.
3. Treat new user screenshots/logs/production symptoms as newer than prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for fresh material evidence.
6. Debug same-class impact + regression prevention.
7. For historical R1/R2 chronology, use `docs/archive/to_do_update_list_pre_r2_4_closeout_snapshot.md`; do not follow its historical Current Batch instructions.
8. For R2.4 authority/evidence, use `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md` plus fresh remote truth.
9. For R2.5A implementation/root-cause/verification history, use `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`.
10. R2.5A is CLOSED / PRODUCTION PAGES VERIFIED. Continue **R2.5B Post-Reconciliation Shadow Readiness Evidence** only after user-authoritative currency confirmation. Do not pre-build opening-balance/NAV/FX/chronology work without fresh evidence.
