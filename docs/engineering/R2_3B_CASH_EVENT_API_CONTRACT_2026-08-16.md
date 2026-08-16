# R2.3B Cash Event API Contract — 2026-08-16

Status: implementation candidate after R2.3A production storage verification.
Risk class: **R2 — Significant**. This activates authenticated writes to the additive `cash_events` family but deliberately does not activate cash-ledger calculation or account NAV.

## Goal

Expose the smallest user-only API needed for the later cash-management UI while preserving tenant isolation, exactly-once create retries, optimistic edit/delete conflict protection, and the R2.3A accounting boundaries.

## Routes

- `GET /api/cash-events` — current user's events only, deterministic `event_date DESC, id DESC` presentation order.
- `POST /api/cash-events` — current user only; requires `Idempotency-Key`.
- `PUT /api/cash-events` — current user only; requires exact previously observed `expected` user-visible state plus desired `event` state.
- `DELETE /api/cash-events` — current user only; requires exact previously observed `expected` user-visible state.

System/API-secret principals are intentionally not authorized on this surface. Broker/import writers remain a later separately reviewed adapter contract.

## Accepted user fields

The user-visible cash state is exactly:

- `event_date`
- `event_type`: `OPENING_BALANCE`, `DEPOSIT`, `WITHDRAWAL`
- `amount`
- `currency`
- `note`

`OPENING_BALANCE` remains signed and may be negative, zero, or positive. Deposit/withdrawal remain positive magnitudes. Currency is strict uppercase three-letter cash currency; quote unit `GBp` is invalid.

Browser callers cannot submit owner fields, internal hashes, audit timestamps or `event_source`. New user-created rows receive server-controlled `event_source = MANUAL`.

## Durable create semantics

`POST` requires a valid `Idempotency-Key` and stores tenant-scoped SHA-256 retry identity plus a versioned `cash-event-create-v1` payload fingerprint.

- same tenant + same key + same validated payload => replay success, one row;
- same tenant + same key + different payload => `409 IDEMPOTENCY_CONFLICT`;
- another tenant may reuse the same external key independently;
- a distinct key is a distinct create intent;
- a second opening balance for the same tenant/currency => `409 OPENING_BALANCE_EXISTS` even with a different key.

## Update/delete conflict semantics

`updated_at` is not used as a concurrency token because it is an audit timestamp with storage precision unrelated to financial identity.

Instead, PUT/DELETE execute one tenant-scoped SQL mutation guarded by the exact previously observed user-visible state. A stale browser therefore receives `409 CASH_EVENT_CHANGED` instead of overwriting/deleting a concurrent amendment. Cross-tenant IDs resolve as `404 CASH_EVENT_NOT_FOUND` without row leakage.

Opening-balance uniqueness remains protected by the existing D1 unique index and an atomic update guard.

## Calculation boundary

Cash CRUD touches `cash_events` only. It does not mutate `records`, `portfolio_snapshots`, `calculation_jobs`, trigger GitHub calculation, dirty a portfolio generation, derive trade/dividend cash, or change Overview/account NAV.

The runtime advances to release `4.11` / API `2.64`; physical schema authority remains `3` and no migration is added. Because the API now depends on `cash_events`, `/api/health` requires the table to exist.

R2.3C may build the user-facing cash-management UX on this contract. R2.4 shadow cash ledger remains a later calculation gate.
