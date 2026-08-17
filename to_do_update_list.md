# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. GitHub / CI / deployment remote truth overrides this snapshot.
>
> Historical chronology is preserved in versioned records rather than duplicated here:
> - Phase 1–6: `docs/archive/to_do_update_list_through_phase6.md`
> - Full pre-R2.4 live-status snapshot: `docs/archive/to_do_update_list_pre_r2_4_closeout_snapshot.md`
> - R2.4 production closeout: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R2.5A currency reconciliation closeout: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`
> - R2.5B post-reconciliation production evidence: `docs/engineering/R2_5B_POST_RECONCILIATION_SHADOW_EVIDENCE_2026-08-17.md`
> - R2.5C opening-balance readiness closeout: `docs/engineering/R2_5C_OPENING_BALANCE_READINESS_CLOSEOUT_2026-08-17.md`
> - R2.5D opening-balance/shadow completion: `docs/engineering/R2_5D_OPENING_BALANCE_SHADOW_COMPLETE_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**  
Current line: **R1 and R2.1–R2.5D are closed at their reviewed boundaries. Fresh production `Update Portfolio Data #3300` / run `31999168801` on `main@87414b89046e83d2905be8a9f29720a94060f10b` proved cash-shadow completeness: 192/192 transaction rows resolved, 2/2 cash events resolved, USD observed, `issue_codes=[]`, `complete=True`, and the normal securities snapshot path also succeeded. Production Worker remains runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. Cash-inclusive NAV/performance is still disabled. The single Primary Active Batch is R2.6A Cash-Inclusive Account Value Preview.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists only to enable product correctness, maintainability and UX.
3. Debug from evidence and root cause; inspect same-class impact and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots or other financial facts that authoritative data does not provide.
8. Shadow completeness is a prerequisite for account-value work, not automatic permission to activate NAV/TWR/XIRR.
9. When a batch closes, stop its technical work instead of expanding scope for neatness.

---

## 1. Current authoritative state

### Repository / production checkpoint

Before this docs-only closeout:

- protected `main`: `87414b89046e83d2905be8a9f29720a94060f10b`;
- open PRs: none at the R2.5D evidence checkpoint;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- production D1 remains schema v3 with reviewed transaction-metadata and cash-event migrations;
- current securities-only snapshot/accounting behavior remains authoritative for its existing scope;
- cash-inclusive account NAV, TWR, XIRR, performance chart and transaction chronology are not activated.

Always re-read fresh `main`, open PRs, CI, Pages and production runtime before modifying anything.

### R2.5A — Transaction Currency Reconciliation UX

Status: **CLOSED / PRODUCTION PAGES VERIFIED**.

Legacy missing currencies were explicitly reviewed by the authenticated user; production evidence later proved all 192 observed transaction rows resolve durable currency. Symbol-derived currency remains suggestion-only.

### R2.5B — Post-Reconciliation Shadow Evidence

Status: **CLOSED / PRODUCTION EVIDENCE VERIFIED**.

`Update Portfolio Data #3295` proved transaction-currency completeness and selected `MISSING_OPENING_BALANCE` as the sole next cash-readiness issue.

### R2.5C — Opening Balance Readiness UX

Status: **CLOSED / PRODUCTION PAGES VERIFIED**.

The existing CashManager was aligned with opening-balance-first setup without adding a new writer, schema or accounting engine.

### R2.5D — Opening Balance Authoritative Input + Shadow Verification

Status: **CLOSED / PRODUCTION SHADOW COMPLETE**.

Production path:

- an intermediate run correctly surfaced `OPENING_DATE_ACTIVITY_AMBIGUOUS` when a baseline shared the earliest transaction date;
- the user clarified the real cash-event semantics and corrected the production cash events;
- no software/accounting workaround was introduced;
- final `Update Portfolio Data #3300` / run `31999168801` on `main@87414b89046e83d2905be8a9f29720a94060f10b` reported:
  - `complete=True`;
  - transaction rows `192`, resolved `192`;
  - cash event rows `2`, resolved `2`;
  - currencies `['USD']`;
  - issue codes `[]`;
- transaction prefix integrity, canonical Daily P&L reconciliation, split-ledger parity and snapshot upload also succeeded.

Do not reopen R2.5 reconciliation unless new production evidence shows a material defect.

---

## 2. Current Primary Active Batch

### Phase

`R2 — Ledger Truth v2`

### Batch

`R2.6A — Cash-Inclusive Account Value Preview`

Status: **PLANNING / READY FOR IMPLEMENTATION**

### Primary Goal

> Give the user a deterministic, auditable preview of whole-account value by combining existing securities valuation with authoritative cash, without silently changing current holdings-value or performance semantics.

### Why this is next

Production now has sufficient reviewed cash facts for the observed USD ledger. The next user-facing gap is that the product still exposes securities market value but cannot yet show a reviewed whole-account value that includes cash.

This batch is intentionally a preview rather than a cutover because cash completeness does not by itself review:

- FX valuation provenance;
- account-value snapshot contract;
- performance cash-flow treatment;
- TWR/XIRR semantics;
- historical whole-account chart methodology.

### Narrow execution boundary

1. Calculation engine owns the account-value preview. The browser does not calculate cash, FX or account NAV.
2. Use cash balances only when shadow cash report is complete.
3. Reuse reviewed engine-owned valuation/FX inputs where possible; do not introduce a second FX source merely for the preview.
4. Publish explicit preview provenance/readiness fields in the calculated snapshot contract.
5. Present a separate user-facing `帳戶價值預覽` (final wording subject to UX review) alongside existing `持倉市值`; do not silently relabel `summary.total_value`.
6. Fail closed when cash or FX inputs are incomplete/unreviewed.
7. Add deterministic reconciliation: preview account value = securities value + reviewed cash value components.
8. Preserve current Daily P&L, TWR, XIRR and performance-chart behavior in R2.6A.
9. No transaction chronology activation.
10. No broker-specific balance importer in this batch.

