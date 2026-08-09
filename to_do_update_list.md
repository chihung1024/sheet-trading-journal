# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **Purpose:** This root-level file is the first-read handoff for any future AI or maintainer continuing this repository. It exists so work can continue correctly even when a chat/session is truncated or unavailable.
>
> **Update rule:** after every material execution step — implementation commit, test result, CI result, PR review, merge, production smoke, recovery ref, blocker, or scope decision — update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

## 0. Mandatory first-read / operating rules

Before changing code, a future AI or maintainer must:

1. Read this file first.
2. Read `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md` for the current product-integrity contract.
3. Re-read current `main`, the active PR head, CI status, review threads, and relevant recovery refs instead of trusting stale chat context.
4. Continue only the **current active gate** unless the user explicitly changes priority.
5. Use the sequence: **pre-change recovery → scoped branch/PR → tests/CI → independent diff review → review/thread check → main-drift check → exact-head merge → post-main CI → post-change recovery**.
6. Do not weaken validation, market/FX integrity, financial semantics, mutation ambiguity handling, recovery gates, or coverage merely to make CI pass.
7. Do not introduce Schema 3 inside Gates A–D unless a later fresh architecture review explicitly authorizes it.
8. Do not deploy the production Worker merely because repository source changed. Production activation remains separately governed.
9. Do not reopen the historical D3D governance investigation during ordinary feature work unless production activation is explicitly requested.
10. Keep this file current. A completed step without a corresponding update here is considered an incomplete handoff.

---

# 1. Current authoritative state

## Repository

- Repository: `chihung1024/sheet-trading-journal`
- Current protected `main`: `03242d00082067333cf77ffa424094b8936b406c`
- Current product-integrity program: post-D3D correctness / reliability sequence
- Current D1 line: **Schema 2**
- Worker source contract remains release `4.07` / API `2.60` / required schema `2` unless a separately governed production deployment changes runtime.

## Current active work

- **Active phase:** Gate C — Schema-2 transaction integrity preflight
- Work branch: `pr-gate-c-transaction-integrity-preflight`
- Qualification base / exact Gate-B merged main: `03242d00082067333cf77ffa424094b8936b406c`
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`
- Gate C implementation PR: **not opened yet**; first task is audit/evidence before enforcement.

---

# 2. Completed phases

| Phase | Status | Main evidence / outcome |
|---|---|---|
| P1 — source-record and required market-data integrity | ✅ completed | PR #133 |
| P2 — dividend semantic unification | ✅ completed | PR #134 |
| P3 — currency-aware valuation / FX dimensional integrity | ✅ completed | PR #135 |
| P4A — XIRR validity / precision / valuation-date semantics | ✅ completed | PR #136 |
| P4B — Modified Dietz / linked-TWR reliability | ✅ completed with residual | PR #137 |
| P5A — `fetchAll()` single-flight / truthful load contract | ✅ completed | PR #138 |
| P5B — stale/read reliability UX and structured anomalies | ✅ completed | PR #139 |
| P5C1 — committed / rejected / ambiguous mutation outcomes | ✅ completed | PR #140 |
| P5C2 — GroupManager partial mutation truth | ✅ completed | PR #141 |
| P5C3A — HTTP 5xx mutation ambiguity truth | ✅ completed | PR #142 |
| Calculation failure observability | ✅ completed | PR #143 |
| P6A — cross-tab authentication generation sync | ✅ completed | PR #144 |
| P6B — non-destructive pending calculation reads | ✅ completed | PR #145 |
| P6D — tenant/job-scoped cross-tab poll claims | ✅ completed | PR #146 |
| Launch-day market bootstrap | ✅ completed | PR #147 |
| Gate A / P6C — generation-safe pending calculation recovery | ✅ completed | PR #148 → merge `f3c55f4...` |
| Gate B / P5C3B — Worker DELETE atomicity | ✅ completed | PR #149 → merge `03242d0...` |

## Gate A closeout evidence

- PR #148 final exact head: `80d417c125797020fab1b6be401084049f2e25e3`
- Merged `main`: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- Final PR CI #429: **SUCCESS**
- Post-main CI #430: **SUCCESS**
- Real production calculation smoke: `Update Portfolio Data` #3213 / run `31295494999`: **SUCCESS**
- Smoke result: 2 users succeeded, 0 failed; snapshots uploaded successfully
- Post-Gate-A recovery: `backup-post-product-integrity-p6c-f3c55f4`

## Gate B closeout evidence

- PR: #149
- Qualification base: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- Pre-change recovery: `backup-pre-gate-b-atomic-delete-f3c55f4`
- Final exact PR head: `439e9ed39647ccd5885a2cc02a6850712c30708a`
- Final exact-head CI #433 / run `31296056184`: **SUCCESS**
- Review submissions: 0
- Unresolved review threads: 0
- Immediately-before-merge main drift: none
- Exact-head merge commit: `03242d00082067333cf77ffa424094b8936b406c`
- Post-main CI #434 / run `31296121054`: **SUCCESS**
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`
- Production Worker deployment: **not performed**; not part of Gate B.

