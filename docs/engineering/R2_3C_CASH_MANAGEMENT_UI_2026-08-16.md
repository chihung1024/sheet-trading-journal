# R2.3C Cash Management UI — 2026-08-16

Status: **ACTIVE IMPLEMENTATION**

## Product goal

Expose the production-verified R2.3B user-only cash-event API as a clear responsive UI for opening balances, deposits and withdrawals, while keeping cash-ledger calculation and account NAV explicitly inactive until R2.4/R2.5 reconciliation gates.

## UX contract

- first-class `現金` view in the existing App shell; no new router/framework;
- list current tenant cash events in server order;
- create, edit and delete opening balance/deposit/withdrawal events;
- opening balance may be negative, zero or positive; deposit/withdrawal use positive magnitude;
- currency is normalized to uppercase three-letter cash currency;
- event source remains server-owned and is not editable;
- stale PUT/DELETE conflicts refresh current state instead of overwriting;
- one-opening-per-currency conflict is explained and refreshed;
- ambiguous POST outcomes keep a sensitive local pending intent and reuse the same Idempotency-Key across reload/retry;
- unresolved POST can be reconciled by safely replaying the exact same payload/key before any new cash create intent; a failed replay never retires the earlier ambiguous intent, because only a successful replay proves its server outcome;
- logout cleanup removes pending cash-create payloads;
- mobile and desktop use the same CashManager surface; the unrelated trade-entry rail/FAB is hidden on the cash view so cash management receives full content width;
- default event date uses the browser's local calendar date rather than UTC;
- signed opening balances preserve their sign in presentation; only deposit/withdrawal derive a display direction from event type.

## Accounting boundary

R2.3C does not call `portfolioStore`, Python calculation, calculation jobs, portfolio snapshot mutation or Overview projection. It does not compute account cash or NAV. BUY/SELL/DIV cash effects stay derived from authoritative transaction records and must not be re-entered as manual cash events.

Next gate: R2.4 shadow cash ledger, followed by reconciliation/migration UX before any NAV/performance cutover.
