# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C, Desktop Visibility D1–D5, R3.2A–R3.2F, and R3.3A are closed at their reviewed engineering boundaries. R2.6B cash-inclusive whole-account Daily P&L is merged and CI-reviewed, but fresh production financial-snapshot evidence is still pending and must not be inferred. R3.3A Import Reconciliation Receipt merged as PR #365 at `main@26c74af8429f3d17380c278f53828008d01fee1e` after exact-head CI #1238 and frozen review PASS. The single Primary Active Batch is R3.3B — Safe Ambiguous Import Retry.**

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

- protected frontend/engine `main`: `26c74af8429f3d17380c278f53828008d01fee1e` (`feat: add shared import reconciliation receipt (#365)`);
- PR #365 R3.3A merged from frozen exact head `65dc2fea6c9a3c392f30fd5ed34ddd6711f91cd2`;
- PR #365 exact-head CI #1238: **SUCCESS** across Frontend security contracts/build, Python tests/coverage, and Worker security/deployment/D1 baseline;
- PR #365 frozen independent review: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- `main@26c74af...` is one merge commit ahead of frozen head `65dc2fea...` with **zero changed files** in the comparison, proving the merged tree is identical to the reviewed/tested candidate tree;
- the repository CI workflow is configured to run on `push` to `main`, but the current connector surface does not expose push-triggered run listing by commit, so no post-main run number/conclusion is claimed without evidence;
- CI #1232 root cause remains recorded as a test-fixture contract mismatch (`refreshError` helper option versus `readbackError` call-site), not production batch behavior; the fix was verified by CI #1238;
- R3.3A introduced no Worker/D1/schema/accounting/FX/idempotency mutation-contract change;
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

## 4. R3.3A closeout — Import Reconciliation Receipt

Status: **CLOSED / MERGED** — PR #365, `main@26c74af8429f3d17380c278f53828008d01fee1e`.

### Product result

1. `runRecordImportBatch` now exposes immutable additive `items`, `attempted`, and `unattempted` while preserving existing status/count/failure/sync authority.
2. Every attempted entry has one memory-only outcome: `created`, `replayed`, `rejected`, or `ambiguous`; stopped suffix entries have no fabricated result.
3. Receipt identity is deterministic and non-financial: mapped source ordinal, Canonical CSV row, IBKR aggregate first source row, or import-order fallback.
4. Receipt projection excludes auth data, idempotency keys, broker file contents, account IDs, record payloads, full notes, and internal error objects/messages.
5. Readback/recalculation/recovery/metadata warnings remain separate from write outcomes.
6. Canonical, mapped broker, and IBKR imports mount the same shared receipt adapter/component.
7. Large receipts expand in bounded 100-row increments.
8. No persistence, Worker, D1, schema, accounting, FX, or idempotency mutation-contract change.

### Root Cause Log — CI #1232

- **Symptom:** 625/626 frontend tests passed; receipt sync-warning test failed.
- **Failure Point:** test helper never threw from `refreshRecords()`.
- **Contributing Factor:** helper option was `refreshError`, caller passed `readbackError`.
- **Root Cause:** test-fixture naming drift from the established `sync.readbackError` contract.
- **Systemic Cause:** the original test asserted downstream text without proving the upstream failure injection reached the batch result.
- **Fix:** align on `readbackError` and assert upstream `result.sync.readbackError` before presentation.
- **Regression Prevention:** shared-surface, privacy/persistence, ambiguity/rejection, and IBKR source-row contract tests.

### Verification / review / rollback

- frozen exact head: `65dc2fea6c9a3c392f30fd5ed34ddd6711f91cd2`;
- exact-head CI #1238: **SUCCESS**;
- frozen review: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- expected-head merge: PR #365 → `26c74af8429f3d17380c278f53828008d01fee1e`;
- merge-tree comparison against frozen head: **0 changed files**;
- post-main push-run listing: **NOT OBSERVED on the currently available connector surface; no fabricated PASS claim**;
- rollback: normal migration-free revert of PR #365 merge; no D1/schema/data restore required.

---

## 5. Primary Active Batch

### Phase

`R3 — Portability / Automation`

### Batch

`R3.3B — Safe Ambiguous Import Retry`

Status: **ACTIVE / CONTRACT-FIRST**

### Primary Goal

> When an import stops on an ambiguous server response, let the user safely retry the exact same in-memory source with one explicit action, replaying already-confirmed entries through the existing stable idempotency contract instead of forcing manual file re-selection.

### Evidence / user problem

