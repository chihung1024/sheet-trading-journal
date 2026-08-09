# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. A new AI session must be able to continue from this file without the previous chat.
>
> **Mandatory update rule:** after every material implementation, CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or main drift, update this file in the same scoped branch/PR whenever practical.

Last updated: **2026-08-09**

---

# Session Startup

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Inspect protected `main`, active branch/PR, recent commits/PRs/Actions.
5. Identify Current Phase, Current Batch, Next Action, locked decisions and recovery refs.
6. Read current-phase evidence docs.
7. Only then begin work.

Current evidence:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`
- `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`

---

# Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Investigation may be broad; implementation must converge to one Current Batch.
- Important changes: recovery → scoped branch/PR → tests/CI → independent review → exact-head merge → post-main verification → recovery → handoff update.
- Never lower validation, coverage, financial-integrity or recovery gates merely to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does not authorize Worker deployment unless the scoped Batch explicitly requires it.
- Unknown/user-authored changes must not be overwritten.
- `note` metadata must not become an implicit financial-ordering contract.
- Gate D must establish reproducibility/evidence before architecture expansion.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Protected main reviewed for D1a: `41338e598f027a502a81c7d08eaec3c2f4069a04`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a architecture audit: **DONE / QUALIFIED FOR D1b**
- Current working branch: `pr-gate-d-d1a-reproducibility-audit`
- D1a evidence commit: `3147a8dfa4af4d35c6c3a5184de977d9301ea2fb`
- Current active Batch: **D1a documentation qualification/merge**; after merge, start **D1b pure deterministic manifest primitives** from a fresh recovery.

## Recovery refs

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C audit infra: `backup-post-gate-c-audit-infra-24fd65c`
- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- pre-C3-rem: `backup-pre-gate-c-c3-rem-4dd896e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- Gate C final qualified baseline: `backup-gate-c-final-qualified-f6a4c58`
- Gate C final merged state: `backup-post-gate-c-ef9f5a1`
- Gate D start: `backup-gate-d-start-41338e5`

---

# Master Plan

| Phase | Batch | Objective | Status | Verification / dependency |
|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | **DONE** | PR #148 + CI + prod smoke |
| Gate B | P5C3B | atomic Worker record deletion | **DONE** | PR #149 + CI + recovery |
| Gate C | C1–C6 | source-ledger integrity qualification/enforcement | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | reproducibility/provenance architecture audit | **DONE / QUALIFIED** | `GATE_D_REPRODUCIBILITY_AUDIT.md`; docs merge pending |
| Gate D | D1b | pure deterministic manifest primitives | **READY AFTER D1a MERGE** | canonical/hash/model tests |
| Gate D | D1c | effective market/FX/synthetic provenance | TODO | D1b contract |
| Gate D | D1d | frozen deterministic golden replay | TODO | D1b + D1c; explicit clock/as-of seam |
| Gate D | D1e | smallest compatible production integration | TODO | D1b–D1d proven first |
| Gate D | Closeout | independent reproducibility review | TODO | exact-head CI + post-main + recovery |
| Post-D | Architecture review | Schema 3 / canonical ledger / provider abstraction | DEFERRED | fresh review after Gate D |

---

# Current Phase — Gate D

**Goal:** given the same trusted transaction ledger and the same declared external inputs/configuration, future reviewers must be able to identify exactly what was calculated, distinguish why an output changed, and reproduce a known-good result offline.

Gate D operates on the qualified Schema-2 pipeline unless evidence proves a blocking dependency.

---

# D1a — DONE / QUALIFIED FOR D1b

Formal evidence: `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`.

## D1a key findings

### A. Snapshot/storage boundary already supports additive evidence

- Python uploads `PortfolioSnapshot.model_dump()` via `/api/portfolio`.
- Worker stores snapshot `data` as opaque JSON in `portfolio_snapshots.json_data`, max 1 MiB, last ten snapshots retained.
- No nested fixed Worker snapshot schema or extra D1 columns are required merely to carry additive evidence.
- Existing optional `benchmark_symbol` proves an additive provenance compatibility pattern.

