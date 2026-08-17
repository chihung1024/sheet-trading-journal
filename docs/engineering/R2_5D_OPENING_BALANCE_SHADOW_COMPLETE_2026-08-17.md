# R2.5D — Opening Balance Authoritative Input + Shadow Verification Closeout

Date: 2026-08-17 (Asia/Taipei)  
Status: **CLOSED / PRODUCTION SHADOW COMPLETE**

## Primary Goal

Convert the production-ready cash-entry UX into authoritative cash facts, rerun the existing shadow cash-ledger path, and close the readiness gap only if production evidence proves full coverage.

## Entry State

R2.5C had already shipped the opening-balance readiness UX. Production `Update Portfolio Data #3295` had proven:

- 192 transaction rows;
- 192 resolved transaction rows;
- zero cash events;
- USD as the observed cash currency;
- `MISSING_OPENING_BALANCE` as the sole cash-shadow issue;
- normal securities calculation and snapshot publication remained successful.

The remaining dependency was financial data authority, not software capability.

## User-Authoritative Correction

The user supplied the missing cash semantics in production.

An intermediate production run (`Update Portfolio Data #3297`) correctly reported `OPENING_DATE_ACTIVITY_AMBIGUOUS` because the first entered opening balance shared the earliest transaction date. The user then clarified that the same-day amount represented a real external deposit that occurred before trading, not an opening balance, and corrected the cash events accordingly while separately supplying an authoritative earlier opening baseline.

No actual personal cash amount is recorded in this public engineering document.

## Final Production Evidence

Fresh normal production `Update Portfolio Data #3300` / run `31999168801` executed on protected `main@87414b89046e83d2905be8a9f29720a94060f10b` and completed successfully.

Observed cash-shadow evidence:

- `complete=True`;
- transaction rows: `192`;
- resolved transaction rows: `192`;
- cash event rows: `2`;
- resolved cash event rows: `2`;
- currencies: `['USD']`;
- issue codes: `[]`.

The same production run also completed the existing securities path successfully:

- transaction prefix integrity passed;
- canonical Daily P&L reconciliation completed;
- split-adjusted ledger parity passed for the 192 BUY/SELL rows;
- portfolio snapshot upload succeeded;
- user processing succeeded with zero workflow-level failure.

## Root Cause and Resolution

The earlier readiness failure was not a missing engine feature. It was a data-semantics distinction:

- an opening balance is a baseline state;
- a same-day external funding event is a deposit movement;
- the shadow ledger deliberately refuses to invent intra-day ordering when a baseline and movement share a calendar date.

Once the authoritative events reflected those real semantics, the existing deterministic ledger became complete without changing Python accounting, Worker APIs, D1 schema, or browser-side accounting.

## Boundaries Preserved

R2.5D does **not** authorize any of the following by itself:

- replacing `持倉市值` with generic account NAV;
- adding cash to existing TWR/XIRR calculations;
- changing the performance chart to whole-account performance;
- inventing transaction chronology;
- introducing browser-local FX/accounting authority;
- automatically importing broker balances as accounting truth.

Shadow completeness proves that the current observed cash facts are sufficient for the reviewed cash-ledger stage. It is a prerequisite for, not an authorization of, account-value/performance cutover.

## Next Product Batch

### R2.6A — Cash-Inclusive Account Value Preview

Primary product goal:

> Publish a deterministic, auditable account-value preview that combines the existing securities valuation with authoritative cash, while leaving the current securities-only value and performance outputs intact until methodology and production reconciliation are explicitly reviewed.

Narrow execution boundary:

1. Define one calculation-engine-owned account-value preview contract.
2. Use authoritative shadow cash balances only when the ledger is complete.
3. Reuse reviewed market/FX inputs from the calculation engine; do not add browser-side FX calculation.
4. Publish explicit provenance/readiness status with the preview.
5. Present the preview as a separate user-facing value, not a silent replacement for `持倉市值`.
6. Do not alter TWR, XIRR, Daily P&L or performance-chart semantics in R2.6A.
7. Reconcile the preview against deterministic components before considering any later account-performance cutover.

## Convergence

### NOW

R2.5D is closed. Preserve the production cash facts and stop further reconciliation work unless new evidence shows a material defect.

### NEXT

R2.6A — Cash-Inclusive Account Value Preview.

### BACKLOG

- formal whole-account TWR/XIRR methodology and cutover;
- multi-currency account-value expansion when additional cash currencies are observed;
- R3 broker-neutral import/export/backup/restore;
- R4 account-level deterministic intelligence and AI summaries.

### REJECT

- using shadow completeness as permission for an unreviewed NAV/performance switch;
- guessed FX or browser-side FX authority;
- inferred chronology;
- unrelated refactor/technical cleanup.
