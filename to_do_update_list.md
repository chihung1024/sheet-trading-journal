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
- Repository merge does not authorize Worker deployment unless explicitly scoped.
- Unknown/user-authored changes must not be overwritten.
- `note` metadata must not become an implicit financial-ordering contract.
- Gate D must establish reproducibility/evidence before architecture expansion.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Protected main: `0d9ad8ea15599bcc7ebdc53bb6b1af98887966e7`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- D1a PR #160 exact-head merge → `0d9ad8ea15599bcc7ebdc53bb6b1af98887966e7`
- D1a PR CI #477 / `31301386915`: **SUCCESS**
- D1a post-main CI #478 / `31301449682`: **SUCCESS**
- D1a recovery: `backup-post-gate-d-d1a-0d9ad8e`
- Current active Batch after this handoff merge: **Gate D / D1b — pure deterministic manifest primitives**.

## Recovery refs

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C audit infra: `backup-post-gate-c-audit-infra-24fd65c`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D start: `backup-gate-d-start-41338e5`
- post-D1a: `backup-post-gate-d-d1a-0d9ad8e`

---

# Master Plan

| Phase | Batch | Objective | Status | Verification / dependency |
|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | **DONE** | PR #148 + CI + prod smoke |
| Gate B | P5C3B | atomic Worker record deletion | **DONE** | PR #149 + CI + recovery |
| Gate C | C1–C6 | source-ledger integrity qualification/enforcement | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | reproducibility/provenance architecture audit | **DONE / POST-MAIN VERIFIED** | PR #160 + CI #477/#478 + recovery |
| Gate D | D1b | pure deterministic manifest primitives | **ACTIVE / NEXT** | canonical/hash/model tests |
| Gate D | D1c | effective market/FX/synthetic provenance | TODO | D1b contract |
| Gate D | D1d | frozen deterministic golden replay | TODO | D1b + D1c + explicit clock/as-of seam |
| Gate D | D1e | smallest compatible production integration | TODO | D1b–D1d proven first |
| Gate D | Closeout | independent reproducibility review | TODO | exact-head CI + post-main + recovery |
| Post-D | Architecture review | Schema 3 / canonical ledger / provider abstraction | DEFERRED | fresh review after Gate D |

---

# Current Phase — Gate D

**Goal:** given the same trusted transaction ledger and declared external inputs/configuration, a future reviewer can identify exactly what was calculated, distinguish why an output changed, and reproduce a known-good result offline.

Gate D operates on the qualified Schema-2 pipeline unless evidence proves a blocking dependency.

---

# D1a — DONE

Formal evidence: `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`.

## Qualified findings

### Snapshot/storage

- Python uploads `PortfolioSnapshot.model_dump()`.
- Worker stores opaque snapshot JSON in `portfolio_snapshots.json_data`, max 1 MiB, latest ten retained.
- Existing optional `benchmark_symbol` is an additive provenance compatibility precedent.
- Preferred D1e boundary: optional versioned `PortfolioSnapshot.calculation_manifest` if later compatibility tests pass.
- No D1/Worker storage migration is currently required.

### Source transaction identity

Canonical material fields:

- `id`
- `Date`
- `Symbol`
- `Type`
- `Qty`
- `Price`
- `Commission`
- `Tax`
- `Tag`

Exclude free-form `note`, `created_at`, and ownership identity from financial content hash. Count/max-id remain diagnostics only.

### Engine/config identity

- Python snapshots currently lack engine source SHA.
- Gate-C audit already proves `GITHUB_SHA` can identify the running repository commit.
- Runtime config identity should contain only independently variable material settings such as resolved benchmark, base currency, oversell policy and later calculation-as-of.

### Effective market/FX provenance

Material current state exists in `MarketDataClient`:

- `Close_Adjusted`
- `Dividends`
- `Split_Factor`
- historical/realtime FX by currency

Reuse existing synthetic provenance:

- `Valuation_Source`
- `Valuation_Source_Date`
- `market`
- `asof_carry_forward`
- `transaction_price_seed`

Price-selection/realtime source metadata is partly lost after logging; D1c addresses that without broad provider abstraction.

### Replay nondeterminism

Current wall clock influences:

- `updated_at`
- calculation current/end date
- market-stage metadata
- today/realtime price/FX path

D1d therefore requires an explicit calculation-as-of/clock seam. `calculation_as_of` is a deterministic input; `calculated_at` is volatile run metadata excluded from deterministic identity.

### Existing golden infrastructure

Reuse/evolve:

- `tests/fixtures/golden_case_mixed_tw_us.json`
- offline `FakeMarketDataClient` in `tests/test_daily_pnl.py`
- `tests/test_market_data_pure_invariants.py`
- TWR/XIRR reliability tests in `tests/test_performance_metrics.py`

Current golden only fixes three rounded values and is insufficient as a full replay contract.

### Authoritative golden outputs

Target:

- normalized transaction projection/hash
- summary value/capital/P&L/realized P&L
- TWR numeric + reliability metadata
- XIRR numeric + status/reason/as-of/conventional flag
- benchmark identity/return where applicable
- holdings
- pending dividends
- material history
- canonical Daily-P&L total/breakdown and populated `day_ledger`
- manifest digests

Do not require populated `lot_ledger`; production currently does not populate it.

---

# D1b — ACTIVE / NEXT

## Objective

Implement **pure deterministic manifest primitives only**, with no production attachment.

## Scope

1. Versioned canonical serialization/hash utility.
2. Normalized source transaction projection + SHA-256.
3. Runtime config projection/hash.
4. Validated engine-source commit resolver.
5. Versioned manifest data/Pydantic contracts and deterministic combined input identity.
6. Pure unit/contract tests.

## Canonicalization contract to implement and verify

- explicit schema/canonicalization version constants;
- fixed field order;
- transactions stable `Date -> id`;
- date `YYYY-MM-DD`;
- ids integers;
- finite floats represented exactly using a versioned representation such as `float.hex()` before canonical JSON;
- canonical UTF-8 JSON with fixed separators/order;
- SHA-256 digest;
- non-finite/ambiguous inputs fail closed.

## Required D1b tests

- repeated calls yield identical bytes/digests;
- irrelevant DataFrame column order does not change transaction digest;
- `note`/`created_at` changes do not change transaction digest;
- any material field/id/order change changes digest where order is semantically material;
- non-finite/missing required inputs fail closed;
- config key insertion order does not change config digest;
- material benchmark/base-currency/policy changes change config digest;
- engine SHA validator accepts full Git SHA and rejects blank/ambiguous production values;
- combined deterministic identity excludes `calculated_at` or other run-instance volatility.

## Explicit D1b non-goals

- no production runner integration;
- no `PortfolioSnapshot.calculation_manifest` field yet;
- no D1/Worker API/schema change;
- no market/FX provenance extractor yet;
- no clock refactor yet;
- no provider abstraction;
- no Schema 3.

## D1b execution plan

1. Create pre-D1b recovery from merged stable main.
2. Create one scoped D1b branch.
3. Add pure module/models/tests only.
4. Run focused tests, then full CI/coverage.
5. Independent review of canonicalization semantics and privacy.
6. Update this handoff in the same PR.
7. Final exact-head CI, main-drift check, merge, post-main CI, recovery.
8. Only then activate D1c.

---

# D1c — Planned

After D1b:

- canonical effective market projection per symbol/date: date, `Close_Adjusted`, `Dividends`, `Split_Factor`, effective valuation provenance;
- canonical historical/realtime FX projection per required currency;
- reuse transaction-calendar synthetic valuation provenance;
- structure price-selection/realtime-overlay provenance where currently lost;
- diagnostics: symbols/currencies/row counts/synthetic counts/realtime state;
- network-free tests based on existing market invariants;
- provider metadata separate from effective numeric input digest.

No broad provider abstraction.

---

# D1d — Planned

After D1b/c:

1. Add narrow explicit calculation-as-of/clock context.
2. Evolve/add a versioned mixed TW/US frozen fixture.
3. Forbid network in replay.
4. Cover prices, FX variation, split-sensitive inputs and dividends.
5. Assert authoritative snapshot projection + Daily-P&L/TWR/XIRR + manifest hashes.
6. Prove repeated replay exact deterministic identity.

---

# D1e — Planned

Only after D1b–D1d are independently proven:

1. Add optional versioned `calculation_manifest` to `PortfolioSnapshot`.
2. Build manifest at authoritative runner boundary after effective inputs are known.
3. Attach before validation/upload.
4. Preserve legacy snapshots without field.
5. Test Worker opaque JSON round-trip and 1 MiB boundary.
6. Test frontend unchanged by additive manifest field.
7. Fail closed on missing/ambiguous manifest-critical input identity.
8. Production smoke only if runtime path materially changes.

No D1 migration or Worker API change unless tests prove existing opaque snapshot boundary insufficient.

---

# Gate D Closeout Criteria

- [x] D1a evidence merged and post-main verified.
- [ ] D1b source/config/engine identity proven.
- [ ] D1c effective market/FX/synthetic provenance proven.
- [ ] D1d deterministic offline replay proven.
- [ ] D1e compatible production attachment proven.
- [ ] change cause can be distinguished among source records / effective market or provider / FX / engine / runtime config / synthetic valuation.
- [ ] independent review finds no unresolved reproducibility blocker.
- [ ] exact-head merge/post-main verification complete.
- [ ] post-Gate-D recovery created.
- [ ] handoff updated before post-Gate-D architecture review.

---

# Gate C — DONE / CLOSED

Formal evidence: `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`.

Key chain:

- C5b audit #3215: CLEAR, 2 users / 168 records, zero prefix/duplicate findings.
- C6a PR #154: blocking split-adjusted source-prefix gate before calculator/upload; CI #462/#463; prod smoke #3216 succeeded 2/0.
- C3-rem PR #156: explicit `Sequence` vs unsupported `_sequence`; CI #468/#469.
- final PR #158 merge `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`; post-main CI #474.
- recovery `backup-post-gate-c-ef9f5a1`.
- Gate-D handoff PR #159 merge `41338e598f027a502a81c7d08eaec3c2f4069a04`; CI #476.

C6b decision: retain calculator `CLAMP` as downstream compatibility/defense-in-depth. Source prefix preflight remains authoritative; reopen only under Gate-C documented conditions.

---

# Decision Log

- **D-C-01 LOCKED:** split-adjusted `Date -> id` prefix integrity is Schema-2 source gate.
- **D-C-02 LOCKED:** record id is deterministic validity order, not broker chronology.
- **D-C-06 LOCKED:** retain CLAMP under current protected Schema-2 path absent reopen conditions.
- **D-C-07 LOCKED:** free-form note is not chronology.
- **D-C-08 LOCKED:** `Sequence`/`Timestamp` are recognized contracts; `_sequence` is not.
- **D-D-01 SATISFIED:** audit evidence/storage boundaries before migrations; D1a found no D1/Worker migration need.
- **D-D-02 LOCKED:** deterministic identity separated from volatile run metadata.
- **D-D-03 LOCKED:** hash effective market/FX inputs separately from provider provenance.
- **D-D-04 QUALIFIED, NOT YET IMPLEMENTED:** optional snapshot manifest is preferred D1e production boundary.

---

# Root Cause / Risk Log

- **RC-D-01 OPEN:** snapshot cannot currently prove exact source/config/market/FX/engine input identity → D1b–D1e.
- **RC-D-02 OPEN:** wall clock breaks true replay → D1d explicit as-of/clock seam.
- **RC-D-03 OPEN:** effective market state and source provenance partly decoupled → D1c.
- **RC-D-04 OPEN:** existing golden regression too shallow → D1d.

---

# Deferred / Not Gate-D Scope Unless Proven Blocking

- Schema 3 / first-class execution identity.
- Immutable `broker_executions` table.
- Futures/derivatives/contract multipliers.
- Net-negative commission/rebate redesign.
- Broad provider abstraction.
- Canonical lot-ledger consolidation / populated production `lot_ledger`.
- Legacy TransactionAnalyzer cleanup.
- Unrelated frontend/UX/refactor work.

---

# Immediate Next Actions

1. Merge this D1a closeout handoff through docs-only PR and verify CI/post-main.
2. Create fresh pre-D1b recovery and D1b branch from merged main.
3. Implement only D1b pure deterministic primitives/tests.
4. Do not attach manifest to production snapshot until D1e.
