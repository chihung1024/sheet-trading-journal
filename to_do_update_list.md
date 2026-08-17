# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / CI / Pages / Worker runtime truth overrides this snapshot.
>
> Stable closeout evidence is versioned under `docs/engineering/`; this file is intentionally a concise live handoff rather than a history dump.

Last updated: **2026-08-17 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A, R3.1B and R3.1C are closed at their reviewed boundaries. Safe empty-account journal restore is activated in protected production. Desktop Visibility D1–D3 are also closed and Pages-verified. The next single Primary Active Batch is Desktop Visibility D4 — Focus Mode / Transaction Rail Workspace Control, beginning with interaction tracing before implementation.**

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

At the start of this handoff snapshot:

- protected frontend `main`: `c6acf86da3a5406a3850c458a7c8fb4f1621d753`;
- open PRs before this docs closeout: none;
- post-main CI #1184: SUCCESS;
- Pages #1630: SUCCESS on exact `main@c6acf86da3a5406a3850c458a7c8fb4f1621d753`;
- production Worker runtime source remains the reviewed R3.1C source `aaa1e39819f0f0c56d37aa02b399cc13738072eb` because D1–D3 are frontend-only;
- Worker runtime contract remains release `4.12` / API `2.65` / schema authority `3`;
- production additive migration `0006_journal_restore_sessions.sql` is applied;
- production authenticated tenant-scoped empty-account atomic `/api/journal-restore` capability is activated through the canonical deployment path.

### R3.1C production activation evidence

Status: **CLOSED / PRODUCTION VERIFIED**.

- PR #346 reviewed restore execution UX;
- exact runtime source `aaa1e39819f0f0c56d37aa02b399cc13738072eb`;
- Production Identity Evidence #27 / run `32030517867`: SUCCESS;
- identity artifact `9288717155`;
- activation authority PR #347 merged to `main@3cb84d6840abdd21ef8b4195efc970e810e64dcb`;
- Production Deployment Dispatch Broker #11: SUCCESS;
- Deploy Worker #14 / run `32031442311`: SUCCESS after protected production approval;
- production D1 identity passed;
- migration `0006_journal_restore_sessions.sql` applied before Worker activation;
- stable post-deploy production contract passed;
- post-deploy artifact `9289089443`.

Retained restore boundary:

```text
backup v1
→ strict local/server validation
→ empty-target requirement
→ explicit confirmation
→ one retry-safe idempotent intent
→ authenticated atomic Worker restore
→ authoritative records/cash readback
→ normal recalculation lifecycle
```

Still rejected: merge restore, replace-all, silent delete, importing derived snapshots, fresh idempotency key on ambiguous retry, destructive production smoke against populated user data.

### R2 cash/account-value boundary

Status: **CLOSED / PRODUCTION VERIFIED**.

- durable transaction currency reviewed;
- explicit cash events authoritative;
- shadow cash complete in observed production scope;
- `account_value_preview` production-ready;
- existing Daily P&L/TWR/XIRR/performance semantics remain unchanged;
- whole-account performance cutover remains a separate future methodology decision.

### R3.1A — Broker-Neutral Backup

Status: **CLOSED / PRODUCTION VERIFIED**.

```text
authenticated durable reads
→ versioned backup contract
→ deterministic user download
```

No backup contents or personal financial values are versioned in repo evidence.

### R3.1B — Atomic Empty Restore Foundation

Status: **CLOSED / ISOLATED STAGING VERIFIED**.

Staging proved atomic empty-tenant restore, authoritative readback, replay deduplication, same-key conflict rejection, non-empty fail-closed behavior, cleanup, and CORS isolation. R3.1C subsequently activated the reviewed route in production without destructive production restore testing.

---

## 2. Desktop Visibility closeout

Detailed evidence: `docs/engineering/R3_1C_AND_DESKTOP_VISIBILITY_D1_D3_CLOSEOUT_2026-08-17.md`.

### D1 — Workspace Reclaim

Status: **CLOSED / PAGES VERIFIED**.

