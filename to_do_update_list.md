# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / PR / CI / Pages / Worker runtime truth overrides this snapshot.
>
> Versioned closeouts:
> - R2.4: `docs/engineering/R2_4_SHADOW_CASH_LEDGER_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R2.5A: `docs/engineering/R2_5A_TRANSACTION_CURRENCY_RECONCILIATION_CLOSEOUT_2026-08-17.md`
> - R2.5B: `docs/engineering/R2_5B_POST_RECONCILIATION_SHADOW_EVIDENCE_2026-08-17.md`
> - R2.5C: `docs/engineering/R2_5C_OPENING_BALANCE_READINESS_CLOSEOUT_2026-08-17.md`
> - R2.5D: `docs/engineering/R2_5D_OPENING_BALANCE_SHADOW_COMPLETE_2026-08-17.md`
> - R2.6A: `docs/engineering/R2_6A_ACCOUNT_VALUE_PREVIEW_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R3.1A: `docs/engineering/R3_1A_BROKER_NEUTRAL_BACKUP_PRODUCTION_CLOSEOUT_2026-08-17.md`
> - R3.1B: `docs/engineering/R3_1B_ATOMIC_EMPTY_RESTORE_STAGING_CLOSEOUT_2026-08-17.md`

Last updated: **2026-08-17 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A, and R3.1B are closed at their reviewed boundaries. R3.1B backend + isolated staging restore is live-proven on `main@c1c7c2895c297372981dac2898131c7727d44e9a`; Deploy Staging Worker #6 / run `32022424046` succeeded after the stable-readiness gate correctly waited 11 attempts for three consecutive exact-source passes. Authenticated atomic restore, authoritative readback, replay deduplication, idempotency conflict, non-empty blocking, cleanup, credential cleanup, and live CORS isolation all passed. The frontend remains intentionally preview-only. The single Primary Active Batch is R3.1C Restore Execution UX + Production Capability Activation.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, maintainability, safety, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention.
4. Financial/data correctness is fail-closed. Browser presentation never becomes a second accounting, FX, tax, recovery, or market-data authority.
5. Important work uses recovery point → Draft PR → exact-head CI → frozen review → expected-head merge → post-main verification.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over methodology expansion when both are optional.
10. Public repo evidence must not unnecessarily record personal financial values, credentials, or backup contents.

---

## 1. Current authoritative state

Before this R3.1B docs closeout branch:

- protected `main`: `c1c7c2895c297372981dac2898131c7727d44e9a`;
- open PRs: none;
- PR #344 merged successfully;
- PR #344 frozen head: `1f5a5c67265464949c2358961f9cf385a673948a`;
- exact-head CI #1170: SUCCESS;
- frozen review: PASS / BLOCKER 0 / FOLLOW-UP 0;
- post-main CI #1171: SUCCESS;
- Pages #1624: SUCCESS;
- Deploy Staging Worker #6 / run `32022424046`: SUCCESS on exact main source;
- staging Worker Version ID: `3198a37d-9882-4e68-b40d-edb7e01ed6c9`;
- staging runtime contract: release `4.12` / API `2.65` / schema `3`;
- Worker regression suite in the staging run: 261 / 261 passed;
- stable staging deployment + restore route readiness required 11 attempts to obtain 3 consecutive exact full-contract passes;
- authenticated live staging restore smoke: PASS;
- live staging CORS isolation: PASS;
- production primary tenant was not used for the restore write smoke.

Last previously verified production Worker source was `f93dbbed3f67ce4e8c9d808d286f2c0096c1e8ee`, Worker Version ID `ebcbdd35-3f5d-40b9-bb97-aef4a25ef706`, release `4.12` / API `2.65` / schema `3`. **Refresh live production runtime/route capability before R3.1C enables any user-facing restore mutation; do not assume this older runtime now contains `/api/journal-restore`.**

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

The authenticated production user confirmed successful backup download. No personal backup contents/counts are versioned.

### R3.1B — Atomic Empty Restore Foundation

Status: **CLOSED / BACKEND + ISOLATED STAGING VERIFIED**.

Delivered authority path:

```text
backup v1
→ strict restore validation
→ empty-destination requirement
→ authenticated tenant-scoped atomic Worker restore
→ durable restore-session idempotency guard
→ authoritative server readback
→ replay/conflict/non-empty fail-closed semantics
```

Live staging evidence proves:

- atomic restore into an empty tenant;
- server-authoritative records/cash readback;
- exact replay deduplication;
- changed-payload same-key conflict rejection;
- second restore against non-empty destination rejection;
- unconditional owned-data cleanup;
- completed-session replay remains a no-op after cleanup;
- browser-origin isolation remains intact;
- deployment propagation is now gated by three consecutive exact-source version/health/restore-route checks before credentials or mutation.

Important retained boundary:

- `JournalRestoreButton.vue` is still preview-only;
- the execute button remains disabled by design;
- no production user-facing restore write should be activated until R3.1C verifies/deploys live production capability.

---

## 2. Primary Active Batch

### Phase

`R3 — Universal Data Gateway`

### Batch

