# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / PR / CI / Pages / runtime truth overrides this snapshot.
>
> Versioned closeouts:
> - R2.4: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R2.5A: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`
> - R2.5B: `docs/engineering/R2_5B_POST_RECONCILIATION_SHADOW_EVIDENCE_2026-08-17.md`
> - R2.5C: `docs/engineering/R2_5C_OPENING_BALANCE_READINESS_CLOSEOUT_2026-08-17.md`
> - R2.5D: `docs/engineering/R2_5D_OPENING_BALANCE_SHADOW_COMPLETE_2026-08-17.md`
> - R2.6A: `docs/engineering/R2_6A_ACCOUNT_VALUE_PREVIEW_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R3.1A: `docs/engineering/R3_1A_BROKER_NEUTRAL_BACKUP_PRODUCTION_CLOSEOUT_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, and R3.1A are closed at their reviewed boundaries. R3.1A merged as PR #337 at `main@1a770a2e0f40588f95e2410ec91db5e0dd43ab70`; exact-head CI #1152, post-main CI #1153, and Pages #1617 succeeded. The authenticated user then executed the production `下載備份` action and confirmed the backup downloaded successfully. No personal backup contents/counts are versioned. Production Worker remains runtime source `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. The single Primary Active Batch is R3.1B Safe Restore / Import Foundation.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, maintainability, safety, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation never becomes a second accounting, FX, tax, recovery, or market-data authority.
5. Important work uses recovery point → Draft PR → exact-head CI → frozen review → exact-head merge → post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over methodology expansion when both are optional.
10. Public repo evidence must not unnecessarily record personal financial values or backup contents.

---

## 1. Current authoritative state

Before this R3.1A docs-only closeout:

- protected `main`: `1a770a2e0f40588f95e2410ec91db5e0dd43ab70`;
- open PRs: none;
- PR #337 merged successfully;
- exact-head CI #1152: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- post-main CI #1153: SUCCESS;
- Pages #1617: SUCCESS on the feature merge head;
- production backup action: authenticated user confirmed successful download;
- production Worker runtime source: `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`;
- Worker Version ID: `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`;
- runtime contract: release `4.12` / API `2.65` / schema `3`;
- R3.1A made no Worker/D1 change.

Always refresh GitHub remote truth before modifying anything.

### R2 cash/account-value boundary

Status: **CLOSED / PRODUCTION VERIFIED**.

- durable transaction currency reviewed;
- explicit cash events authoritative;
- shadow cash complete in observed production scope;
- `account_value_preview` production-ready;
- existing Daily P&L/TWR/XIRR/performance semantics remain unchanged;
- whole-account performance cutover remains a separate future methodology decision.

### R3.1A — Broker-Neutral Export & Backup Foundation

Status: **CLOSED / PRODUCTION VERIFIED**.

Delivered authority path:

```text
authenticated tenant-scoped durable reads
→ explicit versioned backup contract
→ fail-closed validation/serialization
→ user-controlled JSON download
```

Important boundaries:

- fresh `/api/records` pagination, not projected `portfolioStore.records`;
- fresh `/api/cash-events` read;
- raw durable note envelope preserved;
- transaction/cash financial fields preserved without inference;
- tenant/internal idempotency fields stripped;
- credentials, localStorage, browser cache, and derived portfolio snapshots excluded;
- unknown future server fields/malformed responses/duplicate IDs/cursor cycles fail closed;
- no restore/import write path;
- no broker-specific parser.

---

## 2. Primary Active Batch

### Phase

`R3 — Universal Data Gateway`

### Batch

`R3.1B — Safe Restore / Import Foundation`

Status: **PLANNING / READY FOR ARCHITECTURE TRACE**

### Primary Goal

> Make the reviewed backup contract recoverable inside the product through a deterministic, tenant-safe, idempotent restore/import workflow that validates and previews effects before mutation, without destructive overwrite or financial inference.

### Why this is next

R3.1A proves users can create a trustworthy backup. The largest direct product gap is now recoverability: a backup that cannot be safely restored is only half of the portability story.

Broker-specific adapters and whole-account performance methodology remain lower priority until the core backup/restore round trip is safe and deterministic.

### Mandatory architecture questions before writes

