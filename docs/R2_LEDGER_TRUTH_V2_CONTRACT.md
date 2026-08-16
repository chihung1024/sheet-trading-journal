# R2 Ledger Truth v2 — Canonical Event Contract v1

Status: **R2.1 DESIGN BASELINE — schema/runtime activation NOT authorized by this document**  
Date: **2026-08-16 Asia/Taipei**  
Base repository state: `main@6a50e3d3d69906ab891e27ed6a37211f8b786a67`

## 1. Primary goal and scope lock

R2 establishes a truthful account/event foundation without regressing the production transaction ledger, portfolio calculator, or current user experience.

### In scope for R2.1

- define the canonical event/timeline semantics that later R2 batches must implement;
- define the compatibility boundary between the future canonical ledger and the existing `records` trade projection;
- separate economic event identity, source identity and transport/write idempotency;
- define authoritative versus unknown timeline/currency/provenance states;
- define the additive rollout order and explicit gates before any schema or production activation.

### Out of scope for R2.1

- no D1 migration;
- no Worker/API behavior change;
- no production deploy;
- no cash/NAV calculation or UI terminology cutover;
- no historical cash inference/backfill;
- no mandatory execution timestamp for legacy/manual records;
- no broker-specific path that bypasses the future Universal Data Gateway.

### Allowed investigation

Existing manual trade flow, Worker record API/idempotency, IBKR importer, dividend event identity, record pagination/order, Python ingestion and ledger-integrity ordering.

### Expansion trigger

Only a finding that would otherwise cause data corruption, duplicate economic events, incorrect account chronology, auth/privacy leakage, or a production accounting regression may expand this batch.

Risk class: **R2 — significant financial/data contract**.

---

## 2. Evidence from the current architecture

The contract below is constrained by current production-compatible behavior rather than designed in isolation.

1. `records` is intentionally a trade-shaped table. Its schema allows only `BUY`, `SELL`, `DIV`, requires symbol/quantity/price fields, and the current Worker validates the same three types.
2. The Python batch runner also fail-closes on any transaction type outside `BUY`, `SELL`, `DIV`; it requires positive quantity and a symbol for every row.
3. Source-ledger integrity uses deterministic `Date + record id` order and explicitly states that record id is **not** broker execution chronology.
4. Manual entry currently provides a trade date only. Exact execution time therefore cannot be made mandatory without fabricating data.
5. IBKR parsing already observes richer facts — account/profile scope, Order ID, Trade ID, currency and execution DateTime — but the current persistence path reduces a safe import to the legacy record shape. The observed DateTime may be timezone-less, so its presence alone does not prove an offset-aware instant.
6. IBKR durable retry identity is transformed into the existing record-create idempotency key. That protects a write from duplication, but it is not a sufficient universal economic-event identity model.
7. Automatic dividend confirmation has a semantic event identity based on `symbol + date`, then uses record-create idempotency to converge on the existing DIV record. This is a useful domain-specific precedent, not a universal identity format.
8. Privacy hardening intentionally strips legacy IBKR machine metadata from `records.note`; future provenance therefore needs structured privacy-safe fields rather than another note envelope.
9. Existing record-create idempotency hashes the accepted legacy payload. Any future dual-write path that persists additional authoritative canonical fields must version/fingerprint those fields deliberately rather than silently attaching semantics outside the retry contract.

### Root cause / architectural constraint

The current `records` table simultaneously acts as the production trade history consumed by the calculator and as the write/read surface used by the UI. It is **not** a universal account ledger. Adding deposit/withdrawal/opening-balance types directly to `records` would violate current database, Worker and Python contracts and could block portfolio calculation.

Therefore R2 must add a canonical event plane **alongside** the legacy trade projection before any cutover. Extending `records.txn_type` into a universal ledger is rejected for R2.

---

## 3. Canonical event model

The future persisted model is referred to as `ledger_event` in this document. The eventual table/API name may change only by an explicit recorded decision; the semantics below are the baseline.

### 3.1 Core identity

Every canonical event has:

- `contract_version`: integer, v1 = `1`;
- `event_id`: immutable, tenant-scoped, opaque stable identifier generated/persisted once;
- `event_kind`: one of `TRADE`, `DIVIDEND`, `CASH` in v1;
- `event_subtype`: kind-specific semantic subtype;
- `event_date`: required local economic/trade date in `YYYY-MM-DD`;
- `occurred_at`: optional authoritative offset-aware timestamp;
- `source_sequence`: optional stable ordering value supplied by an authoritative source;
- structured `source` provenance;
- `created_at` / `updated_at` as persistence metadata, never substitutes for economic execution time.

