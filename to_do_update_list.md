# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C, Desktop Visibility D1–D5, and R3.2A–R3.2E are closed at their reviewed engineering boundaries. R2.6B cash-inclusive whole-account Daily P&L is merged and CI-reviewed, but fresh production financial-snapshot evidence is still pending and must not be inferred. The single Primary Active Batch is R3.2F — Saved Mapping Presets.**

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
10. Public repo evidence must not unnecessarily record personal financial values, credentials, backup contents, or tenant data.

---

## 1. Current authoritative state

At this handoff snapshot:

- protected frontend/engine `main`: `fbb5f532eab30195379b334e8ff9194879259580`;
- PR #361 R3.2E merged from exact head `a76b8c95c06c9128ee51f63729c962f823153ae0`;
- PR #361 exact-head CI #1222: **SUCCESS** across Frontend contracts/build, Python tests/coverage, and Worker security/deployment/D1 baseline;
- PR #361 frozen independent review: **PASS / BLOCKER 0 / FOLLOW-UP 0**;
- R3.2D/E introduce no Worker/D1/schema changes; production Worker authority remains the reviewed R3.1C Worker line unless fresh deployment truth supersedes it;
- Worker runtime contract remains release `4.12` / API `2.65` / schema authority `3` unless fresh runtime evidence supersedes it;
- additive migration `0006_journal_restore_sessions.sql` remains the restore-session schema authority;
- authenticated tenant-scoped empty-account atomic `/api/journal-restore` remains the protected restore behavior.

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

## 3. R3.2 Portability status

### R3.2A — Canonical Trade CSV v1 Preview

Status: **CLOSED** — PR #355.

Required headers:

`txn_date,symbol,txn_type,qty,price,currency`

Optional headers:

`fee,tax,tag,note,executed_at,execution_sequence`

Contract: BUY/SELL only, exact `YYYY-MM-DD`, explicit currency/direction, no silent sign/date/currency inference, strict unknown/missing/duplicate-header failure, and legitimate duplicate multiplicity preserved.

### R3.2B — Canonical CSV Template

Status: **CLOSED** — PR #356.

- deterministic header-only template;
- exact parser header authority;
- browser-local download only;
- no sample financial data.

### R3.2C — Safe Canonical CSV Execution

Status: **CLOSED** — PR #358.

```text
exact Canonical source
+ explicit normalized source profile
+ source-bound SHA-256 identity
+ source row identity
→ existing durable record-create intent
→ /api/records/idempotent
→ shared batch readback / recalculation
```

Same profile + exact same file is replay-safe. Edited/reordered files or another profile are intentionally new sources. Economic-field similarity is never duplicate authority.

### R3.2D — Explicit Broker Column Mapping Preview

Status: **CLOSED** — PR #360.

- same toolbar footprint under compact `CSV 工具`;
- strict source CSV parsing;
- user explicitly maps source headers to Canonical v1 fields;
- exact same-name canonical headers may prefill only as UI convenience;
- fixed values are allowed only for reviewed `txn_type`, `currency`, `tag`, and `note` fields;
- no fixed-value shortcut for date/symbol/qty/price;
- no date-format, side, currency, sign, number-format, lot/tax/FX, or duplicate inference;
- mapped output must pass the existing Canonical validator;
- mapping preview itself remains `writes_allowed=false`.

### R3.2E — Safe Mapped Broker CSV Execution

Status: **CLOSED / MERGED** — PR #361, `main@fbb5f532eab30195379b334e8ff9194879259580`.

Stable identity binds:

```text
normalized explicit source profile
+ exact original broker CSV text
+ exact normalized mapping contract in Canonical field order
+ source record ordinal
```

Safety properties:

1. Execution reparses the exact original source + current mapping; stale UI preview is not mutation authority.
2. Every mapped row must still pass Canonical v1 before any durable intents are created.
3. Mapping preview stays zero-write; user supplies a source profile and explicitly confirms before mutation.
4. Any source text, mapping, or source-profile change is a new source; no fuzzy/economic-field dedupe.
5. Fully identical legitimate rows remain distinct because source record ordinal participates in the idempotency key.
6. Canonical and mapped imports share the same `buildCanonicalImportRecord()` business-field persistence contract.
7. Mapped execution has no second API/writer; it delegates to existing `createBrokerNeutralRecord` + `/api/records/idempotent`.
8. Shared `runRecordImportBatch` keeps the existing committed/replayed/partial/ambiguous semantics, one authoritative readback, and one recalculation.
9. Ambiguous outcome remains recoverable with the exact same source/profile/mapping. Explicit rejection becomes terminal.
10. No Worker/D1/schema/accounting/FX changes.

---

## 4. Primary Active Batch

### Phase

`R3 — Portability / Automation`

### Batch

`R3.2F — Saved Mapping Presets`

Status: **ACTIVE / AUTHORITY TRACE FIRST**

### Primary Goal

> Remove repeated manual column mapping for recurring broker exports while keeping saved mappings as convenience state only, never financial truth.

### Why this is next

R3.2D/E now make non-canonical broker CSVs safely mappable and executable, but the same broker export still requires the same manual mapping every time. The next direct UX gain is remembering a user-confirmed mapping without expanding Worker/D1 or introducing heuristic mapping authority.

### Required behavior

1. First implementation should prefer a versioned browser-local mapping-preset service; do **not** expand Worker/D1 merely to store a convenience preference.
2. Persist only the minimum mapping metadata needed for reuse: preset label, exact source-header signature, and normalized explicit mapping contract.
3. Do not persist broker CSV contents, transactions, prices, quantities, credentials, auth tokens, or source-file hashes as part of a mapping preset.
4. Source profile / transaction identity remains execution-time input and must not be silently substituted by a saved mapping preset.
5. A preset may auto-match only an **exact source-header signature** and must visibly tell the user which saved mapping is being applied; no fuzzy header matching in this slice.
6. Loading a preset is convenience only. The resulting mapped data must still pass R3.2D Canonical validation and R3.2E explicit confirmation before writing.
7. Corrupted/unsupported preset state must fail closed and must not block manual mapping.
8. Logout/privacy cleanup must include the new versioned preset storage if it contains user-specific broker workflow metadata.
9. Preserve mapping multiplicity/identity rules; a saved preset must not change idempotency semantics.
10. No AI-generated mappings in this slice. AI-assisted suggestions remain future convenience and must always require explicit confirmation.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace project localStorage cleanup/versioning contracts and design the smallest strict mapping-preset schema keyed by exact ordered source-header signature.
- **NEXT:** implement save/load/delete preset UX inside existing `CSV 工具` / mapping modal → regression tests → exact-head CI → frozen review → merge.
- **BACKLOG:** deterministic built-in broker adapters backed by documented export contracts; optional confirmed AI mapping suggestions; import reconciliation/reporting; cross-device preference sync only if product value justifies a server contract.
- **REJECT:** fuzzy preset auto-application, silent transform changes, storing source transaction contents in presets, mapping preset becoming transaction identity, or a second record writer.

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
→ explicit source profile + confirmation
→ source-bound stable idempotency
→ existing durable record-create writer
→ one batch readback / recalculation
```

Saved mapping preset (R3.2F target):

```text
user-confirmed mapping metadata
→ versioned local convenience state
→ exact-header match / visible reuse
→ normal strict mapped preview
→ normal explicit execution gate
```

A preset is never accounting, transaction-identity, or duplicate authority.

Cash:

```text
explicit user cash event
→ tenant-scoped cash CRUD
→ deterministic cash ledger
→ completeness gate
→ reviewed account-value / account-Daily-P&L previews
```

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, exact-head CI, deployment/runtime truth, and any available fresh R2.6B production calculation evidence.
3. Keep R3.2F as the single Primary Active Batch unless fresh evidence materially changes priority.
4. Preserve exact-head CI/frozen-review/expected-head merge discipline.
5. Keep R2.6B production financial verification distinct from engineering/CI completion.
6. Reopen closed work only for new material evidence.
7. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/preset decisions.
