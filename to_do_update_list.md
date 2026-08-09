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
- Current protected `main`: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- Current product-integrity program: post-D3D correctness / reliability sequence
- Current D1 line: **Schema 2**
- Worker runtime contract remains on release `4.07` / API `2.60` / required schema `2` unless a separately governed deployment changes production.

## Current active work

- **Active phase:** Gate B / P5C3B — Worker `DELETE /api/records` atomicity
- Active PR: **#149**
- Branch: `pr-gate-b-atomic-record-delete`
- Qualification base: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- Pre-Gate-B recovery: `backup-pre-gate-b-atomic-delete-f3c55f4`
- Latest implementation head before adding this handoff file: `a8f672537c6cfc1fb857d088752abe6633e831e8`
- CI #431 / run `31295903744`: **SUCCESS**
- Final-head CI #432 / run `31295960816` on `a8f6725...`: **SUCCESS**
- PR review submissions at that qualification point: **0**
- Unresolved review threads at that qualification point: **0**
- `main` drift at that qualification point: **none** (`main` still `f3c55f4...`)

Because this handoff file is being added after CI #432, **PR #149 must receive a fresh exact-head CI before merge**. Do not merge based only on CI #432 after this new commit.

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

## Gate A closeout evidence

- PR #148 final exact head: `80d417c125797020fab1b6be401084049f2e25e3`
- Merged `main`: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- Final PR CI #429: **SUCCESS**
- Post-main CI #430: **SUCCESS**
- Real production calculation smoke: `Update Portfolio Data` #3213 / run `31295494999`: **SUCCESS** on exact merged SHA
- Smoke result: 2 users succeeded, 0 failed; portfolio snapshots uploaded successfully
- Post-Gate-A recovery: `backup-post-product-integrity-p6c-f3c55f4`

### Legacy GitHub Pages note

Legacy GitHub-managed Pages run #1437 entered an inconsistent external state while the authoritative production frontend remains Cloudflare Pages (`sheet-trading-journal.pages.dev`). That legacy Pages state is not treated as an application correctness blocker. Do not change application code merely to make the legacy GitHub Pages status green.

---

# 3. ACTIVE — Gate B / P5C3B Worker DELETE atomicity

Status: **🟠 ACTIVE — PR #149**

## Problem being fixed

Pre-Gate-B `DELETE /api/records` used separate database operations:

1. delete source record;
2. count remaining records;
3. if none remain, delete portfolio snapshots.

A failure after step 1 could therefore return HTTP 500 while the source record was already committed, leaving the server in a partially mutated logical state.

## Authorized scope

Only:

- Worker record-delete atomicity;
- dedicated regression tests;
- execution/handoff documentation.

Not authorized in Gate B:

- Schema 3;
- transaction-format redesign;
- POST/import idempotency;
- financial calculation changes;
- frontend mutation redesign;
- auth redesign;
- workflow redesign;
- production Worker deployment.

## Implemented design in PR #149

`recordsRepository.deleteAtomic()` uses one D1 `batch()` transaction with:

1. guarded snapshot cleanup that executes only when the exact target record exists and there is no sibling record for that user;
2. exact source record delete scoped by `id + user_id`;
3. post-delete remaining-record count used only to select the existing HTTP response contract.

This preserves:

- missing record → `404 NOT_FOUND`;
- non-last record → `{ success: true, deleted: 1 }`;
- last record → `{ success: true, message: "RELOAD_UI" }`;
- malformed/invalid D1 result → fail closed as `DATABASE_ERROR`;
- impossible multi-row delete cardinality → fail closed as `DATABASE_ERROR`.

Frontend committed/rejected/ambiguous mutation semantics remain unchanged. A transport failure after a successful atomic commit may still be client-ambiguous; Gate B only removes the internal server-side partial-state window.

## Gate B tests added

`tests/worker_atomic_delete.test.mjs` currently covers:

- one D1 batch only;
- exact-target existence guard;
- no-sibling guard for snapshot cleanup;
- missing-record definite 404;
- non-last success response;
- last-record `RELOAD_UI` response;
- injected batch failure → fail closed;
- malformed batch result → fail closed;
- impossible `changes > 1` → fail closed.

## Gate B remaining checklist