1. What exact existing Worker mutation contracts exist for transaction records and cash events?
2. Which writes are idempotent today, and what key can restore derive deterministically without exposing/importing old server hashes?
3. Should source database IDs be treated as non-portable and regenerated, while durable business fields are reconstructed?
4. How are exact duplicates, semantic duplicates, conflicts, and existing tenant data distinguished?
5. What is the safe behavior for an empty tenant versus a tenant with existing journal data?
6. Can the complete restore plan be computed client-side/read-only before any mutation?
7. What ordering constraints apply to OPENING_BALANCE, DEPOSIT/WITHDRAWAL, BUY/SELL/DIV, and same-date ambiguity?
8. How are partial success, timeout ambiguity, retry, and resume handled without duplication?
9. Does a batch Worker endpoint materially improve atomicity/recovery, or would it create unnecessary second-path complexity?
10. What production verification can prove restore safety without risking the user's primary tenant data?

### Narrow product boundary

R3.1B should prefer:

- upload/select a versioned journal backup;
- strict schema/version validation;
- read-only restore preview before mutation;
- explicit counts/actions/conflicts in preview;
- no automatic overwrite/delete;
- deterministic idempotency for every accepted write;
- safe retry/resume after ambiguous network outcomes;
- tenant-scoped authenticated writes only;
- post-write server readback verification;
- clear success/partial/conflict UX.

Explicit non-goals unless architecture evidence proves them necessary:

- destructive replace-all restore;
- silently editing/deleting existing records;
- broker-specific CSV parser;
- guessed currency/cash/chronology/tax/lot data;
- whole-account TWR/XIRR/performance change;
- unrelated refactor/cleanup.

### Initial exit criteria

R3.1B may close only when:

1. restore/import contract and duplicate/conflict semantics are explicit;
2. backup v1 validation is fail-closed;
3. preview occurs before all mutations;
4. mutation path is tenant-scoped and deterministic/idempotent;
5. ambiguous retries cannot create duplicate financial events;
6. no destructive overwrite occurs implicitly;
7. post-write server readback verifies accepted results;
8. regression tests cover empty tenant, exact replay, conflicting existing data, auth refresh, timeout/retry, partial failure, and malformed backup;
9. full exact-head CI + frozen review pass;
10. production verification uses a safe evidence plan and does not endanger primary user data.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace record/cash write authority → define portable identity/idempotency semantics → design dry-run restore plan → choose minimal write architecture.
- **NEXT:** implement the reviewed R3.1B slice only after architecture trace proves its safety boundary.
- **BACKLOG:** broker-neutral adapters/CSV ingestion, automated reconciliation preview, whole-account performance methodology, historical whole-account chart, R4 portfolio intelligence.
- **REJECT:** replace-all restore, silent deletes, guessed financial facts, importing server hashes/credentials, second browser accounting authority, unrelated cleanup.

---

## 3. Stable authority boundaries

### Transaction mutation

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ committed readback
→ dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

### Cash

```text
explicit user cash event
→ tenant-scoped cash CRUD
→ deterministic shadow cash derivation
→ completeness gate
→ reviewed account-value preview
```

### Backup

```text
authenticated durable reads
→ versioned backup contract
→ deterministic user download
```

### Restore target boundary

R3.1B must preserve:

```text
user-selected backup
→ strict validation
→ read current tenant state
→ deterministic restore plan / conflict preview
→ explicit user confirmation
→ idempotent tenant-scoped writes
→ server readback verification
```

No stage may infer missing financial facts or silently delete/replace current data.

---

## 4. Immediate next actions

1. Re-read Worker transaction POST/update/delete and cash-event mutation implementations plus tests.
2. Trace current create idempotency key semantics and recovery/pending-intent behavior.
3. Compare backup v1 fields with writable API fields; identify non-portable server-generated fields.
4. Define exact duplicate vs conflict fingerprints for transaction and cash events.
5. Decide whether restore v1 is append-only/idempotent into compatible tenant state or requires a separate empty-tenant constraint.
6. Design read-only restore preview contract and UX before any write code.
7. Select client-orchestrated writes vs a narrowly justified server batch endpoint from atomicity/recovery evidence.
8. Add contract tests before UI mutation wiring.
9. Use Draft PR + full CI + frozen exact-head review.
10. Design production validation around safe data isolation; do not test destructive restore on the user's primary production dataset.

---

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, CI, Pages, Worker/runtime truth.
3. Keep R3.1B as the only Primary Active Batch unless newer production evidence changes priority.
4. Preserve recovery points and exact-head review discipline.
5. Reopen closed R2/R3.1A work only for new material evidence.
