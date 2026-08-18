# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → fresh GitHub remote truth. Remote `main` / open PR / exact-head CI / deployment/runtime truth overrides this snapshot.
>
> Stable closeout evidence lives under `docs/engineering/`; this file is a concise live handoff, not a history dump.
> Update Portfolio Data #3317 RCA: `docs/engineering/update-portfolio-3317-systemic-rca.md`.

Last updated: **2026-08-18 Asia/Taipei**

Current line: **P0 — Update Portfolio Data #3317 is CLOSED with production proof. The single Primary Active Batch returns to R3.3B — Safe Ambiguous Import Retry. Protected `main@ae418ca2eb2efa73190395e9a7951c4badbeba20` contains the final systemic market-data/XIRR remediation and protected production synthetic-record reconciliation.**

---

## 0. Operating doctrine

1. Product functionality and UX are highest priority.
2. Keep one Primary Active Batch; technical work exists only to enable product correctness, safety, maintainability, or UX.
3. Debug from evidence/root cause, check same-class impact, and add regression prevention; do not patch individual symbols, dates, users, or specimens when a general invariant can be fixed.
4. Financial/data correctness is fail-closed. Browser convenience state never becomes a second accounting, FX, tax, recovery, market-data, or transaction-identity authority.
5. Important work uses Draft PR → exact-head CI → frozen review → expected-head merge → authoritative post-main verification where available.
6. Prefer deterministic automation. **AI 管流程，不管帳**.
7. Never infer cash, currency, chronology, lots, tax, broker intent, transaction identity, or other financial facts absent from authoritative data.
8. Closed batches remain closed unless new material evidence appears.
9. Prefer direct user utility over optional methodology expansion.
10. Public repo evidence must not unnecessarily record personal financial values, credentials, backup contents, broker file contents, tenant identities, or record IDs.

---

## 1. Current authoritative state

At this handoff snapshot:

- protected `main`: `ae418ca2eb2efa73190395e9a7951c4badbeba20`;
- PR #382 (`feat: add protected production synthetic-record reconciliation`) merged from frozen exact head `bfe30022cda9b4bb7d14706f77e50aa8314359a2`;
- PR #382 exact-head CI #1371: **SUCCESS** across Frontend, Python + coverage governance, and Worker/D1/security;
- frozen review for #382: **BLOCKER 0**;
- Production Test Record Reconciliation run #1 / run ID `32156834629`: **SUCCESS** on merged `main@ae418ca2...`;
- reconciliation evidence: **before=1, tenants=1, changed=1, after=0, tenant records remaining=0**;
- post-cleanup Update Portfolio Data #3332 / run ID `32157227218`: **SUCCESS** on merged `main@ae418ca2...`;
- #3332 fetched **264 transactions**, processed **2 real users**, downloaded **58 market symbols**, uploaded both portfolio snapshots, final **success 2 / failure 0**;
- `DELETE /api/records` remains **user-only**; the cleanup architecture did not expand Worker authorization;
- the authenticated production idempotency smoke still requires Google OAuth secrets that are not currently configured in the `production` environment, but synthetic-test-data lifecycle cleanup no longer depends on that optional smoke path;
- R3.3A Import Reconciliation Receipt remains **CLOSED / MERGED** as PR #365;
- R3.3B Safe Ambiguous Import Retry is now the single Primary Active Batch.

### Stable market-data / performance authority after #3317

```text
Yahoo freshness transport
→ structurally valid intraday representations
→ unique multi-granularity price quorum
→ row-level authority composition
→ canonical market-data validator
→ portfolio calculation
```

- no ticker/date/security-specific recovery branches;
- no widened price tolerance, alternate-provider substitution, guessed price, or unbounded retry;
- zero-action malformed price rows use same-provider intraday quorum;
- dividend-only rows use their existing stable action valuation authority;
- unsupported action rows remain fail-closed;
- intraday evidence never invents Volume or corporate actions;
- XIRR calculation and upload validation share the same supported safety domain; out-of-domain solver results become explicit `undefined`, not clipped values.

