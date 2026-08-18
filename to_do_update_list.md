# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C, Desktop Visibility D1–D5, and R3.2A–R3.2F are closed at their reviewed engineering boundaries. R2.6B cash-inclusive whole-account Daily P&L is merged and CI-reviewed, but fresh production financial-snapshot evidence is still pending and must not be inferred. The single Primary Active Batch is R3.3A — Import Reconciliation Receipt; implementation is complete on PR #365 and exact-head CI #1237 passed at `0427d41f8f4c14c9e49cc15f7e3ec09a2ef1b820`, with final documentation/frozen review/merge still required.**

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

- protected frontend/engine `main`: `326f5ff63e7385c7b8ccb9c4c8b1c09eb4c22fcf` (`docs: close R3.2F and open import reconciliation receipt (#364)`);
- Draft PR #365 `feat: add shared import reconciliation receipt` is open from `feat/r3-3a-import-reconciliation-receipt` and remained mergeable at the latest refresh;
- PR #365 implementation head before this documentation commit: `0427d41f8f4c14c9e49cc15f7e3ec09a2ef1b820`;
- PR #365 exact-head CI #1237 at `0427d41f8f4c14c9e49cc15f7e3ec09a2ef1b820`: **SUCCESS** across Frontend security contracts/build, Python tests/coverage, and Worker security/deployment/D1 baseline;
- CI #1232 had one frontend receipt test false-negative while 625/626 frontend tests passed; root cause was a test-fixture contract mismatch (`refreshError` helper option versus `readbackError` call-site), not production `runRecordImportBatch` behavior;
- root-cause fix aligned the fixture with the production `sync.readbackError` contract and added an upstream assertion proving the injected readback failure is present before receipt presentation; no product success/failure semantics or assertions were weakened;
- R3.3A changed only shared frontend import batch/presentation/test surfaces plus this handoff document; no Worker/D1/schema/accounting/FX/idempotency mutation contract change is part of the batch;
- frozen review and expected-head merge remain pending until the documentation-updated head receives exact-head CI;
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

Status: **IMPLEMENTATION COMPLETE / EXACT-HEAD CI PASS / DOCUMENTATION-UPDATED HEAD REQUIRES FINAL CI + FROZEN REVIEW**

### Primary Goal

> After an import attempt, show a clear memory-only per-item receipt explaining which ordered items were newly created, safely replayed, failed, or had an ambiguous response, without duplicating accounting or storing broker data.

### Why this is next

Canonical, mapped, and IBKR import already share durable create/replay and batch recovery semantics, but previous UX mainly showed aggregate counts. On partial failure or replay-heavy imports the user could not easily see which ordered items were confirmed versus where processing stopped. The shared receipt improves confidence and recoverability without another backend or financial authority.

### Implemented behavior

1. `runRecordImportBatch` is extended additively with immutable `items`, `attempted`, and `unattempted`; existing status/count/failure/sync authority remains unchanged.
2. Every attempted ordered entry receives exactly one memory-only receipt outcome: `created`, `replayed`, `rejected`, or `ambiguous`; processing-stop suffix entries receive no fabricated outcome.
3. Receipt identity is non-financial and deterministic: explicit mapped source-record ordinal, Canonical CSV row, IBKR aggregate first source row, or final import-order fallback.
4. Receipt rows are not persisted to localStorage, sessionStorage, IndexedDB, D1, backup JSON, or portfolio snapshot.
5. Receipt presentation omits auth credentials, idempotency keys, raw broker CSV, record payloads, full notes, internal errors, and account IDs.
6. Committed/replayed server outcomes remain authoritative; the receipt is a presentation projection of existing batch evidence only.
7. Ambiguous response and explicit rejection have distinct receipt states and labels; unattempted suffixes remain explicit.
8. Authoritative readback/recalculation/recovery/metadata warnings are presented separately from record-write outcomes.
9. Canonical CSV, mapped broker CSV, and IBKR imports render the same `ImportReconciliationReceipt` component and shared presentation adapter; no importer-specific reconciliation engine was created.
10. Large receipts render incrementally in groups of 100 to keep the result UI bounded.
11. No Worker/D1/schema/accounting/FX/idempotency change was required.

### Debug / Root Cause Log — CI #1232

