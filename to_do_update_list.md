# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / CI / Pages / Worker runtime truth overrides this snapshot.
>
> Stable closeout evidence is versioned under `docs/engineering/`; this file is a concise live handoff rather than a history dump.

Last updated: **2026-08-17 Asia/Taipei**

Current line: **R1, R2.1–R2.6A, R3.1A–R3.1C and Desktop Visibility D1–D5 are closed at their reviewed boundaries. Safe empty-account journal restore is activated in protected production. The desktop layout pass is complete and should not be reopened for cosmetic compression alone. The next Primary Active Batch is R3.2 — Broker-Neutral Import Preview Foundation, beginning with authority/contract tracing before any new write path.**

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

At this handoff snapshot:

- protected frontend `main`: `c2928b6c59291f82c4eda901f78f39eaecc124e4`;
- open PRs after D5 merge: none;
- post-main CI #1194: SUCCESS;
- Pages #1633: SUCCESS on exact `main@c2928b6c59291f82c4eda901f78f39eaecc124e4`;
- production Worker runtime source remains the reviewed R3.1C source `aaa1e39819f0f0c56d37aa02b399cc13738072eb` because Desktop Visibility D1–D5 are frontend-only;
- Worker runtime contract remains release `4.12` / API `2.65` / schema authority `3`;
- production additive migration `0006_journal_restore_sessions.sql` is applied;
- authenticated tenant-scoped empty-account atomic `/api/journal-restore` capability is activated through the canonical deployment path.

### Closed product boundaries

R2 cash/account value:

- explicit cash events are authoritative;
- shadow cash completeness is fail-closed;
- `account_value_preview` is production-ready;
- existing Daily P&L/TWR/XIRR/performance semantics remain unchanged;
- whole-account performance cutover remains a separate future methodology decision.

R3.1 backup/restore:

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

Still rejected: merge restore, replace-all, silent delete, importing derived snapshots, fresh idempotency key on ambiguous retry, destructive production smoke against populated user data.

R3.1C production activation evidence remains versioned in the prior closeout documents; production deployment and D1 migration completed successfully.

---

## 2. Desktop Visibility closeout

Detailed evidence:

- `docs/engineering/R3_1C_AND_DESKTOP_VISIBILITY_D1_D3_CLOSEOUT_2026-08-17.md`
- `docs/engineering/DESKTOP_VISIBILITY_D4_D5_CLOSEOUT_2026-08-17.md`

### D1 — Workspace Reclaim

Status: **CLOSED / PAGES VERIFIED**.

- header and outer desktop rhythm compressed without typography changes;
- persistent transaction rail reduced to 330–350px;
- wide-desktop existing navigation row uses sticky-header center;
- PR #348 / Pages #1628.

### D2 — Overview Information Hierarchy

Status: **CLOSED / PAGES VERIFIED**.

- >=1600px portfolio summary + daily context compose side-by-side;
- account-value / detailed P&L explanation / chart remain authoritative and visible;
- chart height is viewport-aware;
- PR #349 / Pages #1629.

### D3 — Data Work Surfaces

Status: **CLOSED / PAGES VERIFIED**.

- records toolbar/counts and holdings concentration chrome tightened;
- holdings table viewport expanded;
- all search/filter/import/backup/refresh controls remain;
- PR #350 / Pages #1630.

### D4 — Reversible Desktop Focus Mode

Status: **CLOSED / PAGES VERIFIED**.

- one visible `專注檢視` / `顯示交易區` control reclaims the desktop transaction-rail width;
- the same single `TradeForm` remains mounted and authoritative;
- record edit reopens the rail before `setupForm(record)`;
- focus state is memory-only;
- runtime mobile boundary now matches the existing CSS authority at `<=1024px`;
- exact-head CI #1189 / post-main CI #1190 / Pages #1632: SUCCESS;
- merged `main@d3278c67b6cfeda468f3503729db82b5f8bfef96`.

