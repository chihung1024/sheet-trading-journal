# NOW-1B Durable Record Create Intent

Date: 2026-08-14 Asia/Taipei
Base: `771518f51eb98ce76a5d8cf7e7c4b1fe383ee982`
Risk: R2 — browser persistence and record-create behavior.

## Current status

The market-data incident that interrupted product work is closed. Normal product run `Update Portfolio Data #3270` production-exercised the generic exact-date same-provider recovery and completed all downstream validation, Daily PnL reconciliation, split-ledger parity, snapshot upload, and calculation-job completion successfully. Market-data work returns to passive watch.

The active product line is NOW-1B: remove ambiguity from `POST /api/records` by consuming the already-live server-side record-create idempotency contract.

## Product objective

```text
one logical trade create
-> persist intent before POST
-> one stable idempotency key + immutable payload
-> timeout / token refresh / reload may occur
-> recovery reuses the same key and payload
-> verified replay/success produces one record
-> completed intent is cleared
```

The user should not have to decide whether an ambiguous create probably succeeded before retrying.

## Scope

In scope: stable key generation, tenant-bound durable intent storage, persist-before-send, same-key replay after ambiguous transport outcomes, reload recovery, token-refresh-safe replay, terminal conflict handling, success cleanup, logout cleanup, cross-tab safety, bounded recovery, tests, and minimal handoff updates.

Out of scope: financial formula changes, UPDATE/DELETE redesign, transaction-content fingerprint dedupe, broad schema/idempotency framework work, auth redesign, scheduler/queue work, provider redesign, ledger/Decimal/UUID work, and documentation-only expansion.

## Correctness boundary: later record mutations supersede stale create replay

A pending create may auto-replay only while no later explicit record mutation has superseded it. Starting a newer logical create or attempting UPDATE/DELETE establishes a durable local barrier for older pending create intents. A superseded intent must never auto-POST again. This prevents a stale ambiguous create from recreating a transaction after a later delete.

After verified create success, that key is never reused for a new logical create. This keeps the guarantee honest without adding a new backend tombstone subsystem.

## Correctness boundary: frontend/backend capability coordination

Automatic stable-key recovery must not silently run against a backend runtime that does not support record-create idempotency. The implementation must use the narrowest reliable capability contract available. If a simple preflight has a mutation race, add only the minimum contract needed to fail closed; do not reopen broad backend architecture.

## Persistence contract

Use a dedicated service rather than ad-hoc Pinia storage calls. Stored values are tenant-validated; storage keys contain no email/PII. Malformed, cross-owner, unsupported-version, impossible-future, or superseded intents fail closed. Multiple intents may coexist, but recovery must be bounded and deterministic.

## Error semantics

- verified success: committed; clear the exact intent and refresh records;
- idempotency conflict: terminal; never rotate a new key automatically for the same logical submission;
- explicit rejection: terminal for that intent;
- timeout/network/server ambiguity after dispatch: retain exact intent/key for bounded recovery;
- storage unavailable before POST: fail before mutation;
- token refresh: any retry must preserve exact key and body.

## Required regressions

1. persist-before-send;
2. same logical retry uses same key;
3. distinct creates get distinct keys even for identical payloads;
4. payload is immutable for a key;
5. conflict does not rotate key;
6. ambiguous failure retains intent;
7. reload restores same-owner intent;
8. cross-owner state cannot replay;
9. logout clears create-intent state only;
10. token refresh preserves key/body;
11. later create/update/delete supersedes older replay eligibility;
12. superseded intent cannot recreate after delete;
13. recovery is bounded;
14. unsupported backend capability fails closed;
15. existing mutation-outcome callers remain compatible;
16. no financial-engine or snapshot-calculation behavior changes.

## Completion rule

Close NOW-1B when normal retry/reload/token-refresh paths produce one logical record, stale replay cannot undo later user intent, unsupported backend capability fails closed, and the user no longer needs to reason about ambiguous POST outcomes. Then resume end-to-end Product Functionality Review rather than expanding idempotency infrastructure.