`event_id` is identity of the economic ledger row. It is not the HTTP retry key and must not be recomputed from mutable note/tag/value fields.

### 3.2 Event kinds and v1 subtypes

#### TRADE

- `TRADE_BUY`
- `TRADE_SELL`

Required economic fields once a native canonical write path is activated:

- instrument/symbol identity;
- quantity;
- unit price;
- transaction currency;
- fee/tax with explicit sign convention defined by the implementation batch.

#### DIVIDEND

- `DIVIDEND_CASH`

The canonical event represents an economic cash distribution. Existing legacy DIV projection semantics (`qty=1`, `price=amount`) remain a compatibility representation only and must not become the canonical dividend schema.

#### CASH

- `CASH_OPENING_BALANCE`
- `CASH_DEPOSIT`
- `CASH_WITHDRAWAL`

Cash amount must be explicit and currency-specific. A generic `ADJUSTMENT` subtype is **not** part of v1; it may be added only after a concrete auditable use case and accounting semantics are reviewed.

Trade-related cash and dividend cash are derived from authoritative trade/dividend events when the shadow cash ledger is implemented. They are not user-entered duplicate cash events.

---

## 4. Timeline truth

### 4.1 Authoritative facts only

`event_date` is required. `occurred_at` and `source_sequence` are optional.

- If an authoritative source supplies an execution timestamp together with authoritative timezone/offset semantics, persist it as `occurred_at` with that offset semantics preserved.
- A clock value without an authoritative timezone/offset is **not** an authoritative instant. Preserve it only as source metadata if needed for reconciliation; do not normalize it into `occurred_at` using browser timezone, import machine timezone, Taipei time, UTC, or any other guessed zone.
- If an authoritative source supplies only a stable sequence, persist that sequence without inventing a timestamp.
- If neither an authoritative instant nor sequence exists, preserve date-only truth.
- `created_at`, auto-increment IDs or import time may provide deterministic technical ordering, but the UI/analytics must not present them as execution chronology.

### 4.2 Same-day ordering

A same-day event can have one of these chronology qualities:

- `AUTHORITATIVE_TIME` — offset-aware execution time exists and its zone/offset semantics are authoritative;
- `AUTHORITATIVE_SEQUENCE` — source sequence exists but exact time may not;
- `DATE_ONLY` — no trustworthy intra-day chronology.

A deterministic fallback may be used for stable processing, but `DATE_ONLY` rows remain semantically unordered within the day. R2 must not claim more chronology than the source provides.

### 4.3 Legacy compatibility

Existing/manual records remain valid with `event_date` only. No migration may fabricate midnight, noon, import time, `created_at`, record ID, browser timezone or a default market timezone as an execution timestamp.

---

## 5. Source provenance and privacy

Canonical provenance is structured data, not a machine-readable string embedded in `note`.

The v1 source envelope must be able to express:

- `source_kind` — e.g. `MANUAL`, `IBKR_CSV`, `DIVIDEND_CONFIRMATION`, `LEGACY_RECORD`, future gateway adapters;
- `source_scope_ref` — optional privacy-safe stable account/profile scope reference;
- `source_event_ref` — optional provider/order/execution reference appropriate to the adapter;
- `source_batch_ref` — optional import batch/file/session reference;
- source-specific metadata only when it is necessary for deterministic reconciliation and safe to persist.

Rules:

1. Raw tenant email is never a provenance field.
2. Raw broker account identifiers must not be copied into free-form note. Persist a privacy-safe stable reference when account-level reconciliation needs one.
3. User journal note remains user content; machine provenance must not be reconstructed by parsing arbitrary note text.
4. Existing legacy rows whose provenance was intentionally stripped remain `LEGACY_RECORD`/unknown provenance unless an authoritative source can reconcile them later.

---

## 6. Three identities that must remain separate

### 6.1 Economic event identity

`event_id` identifies the canonical event row for the tenant and remains stable through normal read/update/reconciliation flows.

### 6.2 Source identity

A provider may expose a natural key such as account scope + Order ID / Trade ID, or the dividend domain may expose symbol + date. Source identity is adapter/domain-specific and may be used to detect whether two inputs refer to the same economic event.

### 6.3 Write idempotency