### D5 — Management Workspace Composition

Status: **CLOSED / PAGES VERIFIED**.

- dividends: desktop header/help/queue chrome tightened without removing guidance/actions;
- cash: >=1280px editor + authoritative ledger side-by-side; cash has no transaction rail;
- groups: >=1600px rename + assignment workspace side-by-side so the seven-column table still has safe width beside the rail;
- >=1680px existing strategy cards use three columns;
- layout layer adds no `font-size`, `!important`, or `display:none` rules;
- exact-head CI #1193 / post-main CI #1194 / Pages #1633: SUCCESS;
- merged `main@c2928b6c59291f82c4eda901f78f39eaecc124e4`.

Desktop Visibility D1–D5 is complete. Do not continue shrinking spacing or adding responsive modes without concrete production evidence of a usability problem.

---

## 3. Primary Active Batch

### Phase

`R3 — Portability / Automation`

### Batch

`R3.2 — Broker-Neutral Import Preview Foundation`

Status: **ACTIVE / ARCHITECTURE TRACE FIRST**

### Primary Goal

> Let a user bring a broker-neutral transaction file into the journal through a safe, deterministic preview that explains what can be imported and what is ambiguous before any durable mutation occurs.

### Why this is next

The project now has durable backup/restore and an existing IBKR-specific trade import surface. The next direct product gap is portability from other broker/export formats without turning guessed field mappings into authoritative financial writes. A zero-write preview creates immediate UX value and a safe foundation for later import execution.

### Required behavior before implementation is accepted

1. First slice is **zero-write preview only**; no POST/PUT/DELETE from the new broker-neutral adapter.
2. Reuse existing transaction validation/business-field contracts where possible; do not create a second accounting model.
3. Input parsing must be explicit and deterministic. Unknown headers, unsupported transaction types, missing currency/date/symbol/quantity/price semantics, or ambiguous sign conventions must fail closed or require explicit user mapping.
4. Preserve legitimate duplicate transaction multiplicity; never deduplicate by loose field similarity.
5. Do not infer broker intent, lots, tax, FX, or chronology from absent data.
6. Preview must distinguish ready rows, blocked rows, warnings, and unsupported fields before execution is ever designed.
7. Existing IBKR import remains unchanged until the neutral contract proves useful; do not refactor working broker-specific code merely for symmetry.
8. Backup/restore contracts remain separate from external broker import contracts.
9. Add frontend/service contract tests before considering any mutation path.

### NOW / NEXT / BACKLOG / REJECT

- **NOW:** trace current `IbkrTradeImport`, transaction create validation/idempotency contracts, record API accepted durable fields, and existing CSV/file parsing utilities; identify the smallest broker-neutral preview schema.
- **NEXT:** implement deterministic local preview beside the existing import/backup controls → exact-head CI → frozen review → merge → Pages verification.
- **BACKLOG:** explicit mapping UI for unknown broker columns; adapter registry; safe import execution only after a separate idempotency/readback/partial-failure design gate; automated reconciliation preview; whole-account performance methodology only if separately justified.
- **REJECT:** AI/heuristic guesses becoming financial truth, silent sign/date/currency inference, field-similarity deduplication, browser-local accounting authority, merge/overwrite behavior disguised as import, or unrelated refactor.

---

## 4. Stable authority boundaries

Transaction mutation:

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ committed readback
→ dirty generation
→ calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

Cash:

```text
explicit user cash event
→ tenant-scoped cash CRUD
→ deterministic shadow cash derivation
→ completeness gate
→ reviewed account-value preview
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

## 5. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh `main`, open PRs, CI, Pages, and Worker/runtime truth.
3. Keep R3.2 as the single Primary Active Batch unless fresh evidence materially changes priority.
4. Preserve exact-head CI/frozen-review/expected-head merge discipline.
5. Reopen closed R2/R3.1/Desktop Visibility work only for new material evidence.
6. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific import/layout decisions.
