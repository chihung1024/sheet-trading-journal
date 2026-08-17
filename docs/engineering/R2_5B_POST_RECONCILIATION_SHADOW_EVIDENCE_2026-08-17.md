# R2.5B — Post-Reconciliation Shadow Readiness Evidence

Date: 2026-08-17 (Asia/Taipei)  
Status: **CLOSED / PRODUCTION EVIDENCE VERIFIED**

## Primary Goal

Use user-confirmed transaction currency metadata to rerun the existing production shadow cash-readiness path, then choose the next product batch only from the next observed deterministic issue.

## Entry Condition

R2.5A Transaction Currency Reconciliation UX was production-Pages verified. The user then explicitly reviewed and confirmed the legacy transaction currencies through the production reconciliation surface. No Symbol-derived suggestion was promoted automatically by the project agent.

## Production Evidence

Fresh normal production workflow:

- workflow: `Update Portfolio Data #3295`;
- run: `31997773324`;
- source: protected `main@75c74b6dfafba68d5a290b08bf8abdc9aa82bb31`;
- result: **SUCCESS**;
- transaction rows: `192`;
- resolved transaction rows: `192`;
- cash event rows: `0`;
- resolved cash event rows: `0`;
- observed cash currencies: `USD`;
- shadow complete: `false`;
- issue codes: `MISSING_OPENING_BALANCE` only;
- earliest tracked transaction date reported by the normal calculation run: `2026-07-31`.

`TRANSACTION_CURRENCY_MISSING` is no longer present. The currency-reconciliation gate therefore succeeded for all 192 observed transaction rows.

The existing securities path remained healthy in the same run: canonical Daily P&L reconciliation completed, split-adjusted ledger parity passed for the 192 BUY/SELL rows, the portfolio snapshot uploaded successfully, and the processed user completed successfully.

## Deterministic Interpretation

The next observed R2 cash-readiness gap is now **explicit opening balance**, not transaction currency and not another cash-feed/runtime problem.

The shadow ledger contract is intentionally strict:

- each cash currency may have at most one `OPENING_BALANCE` event;
- the opening amount may be positive, zero or negative and must be an explicit user fact;
- movements before the opening date are treated as already absorbed into that baseline;
- a movement on the same calendar date as the opening balance is ambiguous because R2 does not have authoritative intra-day ordering;
- therefore a same-date movement produces `OPENING_DATE_ACTIVITY_AMBIGUOUS` and does not yield an authoritative balance;
- missing opening cash must never be interpreted as zero.

## Existing Product Capability Audit

No new cash storage or writer is required:

- `cash_events` already persists `OPENING_BALANCE`;
- the user-only Cash Events API already validates and creates `OPENING_BALANCE`, `DEPOSIT`, and `WITHDRAWAL`;
- the existing CashManager already exposes all three event types and preserves idempotent create / optimistic conflict semantics;
- Worker/D1/Python authority therefore remains unchanged.

The material UX gap is narrower: when the cash ledger is empty, the UI tells the user to start with opening cash but the create form defaults to `DEPOSIT`, and the UI does not explain the baseline-date / same-calendar-day ambiguity rule. That can steer a first-time user toward the wrong event type or an unsafe date choice even though the underlying accounting contract is correct.

## Next Product Batch

### R2.5C — Explicit Opening Balance Readiness UX

Primary Goal:

> Make the existing opening-balance authority safe and obvious enough for a first-time cash-ledger setup, without adding another writer, guessing the user's cash, or changing accounting semantics.

### In Scope

1. When the server confirms the cash-event ledger is empty, default an untouched new-event form to `OPENING_BALANCE`.
2. Never overwrite a form the user already changed and never interfere with a pending ambiguous create intent.
3. Explain that opening balance is a known user baseline, not a calculated value.
4. Explain that prior movements are absorbed into the baseline and same-calendar-day activity remains ambiguous.
5. Keep opening amount blank; do not infer or default it to zero.
6. Preserve existing user-only Cash Events API, D1 schema, idempotency, conflict handling and securities-only calculation behavior.

### Out of Scope

- no Worker/API permission expansion;
- no D1 migration;
- no auto-calculated or Symbol-derived opening cash;
- no broker-balance import in this batch;
- no cash-inclusive NAV/TWR/XIRR/FX cutover;
- no transaction chronology activation;
- no unrelated refactor.

## Rollback Boundary

R2.5B is evidence-only. R2.5C is expected to be frontend/test/documentation only. If the UX change regresses, revert the R2.5C feature merge; no Worker or D1 rollback should be necessary.
