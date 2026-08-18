# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence is versioned under `docs/engineering/`; this file is a concise live handoff rather than a history dump.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C, Desktop Visibility D1–D5, and R3.2A–R3.2C are closed at their reviewed engineering boundaries. R2.6B cash-inclusive whole-account Daily P&L is merged and CI-reviewed; fresh production financial-snapshot evidence is still pending and must not be inferred. The next Primary Active Batch is R3.2D — Explicit Broker Column Mapping Preview, with user-confirmed mappings before any mapped-file write path.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, maintainability, safety, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation never becomes a second accounting, FX, tax, recovery, or market-data authority.
5. Important work uses recovery point → Draft PR → exact-head CI → frozen review → expected-head merge → post-main verification where the connector/deployment surface provides authoritative evidence.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, transaction identity, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over methodology expansion when both are optional.
10. Public repo evidence must not unnecessarily record personal financial values, credentials, backup contents, or tenant data.

---

## 1. Current authoritative state

At this handoff snapshot:

- protected frontend/engine `main`: `a33f122e4f509b070f59ff4720382a96f56e24dc`;
- open product PRs immediately after PR #358 merge: none;
- PR #358 exact-head CI #1213: SUCCESS across Frontend / Python / Worker-D1 jobs;
- PR #358 frozen independent review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- production Worker runtime remains the reviewed R3.1C Worker line because R2.6B and R3.2A–C introduce no Worker/D1/schema mutation;
- Worker runtime contract remains release `4.12` / API `2.65` / schema authority `3` unless fresh deployment truth supersedes it;
- production additive migration `0006_journal_restore_sessions.sql` remains applied;
- authenticated tenant-scoped empty-account atomic `/api/journal-restore` capability remains protected production behavior.

### Evidence boundary that remains open

R2.6B was merged as PR #357 (`main@2d901dd9f9d4043364afc78453092b80ab335d9d`) after exact-head CI #1211 and frozen review PASS. The code path is reviewed and merged, but **a fresh production portfolio calculation/snapshot generated from that main line has not yet been observed through an authoritative connected run/snapshot surface in this session**. Do not claim production financial output is verified until such evidence is available.

---

## 2. Stable closed product boundaries

### R2 cash / account value

- explicit cash events are authoritative;
- shadow cash completeness is fail-closed;
- `account_value_preview` publishes current whole-account value as securities + authoritative cash when complete;
- TWR/XIRR/performance history remain unchanged;
- whole-account performance cutover remains a separate methodology decision.

### R2.6B — Cash-Inclusive Account Daily P&L

Status: **ENGINEERING CLOSED / PRODUCTION FRESH-SNAPSHOT EVIDENCE PENDING**.

Root cause resolved:

- legacy `fx_pnl_twd` is securities-only;
- correct account FX exposure is **per-currency beginning net exposure**, not whole account value multiplied by one FX rate;
- foreign cash, including negative balances, joins beginning securities exposure;
- TWD cash has identity FX and no foreign-currency FX effect.

Reviewed behavior:

```text
canonical security day ledger
+ authoritative cash ledger
+ snapshot-owned beginning/end FX provenance
→ whole-account Daily P&L preview
→ full reconciliation gate
→ browser selects preview only when ready
```

Fail closed when any required evidence is incomplete, including missing cash history/FX, incomplete cash ledger, unsettled dividend evidence, ambiguous date-only external DEPOSIT/WITHDRAWAL timing, unsupported intermediate transaction chronology, or reconciliation failure. In those cases UI retains the existing securities Daily P&L.

Still unchanged: group/tag Daily P&L, TWR, XIRR, holdings market value, historical performance methodology.

### R3.1 backup / restore

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

Still rejected: merge restore, replace-all, silent delete, importing derived snapshots, fresh idempotency key on ambiguous retry, destructive production smoke against a populated account.

### Desktop Visibility D1–D5

Status: **CLOSED**.

- desktop workspace reclaim and density improvements are complete;
- reversible focus mode keeps one authoritative `TradeForm`;
- cash/group/dividend workspaces use horizontal space more effectively;
- do not resume cosmetic compression without concrete usability evidence;
- typography and financial/data authority remain untouched by layout CSS.

Detailed evidence remains in:

- `docs/engineering/R3_1C_AND_DESKTOP_VISIBILITY_D1_D3_CLOSEOUT_2026-08-17.md`
- `docs/engineering/DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`

---

## 3. R3.2 Portability status

### R3.2A — Canonical Trade CSV v1 Preview

Status: **CLOSED** — PR #355.

Canonical v1 required headers:

`txn_date,symbol,txn_type,qty,price,currency`

Optional headers:

`fee,tax,tag,note,executed_at,execution_sequence`

Contract:

- BUY / SELL only;
- exact `YYYY-MM-DD`;
- explicit currency and direction;
- unknown/missing/duplicate headers fail closed;
- offset-aware real `executed_at` when present;
- no sign/date/currency inference;
- legitimate identical source rows preserve multiplicity;
- parser/preview service itself remains structurally zero-write.