**Decision:** preferred D1e boundary is an optional versioned `PortfolioSnapshot.calculation_manifest`; do not create a new D1 table/Worker route unless later tests prove necessary.

### B. Canonical source transaction identity does not yet exist

Production normalization is `prepare_transactions()` with stable `Date -> id` ordering.

Material source-hash fields:

- `id`
- `Date`
- `Symbol`
- `Type`
- `Qty`
- `Price`
- `Commission`
- `Tax`
- `Tag`

Exclude from financial content identity:

- free-form `note`
- `created_at`
- user email/ownership identity

Count/max-id are diagnostics only; they cannot replace a content hash.

### C. Python engine SHA is not in snapshots, but an existing pattern is available

- Gate-C audit already uses `GITHUB_SHA` as `source_commit`.
- Normal Actions runner inherits GitHub build environment.
- `requirements.txt` pins Python runtime dependencies.

**Decision:** D1b introduces a validated engine-source resolver and fail-closes on missing/ambiguous production source identity.

### D. Effective market inputs exist, but provenance is incomplete

Calculation-effective state already lives in `MarketDataClient`:

- per-symbol `market_data`
- historical/realtime FX by currency
- `Close_Adjusted`
- `Dividends`
- `Split_Factor`

Existing useful provenance:

- `AutoPriceSelector`: `price_source`, `selection_reason` — currently not retained structurally after logging.
- `transaction_calendar.py`: `Valuation_Source` / `Valuation_Source_Date` with `market`, `asof_carry_forward`, `transaction_price_seed` semantics.

Gap:

- realtime price overrides and ordinary source-selection metadata are not fully persisted as structured evidence.

**Decision:** D1c hashes only effective calculation inputs, not irrelevant vendor OHLC/Volume payload; provider metadata remains separate from numeric input identity. No broad provider abstraction.

### E. Wall clock currently breaks true replay determinism

Calculator uses current time/date for:

- `updated_at`
- current/end date
- market-stage metadata
- today/realtime price/FX selection

**Decision:** D1d requires one explicit calculation-as-of/clock seam. `calculation_as_of` is a material deterministic input; `calculated_at` is run-instance metadata and excluded from the deterministic input hash.

### F. Existing golden infrastructure should be evolved, not replaced

Existing fixture:

- `tests/fixtures/golden_case_mixed_tw_us.json`

Existing offline harness:

- `tests/test_daily_pnl.py::FakeMarketDataClient`
- `test_golden_snapshot_regression_matrix()`
- network-free `tests/test_market_data_pure_invariants.py`
- explicit TWR/XIRR contracts in `tests/test_performance_metrics.py`

Current golden only asserts three rounded values: total value, realized P&L, Daily P&L.

**Decision:** D1d evolves this into a versioned offline replay with fixed clock, market/FX/split/dividend inputs, authoritative output projection and manifest hashes.

### G. Authoritative golden outputs

Include:

- normalized transaction projection/hash
- summary value/capital/P&L/realized P&L
- TWR numeric + reliability metadata
- XIRR numeric + status/reason/as-of/conventional flag
- benchmark identity/return where applicable
- holdings
- pending dividends
- materially published/consumed history
- canonical Daily-P&L total/breakdown
- populated `day_ledger`
- manifest digests

Do **not** require populated `lot_ledger`: current production does not populate it; doing so would expand into canonical-lot architecture.

---

# D1b — NEXT: Pure Deterministic Manifest Primitives

**Status: READY after D1a docs PR exact-head merge/post-main/recovery.**

## Scope

1. Add a pure, versioned canonical serialization/hash module.
2. Add normalized source transaction projection + SHA-256.
3. Add runtime config projection/hash.
4. Add validated engine-source commit resolver.
5. Add versioned manifest Pydantic/data contract sufficient for deterministic component identities.
6. Add pure tests for determinism, material sensitivity, ignored volatility, fail-closed invalid inputs.

## Canonicalization proposal to implement/test