- PR #348;
- desktop header 64px → 56px;
- tighter outer desktop rhythm;
- right transaction rail 330–350px responsive width;
- more sticky-rail vertical workspace;
- >=1680px uses the existing single navigation row in the sticky-header center instead of consuming a second in-flow row;
- mobile behavior and navigation authority unchanged;
- exact-head CI #1179 / post-main CI #1180 / Pages #1628: SUCCESS.

### D2 — Overview Information Hierarchy

Status: **CLOSED / PAGES VERIFIED**.

- PR #349;
- >=1600px portfolio summary + daily context pair side-by-side;
- account value / detailed Daily P&L explanation / loading skeleton / chart remain full width;
- desktop chart height becomes viewport-aware `clamp(360px, 44vh, 450px)`;
- source order, projection and calculation semantics unchanged;
- exact-head CI #1181 / post-main CI #1182 / Pages #1629: SUCCESS.

### D3 — Data Work Surfaces

Status: **CLOSED / PAGES VERIFIED**.

- PR #350;
- transaction toolbar/header density reduced;
- transaction counts use one inline desktop status strip;
- search/filter/import/backup/refresh controls all remain present;
- holdings concentration facts remain present with reduced non-data spacing;
- holdings table desktop viewport expanded to `clamp(480px, 62vh, 760px)`;
- mobile/tablet component behavior unchanged;
- exact-head CI #1183 / post-main CI #1184 / Pages #1630: SUCCESS.

---

## 3. Primary Active Batch

### Phase

`Desktop Visibility / Product UX`

### Batch

`D4 — Desktop Focus Mode / Transaction Rail Workspace Control`

Status: **ACTIVE / ARCHITECTURE TRACE FIRST**

### Primary Goal

> Let a desktop user intentionally reclaim the horizontal space occupied by the persistent transaction rail when reviewing dense data, without weakening the transaction create/edit flow or affecting the mobile trade sheet.

### Why this is next

D1–D3 reclaimed vertical space and improved information density without hiding content. The remaining persistent desktop space cost is the always-open 330–350px transaction rail. A reversible user-controlled focus mode can improve holdings/history work without permanently removing the fast-entry workflow.

### Required behavior before implementation is accepted

1. Desktop only; mobile sheet behavior must remain exactly as-is.
2. Default remains safe/understandable; no transaction form authority is duplicated.
3. Focus mode must be explicitly reversible from a visible control.
4. Editing a transaction from history must automatically expose the transaction form before `setupForm(record)` executes.
5. Creating/submitting a transaction must continue to use the existing `TradeForm` and store/API paths.
6. Initial implementation should be memory-only session UI state; do not add browser persistence unless later user value clearly justifies it.
7. Cash view remains single-column by its existing authority.
8. No accounting, FX, API, Worker, auth, restore or calculation changes.
9. Add contract tests for desktop-only visibility, edit auto-open behavior, and no mobile regression.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace `App.vue` desktop rail lifecycle, `RecordList @edit`, `TradeForm.setupForm/resetForm`, cash-view layout, responsive breakpoint contracts, and existing frontend tests; design the smallest reversible focus-mode state machine.
- **NEXT:** implement behind existing single `TradeForm` authority → exact-head CI → frozen review → merge → Pages verification.
- **BACKLOG:** further cross-page visual polish only if current production layout evidence identifies a concrete usability gap; broker-neutral CSV/adapters; automated reconciliation preview; whole-account performance methodology only if separately justified.
- **REJECT:** duplicate TradeForm, hidden/unreachable create/edit path, persistent UI state without need, mobile behavior drift, financial calculation changes disguised as layout work, arbitrary font shrinking, unrelated cleanup.

---

## 4. Stable authority boundaries

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

### Backup / Restore

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

### UI layout

`src/styles/product-consistency.css` is the final cross-page spacing/density layer. Typography authority remains in the existing semantic type system/component tokens. Layout CSS must not become a data, financial, persistence, or navigation authority.

---

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, CI, Pages, and Worker/runtime truth.
3. Keep D4 as the single Primary Active Batch unless fresh evidence materially changes priority.
4. Preserve exact-head CI/frozen-review/expected-head merge discipline.
5. Reopen closed R2/R3/D1–D3 work only for new material evidence.
6. Do not change `AI_PROJECT_PLAYBOOK.md` for ordinary layout-specific decisions.