### R3.2B — Canonical CSV Template

Status: **CLOSED** — PR #356.

- deterministic header-only template;
- reuses exact parser header authority;
- no sample financial data;
- browser-local download only.

### R3.2C — Safe Canonical CSV Import Execution

Status: **CLOSED / MERGED** — PR #358, `main@a33f122e4f509b070f59ff4720382a96f56e24dc`.

Safety model:

1. Execution reparses the exact source and requires **every row ready**; no partial-file write mode.
2. User supplies an explicit source profile and explicitly confirms the durable mutation.
3. Per-row stable identity is derived from:

```text
Canonical Trade CSV v1
+ normalized explicit source profile
+ SHA-256(exact source text)
+ original source row number
```

4. Same profile + exact same file is replay-safe and supports continuation after a partial/ambiguous run.
5. Two economically identical rows in one file remain distinct because source row identity differs.
6. Edited/reordered files or a different profile are intentionally treated as a new source. Canonical v1 does **not** pretend to know cross-file duplicate identity without a broker-authoritative transaction ID.
7. Durable record create reuses existing record-create recovery/idempotency authority and `/api/records/idempotent` deployment entry.
8. Explicit rejection becomes terminal; ambiguous outcome remains recoverable; confirmed commit clears the durable intent.
9. Shared `recordImportBatch` performs one authoritative records readback and one recalculation only when the ledger may have changed. Replay-only batches do neither.
10. Existing IBKR batch behavior is preserved through a compatibility wrapper and regression tests.

No Worker/D1/schema/accounting/FX changes were introduced by R3.2C.

---

## 4. Primary Active Batch

### Phase

`R3 — Portability / Automation`

### Batch

`R3.2D — Explicit Broker Column Mapping Preview`

Status: **ACTIVE / AUTHORITY TRACE FIRST**

### Primary Goal

> Let a user upload a non-canonical broker CSV and explicitly map source columns into Canonical Trade CSV v1 semantics, with a deterministic preview before any mapped-file execution is considered.

### Why this is next

R3.2A–C make Canonical CSV safe and executable, but users of other brokers still need to manually transform exports into the canonical headers. The next direct UX gap is reducing that manual conversion while preserving the rule that guessed mappings cannot become financial truth.

### Required behavior

1. Preserve Canonical Trade CSV v1 as the only downstream transaction contract; mapping must not create a second accounting model.
2. Source CSV header discovery may suggest likely mappings, but **suggestions are not authoritative**. Required financial semantics must be explicitly confirmed by the user before a mapped preview can be called ready.
3. Do not silently infer currency, BUY/SELL direction, date convention, quantity sign semantics, tax, FX, lots, or transaction identity.
4. Mapping must expose unmapped required fields, unsupported rows, transformations, and warnings before any execution path.
5. Mapping must preserve source-row multiplicity and stable source evidence.
6. First D slice should remain zero-write mapping/preview; execution of mapped files is a later narrow gate reusing R3.2C rather than a new writer.
7. Native broker adapters may be added only when their export contracts are explicit/testable; do not build brittle heuristics around one sample file.
8. Existing IBKR importer remains its authoritative broker-specific path unless a future adapter reaches contract parity.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace source CSV parser reuse, Canonical preview contract, and a minimal explicit mapping state model; identify whether date/direction/currency transformations can remain identity-only in the first slice.
- **NEXT:** implement zero-write header mapping + mapped Canonical preview → exact-head CI → frozen review → merge.
- **BACKLOG:** reviewed broker-native adapter registry; explicit deterministic transform profiles; optional AI-assisted mapping suggestions that always require confirmation; mapped-file execution by delegating to R3.2C; reconciliation preview.
- **REJECT:** AI/heuristic guesses becoming financial truth, silent sign/date/currency conversion, field-similarity deduplication, hidden transforms, browser-local accounting authority, or a second record writer.

---

## 5. Stable authority boundaries

Transaction mutation:

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ authoritative readback
→ dirty generation / calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

Canonical import:

```text
explicit canonical source semantics
→ strict zero-write preview
→ explicit source profile + confirmation
→ stable per-source-row idempotency
→ existing durable record-create writer
→ one batch readback / recalculation
```

Cash:

```text
explicit user cash event
→ tenant-scoped cash CRUD
→ deterministic cash ledger
→ completeness gate
→ reviewed account-value / account-Daily-P&L previews
```

Backup / Restore:

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

UI layout:

`src/styles/product-consistency.css` is the final cross-page spacing/density layer. Typography authority remains in the semantic type system/component tokens. Layout CSS must not become a data, financial, persistence, or navigation authority.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, exact-head CI, deployment/runtime truth, and any available fresh production calculation evidence.
3. Keep R3.2D as the single Primary Active Batch unless fresh evidence materially changes priority.
4. Preserve exact-head CI/frozen-review/expected-head merge discipline.
5. Keep R2.6B production financial verification distinct from engineering/CI completion.
6. Reopen closed R2/R3.1/Desktop Visibility/R3.2A–C work only for new material evidence.
7. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/layout decisions.