### Gate B result

`DELETE /api/records` now uses one D1 `batch()` transaction containing:

1. guarded final-snapshot cleanup;
2. exact source-record deletion scoped by `id + user_id`;
3. post-delete remaining-record count used only for response selection.

Preserved API semantics:

- missing record → `404 NOT_FOUND`;
- non-last record → `{ success: true, deleted: 1 }`;
- last record → `{ success: true, message: "RELOAD_UI" }`;
- malformed/invalid D1 result → fail closed as `DATABASE_ERROR`;
- impossible delete cardinality → fail closed as `DATABASE_ERROR`.

Dedicated regression file: `tests/worker_atomic_delete.test.mjs`.

### Legacy GitHub Pages note

Legacy GitHub-managed Pages can show inconsistent/stuck states while the authoritative production frontend remains Cloudflare Pages (`sheet-trading-journal.pages.dev`). Do not change application code merely to make the legacy GitHub Pages status green.

---

# 3. ACTIVE — Gate C / Schema-2 transaction integrity preflight

Status: **🟠 ACTIVE — audit first, then enforce**

## Goal

Audit real Schema-2 transaction integrity end-to-end and establish deterministic, fail-closed preflight behavior without changing the D1 schema in the initial slice.

The first Gate C work is **evidence gathering**, not an immediate behavior switch.

## Authorized scope

- transaction preparation / ordering audit;
- deterministic stable sequence definition;
- running-position prefix validation;
- active-tag-group prefix validation;
- external-import provenance audit under Schema 2;
- duplicate provenance detection where safe;
- current production-data integrity audit;
- oversell-policy qualification (`CLAMP` → potential `ERROR`) only after evidence;
- regression/golden tests for ordering/integrity semantics;
- fail-closed handling of transaction-analysis integrity exceptions.

Not authorized in the first Gate C slice:

- Schema 3;
- first-class new D1 execution columns;
- broker execution table;
- broad import redesign;
- futures support;
- production Worker deployment;
- broad provider abstraction;
- unrelated UX cleanup.

## Gate C planned tasks

### C1 — Current path audit

- [x] Create pre-Gate-C recovery from exact Gate-B merged main.
- [x] Create Gate C work branch.
- [ ] Re-read `main.py` transaction normalization and stable sorting.
- [ ] Re-read calculator lot/FIFO ordering and oversell policy.
- [ ] Re-read transaction analyzer ordering and fee/tax treatment.
- [ ] Re-read Daily-P&L reconciliation ordering logic.
- [ ] Inventory every code path that can consume records for holdings / realized P&L / daily P&L / metrics.
- [ ] Write an evidence table showing where ordering semantics agree or diverge.

### C2 — Deterministic prefix-integrity contract

- [ ] Define canonical audit order: user → symbol → transaction date → stable sequence.
- [ ] Define tolerance for floating quantity residue.
- [ ] Validate cumulative `BUY - SELL` never becomes negative beyond tolerance.
- [ ] Repeat prefix validation for every active tag group.
- [ ] Make failure diagnostics identify user/symbol/date/record id/prefix quantity without leaking secrets.
- [ ] Add unit tests for exact-zero, fractional, round-trip, oversell, and tolerance-edge cases.