`R3.1C — Restore Execution UX + Production Capability Activation`

Status: **ACTIVE / READY FOR IMPLEMENTATION TRACE**

### Primary Goal

> Turn the already-reviewed backup preview and atomic empty-tenant restore backend into a safe, understandable user recovery flow, while preserving one idempotent intent across ambiguous retries and refusing to expose an execution action until the live production Worker can prove the reviewed restore route.

### Why this is next

R3.1A proves trustworthy export. R3.1B proves trustworthy atomic empty restore in isolated staging. The remaining direct user gap is execution: today the product can tell the user that a backup is ready, but the UI intentionally stops before mutation.

### Required product behavior

1. Keep strict backup-v1 validation and current-target preview before mutation.
2. Keep restore limited to an empty transaction + cash-event destination; no merge and no replace-all.
3. Require deliberate final confirmation that restoring will create durable journal rows.
4. Create one restore intent/idempotency generation per accepted backup preview and retain it across retry of the same intent.
5. Do not generate a fresh key merely because a request timed out or the user retries an ambiguous result.
6. Reset the restore intent only when the selected backup/preview materially changes or the operation reaches a terminal outcome that requires a new intent.
7. Surface server fail-closed classifications clearly: route/capability unavailable, auth, destination-not-empty, idempotency conflict, validation/schema, network ambiguity, and database failure.
8. After accepted restore, refetch records and cash events authoritatively and verify expected counts/portable fields before declaring success.
9. Trigger the normal calculation lifecycle after committed readback; never import derived analytics/snapshots from the backup.
10. Preserve current user journal if any precondition fails.
11. If live production restore capability is absent, show a clear unavailable state rather than sending a broken POST.

### Production activation gate

Before enabling the execute path in production:

- refresh live production Worker source and `/api/journal-restore` route capability;
- verify production D1 has the additive `journal_restore_sessions` migration;
- deploy only through the existing reviewed production Worker activation path if runtime is behind;
- use non-mutating route/readiness proof before any user write;
- do not attempt destructive/empty-restore smoke against the user's populated primary tenant;
- production verification may safely prove route identity, auth/fail-closed behavior, and no mutation on non-empty destination.

### Initial exit criteria

R3.1C may close only when:

1. frontend execution is reachable only after a valid executable preview;
2. same restore intent preserves one idempotency key across ambiguous retries;
3. explicit confirmation precedes mutation;
4. timeout/retry cannot duplicate financial events;
5. non-empty destination remains fail-closed and non-destructive;
6. successful restore performs authoritative post-write refetch/verification;
7. normal recalculation is requested only after committed restore/readback;
8. capability-unavailable/auth/conflict/network/database states have actionable UX;
9. full exact-head CI + frozen review pass;
10. live production capability is verified before the UI is considered production-ready;
11. production verification does not endanger existing production journal data.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace current frontend auth/API/mutation orchestration → define stable restore-intent lifecycle → verify live production restore capability → implement the smallest execution UX slice.
- **NEXT:** exact-head CI/frozen review → production capability activation/deployment if required → non-destructive live verification → close R3.1C.
- **BACKLOG:** staging metadata-display drift cleanup; broker-neutral CSV/adapters; automated reconciliation preview; external-cash migration guidance; minimal strategy metadata; whole-account performance methodology only if separately justified.
- **REJECT:** merge restore, replace-all, silent deletes, fresh idempotency key on ambiguous retry, guessed financial facts, importing credentials/server hashes/derived snapshots, unrelated refactor.

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

### Restore

```text
user-selected backup
→ strict local validation
→ authoritative current-target read
→ empty-target/executable preview
→ explicit confirmation
→ one durable retry-safe restore intent
→ authenticated atomic Worker restore
→ authoritative records/cash readback
→ normal recalculation lifecycle
→ success UX
```

No stage may infer missing financial facts or silently merge/delete/replace current data.

---

## 4. Immediate next actions

1. Read `JournalRestoreButton.vue`, `journalRestorePreview.js`, API/auth utilities, store refresh/recalculation path, and frontend restore tests.
2. Verify current live production Worker source and whether `GET /api/journal-restore` returns the reviewed non-mutating 405 contract on that exact source.
3. Verify production migration/runtime authority for `journal_restore_sessions` before enabling mutation.
4. Define a frontend restore-intent state machine that retains one key across timeout/ambiguous retry.
5. Add execution service contract + unit tests before UI wiring.
6. Add explicit confirmation and actionable terminal/ambiguous state UX without weakening empty-target rules.
7. Refetch/verify durable rows after success, then invoke existing normal recalculation path.
8. Use Draft PR + exact-head full CI + frozen independent review.
9. If production Worker is behind, use the existing reviewed deployment process rather than creating a second deployment path.
10. Close R3.1C only after non-destructive production capability evidence.

---

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, CI, Pages, Worker/runtime truth.
3. Keep R3.1C as the only Primary Active Batch unless newer production evidence materially changes priority.
4. Preserve recovery points and exact-head review discipline.
5. Reopen closed R2/R3.1A/R3.1B work only for new material evidence.
