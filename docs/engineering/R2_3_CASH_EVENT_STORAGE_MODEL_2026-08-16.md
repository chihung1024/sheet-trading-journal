# R2.3 Cash Event Storage Model — 2026-08-16

Status: **R2.3A additive storage/model candidate; no API, cash-ledger or NAV activation**  
Audit / recovery base: `main@9caaa399f1cb7f40bbb74c0eab3eb3e7065c190f`  
Risk class: **R2 — Significant**. This is a new persistent data family, but the migration is additive, does not mutate existing rows/tables, does not advance `schema_metadata`, and remains inert to the current Worker/Python/frontend.

## 1. Primary goal

Create the smallest durable, multi-currency explicit cash-event model required for a later truthful cash ledger without destabilizing the existing BUY / SELL / DIV transaction table or prematurely changing account-value calculations.

R2.3A answers only:

> What explicit external cash facts can the user eventually store durably, and what invariants must the database protect before any cash-ledger calculation is activated?

It does **not** add cash CRUD APIs, UI, Python cash calculation, account NAV, performance changes, broker sync, or transaction chronology activation.

## 2. Root-cause boundary

The current `records` table is a security- and accounting-sensitive compatibility surface whose `txn_type` is deliberately limited to `BUY`, `SELL`, and `DIV`. Cash deposits/withdrawals/opening balances are a different event family.

R2.3 therefore keeps two domain families:

```text
transaction records
- BUY
- SELL
- DIV

explicit cash events
- OPENING_BALANCE
- DEPOSIT
- WITHDRAWAL
```

Do not widen `records.txn_type` to cash classes.

Trade cash, fees/taxes and dividend cash are later **derived from authoritative transaction records** when the cash ledger is implemented. They must not be duplicated as user-entered `cash_events`, because doing so would create two accounting authorities for the same economic event.

## 3. Durable cash-event contract v1

`cash_events` is tenant-scoped and consolidated at the current user portfolio level. There is intentionally no broker-account identifier in this model.

| Field | Required | Semantics |
|---|---:|---|
| `id` | yes | Durable database identity only; not financial chronology. |
| `user_id` | yes | Tenant boundary. |
| `event_date` | yes | Authoritative date-level cash fact supplied by the user/source. |
| `event_type` | yes | Exactly `OPENING_BALANCE`, `DEPOSIT`, or `WITHDRAWAL`. |
| `amount` | yes | Opening balance is the signed baseline balance and may be positive, zero, or negative. Deposit/withdrawal store a positive magnitude; `event_type` supplies direction. |
| `currency` | yes | Actual cash currency: exactly three uppercase ASCII letters such as `USD`, `TWD`, `JPY`, `GBP`. Quote units such as `GBp` are not cash currencies. |
| `note` | yes | User-facing memo, default empty. Never machine chronology authority. |
| `event_source` | no | Future provenance such as manual/import/broker/system. Nullable until the API contract is activated. |
| `create_idempotency_hash` | no | Reserved tenant-scoped create retry identity. Internal only. |
| `create_payload_hash` | no | Reserved create-payload conflict guard. Internal only. |
| `created_at` / `updated_at` | yes | Database audit timestamps only. Never interpreted as event time. |

### 3.1 Opening balance semantics

`OPENING_BALANCE` is a **baseline state**, not a cash movement.

- It may be negative for margin/debit cash.
- Zero is valid and can explicitly establish a zero starting balance.
- The current product is a consolidated portfolio per user, so there is at most one opening balance per `user_id + currency`.
- Its date defines the beginning of explicit cash coverage for that currency.
- No earlier cash balance may be inferred from missing data.

Future migration/reconciliation UX must make this coverage boundary visible before account NAV is activated.

### 3.2 Deposit / withdrawal semantics

`DEPOSIT` and `WITHDRAWAL` store positive magnitudes only. The event type determines direction.

This prevents contradictory rows such as a negative `DEPOSIT` or negative `WITHDRAWAL` while keeping user entry intuitive.

### 3.3 Adjustment is intentionally rejected

`ADJUSTMENT` is not in v1. A generic adjustment event can hide unexplained reconciliation errors and become a manual accounting escape hatch. It may be added only when a concrete auditable use case, reason semantics and UX are reviewed.

## 4. Currency semantics

Cash currency is not the same concept as an instrument quote unit.

