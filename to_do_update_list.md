# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C, Desktop Visibility D1–D5, and R3.2A–R3.2F are closed at their reviewed engineering boundaries. R2.6B cash-inclusive whole-account Daily P&L is merged and CI-reviewed, but fresh production financial-snapshot evidence is still pending and must not be inferred. The single Primary Active Batch is R3.3A — Import Reconciliation Receipt.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, safety, maintainability, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation or convenience state never becomes a second accounting, FX, tax, recovery, market-data, or transaction-identity authority.
5. Important work uses recovery point → Draft PR → exact-head CI → frozen review → expected-head merge → post-main verification where authoritative evidence is available.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, transaction identity, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over methodology expansion when both are optional.
10. Public repo evidence must not unnecessarily record personal financial values, credentials, backup contents, broker file contents, or tenant data.

---

## 1. Current authoritative state

At this handoff snapshot:

- protected frontend/engine `main`: `8f6240be74014af81e908064aa782fc1a6f43fd4`;
- PR #363 R3.2F merged from exact head `bac2b1e82f2a3ada3fadeb321d354f13c444a254`;
- PR #363 exact-head CI #1227: **SUCCESS** across Frontend contracts/build, Python tests/coverage, and Worker security/deployment/D1 baseline;
- PR #363 frozen independent review: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- CI #1226 correctly failed because the new browser-storage prefix had not yet been registered in the exact persistence inventory; the governance baseline was updated rather than weakening the security contract;
- R3.2F introduces no Worker/D1/schema/accounting/FX/idempotency change;
- production Worker authority remains the reviewed R3.1C Worker line unless fresh deployment truth supersedes it;
- Worker runtime contract remains release `4.12` / API `2.65` / schema authority `3` unless fresh runtime evidence supersedes it;
- additive migration `0006_journal_restore_sessions.sql` remains the restore-session schema authority.

### Open evidence boundary — R2.6B

R2.6B merged as PR #357 (`main@2d901dd9f9d4043364afc78453092b80ab335d9d`) after exact-head CI #1211 and frozen review PASS. The engineering path is reviewed and merged, but **a fresh production portfolio calculation/snapshot generated from that code line has not yet been observed through an authoritative connected run/snapshot surface in this session**. Do not claim production financial output is verified until such evidence exists.

---

## 2. Stable financial/product boundaries

### Cash and account value

- explicit cash events are authoritative;
- cash completeness is fail-closed;
- `account_value_preview` publishes current whole-account value only when securities + cash evidence is complete;
- R2.6B adds engine-owned whole-account Daily P&L using beginning net currency exposure, including positive/negative foreign cash;
- ambiguous date-only external cash-flow timing, missing FX/cash history, incomplete cash ledger, or reconciliation failure keeps the existing securities-only Daily P&L rather than guessing;
- group/tag Daily P&L, TWR, XIRR, holdings market value, and performance-history methodology remain unchanged.

### Backup / restore

```text
authenticated durable reads
→ versioned backup
→ strict restore preview
→ empty-target confirmation
→ one idempotent restore intent
→ atomic Worker restore
→ authoritative readback
→ normal recalculation
```

Still rejected: merge restore, replace-all, silent delete, importing derived snapshots, fresh idempotency key on ambiguous retry, or destructive production smoke against a populated account.

### Desktop Visibility D1–D5

Status: **CLOSED**. Do not resume cosmetic compression without concrete production usability evidence.

---

## 3. R3.2 Portability closeout

### R3.2A — Canonical Trade CSV v1 Preview

Status: **CLOSED** — PR #355.

Strict BUY/SELL Canonical contract; explicit date/currency/direction; no silent sign/date/currency inference; strict header validation; legitimate duplicate multiplicity preserved.

### R3.2B — Canonical CSV Template

Status: **CLOSED** — PR #356.

Deterministic header-only template; exact parser contract; local download only; no sample financial data.

### R3.2C — Safe Canonical CSV Execution

Status: **CLOSED** — PR #358.

Same explicit source profile + exact source file is replay-safe through source-bound SHA-256 per-row idempotency. Edited/reordered files or another profile are intentionally new sources. Economic-field similarity is never duplicate authority.

### R3.2D — Explicit Broker Column Mapping Preview

Status: **CLOSED** — PR #360.

User explicitly maps source headers to Canonical fields. No date/side/currency/sign/number-format/lot/tax/FX/duplicate inference. Mapping output must pass the existing Canonical validator and mapping preview itself remains zero-write.

### R3.2E — Safe Mapped Broker CSV Execution

Status: **CLOSED** — PR #361.

Stable identity binds normalized source profile + exact original broker CSV + normalized mapping contract + source record ordinal. Fully identical legitimate rows remain distinct. Execution reuses the existing durable record-create writer and shared batch readback/recalculation authority.

### R3.2F — Saved Mapping Presets

Status: **CLOSED / MERGED** — PR #363, `main@8f6240be74014af81e908064aa782fc1a6f43fd4`.