`Idempotency-Key` and the persisted `create_idempotency_hash/create_payload_hash` protect transport retries and ambiguous responses. They are write-safety mechanisms.

A deterministic importer may derive a write key from source identity, as IBKR already does, but the resulting retry key is not the universal canonical `event_id`.

If an existing write endpoint is later extended to persist canonical fields, its idempotency fingerprint/version must cover every authoritative field written by that request while preserving safe retries from old clients/intents. A canonical field must not be silently dual-written outside the request fingerprint and then treated as authoritative.

This separation prevents later edits, import normalization changes, or protocol details from silently changing economic identity.

---

## 7. Currency truth

New native canonical events that move/value cash must persist an explicit ISO-style currency code accepted by the reviewed implementation contract.

Legacy compatibility is intentionally weaker:

- existing records have no dedicated currency column;
- symbol-based currency detection may remain a compatibility/read-model aid for the current securities engine;
- a guessed/inferred currency must not be relabeled as authoritative account-cash truth;
- unresolved legacy currency is allowed during shadow migration and blocks account-level reconciliation for that event until resolved.

No R2 batch may infer historical cash or account NAV merely because a symbol maps to a market currency.

---

## 8. Storage boundary and compatibility architecture

### 8.1 `records` remains the production trade projection during additive R2 rollout

Until an explicit cutover gate is passed:

- `/api/records` remains backward compatible;
- existing BUY/SELL/DIV CRUD continues to serve the current UI and Python calculator;
- current record pagination and durable mutation recovery remain unchanged;
- current Python accounting consumes only the legacy trade projection.

### 8.2 Canonical events use a separate persistence plane

The next schema implementation proposal should introduce a separate canonical event store (working name `ledger_events`) rather than extending cash subtypes into `records`.

The schema must support at minimum:

- tenant-scoped stable `event_id`;
- event kind/subtype/date;
- optional authoritative timestamp and sequence;
- structured instrument/economic values appropriate to the event kind;
- explicit currency for native canonical cash/value events;
- structured source provenance and source uniqueness/reconciliation keys;
- optional `legacy_record_id` bridge for compatibility/backfill;
- created/updated metadata;
- indexes/uniqueness needed for tenant isolation and deterministic reconciliation.

Schema details, constraints and migrations belong to the next reviewed batch; this document does not authorize them.

### 8.3 Projection rule

Canonical `TRADE` and `DIVIDEND` events may project to the existing BUY/SELL/DIV shape while the legacy calculator remains authoritative. `CASH` events must **never** be fabricated as legacy trade records.

### 8.4 Dual-write authority and failure semantics

During any future transition where one user action creates/updates both a canonical event and a legacy `records` projection:

- the transition must not create two independently writable financial authorities;
- success must mean both required representations are durably consistent, or the design must use an explicit shadow/outbox/reconciliation state that cannot be mistaken for fully committed account truth;
- a partial write must be detectable and repairable idempotently;
- ambiguous network outcomes must remain safe under retry;
- legacy readback may remain the production UX/calculation authority until the canonical path passes parity/cutover gates;
- implementation must define rollback for schema + write-path activation before production enablement.

A naïve best-effort `INSERT ledger_events` followed by independent `INSERT records` (or the reverse) is rejected unless atomicity or an equivalent deterministic recovery invariant is proven.

---

## 9. Backward-compatibility mapping

### Existing manual BUY/SELL

- event kind/subtype: TRADE / BUY or SELL;
- event date: `txn_date`;
- intra-day chronology: `DATE_ONLY` unless future authoritative metadata exists;
- `legacy_record_id`: existing record ID;
- currency/provenance may remain unresolved during shadow backfill;
- tag/note are compatibility/user-journal metadata, not identity.

### Existing DIV

- event kind: DIVIDEND;
- date/symbol remain authoritative at the same level as the existing record;
- existing `qty=1, price=amount` representation remains the legacy projection;
- automatic dividend identity may be retained as source/domain reconciliation evidence when it can be proven.

### New/future IBKR canonical import

The adapter should preserve, structurally:

- authoritative currency;
- account/profile scope as privacy-safe `source_scope_ref`;
- Order ID and/or Trade IDs as source identity;
- execution DateTime as source metadata when supplied;
- `occurred_at` only if authoritative timezone/offset semantics are also available; otherwise chronology remains sequence/date-only rather than guessed;
- deterministic import reconciliation identity;
- aggregated-order provenance without relying on note parsing.