- **Symptom:** Frontend CI had 625/626 tests passing; only the new receipt sync-warning test failed because the expected readback warning message was absent.
- **Failure Point:** Test helper did not throw from `refreshRecords()`.
- **Contributing Factor:** Fixture option was named `refreshError`, while the test passed `readbackError`.
- **Root Cause:** Test-fixture naming drift from the established `sync.readbackError` batch contract produced a false-negative; production `runRecordImportBatch` correctly maps `refreshRecords()` failure to `sync.readbackError`.
- **Systemic Cause:** The test initially asserted only downstream presentation text and did not prove the upstream failure injection actually reached the shared batch result.
- **Fix:** Rename the fixture option to `readbackError` and assert `result.sync.readbackError` before exercising `buildImportReconciliationReceipt`.
- **Regression Prevention:** Shared-surface contract test verifies all three import UIs mount the same receipt component; privacy/persistence tests prohibit sensitive fields and storage/API paths; broker aggregate source-row reduction is covered explicitly.

### Files changed in R3.3A implementation

- `src/services/recordImportBatch.js`
- `src/services/importReconciliationReceipt.js`
- `src/components/ImportReconciliationReceipt.vue`
- `src/components/BrokerNeutralImportPreview.vue`
- `src/components/BrokerNeutralColumnMapping.vue`
- `src/components/IbkrTradeImport.vue`
- `tests/frontend_import_reconciliation_receipt.test.mjs`
- `to_do_update_list.md` (handoff/evidence only)

### Verification evidence

- Implementation exact head before documentation update: `0427d41f8f4c14c9e49cc15f7e3ec09a2ef1b820`.
- CI #1237 on that exact head: **SUCCESS**.
- Frontend security contract tests: **SUCCESS**.
- Frontend production build: **SUCCESS**.
- Python compile/tests/coverage baseline: **SUCCESS**.
- Worker tests, deployment metadata, Recovery Evidence Gate, and local D1 baseline: **SUCCESS**.
- Frozen diff scope before documentation update: seven implementation/test files only; no backend/schema/financial-authority expansion.
- Open review threads at that checkpoint: **0**.
- This documentation commit intentionally changes PR head; final exact-head CI and frozen review must therefore use the new head rather than reusing #1237 as merge authority.

### Rollback

- R3.3A is additive and migration-free. Rollback is a normal revert of the expected-head PR merge; no D1/schema/data restoration is required.
- Existing aggregate import result messages and server mutation authority remain present, so reverting the receipt layer does not require reconstructing transaction state.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** exact-head CI on the documentation-updated PR head → frozen independent review with BLOCKER/FOLLOW-UP/BACKLOG classification → mark Ready → expected-head merge.
- **NEXT:** after merge, verify `main` points to the expected merge result and inspect authoritative post-main CI/deployment evidence that is available; then close R3.3A at a stable checkpoint before choosing the next product batch.
- **BACKLOG:** optional local receipt download/export; deterministic built-in broker adapters backed by documented export contracts; confirmed mapping suggestions; cross-device preference sync only if product value justifies a server contract.
- **REJECT:** storing broker file contents in receipt history, economic-field duplicate guessing, receipt becoming accounting authority, masking partial failure as success, adding a second writer, or refactoring unrelated stable import paths in this batch.

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

Import receipt:

```text
shared authoritative batch outcomes
→ additive immutable per-attempt evidence
→ memory-only non-financial ordered receipt
→ shared Canonical / mapped / IBKR presentation
→ distinct created / replayed / rejected / ambiguous / sync-warning UX
```

Receipt state is never accounting, duplicate, or transaction-identity authority.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, PR #365 (or its merge result), exact-head CI, deployment/runtime truth, and any available fresh R2.6B production calculation evidence.
3. If PR #365 is still open, keep R3.3A as the single Primary Active Batch and complete only its CI/frozen-review/expected-head merge gates.
4. If PR #365 is merged and post-main verification is clean, mark R3.3A closed before opening another implementation batch.
5. Preserve exact-head CI/frozen-review/expected-head merge discipline.
6. Keep R2.6B production financial verification distinct from engineering/CI completion.
7. Reopen closed work only for new material evidence.
8. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/receipt decisions.