### Exit criteria

R2.6A may close only when:

1. the engine-owned preview contract and terminology are explicit;
2. incomplete cash/FX states fail closed rather than fabricate a value;
3. deterministic component reconciliation is tested;
4. existing securities-only metrics are unchanged;
5. frontend only renders published preview/provenance and performs no parallel accounting;
6. exact-head CI and frozen independent review pass;
7. production Pages/runtime evidence confirms the new preview without regressions;
8. no whole-account performance cutover is implied by the preview.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** R2.6A account-value preview contract → engine calculation → snapshot publication → frontend rendering → production reconciliation.
- **NEXT:** only after R2.6A production evidence, decide whether a separate whole-account performance methodology/cutover batch is justified.
- **BACKLOG:** account-level TWR/XIRR methodology, historical account-value chart, multi-currency expansion when actually observed, R3 broker-neutral import/export/backup/restore, R4 deterministic portfolio intelligence.
- **REJECT:** browser-side NAV/FX accounting, silent replacement of `持倉市值`, automatic TWR/XIRR cutover, guessed FX/cash, inferred chronology, unrelated cleanup.

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

### Cash authority

```text
user cash CRUD
→ explicit cash_events
→ targeted trusted-system read
→ deterministic shadow cash derivation
→ completeness gate
→ reviewed account-value preview
→ later separate performance-cutover review
```

- user CRUD remains the only cash mutation authority;
- no system cash writer;
- transaction cash currency must be explicitly persisted;
- one opening balance per currency;
- absence of opening balance never means zero;
- same-date ambiguity remains fail-closed unless a separately reviewed chronology authority exists;
- cash-shadow/account-value preview does not automatically alter TWR/XIRR.

### Financial terminology

Until a later reviewed cutover:

- `summary.total_value` → user-facing `持倉市值`;
- `summary.invested_capital` → user-facing `持倉成本`;
- any whole-account value introduced in R2.6A must be clearly identified as a separate preview contract;
- generic whole-account ROI/TWR/XIRR claims remain invalid unless explicitly reviewed later.

### Dividend / history

- same-tenant DIV record is the only `已入帳` authority;
- records remain authoritative transaction history;
- Journal `note` is user content, not execution chronology/provenance authority;
- `id` / `created_at` are database facts, not broker execution time.

---

## 4. Roadmap V2 — current dependency order

1. R2.1 canonical event/timeline contract — CLOSED / VERIFIED.
2. R2.2 transaction metadata foundation — CLOSED at reviewed production boundaries.
3. R2.3 explicit cash storage/API/UI — CLOSED at reviewed production boundaries.
4. R2.4 deterministic shadow cash ledger + targeted production feed — CLOSED / PRODUCTION VERIFIED.
5. R2.5A transaction currency reconciliation — CLOSED / PRODUCTION VERIFIED.
6. R2.5B post-reconciliation evidence — CLOSED.
7. R2.5C opening-balance readiness UX — CLOSED / PRODUCTION PAGES VERIFIED.
8. R2.5D authoritative cash input + shadow verification — CLOSED / `complete=True` production evidence.
9. **R2.6A cash-inclusive account-value preview — CURRENT.**
10. Only after R2.6A reviewed production evidence: separately consider whole-account TWR/XIRR/performance cutover.

After R2 foundation:

- **R3 Universal Data Gateway:** broker-neutral import/export/backup/restore and deterministic adapters.
- **R4 Portfolio Intelligence:** account-level analytics and AI summarization over deterministic facts. AI never becomes accounting/FX/tax/lot/market-data authority.

---

## 5. Risk / decision register

### Current risks to control

- Do not treat one production USD-complete ledger as proof that every future tenant/currency is complete.
- Do not reuse a spot/current FX value for historical performance without an explicitly reviewed rule.
- Do not make the browser responsible for deriving cash balance or account value.
- Do not let a new account-value label silently change the semantics of existing persisted snapshot fields.
- Existing XIRR warnings about non-conventional cash flows are not automatically solved by cash completeness and are outside R2.6A unless the new preview directly exposes a defect.

### Decisions carried forward

- symbol-derived currency is never durable financial authority;
- historical/opening cash is never inferred;
- chronology is never inferred from partial timestamps;
- production evidence selects the next truth gap;
- closed-batch details belong in versioned `docs/engineering/`, not duplicated live-status prose;
- technical cleanup without product justification remains rejected.

---

## 6. Immediate next actions

1. Re-read current snapshot schema/calculator publication path and StatsGrid rendering contracts.
2. Identify the existing engine-owned FX provenance used for securities valuation and whether it can safely value the complete USD cash balance for the preview.
3. Define R2.6A preview fields and fail-closed readiness semantics before implementation.
4. Implement the narrow engine/snapshot/frontend path with reconciliation tests.
5. Do not modify existing TWR/XIRR/Daily P&L/performance chart behavior.
6. Run full CI, frozen exact-head review and production verification.
7. Update this live handoff only after evidence changes the current state.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this live handoff.
2. Re-read fresh `main`, open PRs, CI, Pages and production runtime before modification.
3. Treat newer production evidence as higher authority than this snapshot.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for new material evidence.
6. Debug same-class impact + regression prevention.
7. Use versioned engineering closeouts for R2.4/R2.5 history.
8. Continue **R2.6A Cash-Inclusive Account Value Preview** without prematurely activating whole-account performance semantics.