- [x] Create exact pre-change recovery ref from Gate A main.
- [x] Create scoped work branch.
- [x] Implement atomic D1 batch boundary.
- [x] Add dedicated regression tests.
- [x] Independent diff review found and closed missing malformed/cardinality test coverage.
- [x] CI #431 succeeded on initial integrated candidate.
- [x] CI #432 succeeded on `a8f6725...` after extra fail-closed tests.
- [x] Confirm no review submissions / unresolved review threads at `a8f6725...` qualification point.
- [x] Confirm `main` had not drifted from `f3c55f4...` at `a8f6725...` qualification point.
- [x] Add this persistent root handoff file per user instruction.
- [ ] Wait for **new exact-head PR CI** caused by this handoff-file commit.
- [ ] Re-check changed-file scope after the handoff-file commit.
- [ ] Re-check review submissions and unresolved inline threads.
- [ ] Re-check `main` immediately before merge.
- [ ] Mark PR ready for review if still Draft.
- [ ] Merge PR #149 with exact expected head SHA guard.
- [ ] Confirm post-main CI succeeds.
- [ ] Create `backup-post-gate-b-...` recovery ref from exact merged main.
- [ ] Update this file: mark Gate B completed and Gate C active.

## Gate B merge blockers

Do **not** merge if any of these is true:

- final exact-head CI fails or is still pending;
- active PR contains unauthorized schema/financial/frontend/auth/workflow/deployment changes;
- missing-record path can clear snapshots;
- record delete and last-record snapshot cleanup no longer share one D1 atomic batch;
- malformed result / impossible cardinality is silently accepted;
- unresolved review thread exists;
- `main` drifted and the PR has not been requalified against the new base.

---

# 4. QUEUED — Gate C / Schema-2 transaction integrity preflight

Status: **⚪ QUEUED — start only after Gate B closeout**

## Goal

Audit real Schema-2 transaction integrity first, then enforce strict behavior only if production data proves compatible. No initial schema change.

## Planned tasks

- [ ] Create pre-Gate-C recovery ref from exact Gate-B merged main.
- [ ] Audit existing transaction preparation / ordering path end-to-end.
- [ ] Define deterministic ledger order by user → symbol → date → stable sequence.
- [ ] Add running position prefix validation: `BUY - SELL` quantity must never become negative beyond documented tolerance.
- [ ] Repeat prefix-integrity validation for every active tag group.
- [ ] Audit current behavior where same-day records can be re-ordered by BUY/DIV/SELL priority when no first-class execution timestamp/sequence exists.
- [ ] Audit external-import provenance in `note` (`import_key`, order id, timestamps) without treating `note` as a financial calculation field.
- [ ] Detect duplicate structured external import provenance where possible under Schema 2.
- [ ] Audit production records for unexplained prefix violations before changing calculator oversell policy.
- [ ] Ensure secondary transaction-analysis integrity exceptions cannot be converted into apparently valid all-zero snapshots.
- [ ] Add regression/golden cases for same-day buy/sell/rebuy/resell ordering risk.
- [ ] Decide whether current production oversell compatibility `CLAMP` can safely become fail-closed `ERROR`.
- [ ] Open scoped Gate-C PR only after the audit evidence is written.
- [ ] Exact-head CI / independent diff review / merge qualification.
- [ ] Post-main CI and post-Gate-C recovery ref.
- [ ] Update this file with all Gate-C execution results.

## Known Gate C architecture risks to preserve

- Current Schema 2 has no first-class `executed_at`, `sequence`, `source`, or immutable external trade id.
- Historical same-day execution timestamps stored only in `note` are not currently calculation ordering fields.
- IBKR orders may contain multiple fills and can span sessions/dates.
- Futures/derivatives require multiplier/asset-class semantics and must not be silently treated as ordinary stock records.

## Gate C explicit prohibition

Schema 3 is **not** authorized merely because these limitations exist. Gate C must first produce evidence showing what can and cannot be made safe on Schema 2.

---

# 5. QUEUED — Gate D / calculation reproducibility evidence

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
- [ ] Verify the replay can distinguish record changes vs vendor revisions vs FX revisions vs engine changes vs synthetic-valuation changes.
- [ ] Add CI evidence for deterministic replay.
- [ ] Independent diff review / exact-head merge qualification.
- [ ] Post-main CI and post-Gate-D recovery ref.
- [ ] Update this file with Gate-D closeout.

---

# 6. Post-Gate-D architecture review — NOT YET AUTHORIZED IMPLEMENTATION

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

Do not start until calculation reproducibility exists. Provider abstraction without replay evidence can make data provenance harder to audit.

## Candidate D — broad cleanup / coverage / dead-code / typing refactor

Keep deferred until higher-value correctness gates are closed.

---

# 7. Historical D3D production-governance status

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

# 8. Known residuals that remain after completed phases

These are real but are **not permission to bypass the active gate order**.

## P4B residual

Published history currently persists net daily cash flow. A zero-start day with offsetting intraday flows cannot be reconstructed as gross/order-aware Modified Dietz timing from published history alone.

## External broker execution identity residual

Schema 2 does not have first-class immutable broker execution identity or execution timestamp/sequence. Current structured import provenance is metadata, commonly in `note`, not part of the calculation field contract.

## Same-day ordering residual