Examples:

- `USD`, `TWD`, `JPY`, `GBP` — valid cash currency identifiers.
- `GBp` — valid in the existing security quote-unit domain, but invalid for `cash_events`; actual cash settles in `GBP`.

R2.3A therefore uses a strict uppercase three-letter storage invariant. Broader currency-source validation belongs to the later API/import adapter gate.

## 5. Ordering and chronology

R2.3A stores only `event_date`.

It deliberately does not add an execution timestamp/sequence merely because the transaction model now supports metadata. Deposits and withdrawals may arrive with only a date, and database `created_at`/`id` are not financial event time.

If R3 later proves a need for source-authoritative intraday cash ordering, that becomes a separate additive contract with the same no-fabrication rule used by R2.2 transaction metadata.

No Python chronology behavior changes in R2.3A.

## 6. Idempotency foundation

The table reserves nullable 64-character `create_idempotency_hash` and `create_payload_hash` fields and a tenant-scoped unique index.

This does not activate any writer yet. It avoids designing a cash create endpoint that is weaker than the already-reviewed transaction create contract.

R2.3B must define the exact canonical cash-create payload hash and retry/conflict semantics before exposing writes.

## 7. Physical schema rollout

Migration: `migrations/0005_cash_events_expand.sql`

Properties:

- additive `CREATE TABLE IF NOT EXISTS cash_events` only;
- no `ALTER TABLE records`;
- no mutation of existing rows;
- no `UPDATE schema_metadata`;
- current release `4.10` / API `2.63` / schema `3` Worker remains compatible and ignores the table;
- rollback of application behavior is therefore to leave the additive table inert, not destructively drop it.

The migration is production-worthy only after exact-head CI, independent review, current production identity evidence and the protected canonical deploy path.

## 8. Real D1 invariants required before merge

The local D1 baseline must prove:

1. `cash_events` exists after all migrations while `schema_metadata` remains on the current schema-v3 activation contract.
2. Negative/zero/positive opening balances are representable.
3. Deposit/withdrawal require positive magnitudes.
4. Cash currency rejects quote-unit casing such as `GBp` and invalid non-three-letter values.
5. Only one opening balance exists per tenant/currency, while another currency and another tenant remain independent.
6. Create idempotency is unique per tenant but the same hash can exist in another tenant.
7. Existing `records` behavior remains unchanged.

## 9. Rollout sequence after R2.3A

### R2.3A — current

- additive table/model;
- static contract tests;
- real local D1 invariant proof;
- exact-head CI + frozen review;
- production storage expansion only through protected deployment.

### R2.3B — next

User-only cash-event CRUD/API semantics:

- strict validation;
- tenant isolation;
- durable idempotent create;
- update/delete conflict semantics;
- no cash-ledger calculation side effect until readback/dirty-generation semantics are separately reviewed.

### R2.3C — next product UX

Cash management UI with explicit coverage language, opening balance setup, deposit/withdrawal history and safe edit/delete flows.

### R2.4 — only after R2.3 coverage is usable

Shadow multi-currency cash ledger:

```text
explicit opening/external cash events
+ derived BUY/SELL/fee/tax cash effects
+ derived confirmed DIV cash effects
→ currency balances
→ reconciliation evidence
```

Account NAV / account-level performance cutover remains a later evidence gate.

## 10. NOW / NEXT / BACKLOG / REJECT

### NOW

- separate `cash_events` table;
- opening/deposit/withdrawal semantics;
- multi-currency storage invariant;
- tenant-scoped idempotency foundation;
- local D1 proof;
- no schema-version/runtime behavior activation.

### NEXT

- authenticated CRUD/API;
- cash management UX;
- shadow ledger and reconciliation.

### BACKLOG

- broker/API cash import adapters under R3 Universal Data Gateway;
- richer account/sub-account dimensions only if product requirements prove they are necessary;
- intraday cash event ordering metadata only if authoritative sources and accounting impact justify it.

### REJECT

- adding cash types to `records.txn_type`;
- duplicating BUY/SELL/DIV cash movements into `cash_events`;
- generic unaudited `ADJUSTMENT`;
- treating `created_at`/`id` as cash-event time;
- interpreting missing historical cash as zero;
- changing current `持倉市值` into cash-inclusive NAV before reconciliation evidence exists.
