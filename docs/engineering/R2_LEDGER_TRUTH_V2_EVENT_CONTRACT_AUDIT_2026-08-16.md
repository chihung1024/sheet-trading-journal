# R2 Ledger Truth v2 — Event / Timeline Contract Audit

Status: **R2.1 contract baseline / no runtime or schema activation**  
Audit base: `main@6a50e3d3d69906ab891e27ed6a37211f8b786a67`  
Work branch: `feat/r2-ledger-truth-v2`  
Recovery checkpoint: `backup-2026-08-16-tech-debt-closeout`  
Risk class: **R2 — Significant** because this document defines a future persisted data / ordering contract even though this batch changes no runtime behavior.

## 1. Primary goal

Establish the smallest backward-compatible event contract needed to support a truthful transaction timeline and later cash/account ledger work without inventing chronology, overloading Journal Note, or replacing current accounting before evidence exists.

R2.1 is deliberately a contract/audit batch. It does **not**:

- add or deploy a D1 migration;
- change Worker/API behavior;
- change Python portfolio accounting, FIFO, Daily P&L, TWR or XIRR;
- change current transaction ordering;
- add cash events or cash-inclusive NAV;
- parse free-form `note` as financial authority;
- require timestamps for legacy/manual records.

## 2. Evidence inventory

### 2.1 Durable transaction storage is still date-level

`migrations/0001_baseline.sql` defines `records` with:

- `txn_date`;
- `symbol`;
- `txn_type`;
- `qty` / `price` / `fee` / `tax`;
- `tag` / `note`;
- `created_at`.

`migrations/0003_record_create_idempotency.sql` later adds nullable `create_idempotency_hash` and `create_payload_hash`, but there are still no first-class execution timestamp, sequence, currency or source-provenance columns.

### 2.2 Worker write/read contract is still legacy-record shaped

Current `worker.js` requires schema version 3. `validateTransactionPayload()` accepts the legacy transaction fields only, and the records repository inserts/updates those fields plus the internal idempotency hashes.

`publicRecord()` deliberately removes the idempotency hashes from public output. Therefore durable create idempotency is not the same thing as user-visible/event-level provenance.

### 2.3 Python ingest has no first-class execution metadata

`main.prepare_transactions()` converts the durable record into the calculation DataFrame and sorts by:

```text
Date -> id
```

It does not currently supply `Timestamp`, `Sequence`, durable currency or source metadata to the calculation engine.

Gate C already established an important boundary: `Date -> id` is a deterministic Schema-2 ledger order, but it is **not proof of broker execution chronology**.

### 2.4 IBKR adapter already sees richer source facts

`src/services/ibkrTradeImport.js` can parse and validate:

- `Currency`;
- `TradeDate`;
- `DateTime`;
- `OrderID`;
- `TradeID`;
- account/scope identity used for safe import deduplication.

The adapter also creates deterministic import identity and aggregates executions into the existing transaction-record shape.

Historically, machine metadata was encoded into `note` (`source=IBKR`, `currency=...`, `order_id=...`, `trade_ids=...`, `executed_at=...`). That is not a safe permanent domain boundary.

### 2.5 Journal cleanup intentionally removes that machine envelope

`src/services/ibkrJournalNote.js` explicitly recognizes IBKR machine keys, including `source`, `currency`, `order_id`, `trade_ids`, `executed_at`, `batch_id`, `import_key` and account identifiers.

`src/services/ibkrRecordCreate.js` calls `extractIbkrUserJournalNote()` before persistence. This is correct for Journal UX/privacy separation, but it means source execution metadata available during import is no longer represented as first-class durable transaction facts.

## 3. Root-cause analysis

### Symptom

After a transaction is committed, the authoritative record can prove its trade date and durable row identity, but cannot preserve or expose richer source execution chronology/provenance even when the import source provided it.

### Failure point

The durable `records` contract and Worker validation boundary have no optional event-metadata fields. Rich importer metadata therefore cannot cross the persistence boundary as structured facts.

### Contributing factors

1. The original record model was designed around manual date-level journal transactions.
2. Import support arrived later and temporarily represented machine metadata inside free-form `note`.
3. Journal Note cleanup correctly removed broker/machine metadata from user prose.
4. Durable idempotency solves duplicate writes but does not itself define chronology/provenance semantics.
5. Legacy/manual records legitimately have no execution timestamp.

### Root cause

The project has no canonical, backward-compatible **transaction event metadata envelope** between adapters, Worker/D1, Python and presentation.

