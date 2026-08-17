# R2.5C — Explicit Opening Balance Readiness UX Closeout

Date: 2026-08-17 (Asia/Taipei)  
Status: **CLOSED / PRODUCTION PAGES VERIFIED**

## Primary Goal

Make the already-existing opening-balance authority safe and obvious for first-time cash-ledger setup without inventing another writer, guessing cash, or changing accounting semantics.

## Evidence that selected this batch

R2.5B production evidence came from normal `Update Portfolio Data #3295` / run `31997773324` on protected `main@75c74b6dfafba68d5a290b08bf8abdc9aa82bb31` after the user explicitly completed transaction-currency reconciliation.

Observed shadow evidence:

- transaction rows: `192`;
- resolved transaction rows: `192`;
- cash event rows: `0`;
- resolved cash event rows: `0`;
- currencies: `USD`;
- issue codes: `MISSING_OPENING_BALANCE` only;
- `TRANSACTION_CURRENCY_MISSING` no longer present;
- existing securities calculation and snapshot upload still succeeded.

Full production evidence and deterministic interpretation are recorded in `docs/engineering/R2_5B_POST_RECONCILIATION_SHADOW_EVIDENCE_2026-08-17.md`.

## Root Cause

The underlying product authority was already complete enough for explicit opening cash:

- `cash_events` already supports `OPENING_BALANCE`;
- the user-only Cash Events API already validates/creates opening balance, deposit and withdrawal;
- CashManager already exposes those event types and preserves idempotent create / optimistic conflict behavior;
- Python shadow accounting already defines the baseline semantics.

The UX mismatch was narrower: an empty cash ledger instructed the user to start from opening cash, but the untouched create form defaulted to `DEPOSIT`; the UI also did not explain that the opening balance is a user-known baseline, that prior movements are absorbed into it, or that same-calendar-day movement remains ambiguous without authoritative intra-day ordering.

## Scope Delivered

- After a successful initial server read confirms zero cash events, an untouched create form defaults to `OPENING_BALANCE`.
- The default is not applied if a pending ambiguous create intent exists.
- The default is not intended to replace user-entered cash facts; opening amount remains blank.
- Opening-balance guidance states that the amount is a known user baseline, not a system calculation.
- Guidance explains that movements before the baseline date are absorbed by the baseline.
- Guidance explains that BUY/SELL/DIV/deposit/withdrawal on the same calendar date keeps the shadow cash result ambiguous because intra-day ordering is not authoritative.
- UI explicitly rejects guessing a value or auto-filling zero merely to clear readiness.
- Empty-state language now aligns with the opening-balance-first setup path.
- Focused frontend regression coverage protects the empty-ledger default and no-fabricated-zero boundary.

## Explicit Non-Goals Preserved

- no Worker/API permission expansion;
- no D1 migration;
- no Python shadow-ledger/accounting change;
- no broker-balance import;
- no inferred or automatically calculated opening cash;
- no fabricated zero opening balance;
- no cash-inclusive NAV/TWR/XIRR/FX cutover;
- no transaction chronology activation;
- no unrelated refactor.

## Verification

### Candidate

- PR: #332 — `feat: clarify opening balance readiness UX`;
- base: `75c74b6dfafba68d5a290b08bf8abdc9aa82bb31`;
- frozen exact head: `037fdb90739e5048a5ef9049c3be097cafbd6e96`;
- changed files: 3.

### Exact-head CI

CI #1137 / run `31998060195`: **SUCCESS**.

Verified:

- frontend contracts — PASS;
- Vite production build — PASS;
- Python tests / branch-coverage gate — PASS;
- Worker security / recovery contracts — PASS;
- local D1 baseline — PASS.

### Frozen review

Exact head `037fdb90739e5048a5ef9049c3be097cafbd6e96`: **PASS / BLOCKER 0 / FOLLOW-UP 0**.

### Merge

- PR #332 merged with expected-head protection.
- Merge commit: `80c4a57ca9e2b136b33aa2f1420aec179bd42b3e`.

### Post-main verification

- CI #1138 / run `31998147441`: **SUCCESS** on merge SHA `80c4a57c...`.
- GitHub Pages #1612 / run `31998146666`: **SUCCESS** on the same merge SHA.
- Production Worker was intentionally not deployed; R2.5C contains no Worker/runtime/schema change.

## Accounting / Data Boundary

The software is now ready to accept an explicit USD opening baseline, but it still does not know that financial fact. The amount and valid baseline date must come from the authenticated user or another reviewed authoritative source.

Shadow rules remain:

- one opening balance per cash currency;
- opening amount may be positive, zero or negative;
- movements earlier than the opening date are treated as absorbed by the baseline;
- same-calendar-day movement produces `OPENING_DATE_ACTIVITY_AMBIGUOUS` because no authoritative intra-day ordering exists;
- absence of an opening balance never means zero.

## Rollback

Revert PR #332 / merge `80c4a57ca9e2b136b33aa2f1420aec179bd42b3e`. No D1 or Worker rollback is required.

## Convergence

### NOW

R2.5C is closed. Do not extend opening-balance UI implementation without new material evidence.

### NEXT — R2.5D Opening Balance Authoritative Input + Shadow Verification

1. Authenticated user records one explicit USD `OPENING_BALANCE` using a cash balance and calendar date they can actually verify.
2. Prefer a baseline date with no BUY/SELL/DIV/deposit/withdrawal activity on that same calendar date; do not choose a date merely to satisfy the model.
3. Rerun/observe the existing production shadow path.
4. If shadow becomes complete for this stage, record that evidence. If a different deterministic issue appears, open only the narrow product batch required by that evidence.

### BACKLOG

Reviewed FX/account-value methodology, cash-inclusive account NAV/performance cutover, and broker-neutral data gateway work remain downstream.

### REJECT

Guessed opening cash, fabricated zero, inferred chronology, premature NAV/FX activation, parallel browser accounting engines, and unrelated cleanup.
