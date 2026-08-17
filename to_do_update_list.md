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

Last updated: **2026-08-17 Asia/Taipei**  
Current line: **R1 and R2.1–R2.5C are closed at their reviewed boundaries. R2.5A repaired the transaction-currency UX; fresh production `Update Portfolio Data #3295` then proved all 192 observed transaction rows have resolved currency and identified `MISSING_OPENING_BALANCE` as the sole cash-shadow readiness issue. R2.5C aligned the existing CashManager with that evidence and is CLOSED / PRODUCTION PAGES VERIFIED at merge `80c4a57ca9e2b136b33aa2f1420aec179bd42b3e`; exact-head CI #1137, post-main CI #1138 and Pages #1612 succeeded. Production Worker remains exact runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. Cash-inclusive NAV/performance remains disabled. The single Primary Active Batch is R2.5D Opening Balance Authoritative Input + Shadow Verification, BLOCKED ON USER AUTHORITATIVE INPUT rather than code.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch. Technical work exists only to enable product correctness, maintainability and UX.
3. Debug from evidence and root cause; inspect same-class impact and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation must never become a second accounting, FX, tax, recovery or market-data authority.
5. Important work uses recovery points, exact-head CI, frozen review, exact-head merge and post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Do not delete compatibility/forensic material without evidence that removal is safe.
8. Rank work by cross-user applicability, frequency, product/UX value and dependency order.
9. Never infer cash, transaction currency, historical lots, classifications, risk scores or other financial facts that authoritative data does not provide.
10. When a batch closes, stop its technical work instead of expanding scope for neatness.

---

## 1. Current authoritative state

### Repository / production checkpoint

Before this docs-only closeout:

- protected `main`: `80c4a57ca9e2b136b33aa2f1420aec179bd42b3e`;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- production D1 remains schema v3 with the reviewed additive transaction-metadata and cash-event migrations already applied;
- R2.5A/C are frontend/product UX changes only and did not redeploy Worker or migrate D1;
- current securities-only snapshot/accounting behavior remains authoritative for its existing scope;
- cash-inclusive account NAV, TWR, XIRR, FX valuation and transaction chronology are not activated.

Always re-read fresh `main`, open PRs, CI, Pages and production runtime before modifying anything.

### R2.5A — Transaction Currency Reconciliation UX

Status: **CLOSED / PRODUCTION PAGES VERIFIED**.

Key evidence:

- PR #330 frozen head `2bfa16c26f6848caf3fd5241def2ed7159702e71`;
- exact-head CI #1133 / run `31996866556`: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merge `7acb01717395b09a0b4e09b24af8733e60a0a8cb`;
- post-main CI #1134 / run `31996960247`: SUCCESS;
- Pages #1610 / run `31996959451`: SUCCESS.

The user subsequently explicitly reviewed and confirmed the legacy missing transaction currencies through the production reconciliation UX. Symbol-derived currency remained suggestion-only.

### R2.5B — Post-Reconciliation Shadow Readiness Evidence

Status: **CLOSED / PRODUCTION EVIDENCE VERIFIED**.

Normal production `Update Portfolio Data #3295` / run `31997773324` on `main@75c74b6dfafba68d5a290b08bf8abdc9aa82bb31` reported:

- transaction rows: `192`;
- resolved transaction rows: `192`;
- cash event rows: `0`;
- resolved cash event rows: `0`;
- observed cash currencies: `USD`;
- shadow complete: `false`;
- issue codes: `MISSING_OPENING_BALANCE` only;
- earliest tracked transaction date in that run: `2026-07-31`.

`TRANSACTION_CURRENCY_MISSING` disappeared. In the same run, canonical Daily P&L reconciliation, split-adjusted ledger parity, portfolio snapshot upload and normal securities processing succeeded.

Therefore the next observed product/data gap is explicit USD opening cash, not another currency repair, Worker deployment or cash-engine rewrite.

### R2.5C — Explicit Opening Balance Readiness UX

Status: **CLOSED / PRODUCTION PAGES VERIFIED**.

Key evidence:

- PR #332 frozen head `037fdb90739e5048a5ef9049c3be097cafbd6e96`;
- exact-head CI #1137 / run `31998060195`: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- merge `80c4a57ca9e2b136b33aa2f1420aec179bd42b3e` using expected-head protection;
- post-main CI #1138 / run `31998147441`: SUCCESS;
- Pages #1612 / run `31998146666`: SUCCESS;
- no Worker deploy or D1 migration.