### Systemic cause

Transaction accounting, Journal Note, import identity and timeline presentation evolved at different times. Without one event contract, each layer can be tempted to infer missing facts independently.

## 4. R2 canonical transaction event contract v1

The existing BUY / SELL / DIV record remains the compatibility core. R2 adds an **optional metadata envelope**; it does not replace legacy fields.

### 4.1 Existing required compatibility fields

```text
id
user_id
txn_date
symbol
txn_type
qty
price
fee
tax
tag
note
created_at
```

Existing records remain valid without any R2 metadata.

### 4.2 Additive optional metadata candidates

The first migration/Worker implementation should be limited to fields with a proven cross-product purpose:

| Field | Required | Semantics |
|---|---:|---|
| `currency` | no | Native quote/settlement currency identifier used by the existing product domain. It must not be guessed from an unreviewed source when explicitly supplied data conflicts with the reviewed symbol/currency mapping. |
| `executed_at` | no | Authoritative execution timestamp for the canonical event **only when one unambiguous timestamp exists and its timezone/offset semantics are reviewed**. No fabricated midnight/noon/default timezone. |
| `execution_sequence` | no | Stable source-provided or reviewed adapter-provided sequence when it represents an authoritative ordering relation. Never synthesize it from array position merely to make old data look precise. |
| `event_source` | no | Broker-neutral source namespace such as `manual` or `ibkr_file`; descriptive provenance only, never accounting authority by itself. |

A source/event reference may be added later only if R3 reconciliation proves a need beyond the existing tenant-scoped idempotency identity. Do not persist account numbers or other sensitive broker scope values merely for display.

### 4.3 Why `executed_at` must remain nullable

A legacy/manual transaction with only `txn_date` is truthful date-level data. Converting it to `YYYY-MM-DDT00:00:00`, local noon, browser submission time, `created_at`, or record `id` as if any of those were execution time would create false financial evidence.

Therefore:

```text
missing execution timestamp = unknown
```

not:

```text
missing execution timestamp = invented default
```

### 4.4 Aggregated broker orders require conservative timestamp semantics

The existing IBKR adapter can aggregate multiple fills into one canonical BUY/SELL record. A multi-fill order may contain multiple execution timestamps.

For such a record, `executed_at` must be populated only if the adapter can prove one unambiguous event timestamp under a reviewed aggregation policy. Do not silently choose the first/last fill and call it the exact execution time.

Until that policy is reviewed, multi-fill aggregates may preserve date/source/currency while leaving `executed_at` null.

## 5. Ordering semantics: deterministic is not the same as authoritative

### 5.1 Legacy deterministic order remains valid fallback

Current durable source order:

```text
Date -> id
```

remains a deterministic compatibility order. It must continue to work for records without R2 metadata.

### 5.2 Partial timestamp coverage must not activate a fake chronology

A dangerous implementation would sort same-day records like this:

```text
known executed_at first
unknown executed_at later
```

or mix timestamped imports and untimestamped manual records into one supposedly chronological timeline.

That would claim an ordering relationship that the data does not prove.

R2 therefore adopts a **coverage-aware activation rule**:

1. `executed_at` / `execution_sequence` may be stored and displayed as provenance when individually valid.
2. A calculation or authoritative chronological ordering mode may use R2 execution order only after the relevant event set has complete, mutually comparable ordering coverage under a reviewed rule.
3. If coverage is incomplete, the accounting engine keeps its existing reviewed compatibility behavior; it must not partially switch ordering based on whichever rows happen to have timestamps.
4. UI may display a known timestamp on an individual record while clearly preserving date-level uncertainty for records that lack one.

The exact calculation activation scope (whole user/day, symbol/day, or another reviewed domain scope) is intentionally **not selected in R2.1**. It must be chosen from accounting impact evidence before Python ordering changes.

## 6. Mutation / amendment semantics are a schema-activation gate

Adding metadata to POST only would be incomplete because imported records remain editable through the existing transaction UI.

A future implementation must prevent either of these failures:

- legacy `PUT` silently erases source metadata because the client does not round-trip new fields;
- edited financial fields retain stale execution metadata and the calculation engine later trusts it as if the source event were unchanged.

Therefore R2.2 must define one explicit amendment policy before calculation consumes execution ordering. At minimum:

- absence of optional metadata in a legacy-compatible update must not accidentally clear it;
- source provenance must remain distinguishable from user-amended canonical values;
- calculation must not trust execution-order metadata whose validity was invalidated by an amendment.