### C3 — Same-day ordering audit

- [ ] Verify current behavior when `Timestamp` / `Sequence` columns are absent.
- [ ] Verify whether BUY/DIV/SELL priority can reorder same-day broker execution sequence.
- [ ] Add regression fixtures for buy → sell → rebuy → sell on the same date.
- [ ] Determine whether Schema-2 `id` can be safely used as a stable fallback sequence for current records.
- [ ] Do **not** parse free-form `note` into financial ordering unless a separately reviewed structured contract exists.

### C4 — External provenance / duplicate audit

- [ ] Inventory current `note` conventions: `import_key`, IBKR order id, trade id, timestamps.
- [ ] Detect structured duplicate provenance conservatively without making `note` a calculation dependency.
- [ ] Distinguish order-level vs fill-level identity limitations.
- [ ] Document partially-filled-order risk and cross-date fill risk.
- [ ] Keep futures/derivatives excluded from Stock-journal semantics.

### C5 — Production-data qualification

- [ ] Use current production records via the existing authorized read path.
- [ ] Audit all users for prefix violations.
- [ ] Audit all active tag groups for prefix violations.
- [ ] Separate explained legacy floating residue from true oversell/data-integrity errors.
- [ ] Record exact counts and anonymized diagnostics.
- [ ] Do not switch production oversell policy if unexplained violations remain.

### C6 — Enforcement proposal

- [ ] If production audit is clean, propose calculator oversell policy change from compatibility `CLAMP` to fail-closed `ERROR`.
- [ ] Ensure secondary transaction-analysis integrity failures cannot collapse into valid-looking zero snapshots.
- [ ] Add regression/golden evidence before opening enforcement PR.
- [ ] Open a scoped Gate-C implementation PR only after audit evidence is written.
- [ ] Exact-head CI / independent diff review / review-thread check / main-drift check.
- [ ] Exact-head merge.
- [ ] Post-main CI.
- [ ] Post-Gate-C recovery.
- [ ] Update this file and activate Gate D.

## Known Gate C architecture risks

- Schema 2 has no first-class `executed_at`, `sequence`, `source`, or immutable external trade id.
- Historical same-day execution timestamps stored only in `note` are not calculation ordering fields.
- Current transaction preparation historically sorted by Date and then id if available, while calculator code can apply BUY/DIV/SELL priority when no Timestamp/Sequence is supplied.
- IBKR `order_id` may contain multiple fills and may span sessions/dates.
- Current calculation paths normalize Commission/Tax with `abs()`, so genuinely net-negative commission/rebate cannot be represented faithfully.
- Futures/derivatives require multiplier/asset-class semantics and must not be silently treated as ordinary stock records.

## Gate C explicit prohibition

Schema 3 is **not** authorized merely because these limitations exist. Gate C must first produce evidence showing what can and cannot be made safe under Schema 2.

---

# 4. QUEUED — Gate D / calculation reproducibility evidence

Status: **⚪ QUEUED — start only after Gate C closeout**

## Goal

Make a successful calculation explainable and replayable before introducing broad provider abstractions or architecture rewrites.

## Planned tasks

- [ ] Create pre-Gate-D recovery ref.
- [ ] Define a calculation/replay manifest.
- [ ] Include engine/source commit SHA.
- [ ] Include record count, maximum record id, and canonical input hash.
- [ ] Include benchmark/config hash.
- [ ] Include market-data as-of provenance.
- [ ] Include FX as-of provenance.
- [ ] Include synthetic valuation count/source.
- [ ] Include calculation timestamp.
- [ ] Add a frozen golden replay fixture.
- [ ] Golden fixture must cover transactions, prices, FX, splits, dividends, holdings, realized P&L, daily P&L, TWR, and XIRR.
- [ ] Verify replay can distinguish record changes vs vendor revisions vs FX revisions vs engine changes vs synthetic-valuation changes.
- [ ] Add CI evidence for deterministic replay.
- [ ] Independent diff review / exact-head merge qualification.
- [ ] Post-main CI and post-Gate-D recovery ref.
- [ ] Update this file with Gate-D closeout.

