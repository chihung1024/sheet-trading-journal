# R2.4B Cash Shadow Feed Contract — 2026-08-17

## Goal

Expose explicit `cash_events` to the trusted calculator as a strictly targeted, read-only feed and run R2.4A as observation-only completeness evidence. This batch does **not** make cash authoritative for account value.

## Authority boundary

- User CRUD remains the only cash writer; system/API-secret principals cannot POST/PUT/DELETE cash events.
- System GET requires an explicit single `X-Target-User`; there is no all-users cash endpoint.
- User GET remains pinned to the authenticated user's own tenant even if a target header is supplied.
- Public cash projection remains owner/idempotency-hash free.
- Python fetch failure, authorization failure, malformed response, or ledger derivation failure cannot block the existing securities-only snapshot.
- Shadow evidence logs only completeness/counts/currency codes/issue codes and exception class names. It never logs balances, cash amounts, notes, raw payloads, or tenant identity.
- No cash amount is written into snapshots, Overview, NAV, TWR, XIRR, FX conversion, transaction chronology, or production manifests.

## Runtime

Worker release `4.12`, API `2.65`, schema authority `3`. No migration.

## Activation

Repository merge is safe before Worker activation because the Python cash feed is intentionally non-blocking. Production activation still requires the repository-controlled protected deployment workflow before the system principal can receive cash events.