R2.1 does not add extra amendment columns yet because the correct minimal representation depends on R2.2 implementation evidence.

## 7. Idempotency interaction

When R2 optional metadata becomes accepted by `POST /api/records`, the canonical create payload hash must include any metadata that changes the durable event meaning.

Otherwise the same `Idempotency-Key` could replay with different timestamp/currency/source metadata and incorrectly be treated as the same payload.

Tenant-scoped idempotency remains the write-deduplication authority. It is not replaced by `event_source` or timeline fields.

## 8. Cash/account boundary

R2.1 deliberately does not force `DEPOSIT`, `WITHDRAWAL` or opening balance into the existing `records.txn_type` CHECK constraint.

The canonical **account event** design has two layers:

```text
common event concepts
- date / optional ordering metadata
- currency
- source provenance
- deterministic identity

transaction event family
- existing BUY / SELL / DIV compatibility record

cash event family
- opening balance / deposit / withdrawal / reviewed adjustment
- storage model selected in R2.3 after transaction metadata is proven
```

This avoids destabilizing the production transaction table before cash semantics and migration UX are reviewed.

Trade- and dividend-related cash movements will later be **derived from authoritative transaction semantics**, not duplicated as user-entered shadow copies of the same economic event.

## 9. Rollout gates

### R2.1 — NOW / this batch

- fresh architecture/data-flow audit;
- contract decisions above;
- no schema/runtime activation.

### R2.2 — NEXT / capture and presentation foundation

Proposed narrow sequence:

1. additive nullable D1 columns for the accepted transaction metadata subset;
2. Worker create/read validation and persistence;
3. payload-hash/idempotency regression coverage;
4. legacy/manual create compatibility tests;
5. safe update/amendment preservation semantics;
6. IBKR adapter maps only source facts it can prove;
7. transaction detail/timeline presentation can show execution time/source/currency when available;
8. Python ingest may transport the metadata in shadow mode, but **no calculation ordering behavior switch yet**;
9. migration + Worker/API deployment is separately qualified and rollbackable.

### R2.2 ordering activation — separate gate

Only after production coverage/amendment evidence:

- define comparable ordering scope;
- prove no partial-coverage chronology;
- add Python/ledger regression tests;
- reconcile calculator and Daily-P&L consumers;
- then consider changing authoritative same-day ordering.

### R2.3 — NEXT after metadata foundation

Explicit multi-currency cash event storage/model and opening-balance semantics.

No account NAV cutover occurs in R2.3 merely because a cash table exists.

## 10. Discovery classification

### NOW

- first-class optional transaction metadata contract;
- nullable backward compatibility;
- coverage-aware ordering rule;
- amendment/idempotency gates before activation;
- preserve current accounting until separate evidence-based activation.

### NEXT

- additive migration + Worker/API capture/read;
- IBKR adapter mapping;
- detail/timeline UX;
- shadow Python transport;
- later explicit cash event model.

### BACKLOG

- broker-specific background sync, which must use R3 Universal Data Gateway;
- richer source references beyond what reconciliation proves necessary;
- historical lot analytics and account-level advanced analytics until R2 truth exists.

### REJECT

- parse `note` to reconstruct financial chronology;
- use `created_at` or `id` as fake execution timestamp;
- invent timestamps for legacy/manual records;
- activate calculation ordering from partial timestamp coverage;
- add cash-inclusive NAV before explicit cash coverage/reconciliation;
- extend this batch into IBKR sync or general technical cleanup.

## 11. Verification plan for R2.1

Because this batch is a semantic R2 contract with no runtime behavior change:

- confirm fresh main/open PR/CI/Pages before work;
- review D1 schema, Worker mutation/read contract, Python ingest/order, IBKR parser/create sanitization, existing Gate-C chronology decisions and manual form path;
- exact-head repository CI on the PR;
- frozen independent contract review with BLOCKER / FOLLOW-UP classification;
- exact-head merge only after the above pass;
- post-main CI/Pages verification;
- no Worker/D1 deployment for R2.1.

## 12. Exit criteria

R2.1 is DONE when:

- one backward-compatible event/timeline contract is documented;
- no runtime/schema behavior changed;
- risky ordering assumptions are explicitly rejected;
- R2.2 has a narrow activation sequence and rollback boundary;
- exact-head CI + frozen review pass;
- handoff identifies R2.2 as the next single active batch.

The project remains fully usable at the R1 production state throughout this batch.