---

# 5. Post-Gate-D architecture review — NOT YET AUTHORIZED IMPLEMENTATION

Status: **⏸ DEFERRED / REVIEW ONLY AFTER GATE D**

A fresh architecture review is required before implementing any of the following.

## Candidate A — Schema-3 execution identity / broker ingestion

Potential additive `records` fields previously identified:

- `source`
- `external_id`
- `order_id`
- `executed_at_utc`
- `currency`
- `asset_class`
- `contract_multiplier`
- unique partial index on `(user_id, source, external_id)` when external id is present

Potential stronger design:

- immutable `broker_executions` table containing broker/account/external trade id/order id/symbol/side/qty/price/commission/tax/multiplier/exchange/executed-at/trade-date/raw JSON;
- unique immutable broker execution identity;
- normalization/materialization into the calculation ledger.

Do not implement until the post-Gate-D review explicitly selects a design and the Schema-3 recovery gate is satisfied.

## Candidate B — canonical lot-ledger consolidation

Possible future consolidation of calculator, transaction analyzer, and daily-P&L lot/order semantics. Not authorized yet.

## Candidate C — broad market-data provider abstraction

Do not start until calculation reproducibility exists. Provider abstraction without replay evidence can make provenance harder to audit.

## Candidate D — broad cleanup / coverage / dead-code / typing refactor

Keep deferred until higher-value correctness gates are closed.

---

# 6. Historical D3D production-governance status

Status: **⏸ intentionally deferred for ordinary product work**

The D3D investigation previously established fail-closed production deployment governance. Do not reopen it automatically.

Key deferred items include:

- production identity evidence dispatch;
- N58 production frontend legacy fallback removal;
- N61 live production CSP proof;
- N64 authoritative production D1 identity pinning;
- N62 staging-audience OAuth rejection proof;
- N69 least-privilege Cloudflare audit credential hardening;
- N59/N60 GitHub review/admin-bypass hardening;
- RISK-032 long-term Actions artifact retention;
- Recovery Evidence Gate / any future Schema 3 activation.

Resume only when preparing a production activation, Schema-3 migration, or when the user explicitly asks.

Historical navigation file: `docs/governance/V5_CURRENT_HANDOFF.md`.

---

# 7. Known residuals that remain after completed phases

These are real but are **not permission to bypass the active gate order**.

## P4B residual

Published history persists net daily cash flow. A zero-start day with offsetting intraday flows cannot be reconstructed as gross/order-aware Modified Dietz timing from published history alone.

## External broker execution identity residual

Schema 2 does not have first-class immutable broker execution identity or execution timestamp/sequence. Current structured import provenance is metadata, commonly in `note`, not part of the calculation field contract.

## Same-day ordering residual

Current transaction preparation does not promote execution time from `note` into calculator `Timestamp` / `Sequence`. Same-day FIFO/accounting can therefore diverge from broker execution order for round trips even when final net quantity reconciles.

## Commission rebate residual

Current calculation paths normalize commission/tax with `abs()`. A genuinely net-negative broker commission/rebate cannot be represented faithfully under the current record/calculation contract.

## Futures / derivatives residual

Current Stock journal schema does not have first-class asset class and contract multiplier. Futures such as MCL/SIC must not be imported as ordinary equities.

---

# 8. Production / deployment boundaries

Unless separately authorized:

- repository merge ≠ production Worker deployment;
- D1 migration ≠ allowed unless explicitly in scope and recovery gate satisfied;
- Cloudflare production activation remains governed separately;
- current product-integrity gates should not mutate production D1 directly;
- do not use an unavailable Cloudflare connector as if direct D1 access had been proven.

Any future production activation must freshly re-read current deployment contracts, Environment/ruleset state, exact protected-main SHA, and fresh Cloudflare identity evidence.

---

# 9. External broker import notes for future work

These are constraints for later transaction-integrity/import work, not permission to redesign Gate C.