- explicit schema/version constants;
- fixed field order;
- source rows already in stable `Date -> id` order;
- dates `YYYY-MM-DD`;
- ids integers;
- finite floats encoded with a versioned exact representation such as `float.hex()` before canonical JSON;
- canonical UTF-8 JSON with fixed separators/order;
- SHA-256 digest.

Tests must prove:

- repeated calls are byte/digest identical;
- irrelevant DataFrame column order does not change digest;
- note/created_at changes do not change digest;
- every material financial field/id/order change changes digest;
- NaN/Inf/missing required values fail closed;
- deterministic identity excludes volatile run timestamp.

## D1b explicit non-goals

- no production runner attachment;
- no `PortfolioSnapshot` field yet;
- no D1/Worker change;
- no market-data provenance extractor yet;
- no clock refactor yet;
- no provider abstraction;
- no Schema 3.

---

# D1c — Effective Market / FX / Synthetic Provenance

After D1b:

1. Canonical effective market projection per symbol/date:
   - date
   - `Close_Adjusted`
   - `Dividends`
   - `Split_Factor`
   - effective `Valuation_Source`
   - `Valuation_Source_Date`
2. Canonical historical FX projection per required currency/date.
3. Realtime effective FX/input state when calculation context can use it.
4. Reuse synthetic valuation provenance from `transaction_calendar.py`.
5. Retain/structure price-selection and realtime-overlay metadata only where currently lost.
6. Add diagnostics: symbols/currencies, row counts, synthetic counts by source, realtime overlay state.
7. Network-free tests using existing market invariant infrastructure.

No broad provider abstraction.

---

# D1d — Frozen Deterministic Golden Replay

After D1b/c:

1. Introduce narrow explicit calculation-as-of/clock context.
2. Evolve/add a versioned mixed TW/US frozen fixture.
3. Network must be forbidden in replay.
4. Fixture must cover a reviewable mix of:
   - transaction ordering
   - prices
   - FX variation
   - split-sensitive inputs
   - dividends
5. Assert authoritative outputs listed above.
6. Assert component/combined manifest hashes.
7. Prove repeated replay gives exact deterministic projection/content identity.
8. Keep edge-case economic tests separate rather than turning one golden fixture into an unreviewable mega-case.

---

# D1e — Smallest Compatible Production Integration

Only after D1b–D1d are independently proven:

1. Add optional versioned `calculation_manifest` to `PortfolioSnapshot`.
2. Build manifest at the authoritative runner boundary after effective inputs are known.
3. Attach it before snapshot validation/upload.
4. Preserve legacy snapshots without the field.
5. Explicitly test Worker opaque JSON round-trip/size boundary.
6. Explicitly test frontend remains unchanged with unknown/additive manifest field.
7. Add fail-closed runner regressions for missing/ambiguous manifest-critical input identity.
8. Run production smoke only if runtime execution path materially changes.

No D1 migration or Worker API change unless a D1e test proves the opaque snapshot boundary insufficient.

---

# Gate D Closeout Criteria

- [ ] D1a evidence merged and post-main verified.
- [ ] D1b canonical source/config/engine identity proven.
- [ ] D1c effective market/FX/synthetic provenance proven.
- [ ] D1d deterministic offline replay proven.
- [ ] D1e compatible production attachment proven.
- [ ] repeated deterministic replay can identify record/vendor-or-effective-market/FX/engine/config causes of change.
- [ ] independent review finds no unresolved reproducibility blocker.
- [ ] exact-head CI/merge/post-main verification complete.
- [ ] post-Gate-D recovery created.
- [ ] handoff updated before any post-Gate-D architecture review.

---

# Gate C Final Closeout — DONE

Formal evidence: `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`.

Key evidence:

- C5b audit #3215 / `31298163263`: CLEAR, 2 users / 168 records, zero source-prefix/duplicate-provenance findings.
- C6a PR #154: blocking split-adjusted source-prefix gate before calculator/upload.
- C6a CI #462/#463 and production smoke #3216: SUCCESS, 2 users / 0 failed.
- C3-rem PR #156: explicit `Sequence` vs unsupported `_sequence` regression; CI #468/#469 SUCCESS.
- final independent PR #158 CI #473; merge `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`; post-main CI #474 SUCCESS.
- post-Gate-C recovery `backup-post-gate-c-ef9f5a1`.
- Gate-D handoff PR #159 merged → `41338e598f027a502a81c7d08eaec3c2f4069a04`; post-main CI #476 SUCCESS.