Current transaction preparation does not promote `executed_at` information from `note` into calculator `Timestamp` / `Sequence`. Therefore same-day FIFO/accounting can diverge from broker execution order for round trips even when final net quantity reconciles.

## Commission rebate residual

Current calculation paths normalize commission/tax with `abs()`. A genuinely net-negative broker commission/rebate cannot be represented faithfully under the current record/calculation contract.

## Futures / derivatives residual

Current Stock journal schema does not have first-class asset class and contract multiplier. Futures such as MCL/SIC must not be imported as if they were ordinary equities.

---

# 9. Production / deployment boundaries

Unless separately authorized:

- repository merge ≠ production Worker deployment;
- D1 migration ≠ allowed unless explicitly in scope and recovery gate satisfied;
- Cloudflare production activation remains governed separately;
- current product-integrity gates should not mutate production D1 directly;
- do not use an unavailable Cloudflare connector as if direct D1 access had been proven.

Any future production activation must freshly re-read current deployment contracts, Environment/ruleset state, exact protected main SHA, and fresh Cloudflare identity evidence.

---

# 10. External broker import notes for future work

These notes are constraints for later transaction-integrity/import work, not a current Gate-B task.

- Use IBKR `DAYS_7` rather than `TODAY` alone when reconstructing overnight/recent activity because `TODAY` can omit intermediate fills/orders.
- Reconcile trades with current positions before declaring an import complete.
- One IBKR `order_id` can contain multiple fills with different `trade_id`, size, price, exchange, and commission.
- Weighted-average price is appropriate for aggregating completed stock-order fills; commissions must be aggregated separately.
- Order-level note-based `import_key` is not database-enforced idempotency.
- Importing a partially filled order and later guarding only by order id can silently skip later fills.
- Per-fill immutable `trade_id` ingestion is more robust, but exact same-day sequencing still requires a first-class execution time/sequence contract.
- Futures remain excluded from the Stock journal until multiplier/asset-class semantics exist.

---

# 11. Required update format after every execution step

Append or modify the relevant phase section and record, at minimum:

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

Use this compact log for chronological continuity.

## Execution log

### 2026-08-09 — Gate A closeout

- Action: verified real current-main `Update Portfolio Data` smoke after PR #148 merge.
- Main: `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`.
- Run: #3213 / `31295494999`.
- Result: SUCCESS; 2 users succeeded, 0 failed; snapshots uploaded.
- Decision: Gate A closed. Legacy GitHub Pages stuck state recorded as non-authoritative external anomaly.
- Next: Gate B.

### 2026-08-09 — Gate B implementation

- Pre-change recovery: `backup-pre-gate-b-atomic-delete-f3c55f4`.
- Branch: `pr-gate-b-atomic-record-delete`.
- PR: #149.
- Implementation: atomic `recordsRepository.deleteAtomic()` using one D1 batch; guarded final-snapshot cleanup + record delete + remaining count.
- Dedicated test file: `tests/worker_atomic_delete.test.mjs`.
- Initial integrated head: `a5853a5433ab10fd6c1793dd7116d05f4ff48116`.
- CI #431 / `31295903744`: SUCCESS.
- Independent review found missing explicit fail-closed tests for malformed batch/cardinality anomalies.
- Additional test head: `a8f672537c6cfc1fb857d088752abe6633e831e8`.
- CI #432 / `31295960816`: SUCCESS.
- Review submissions: 0; unresolved threads: 0.
- Main drift: none at qualification check; still `f3c55f4...`.
- User then required this persistent root handoff file.
- Decision: add `to_do_update_list.md` to PR #149 and require a new exact-head CI before merge.
- **Exact next action:** wait for the CI triggered by this file commit, requalify PR #149, then exact-head merge if all blockers remain clear.

---

# 12. Immediate next action for the next AI

**Do not start Gate C yet.**

For the current repository state, perform these steps in order:

1. Fetch PR #149 current head after `to_do_update_list.md` was added.
2. Confirm the new PR CI run for that exact head completes successfully.
3. Confirm changed-file list remains limited to:
   - `worker.js`
   - `tests/worker_atomic_delete.test.mjs`
   - `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
   - `to_do_update_list.md`
4. Re-check review submissions and unresolved review threads.
5. Re-fetch protected `main`; if it differs from `f3c55f4...`, stop and rebase/requalify rather than merging stale review evidence.
6. Mark PR #149 ready for review if still Draft.
7. Merge with `expected_head_sha` equal to the exact freshly-qualified PR head.
8. Confirm post-main CI succeeds.
9. Create a post-Gate-B recovery branch/ref from the exact merged main.
10. Update this file to mark Gate B **completed**, record all final SHAs/run ids/recovery refs, and promote Gate C to **active**.

That sequence is the authoritative continuation unless the user explicitly changes priorities.