Delivered boundary:

- an untouched form defaults to `OPENING_BALANCE` only after a successful server read confirms zero cash events and there is no pending ambiguous create intent;
- the opening amount remains blank and is never inferred/defaulted to zero;
- the UI explains baseline semantics and same-calendar-day ambiguity;
- existing Cash Events API/idempotency/conflict handling and Python shadow accounting remain unchanged.

---

## 2. Current Primary Active Batch

### Phase

`R2 — Ledger Truth v2`

### Batch

`R2.5D — Opening Balance Authoritative Input + Shadow Verification`

Status: **BLOCKED ON USER AUTHORITATIVE INPUT**

### Primary Goal

> Convert the production-verified opening-balance UX into one explicit USD baseline fact, then rerun the existing shadow cash-readiness path and decide the next product work only from the new deterministic evidence.

### Entry truth

- production shadow evidence has resolved all 192 observed transaction currencies;
- current shadow issue is `MISSING_OPENING_BALANCE` for `USD`;
- production currently has zero cash events in the observed shadow run;
- CashManager / Cash Events API already provide the durable user-only opening-balance authority;
- the software cannot know the correct historical USD cash amount or date without user/reviewed-source input;
- absence of opening cash must never be treated as zero.

### User-authoritative input required

The authenticated user must create exactly one USD `OPENING_BALANCE` from a cash balance and calendar date they can actually verify.

Date rule:

- prefer a known baseline date with no BUY, SELL, DIV, DEPOSIT or WITHDRAWAL activity on that same calendar date;
- movements before the opening date are intentionally absorbed into the baseline;
- a movement on the opening date produces `OPENING_DATE_ACTIVITY_AMBIGUOUS` because authoritative intra-day ordering is not available;
- the production run reported the earliest tracked transaction date as `2026-07-31`, but that does **not** authorize the system to invent a `2026-07-30` balance. Use an earlier date only if its actual USD balance is known.

Amount rule:

- may be positive, zero or negative;
- must be the actual known USD cash balance at the chosen baseline;
- zero is valid only if zero is the real known fact;
- do not reconstruct or guess the amount merely to clear readiness.

### Exit criteria

R2.5D may close only when:

1. the user explicitly records a valid USD opening balance in production;
2. server state confirms the cash event exists;
3. a fresh normal production shadow run consumes that cash event;
4. the resulting shadow evidence is recorded;
5. if a new issue appears, the next batch is limited to that observed issue;
6. if shadow becomes complete for the current stage, that completion is recorded without automatically activating NAV/FX/performance.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** user-authoritative USD opening balance, then fresh shadow verification.
- **NEXT:** only the next issue observed by the post-opening production shadow run, or an evidence closeout if complete.
- **BACKLOG:** reviewed FX/account-value methodology, cash-inclusive account NAV/performance cutover, broker-neutral import/restore gateway.
- **REJECT:** guessed opening cash, fake zero, inferred chronology, automatic broker-balance assumptions, premature NAV/FX activation, parallel browser accounting engines, unrelated cleanup.

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
→ shadow cash derivation + completeness issues
→ reconciliation / evidence gate
→ later explicit account-value cutover review
```

- user CRUD is the only cash mutation authority;
- system/API-secret cash reads require one explicit target tenant;
- no system cash writer;
- transaction cash currency must be explicitly persisted; Symbol inference is suggestion-only, never durable authority;
- one opening balance per currency;
- opening balance must be explicit; absence never means zero;
- pre-opening movements are absorbed by the baseline;
- opening-date movement remains ambiguous until a separately reviewed chronology authority exists;
- multi-currency cash remains separated until a reviewed FX/account-value methodology exists;
- shadow balances/evidence do not enter current snapshots or performance.

### Financial terminology

Until a later reviewed R2 cutover:

- `summary.total_value` → user-facing `持倉市值`;
- `summary.invested_capital` → user-facing `持倉成本`;
- generic cash-inclusive `總資產淨值 / NAV` is invalid;
- generic whole-account ROI language is invalid for the current securities-only calculation scope.

### Dividend / history

- actual same-tenant DIV record is the only `已入帳` authority;
- records remain authoritative transaction history;
- Journal `note` is user content, not execution chronology/provenance authority;
- `id` / `created_at` are database facts, not broker execution time.

---

## 4. Roadmap V2 — current dependency order

1. R2.1 canonical event/timeline contract — CLOSED / VERIFIED.
2. R2.2A/B/C transaction metadata foundation — CLOSED at reviewed production boundaries.
3. R2.3A/B/C explicit cash storage/API/UI — CLOSED at reviewed production boundaries.
4. R2.4 deterministic shadow cash ledger + targeted production feed — CLOSED / PRODUCTION VERIFIED at shadow-only boundary.
5. R2.5A transaction currency reconciliation UX — CLOSED / PRODUCTION PAGES VERIFIED.
6. R2.5B post-reconciliation shadow evidence — CLOSED / PRODUCTION EVIDENCE VERIFIED.
7. R2.5C explicit opening-balance readiness UX — CLOSED / PRODUCTION PAGES VERIFIED.
8. **R2.5D explicit opening-balance input + fresh shadow evidence — CURRENT / user-authoritative input required.**
9. Address only the next observed truth gap.
10. Only after sufficient authoritative coverage: separately review FX/account-value methodology and account NAV/performance cutover.

After R2 foundation:

- **R3 Universal Data Gateway:** broker-neutral import/export/backup/restore and deterministic adapters.
- **R4 Portfolio Intelligence:** account-level analytics and AI summarization over deterministic facts. AI never becomes accounting/FX/tax/lot/market-data authority.

---

## 5. Current risk / decision register

### Active dependency

- No unresolved R2.5A/B/C software BLOCKER remains at their closeout boundaries.
- Current R2.5D dependency is a financial fact: the user's explicit USD opening balance and valid baseline date.
- This blocks authoritative cash-shadow completion but does **not** invalidate existing securities accounting.

### Decisions carried forward

- do not infer currency from Symbol as durable truth;
- do not infer historical/opening cash as zero;
- do not infer chronology from partial timestamps or generic execution sequence;
- do not widen R2.5 into FX/NAV/performance cutover;
- do not create a second browser valuation/accounting/reconciliation authority;
- do not perform unrelated refactor/technical cleanup without product justification;
- closed-batch details live in versioned `docs/engineering/` records, not duplicate Current Batch prose.

### Deferred candidates

- FX/account-value methodology — BACKLOG until shadow cash coverage is sufficient;
- cash-inclusive NAV/account performance — BACKLOG pending explicit reviewed cutover;
- broker-neutral restore/import — R3 BACKLOG;
- broker-specific automation — optional, not part of the current cash-readiness gate.

---

## 6. Immediate next actions

1. Authenticated user opens the production Trading Journal.
2. Open the `現金` view.
3. Confirm the create form shows `期初現金` for the currently empty cash-event ledger.
4. Choose `USD`.
5. Choose a calendar date whose USD cash balance is actually known and that has no same-day BUY/SELL/DIV/deposit/withdrawal activity if possible.
6. Enter the actual USD cash balance for that date. Do not guess or use zero unless zero is the known fact.
7. Optional: add a note identifying the authoritative source/baseline context without storing secrets.
8. Submit `新增紀錄`.
9. Confirm the new `期初現金 / USD` row appears in `現金流水`. If the UI shows a pending/ambiguous create, use `確認上一筆結果` rather than creating a second event.
10. User reports completion to the project agent without sending tokens/passwords.
11. Agent observes/reruns the existing production shadow path and records the next deterministic result.
12. Do not activate NAV/performance, FX valuation or chronology unless a new explicit reviewed evidence gate authorizes it.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this live handoff.
2. Re-read fresh `main`, open PRs, CI, Pages and production runtime before modification.
3. Treat new user screenshots/logs/production symptoms as newer than documentation prose.
4. Keep one Primary Active Batch and preserve its recovery point.
5. Reopen closed work only for new material evidence.
6. Debug same-class impact + regression prevention.
7. Use the versioned engineering closeouts above for R2.4/R2.5 history rather than stale archived Current Batch instructions.
8. R2.5C is CLOSED / PRODUCTION PAGES VERIFIED. Continue **R2.5D Opening Balance Authoritative Input + Shadow Verification** only from explicit user/reviewed-source cash facts.
