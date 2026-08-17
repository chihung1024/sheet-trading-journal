# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. GitHub / CI / deployment remote truth overrides this snapshot.
>
> Historical chronology is preserved, not deleted:
> - Phase 1–6: `docs/archive/to_do_update_list_through_phase6.md`
> - Full pre-R2.4-closeout live-status snapshot: `docs/archive/to_do_update_list_pre_r2_4_closeout_snapshot.md` — historical only; do not follow its stale Current Batch sections.
> - R2.4 production closeout: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**  
Current line: **R1 and R2.1–R2.4 are closed at their reviewed boundaries. R2.4 Shadow Cash Ledger is CLOSED / PRODUCTION VERIFIED at the shadow-only boundary. Production Worker is exact runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. A real hosted calculation proved the targeted cash shadow feed works without taking over or blocking securities accounting. Production evidence now identifies missing authoritative transaction currency as the first reconciliation gap, so cash-inclusive NAV/performance remains explicitly disabled. The single Primary Active Batch is R2.5A Transaction Currency Reconciliation UX.**

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

- protected `main`: `9bd3d1fe3f92376f7e922df7a37eb738963de136`;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- production D1 remains the reviewed additive schema-v3 database with `0004_record_timeline_metadata_expand.sql` and `0005_cash_events_expand.sql` already applied;
- R2.4 does not activate cash-inclusive snapshots, NAV, Overview totals, TWR, XIRR, FX conversion or transaction chronology.

Always re-read remote main before new work because docs-only closeouts can advance repository main without changing production Worker source.

### R2.4 repository delivery

- R2.4A deterministic shadow cash ledger — PR #326, exact head `0035de2c009611621ec6e8dc227aad9004c09eec`, merge `717866ee489aee938fbb8954d071b582e9b6752c`.
- R2.4B targeted read-only cash shadow feed — PR #327, exact head `da9b26f2d7ba28fda1d5eeb160060ff704288a47`, runtime merge/source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- PR #327 exact-head CI #1124: SUCCESS; frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0.
- System/API-secret authority is read-only and single-target for `GET /api/cash-events`; user cash CRUD remains the only mutation authority.
- Missing/invalid system target fails as `INVALID_REQUEST` / HTTP 400 before DB access; DB failures remain 500.
- Python shadow feed/derivation failure cannot block the existing securities snapshot path.
- Shadow evidence is privacy-safe and contains no cash amount, balance, note, raw payload or tenant identity.

### R2.4 production activation closeout — 2026-08-17

- Production Identity Evidence #26 / run `31984262043`: SUCCESS for exact source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`.
- Identity artifact `9273271736`, digest `sha256:4cdcb90702026a1cb3a45ed8b5dc76026bad3abd5c54ad2ce90c2f7480466704`.
- Activation PR #328 exact head `a1598105aa31aa09c755646daff78e08a5c7b137`; exact-head CI #1126 / run `31984636350`: SUCCESS; frozen review PASS / BLOCKER 0 / FOLLOW-UP 0.
- Activation/control-plane merge `9bd3d1fe3f92376f7e922df7a37eb738963de136`; post-main CI #1127 / run `31984732786`: SUCCESS; Pages #1608 / run `31984731948`: SUCCESS.
- Production Deployment Dispatch Broker #10 / run `31984732759`: SUCCESS.
- Deploy Worker #13 / run `31984738416`: SUCCESS after reviewer-protected `production` approval. D1 identity, authority, migration, canonical deploy and stable post-deploy contract all passed.
- Post-deploy artifact `9273434812`, digest `sha256:3620b1740b2d2f95681432f42d0aa86e3b45c8d3eb0ebdfad7ab9a9e4c7c3e1b`; `/version=200`, `/health=200`, anonymous records `401`, production CORS accepted and staging/local origins rejected.
- Normal production `Update Portfolio Data` #3291 / run `31985211893`: SUCCESS. The trusted calculation path executed the targeted cash shadow feed for every processed tenant without feed/derive failure, and the existing securities-only snapshot path still completed successfully.
- Real shadow evidence remains incomplete with issue code `TRANSACTION_CURRENCY_MISSING`. This is the first observed account-readiness blocker, not a deployment failure.

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
- **R2.5A Transaction Currency Reconciliation UX — PRIMARY ACTIVE BATCH**

---

## 2. Current Primary Active Batch

### Phase

`R2 — Ledger Truth v2`

### Batch

`R2.5A — Transaction Currency Reconciliation UX`

### Primary Goal

> Make legacy transactions that lack authoritative cash currency understandable and safely repairable, so cash-ledger completeness can progress from real facts instead of symbol-based inference or fabricated defaults.

### Root-cause evidence

R2.4 production shadow observation is functioning correctly. The hosted calculation did not fail to read cash events and did not disrupt current securities snapshots. Instead, the deterministic shadow ledger rejected legacy transaction rows whose durable `currency` metadata is absent and emitted `TRANSACTION_CURRENCY_MISSING`.

Therefore the next constraint is **data reconciliation UX**, not another cash-engine rewrite and not an account-NAV cutover.

### Product-first scope

1. Provide one clear reconciliation/readiness surface for transactions missing authoritative `currency`.
2. Show enough reviewed transaction context for a user to make a safe currency decision without exposing another tenant or turning free-form notes into financial authority.
3. Reuse the existing user-only fill-only metadata authority for durable currency enrichment; do not mutate transaction economics.
4. If the product offers a candidate currency, treat it as a suggestion only until deterministic validation and explicit user confirmation make it durable authority.
5. Support efficient reviewed bulk correction where multiple records share the same trustworthy source context, while retaining per-record conflict/failure visibility.
6. Preserve mixed-currency correctness and fail closed for quote-unit cases such as `GBp` until a reviewed settlement rule exists.
7. After currency coverage improves, surface the next shadow readiness issue truthfully, including missing explicit opening balance when applicable; never assume opening cash is zero.
8. Add focused regression tests for legacy records, mixed currencies, partial repair, stale/conflicting metadata, privacy boundaries, and no accidental NAV/chronology activation.

