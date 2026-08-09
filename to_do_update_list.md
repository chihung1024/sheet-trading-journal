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
3. Read `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md` while Gate C is active.
4. Re-read current `main`, the active PR head, CI status, review threads, and relevant recovery refs instead of trusting stale chat context.
5. Continue only the **current active gate** unless the user explicitly changes priority.
6. Use the sequence: **pre-change recovery → scoped branch/PR → tests/CI → independent diff review → review/thread check → main-drift check → exact-head merge → post-main CI → post-change recovery**.
7. Do not weaken validation, market/FX integrity, financial semantics, mutation ambiguity handling, recovery gates, or coverage merely to make CI pass.
8. Do not introduce Schema 3 inside Gates A–D unless a later fresh post-Gate-D architecture review explicitly authorizes it.
9. Do not deploy the production Worker merely because repository source changed. Production activation remains separately governed.
10. Do not reopen the historical D3D governance investigation during ordinary feature work unless production activation is explicitly requested.
11. Keep this file current. A completed step without a corresponding update here is considered an incomplete handoff.

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
- Current sub-phase: **C2 — deterministic prefix-integrity module/tests; no strict-policy switch yet**
- Work branch: `pr-gate-c-transaction-integrity-preflight`
- Qualification base / exact Gate-B merged main: `03242d00082067333cf77ffa424094b8936b406c`
- Pre-Gate-C recovery: `backup-pre-gate-c-03242d0`
- Post-Gate-B recovery: `backup-post-gate-b-03242d0`
- Gate C implementation PR: **not opened yet**; C1 evidence is now written, C2 implementation/tests come next.
- Gate C C1 audit evidence: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`.

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

Status: **🟠 ACTIVE — C1 completed, C2 next**

## Goal

Audit real Schema-2 transaction integrity end-to-end and establish deterministic, fail-closed preflight behavior without changing the D1 schema in the initial slice.

The first Gate C work is evidence + preflight. Do **not** switch calculator policy to strict ERROR until production data has been audited.

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
- [x] Re-read `main.py` transaction normalization and stable sorting.
- [x] Re-read calculator lot/FIFO ordering and oversell policy.
- [x] Re-read transaction analyzer ordering and fee/tax treatment.
- [x] Re-read Daily-P&L reconciliation ordering logic.
- [x] Inventory every code path that consumes records for holdings / realized P&L / daily P&L / metrics.
- [x] Write evidence table showing where ordering semantics agree or diverge.
- [x] Persist audit evidence in `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`.

#### C1 findings that future work must preserve

1. `prepare_transactions()` provides deterministic Schema-2 source order `Date -> id` and does not create `Timestamp`/`Sequence` or parse `note`.
2. Production calculator effectively processes same-day rows as `BUY -> DIV -> SELL`, stable by source id within each type, because no first-class Timestamp/Sequence is supplied.
3. Canonical Daily-P&L uses the same effective type-priority ordering and independently clamps oversells; successful reconciliation therefore does **not** prove source-ledger validity.
4. `validate_holdings_consistency()` checks only final aggregate `BUY - SELL`; it cannot detect a negative intermediate prefix.
5. Prefix validation must run on the independent **split-adjusted** ledger; raw historical quantities may use different pre/post-split share units.
6. Schema-2 `Date -> id` is acceptable as a deterministic **ledger validity order**, but must not be described as guaranteed broker execution chronology.
7. Existing `test_sequence_stabilizes_same_day_order()` supplies `_sequence`, while calculator reads only `Timestamp` / `Sequence`; the test currently passes because of BUY-before-SELL priority, not because `_sequence` is honored.
8. `TransactionAnalyzer` has unsafe zero-on-exception semantics but no live runtime constructor/call was found; do not broaden into a rewrite unless an authoritative consumer is discovered.

### C2 — Deterministic prefix-integrity contract

- [x] Define canonical audit order: user/scope → symbol → `Date` → positive integer record `id` ascending.
- [x] Define provisional tolerance formula: `max(1e-9, cumulative_abs_buy_qty * 1e-12)`; production audit must qualify it before strict enforcement.
- [x] Define validation rule: cumulative adjusted `BUY - SELL` must never fall below negative tolerance; DIV does not change quantity.
- [x] Define active-tag replay: same comma/semicolon parsing semantics as calculator; a multi-tag row participates independently in each named group.
- [x] Define non-secret diagnostic contract: masked user, scope, symbol, date, record id, type, requested adjusted qty, pre/post qty, tolerance.
- [ ] Implement standalone Schema-2 ledger-integrity module over the split-adjusted DataFrame.
- [ ] Add unit tests for exact-zero, fractional, round-trip, first-row SELL, partial oversell, tolerance edge, split-adjusted quantities, multi-tag scopes, and deterministic id tie-breaking.
- [ ] Integrate preflight before `PortfolioCalculator` execution without changing production oversell policy yet.

### C3 — Same-day ordering audit

- [x] Verify behavior when `Timestamp` / `Sequence` columns are absent: calculator/reconciler use BUY/DIV/SELL priority.
- [x] Verify type priority can reorder same-day source `id` sequence across BUY and SELL rows.
- [x] Determine Schema-2 `id` can serve as a deterministic ledger-validity fallback, but not as proof of broker chronology.
- [ ] Add explicit regression fixtures for buy → sell → rebuy → sell on the same date.
- [ ] Add a test showing source-prefix audit uses Date/id rather than calculator type priority.
- [ ] Correct/supplement misleading `_sequence` test so it tests the actual supported `Sequence` contract or explicitly tests priority behavior.
- [ ] Do **not** parse free-form `note` into financial ordering unless a separately reviewed structured contract exists.

### C4 — External provenance / duplicate audit

- [x] Repository search confirms `import_key` currently appears only in documentation/handoff, not as a runtime-enforced identity field.
- [ ] Inventory actual production `note` conventions: `import_key`, IBKR order id, trade id, timestamps.
- [ ] Detect structured duplicate provenance conservatively without making `note` a calculation dependency.
- [ ] Distinguish order-level vs fill-level identity limitations.
- [ ] Document partially-filled-order risk and cross-date fill risk.
- [ ] Keep futures/derivatives excluded from Stock-journal semantics.

### C5 — Production-data qualification

- [ ] Use current production records via the existing authorized read path.
- [ ] Audit all users for prefix violations using split-adjusted Date/id order.
- [ ] Audit all active tag groups for prefix violations.
- [ ] Record tolerance-residue observations separately from real negative prefixes.
- [ ] Separate explained legacy/import ordering issues, split-unit issues, genuine unsupported short/oversell, and unknown cases.
- [ ] Record exact counts and anonymized diagnostics.
- [ ] Do not switch production oversell policy if unexplained violations remain.

### C6 — Enforcement proposal

- [ ] If production audit is clean, propose calculator oversell policy change from compatibility `CLAMP` to fail-closed `ERROR`.
- [ ] Ensure secondary transaction-analysis integrity failures cannot collapse into valid-looking zero snapshots if that path is made authoritative.
- [ ] Add regression/golden evidence before strict enforcement.
- [ ] Open a scoped Gate-C implementation PR only after audit evidence and read-only production audit are written.
- [ ] Exact-head CI / independent diff review / review-thread check / main-drift check.
- [ ] Exact-head merge.
- [ ] Post-main CI.
- [ ] Post-Gate-C recovery.
- [ ] Update this file and activate Gate D.

## Gate C evidence matrix — current runtime

| Path | Effective order | Oversell | Failure behavior | Role |
|---|---|---|---|---|
| `prepare_transactions` | `Date -> id` | none | raises | source normalization |
| `PortfolioCalculator` | same-day `Timestamp? -> Sequence? -> BUY/DIV/SELL priority`; production effectively priority + stable id | CLAMP default / ERROR optional | propagates | authoritative holdings/FIFO/realized/TWR/XIRR |
| canonical Daily-P&L | `Date -> Timestamp? -> Sequence? -> priority -> id` | clamp | raises on reconciliation failure | authoritative published Daily-P&L |
| holdings validator | aggregate only | cannot see prefix | false + ERROR blocks upload | final quantity safeguard |
| split ledger | preserves source rows while split-adjusting | no prefix logic | raises/fail closed | independent unit-normalized ledger |
| `TransactionAnalyzer` | `Date -> _sequence` | clamp/warn | catches exception and returns zeros | appears legacy/non-runtime |

## Known Gate C architecture risks

- Schema 2 has no first-class `executed_at`, `sequence`, `source`, or immutable external trade id.
- Historical same-day execution timestamps stored only in `note` are not calculation ordering fields.
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

### 2026-08-09 — Gate C C1 runtime audit completed

- Branch: `pr-gate-c-transaction-integrity-preflight`.
- Audit evidence added: `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`.
- Audit-evidence commit: `2e535982e460045fb8235d99307c9ba1e31ffa2e`.
- Consumer inventory completed across runner, calculator, canonical Daily-P&L, validator, split ledger, transaction analyzer, calendar support, and downstream metrics.
- Key finding: calculator + canonical reconciler both clamp oversells and share BUY/DIV/SELL same-day priority, so their agreement cannot certify source-prefix validity.
- Key finding: current aggregate holdings validator does not check intermediate prefixes.
- Key finding: prefix audit must use split-adjusted quantities and Schema-2 `Date -> id` ledger order.
- Key finding: `_sequence` regression test does not exercise calculator sequence support.
- Decision: C1 complete. Do not switch `CLAMP -> ERROR` yet.
- **Exact next action:** implement standalone C2 prefix-integrity module + targeted tests, integrate it before calculator execution, then run read-only production qualification.

---

# 11. Immediate next action for the next AI

**Gate C / C2 is active. Do not start Gate D, Schema 3, or strict oversell enforcement.**

Perform these steps in order:

1. Implement a small standalone ledger-integrity module that accepts the independent split-adjusted DataFrame.
2. Require positive integer `id`, normalize `Date`, and replay each symbol in stable `Date -> id` order.
3. Validate `all` plus every active tag group using the calculator's comma/semicolon tag semantics.
4. Use provisional tolerance `max(1e-9, cumulative_abs_buy_qty * 1e-12)` and return/raise structured deterministic diagnostics on a negative prefix.
5. Add focused tests for exact closeout, fractional quantities, first-row SELL, partial oversell, tolerance edge, split-adjusted quantity, multi-tag scope, same-day round trip, and id tie-breaking.
6. Integrate the preflight **after split-adjusted validation ledger construction and before PortfolioCalculator runs**; retain existing post-calculation split-ledger parity.
7. Do not change the calculator's default `CLAMP` yet.
8. Run the full local/PR test suite after C2 implementation.
9. Update this file with exact commit/test results before beginning C5 production audit.

That sequence is the authoritative continuation unless the user explicitly changes priorities.