The current IBKR file importer remains functional until that path is deliberately migrated through the canonical gateway.

---

## 10. Rollout phases and gates

### R2.1 — Contract baseline

This document plus the handoff update only. No runtime/schema behavior changes.

Gate to close R2.1:

- architecture/data-flow audit completed across manual, IBKR, dividend, Worker and Python paths;
- no direct-cash-in-`records` design;
- identity/time/currency/provenance semantics recorded;
- dual-write/idempotency failure semantics recorded;
- exact-head CI for repository integrity;
- independent review with BLOCKER = 0;
- handoff updated.

### R2.2 — Timeline/provenance implementation foundation

Candidate scope after R2.1 closes:

- additive schema proposal/migration tests for canonical event store;
- structured event validator/normalizer shared by write adapters;
- optional timestamp/sequence/provenance through manual/import paths where authoritative;
- compatibility projection tests;
- versioned idempotency/fingerprint design for any endpoint that persists new canonical fields;
- atomic or explicitly recoverable shadow/dual-write semantics with reconciliation tests;
- no production schema activation until migration + rollback + shadow-read plan pass review.

### R2.3 — Explicit cash events

- opening balance/deposit/withdrawal model and UX;
- multi-currency validation;
- no NAV cutover.

### R2.4 — Shadow cash ledger

- event-derived cash movements;
- reconciliation, parity and discrepancy reporting;
- production summary remains securities-only until coverage gates pass.

### R2.5 — Reconciliation/migration UX

- resolve missing opening balances/currency/source conflicts without guessed history.

### R2.6 — Account truth cutover review

Only after coverage/reconciliation is authoritative enough may terminology and account-level NAV/performance be reconsidered.

---

## 11. Rejected alternatives

### REJECT — extend `records.txn_type` with cash event types now

Reason: violates current D1 CHECK, Worker validation, Python ingestion and ledger-integrity assumptions; creates high regression risk and mixes two domains.

### REJECT — use record ID / `created_at` as true execution chronology

Reason: they are persistence order, not broker execution evidence.

### REJECT — make timestamp mandatory

Reason: manual and historical records legitimately have date-only truth.

### REJECT — promote a timezone-less clock value to `occurred_at` using a default timezone

Reason: this fabricates an instant and can silently reorder same-day events across markets/accounts.

### REJECT — reuse `Idempotency-Key` as canonical event ID

Reason: transport retry identity and economic identity have different lifecycles and semantics.

### REJECT — persist authoritative canonical fields outside the endpoint idempotency fingerprint

Reason: an ambiguous retry could converge on the legacy payload while leaving canonical metadata inconsistent or silently different.

### REJECT — best-effort independent canonical + legacy writes with no atomic/reconciliation invariant

Reason: creates split financial authority and makes partial commits indistinguishable from complete ledger truth.

### REJECT — persist broker machine metadata back into free-form note

Reason: privacy hardening intentionally removed that coupling; structured provenance is the correct boundary.

### REJECT — infer missing cash/currency to unlock NAV early

Reason: would create false account truth and violate current fail-closed financial semantics.

---

## 12. Decision record

### Original decision

Roadmap V2 selected R2 Ledger Truth v2 before Universal Data Gateway and Portfolio Intelligence.

### New evidence reviewed in R2.1

- existing `records` schema/Worker/Python are all trade-specific;
- same-day record ID is deterministic but explicitly non-chronological;
- IBKR already observes rich source/timestamp/currency data before legacy projection, while its raw DateTime does not by itself prove timezone semantics;
- dividend flow demonstrates domain identity + transport idempotency as separate concerns;
- privacy code deliberately strips IBKR machine envelopes from journal notes;
- current record-create safety depends on a payload hash, so canonical dual-write semantics must remain inside a versioned idempotency/recovery contract.

### Decision

Use an additive canonical ledger event plane and keep `records` as the compatibility trade projection until a later reviewed cutover. Preserve unknown chronology/currency/provenance as unknown rather than fabricating facts. Any transition dual-write must be atomic or explicitly recoverable/reconcilable and must not create two independently writable financial authorities.

### Trade-off

This adds a temporary dual-model period, but sharply reduces migration risk: cash truth can be built and reconciled without destabilizing the current production calculator or user-facing trade history.

### Reopen condition

Reopen only if fresh production evidence proves the current trade-projection boundary is incorrect, a simpler design preserves every compatibility/financial invariant, or an external platform constraint materially changes the storage/API architecture.