Final C6b decision: retain calculator `CLAMP` as downstream compatibility/defense-in-depth; source prefix preflight is authoritative. Reopen only under conditions documented in Gate-C final closeout.

---

# Decision Log

## D-C-01 — Source ledger first
Split-adjusted `Date -> id` prefix integrity is the Schema-2 source gate. **LOCKED.**

## D-C-02 — Record id is not broker chronology
`id` is a deterministic validity-order tie-breaker only. **LOCKED.**

## D-C-06 — Retain CLAMP under protected Schema-2 path
No C6b runtime migration absent reopen conditions. **LOCKED.**

## D-C-07 — Free-form note is not chronology
Do not parse note into financial ordering. **LOCKED.**

## D-C-08 — `Sequence` != `_sequence`
Only recognized `Sequence`/`Timestamp` may alter explicit calculator same-day order. **LOCKED.**

## D-D-01 — Evidence contract before persistence/schema changes
D1a audit existing boundaries before any storage migration. **SATISFIED; no D1/Worker migration currently required.**

## D-D-02 — Separate deterministic identity from run metadata
`calculation_as_of` may affect deterministic result; `calculated_at` must not contaminate deterministic input identity. **LOCKED FOR D1b/D1d DESIGN.**

## D-D-03 — Effective inputs before provider architecture
Hash calculation-effective market/FX state separately from provider provenance. **LOCKED FOR D1c.**

## D-D-04 — Snapshot additive manifest is preferred production boundary
Use optional `PortfolioSnapshot.calculation_manifest` in D1e if compatibility tests pass. **PROPOSED/QUALIFIED BY D1a; not implemented yet.**

---

# Root Cause / Risk Log

## RC-C-01 — Invalid source prefixes could be hidden
Fixed by Gate C C6a preflight. **CLOSED.**

## RC-C-02 — Historical `_sequence` test false positive
Fixed by C3-rem explicit regression. **CLOSED.**

## RC-D-01 — Snapshot cannot currently prove exact calculation inputs
No canonical transaction/config/market/FX/engine identity is attached. **OPEN; D1b–D1e.**

## RC-D-02 — Wall clock prevents true offline replay
Current date/market-stage/realtime branches depend on current time. **OPEN; D1d explicit as-of/clock seam.**

## RC-D-03 — Effective market values and source provenance are partially decoupled
Numeric state is present, but price-selection/realtime provenance is partly lost after logs. **OPEN; D1c.**

## RC-D-04 — Existing golden regression is too shallow
Only three rounded summary values are asserted. **OPEN; D1d.**

---

# Deferred / Not Gate-D Scope Unless Proven Blocking

- Schema 3 / first-class execution identity.
- Immutable `broker_executions` table.
- Futures/derivatives/contract multipliers.
- Net-negative commission/rebate redesign.
- Broad provider abstraction.
- Canonical calculator/analyzer/Daily-P&L lot-ledger consolidation.
- Populating production `lot_ledger`.
- Legacy TransactionAnalyzer zero-on-exception cleanup.
- Unrelated frontend/UX/refactor work.

---

# Immediate Next Actions

## Finish D1a

1. Open D1a docs-only PR containing:
   - `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`
   - this handoff update.
2. Run full exact-head CI.
3. Independently verify changed-file whitelist, reviews/threads and main drift.
4. Exact-head merge.
5. Verify post-main CI.
6. Create `backup-post-gate-d-d1a-<sha>` recovery.
7. Synchronize handoff if merge SHA/CI/recovery are not yet recorded.

## Then start D1b

1. Create fresh pre-D1b recovery/branch from merged stable main.
2. Implement **pure deterministic manifest primitives only**.
3. No production runner/storage/market changes in D1b.
4. Tests/coverage → independent review → exact-head merge → post-main CI → recovery → handoff.