Preset contract:

```text
signed owner
+ explicit preset label
+ exact ordered parsed source-header signature
+ normalized explicit mapping contract
+ timestamps
→ versioned browser-local convenience state
```

Safety properties:

1. Presets are owner-scoped, browser-local, versioned, bounded to 20, and non-authoritative.
2. They do not store broker CSV text, transactions, prices/quantities, source digest, execution source profile, credentials, or tokens.
3. Presets are listed only for an exact ordered header match; there is no fuzzy matching.
4. Nothing is auto-applied. The user explicitly selects **套用**.
5. Applying a preset only fills mapping controls and invalidates any stale preview; the user must rebuild Canonical preview.
6. Any mapping edit clears the selected preset association.
7. Execution source profile remains separate execution-time input and is never restored from a preset.
8. Corrupted/unsupported local preset state never becomes mapping authority; manual mapping remains available and an explicit save can replace corrupted state.
9. Logout privacy cleanup removes the v1 owner-scoped preset prefix.
10. Browser-storage governance inventory explicitly registers the new prefix as non-authoritative mapping metadata only.
11. No Worker/D1/schema/accounting/FX/idempotency changes.

---

## 4. Primary Active Batch

### Phase

`R3 — Portability / Automation`

### Batch

`R3.3A — Import Reconciliation Receipt`

Status: **ACTIVE / SHARED BATCH CONTRACT FIRST**

### Primary Goal

> After an import attempt, show a clear memory-only per-item receipt explaining which ordered items were newly created, safely replayed, failed, or had an ambiguous response, without duplicating accounting or storing broker data.

### Why this is next

Canonical, mapped, and IBKR import already share durable create/replay and batch recovery semantics, but current UX mainly shows aggregate counts. On partial failure or replay-heavy imports the user cannot easily see which ordered items were confirmed versus where processing stopped. A shared receipt improves confidence and recoverability without another backend or financial authority.

### Required behavior

1. Extend the existing shared `runRecordImportBatch` result additively; existing status/count/sync semantics must remain backward compatible.
2. Record one memory-only outcome for every **attempted** ordered entry: created, replayed, or failed/ambiguous. Do not fabricate outcomes for unattempted suffix entries after a stop.
3. Receipt row identity should be non-financial and deterministic. Prefer import order/index plus explicit source-reference metadata supplied by the importer; do not infer transaction identity from economic fields.
4. Do not persist receipt rows to localStorage, D1, backup JSON, or portfolio snapshot in this slice.
5. Receipt presentation must not expose auth credentials, idempotency keys, raw broker CSV, full note payloads, or internal request objects.
6. A committed/replayed server outcome remains the authority. UI receipt is presentation of that evidence, not a second reconciliation engine.
7. Ambiguous failure must be visibly different from explicit rejection and preserve the existing safe-retry guidance.
8. Sync warnings (authoritative readback/recalculation failure) must remain distinct from record-write failure.
9. Apply the same shared receipt model to Canonical CSV, mapped broker CSV, and IBKR imports where their existing batch flow permits it; do not fork three reconciliation implementations.
10. No Worker/D1/schema/accounting/FX/idempotency changes unless fresh evidence proves the existing outcome does not contain enough authority.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace `runRecordImportBatch`, Canonical/mapped/IBKR entry metadata, and their current result UIs; define the smallest additive per-item outcome schema.
- **NEXT:** implement shared receipt service/presentation → integrate import UIs → regression tests for committed/replayed/partial/ambiguous/sync-warning cases → exact-head CI → frozen review → merge.
- **BACKLOG:** optional local receipt download/export; deterministic built-in broker adapters backed by documented export contracts; confirmed mapping suggestions; cross-device preference sync only if product value justifies a server contract.
- **REJECT:** storing broker file contents in receipt history, economic-field duplicate guessing, receipt becoming accounting authority, masking partial failure as success, or a second writer.

---

## 5. Stable authority boundaries

Transaction mutation:

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ authoritative readback
→ calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

Broker-neutral import:

```text
explicit source semantics
→ strict Canonical/mapped preview
→ optional explicit saved mapping convenience
→ explicit source profile + confirmation
→ source-bound stable idempotency
→ existing durable record-create writer
→ shared batch outcome / readback / recalculation
```

Import receipt target:

```text
shared authoritative batch outcomes
→ memory-only non-financial ordered receipt
→ clear created / replayed / failed / ambiguous / sync-warning presentation
```

Receipt state is never accounting, duplicate, or transaction-identity authority.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, exact-head CI, deployment/runtime truth, and any available fresh R2.6B production calculation evidence.
3. Keep R3.3A as the single Primary Active Batch unless fresh evidence materially changes priority.
4. Preserve exact-head CI/frozen-review/expected-head merge discipline.
5. Keep R2.6B production financial verification distinct from engineering/CI completion.
6. Reopen closed work only for new material evidence.
7. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/receipt decisions.