### Stable production synthetic-data lifecycle

```text
shared exact ownership contract
→ candidate discovery
→ whole-tenant purity verification
→ frozen record/owner/payload snapshot
→ reviewer-protected production D1 identity gate
→ one atomic cardinality-guarded mutation
→ sanitized zero-residual evidence
```

Any forged smoke-looking row, mixed real tenant data, duplicate legacy marker, invalid owner, snapshot drift, or last-moment tenant mutation fails closed.

---

## 2. P0 closeout — Update Portfolio Data #3317

Status: **CLOSED / PRODUCTION VERIFIED**

The incident was not a single-symbol bug. The systemic chain was:

1. Yahoo/yfinance latest daily rows could contain NaN selected prices or internally impossible OHLC while other fields remained populated.
2. `repair=True` and optional SciPy were not a sufficient trusted authority.
3. Raw intraday reconstruction removed dependence on malformed daily price anchors.
4. Sparse fully-empty intraday buckets required explicit zero-volume semantics.
5. yfinance historical caching proved that identical retries were not necessarily fresh observations, so freshness transport was separated from price semantics.
6. Fixed-pair interval logic was replaced by a generic unique multi-granularity quorum.
7. Whole-frame recovery was replaced by row-level authority composition so independent malformed row classes cannot suppress each other.
8. XIRR calculation and validation were unified under one supported safety domain.
9. A legacy production synthetic test record exposed a separate lifecycle gap; shared ownership plus reviewer-protected atomic D1 reconciliation now handles this class without weakening user-delete authorization.

Key merges:

- #369 → `7642ace742eef34e1ab408c56384c3226f0a984e`
- #370 → `533b076e4beba34b72549f5bb39b9588bb14724f`
- #371 → `e89cf39463c69e83ffa1237554ac7d94aafaa44d`
- #372 → `e73aee8840b950d22bce0a58cbed316459cb53bc`
- #373 → `f7bd7b7dc2e0ae28673fca11bae88f72d138c2f0`
- #376 → `0537d73e0674f09a9b3f671f15caa089a75273c7`
- #382 → `ae418ca2eb2efa73190395e9a7951c4badbeba20`

Final gates:

- exact-head CI #1371: **SUCCESS**;
- Production Test Record Reconciliation #1 / `32156834629`: **SUCCESS**, one exact-owned legacy row removed atomically, zero residual tenant rows;
- Update Portfolio Data #3332 / `32157227218`: **SUCCESS**, 264 records / 2 users / 58 symbols / snapshots uploaded / 2 success / 0 failure.

Do not reopen #3317 for isolated upstream market-data noise unless new evidence disproves one of the generic invariants above. Full RCA remains in `docs/engineering/update-portfolio-3317-systemic-rca.md`.

---

## 3. Stable product boundaries

### Transaction mutation

```text
explicit durable intent
→ tenant-scoped idempotent Worker write
→ authoritative readback
→ calculation lifecycle
→ Python snapshot publication
→ browser presentation
```

### Cash and account value

- explicit cash events are authoritative;
- cash completeness is fail-closed;
- whole-account value is published only when securities + cash evidence is complete;
- ambiguous/missing cash or FX evidence never gets guessed.

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

Still rejected: merge restore, replace-all, silent delete, importing derived snapshots, fresh idempotency identity on ambiguous retry, or destructive smoke against a populated real account.

### Broker-neutral import

```text
explicit source semantics
→ strict Canonical/mapped preview
→ optional explicit saved mapping convenience
→ explicit source profile + confirmation
→ source-bound stable idempotency
→ existing durable record-create writer
→ shared batch outcome / readback / recalculation
```

Import receipt/retry state is never accounting, duplicate, or transaction-identity authority.

---

## 4. Closed portability checkpoints