- Use IBKR `DAYS_7` rather than `TODAY` alone when reconstructing overnight/recent activity because `TODAY` can omit intermediate fills/orders.
- Reconcile trades with current positions before declaring an import complete.
- One IBKR `order_id` can contain multiple fills with different `trade_id`, size, price, exchange, and commission.
- Weighted-average price is appropriate for aggregating completed stock-order fills; commissions must be aggregated separately.
- Order-level note-based `import_key` is not database-enforced idempotency.
- Importing a partially filled order and later guarding only by order id can silently skip later fills.
- Per-fill immutable `trade_id` ingestion is more robust, but exact same-day sequencing still requires a first-class execution time/sequence contract.
- Futures remain excluded from the Stock journal until multiplier/asset-class semantics exist.

---

# 10. Required update format after every execution step

For each material step, update the relevant phase section and record at minimum:

- **Date/time**
- **Phase / Gate**
- **Action executed**
- **Branch / PR**
- **Exact SHA**
- **CI/run id + result**
- **Review/thread state**
- **Recovery ref created**
- **Observed blocker or anomaly**
- **Decision taken**
- **Exact next action**

## Execution log

### 2026-08-09 — Gate A closeout

- Action: verified real current-main `Update Portfolio Data` smoke after PR #148 merge.
- Main: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`.
- Run: #3213 / `31295494999`.
- Result: SUCCESS; 2 users succeeded, 0 failed; snapshots uploaded.
- Decision: Gate A closed. Legacy GitHub Pages stuck state recorded as non-authoritative external anomaly.
- Next: Gate B.

### 2026-08-09 — Gate B implementation and closeout

- Pre-change recovery: `backup-pre-gate-b-atomic-delete-f3c55f4`.
- Branch: `pr-gate-b-atomic-record-delete`.
- PR: #149.
- Implementation: atomic `recordsRepository.deleteAtomic()` using one D1 batch; guarded final-snapshot cleanup + record delete + remaining count.
- Dedicated test file: `tests/worker_atomic_delete.test.mjs`.
- CI #431 / `31295903744`: SUCCESS.
- Independent review found missing explicit fail-closed tests for malformed batch/cardinality anomalies.
- Additional test head: `a8f672537c6cfc1fb857d088752abe6633e831e8`.
- CI #432 / `31295960816`: SUCCESS.
- User required persistent root handoff file; `to_do_update_list.md` added.
- Final PR head: `439e9ed39647ccd5885a2cc02a6850712c30708a`.
- Final exact-head CI #433 / `31296056184`: SUCCESS.
- Changed-file scope: `worker.js`, `tests/worker_atomic_delete.test.mjs`, `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`, `to_do_update_list.md` only.
- Review submissions: 0; unresolved threads: 0.
- Main drift: none immediately before merge.
- Merge: `03242d00082067333cf77ffa424094b8936b406c`.
- Post-main CI #434 / `31296121054`: SUCCESS.
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`.
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`.
- Decision: Gate B completed; no production Worker deployment.
- Next: Gate C audit-first transaction-integrity preflight.

### 2026-08-09 — Gate C activation

- Qualification base: `03242d00082067333cf77ffa424094b8936b406c`.
- Recovery: `backup-pre-gate-c-03242d0`.
- Work branch: `pr-gate-c-transaction-integrity-preflight`.
- State: audit phase started; no behavior/schema change yet.
- **Exact next action:** inspect all transaction-consumer ordering/oversell paths and produce an evidence table before implementing enforcement.

---

# 11. Immediate next action for the next AI

**Gate C is active. Do not start Gate D or Schema 3.**

Perform these steps in order:

1. Read `main.py` transaction preparation and sorting.
2. Read `journal_engine/core/calculator.py` transaction ordering, FIFO, and oversell handling.
3. Read transaction analyzer and daily-P&L reconciler ordering/lot behavior.
4. Search the repository for every records/transaction consumer affecting holdings, realized P&L, daily P&L, or portfolio metrics.
5. Build a concise divergence/evidence matrix: input columns, sort keys, tie-breaker, oversell policy, commission/tax semantics, failure behavior.
6. Define the minimal Schema-2 prefix-integrity preflight contract.
7. Add tests only after the contract is explicit.
8. Update this file with the audit findings before opening an implementation PR.

That sequence is the authoritative continuation unless the user explicitly changes priorities.