### Non-goals

- no automatic symbol-based currency inference as accounting authority;
- no fabricated historical/opening cash;
- no cash-inclusive snapshot / Overview / NAV / TWR / XIRR cutover;
- no FX valuation layer in R2.5A;
- no transaction-order activation from partial timestamp/sequence coverage;
- no system/API-secret cash writer;
- no broker-specific background sync;
- no unrelated refactor or cleanup.

### Entry truth

- production Worker is exact source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, release `4.12` / API `2.65` / schema `3`;
- R2.4 shadow feed and derivation are production verified and intentionally non-authoritative;
- existing `PUT /api/records/metadata` fill-only semantics are production verified and can be reused rather than adding a second metadata writer;
- legacy records without currency remain valid securities records; missing cash currency blocks only cash-authority completeness;
- account NAV/performance and transaction chronology remain disabled.

### Exit criteria

R2.5A may close only when:

1. users can identify and review missing-currency transactions through one coherent UX;
2. confirmed currency repair uses the existing tenant-scoped metadata authority and cannot overwrite conflicting authoritative metadata silently;
3. suggestions/defaults cannot become durable currency facts without the reviewed confirmation boundary;
4. mixed-currency, `GBp`, legacy, partial-repair and conflict cases have regression coverage;
5. the normal transaction/history and securities snapshot behavior remains unchanged;
6. no cash-inclusive NAV/performance/FX/chronology authority is activated;
7. exact-head CI, risk-proportional independent review, merge and production Pages verification pass.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** R2.5A Transaction Currency Reconciliation UX.
- **NEXT:** reconcile explicit opening-balance readiness per resolved currency; then collect shadow completeness evidence over corrected data.
- **BACKLOG:** reviewed FX/account-value methodology and account-level performance cutover until R2 coverage is demonstrably sufficient; broker-neutral restore/import belongs to R3.
- **REJECT:** guessed currency authority, fake zero cash, partial-data NAV cutover, chronology inference, new parallel accounting engines, unrelated cleanup.

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
- transaction cash currency must be explicitly persisted; symbol inference is forbidden;
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
7. **R2.5 reconciliation and migration UX — CURRENT; R2.5A transaction currency first.**
8. Re-run shadow evidence after reconciliation and address the next truthful gap, such as explicit opening-balance readiness.
9. Only after sufficient authoritative coverage: separately review account NAV / account-level performance / FX methodology and cutover.

After R2 foundation:

- **R3 Universal Data Gateway:** broker-neutral import/export/backup/restore and adapters; AI may suggest mappings, deterministic validation decides what enters the ledger.
- **R4 Portfolio Intelligence:** account-level analytics, authoritative historical-lot lifecycle, then AI summarization over deterministic facts. AI never becomes accounting/FX/tax/lot/market-data authority.

---

## 5. Current risk / decision / technical-debt register

### Active blocker

- `TRANSACTION_CURRENCY_MISSING` is the first production-observed R2 cash-readiness gap.
- It blocks authoritative transaction cash derivation for affected legacy rows but does **not** invalidate existing securities accounting.

### Decisions carried forward

- do not infer currency from symbol as durable truth;
- do not infer historical/opening cash as zero;
- do not use partial timestamp coverage or generic `execution_sequence` sorting as chronology authority;
- do not widen R2.5A into FX/NAV/performance cutover;
- do not create a second browser valuation/accounting/reconciliation authority;
- preserve additive D1 history and compatibility readers unless a separate evidence-backed cleanup is justified.

### Handoff drift root cause / prevention

The previous live handoff accumulated detailed history plus duplicate Current Batch sections, allowing the top status and lower startup instructions to diverge. This closeout preserves that full historical snapshot under `docs/archive/` and restores `to_do_update_list.md` to one concise live current-state owner. Future closed-batch detail belongs in versioned `docs/engineering/` closeout/contract records; this live file should point to those records instead of duplicating stale current-state prose in multiple locations.

This documentation correction does not change runtime, schema, API, frontend or Python accounting behavior.

---

## 6. Current Phase / Batch / Next Actions

### Primary Goal

**R2 Ledger Truth v2: make account/event data truthful enough that future timeline, cash, import/restore and intelligence features do not depend on inferred chronology, guessed currency or fake NAV.**

### Current Phase

`R2 — Ledger Truth v2`

### Current Batch

`R2.5A — Transaction Currency Reconciliation UX`

### Immediate next actions

1. Re-read transaction history/detail and metadata enrichment UX/data paths from fresh main.
2. Design the minimum user-facing reconciliation state around `TRANSACTION_CURRENCY_MISSING` without adding a second accounting engine.
3. Reuse the existing fill-only metadata endpoint rather than inventing another currency writer.
4. Implement one narrow, testable UX batch with explicit suggestion-vs-authority semantics.
5. Verify legacy/mixed-currency/conflict/privacy cases and that normal securities calculation remains unchanged.
6. Publish through exact-head CI, frozen review, exact-head merge and Pages verification.
7. Stop R2.5A after the currency-reconciliation UX boundary; do not automatically continue into NAV/FX/account-performance activation.

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
9. R2.4 is CLOSED / PRODUCTION VERIFIED at the shadow-only boundary. Continue **R2.5A Transaction Currency Reconciliation UX** only. Do not activate cash-inclusive NAV/performance, FX valuation or transaction chronology without a new explicit reviewed evidence gate.