- R3.2A Canonical Trade CSV v1 Preview — PR #355 — **CLOSED**
- R3.2B Canonical CSV Template — PR #356 — **CLOSED**
- R3.2C Safe Canonical CSV Execution — PR #358 — **CLOSED**
- R3.2D Explicit Broker Column Mapping Preview — PR #360 — **CLOSED**
- R3.2E Safe Mapped Broker CSV Execution — PR #361 — **CLOSED**
- R3.2F Saved Mapping Presets — PR #363 — **CLOSED**
- R3.3A Import Reconciliation Receipt — PR #365 — **CLOSED**

R3.3A guarantees a memory-only ordered receipt of `created`, `replayed`, `rejected`, and `ambiguous` outcomes without persisting broker contents, idempotency keys, account IDs, full notes, or internal error payloads.

---

## 5. Primary Active Batch — R3.3B Safe Ambiguous Import Retry

Phase: `R3 — Portability / Automation`

Status: **ACTIVE / CONTRACT PRESERVED**

### Primary Goal

> When an import stops on an ambiguous server response, let the user safely retry the exact same still-open in-memory source with one explicit action, replaying already-confirmed entries through the existing stable idempotency contract instead of forcing manual file re-selection.

### Working contract

1. Retry is offered only for `status === 'partial_failure'` with `failure.outcomeAmbiguous === true`.
2. Do not offer retry for committed/replayed results, sync-only warnings, or explicit rejection.
3. Retry reuses the exact current in-memory source/profile/mapping inputs and existing preparer/writer; never reconstruct transactions from receipt rows.
4. Retry starts the whole exact batch from the beginning. Already-confirmed entries must replay through the same stable idempotency keys; the ambiguous item is re-resolved and later entries may continue.
5. Never generate a fresh identity for an ambiguous entry and never use economic-field similarity as duplicate authority.
6. Canonical/mapped retry requires the existing source-profile/readiness contract; mapped retry requires unchanged current mapping.
7. IBKR retry is disabled when the profile is edited but not revalidated (`profileDirty`).
8. Shared receipt UX may expose the retry action, but each parent importer remains responsible for proving the exact source is still in memory and eligible.
9. Explicit user action is required. No timed/background automatic mutation loop.
10. No Worker/D1/schema/accounting/FX/idempotency change unless current-main tracing proves the existing stable-key reproduction contract is insufficient.

### In scope

- one shared ambiguous-retry eligibility policy;
- consistent retry UX across Canonical, mapped, and IBKR imports;
- reuse existing preparation + durable batch execution paths;
- regression tests for ambiguity-only visibility, unchanged-source gating, stable-key reuse, profile/mapping dirtiness, and no retry for sync warnings/explicit rejection;
- full Frontend/Python/Worker CI because shared import code is security-sensitive;
- frozen review → expected-head merge → stable checkpoint.

### Out of scope

- retrying explicit rejection without user correction;
- automatic retry loops;
- storing broker source/receipt for future sessions;
- reconstructing mutation payloads from receipt rows;
- receipt export/download;
- new broker adapters;
- fuzzy/AI mapping inference;
- unrelated Worker/D1/accounting/FX refactor.

### Immediate next actions

1. Refresh PR #367 and its branch against current `main` remote truth.
2. Re-trace exact source → stable-key reproduction for Canonical, mapped, and IBKR under current code; do not rely on pre-P0 assumptions.
3. Reproduce the last CI failure from exact remote head and classify whether it is production logic, test contract, or main-drift integration.
4. Implement only the smallest general contract needed after the trace.
5. Run full exact-head CI, frozen review, expected-head merge, then product-level verification.

---

## 6. Fresh-session startup

1. Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file.
2. Refresh protected `main`, open PRs, exact-head CI, and deployment/runtime truth.
3. Treat #3317 as closed unless new material evidence disproves its generic recovery invariants.
4. Confirm PR #365 remains merged; do not reopen R3.3A without new material evidence.
5. Keep R3.3B as the single Primary Active Batch.
6. Before any retry mutation work, verify Canonical/mapped/IBKR exact source → stable-key reproduction from current `main`.
7. Preserve exact-head CI / frozen-review / expected-head merge discipline.
8. Do not change `AI_PROJECT_PLAYBOOK.md` for feature-specific retry decisions unless a truly project-wide rule changes.