After R3.3A, all three importers can explain an ambiguous partial failure, but their current result state replaces the import action with only Close/Done. The source CSV/text, source profile, mapping state, or parsed IBKR preview still remain in memory while the dialog is open, and existing result copy tells the user that re-importing the same source is safe. The product gap is therefore UX orchestration, not a missing writer or duplicate-detection mechanism.

### Working contract

1. Retry is offered only for `status === 'partial_failure'` with `failure.outcomeAmbiguous === true`.
2. Do **not** offer retry for committed/replayed results, sync-only warnings, or explicit rejection; those states have different recovery actions.
3. Retry reuses the exact current in-memory source/profile/mapping inputs and existing preparer/writer. It does not reconstruct transactions from receipt rows.
4. Retry starts the whole exact batch from the beginning; already-confirmed entries safely replay through their existing stable idempotency keys, the ambiguous entry is re-resolved, and later entries can continue.
5. Never generate a fresh identity for an ambiguous entry. No receipt-derived or economic-field duplicate matching.
6. Canonical and mapped sources must still satisfy their existing ready/source-profile contracts; mapped retry requires unchanged current mapping.
7. IBKR retry is disabled if the profile has been edited and not revalidated (`profileDirty`).
8. The shared receipt component may expose the action consistently, but parent importer state remains responsible for proving the exact source is still available and eligible.
9. Keep explicit user action/confirmation before retry. No background or automatic mutation loop.
10. No receipt persistence, Worker/D1/schema/accounting/FX/idempotency changes unless new evidence proves the existing stable-key contract insufficient.

### In Scope

- one shared ambiguous-retry eligibility policy;
- one consistent retry action in Canonical, mapped, and IBKR result UX;
- reuse of existing preparation and durable batch execution paths;
- regression tests proving exact ambiguous-only visibility, unchanged-source gating, stable-key reuse path, and no retry for sync warnings/explicit rejection;
- exact-head CI, frozen review, expected-head merge.

### Out of Scope

- retrying explicit validation/server rejection without user correction;
- automatic timed retry loops;
- storing broker source or receipt state for later sessions;
- selective receipt-row mutation/reconstruction;
- receipt export/download;
- new broker adapters;
- AI/fuzzy mapping inference;
- Worker/D1/accounting/FX refactor.

### Convergence decision

Candidate ranking after R3.3A:

- **NOW — R3.3B Safe Ambiguous Import Retry:** direct continuation of the new receipt, removes repeated manual file selection, and is already supported by stable idempotency authority.
- **BACKLOG — receipt export/download:** useful but does not reduce import recovery friction.
- **BACKLOG — deterministic broker adapters:** potentially high value but broker-specific and larger scope.
- **BACKLOG — mapping suggestions/AI assistance:** potentially useful, but must first define privacy, confidence, explicit-confirmation, and non-authority boundaries; not needed to solve current recovery friction.
- **BACKLOG — cross-device preference sync:** lower immediate product value and requires a server contract.
- **REJECT for this batch:** new writer, fresh retry idempotency keys, economic-field duplicate guesses, persistent broker contents, automatic mutation loops, or unrelated refactor.

### Expansion triggers

Re-plan before implementation if evidence shows any importer cannot deterministically reproduce the same stable entry keys from the still-open in-memory source, or if retrying the whole batch can alter transaction identity. Such evidence is **High Impact** because it would invalidate the proposed safe-replay UX.

### Next Actions

1. Trace the exact preparation/key derivation for Canonical, mapped, and IBKR retry from current `main`.
2. Define the smallest shared eligibility/presentation contract.
3. Add focused regression tests before/with implementation.
4. Implement one importer at a time only if the shared contract remains valid, keeping one PR/batch.
5. Run full Frontend/Python/Worker CI because shared import code is security-sensitive even if the implementation remains frontend-only.
6. Frozen review → expected-head merge → stable checkpoint.

---

## 6. Stable authority boundaries

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

Ambiguous retry target:

```text
ambiguous partial batch result
+ unchanged in-memory source contract
→ explicit user retry action
→ reproduce the same stable import entries/keys
→ replay confirmed prefix safely
→ re-resolve ambiguous item
→ continue remaining entries
```

Receipt/retry state is never accounting, duplicate, or transaction-identity authority.

---

## 7. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, exact-head CI, deployment/runtime truth, and any available fresh R2.6B production calculation evidence.
3. Confirm PR #365 remains merged and do not reopen R3.3A without new material evidence.
4. Keep R3.3B as the single Primary Active Batch unless its stable-key assumption is disproven.
5. Before mutation, verify Canonical/mapped/IBKR exact source→stable-key reproduction from current code.
6. Preserve exact-head CI/frozen-review/expected-head merge discipline.
7. Keep R2.6B production financial verification distinct from engineering/CI completion.
8. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/retry decisions.
