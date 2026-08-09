# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** This file is the persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. It must remain sufficient for a new AI session to continue without the previous chat.
>
> **Mandatory update rule:** after every material implementation, test/CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or externally introduced main drift, update this file in the same working branch/PR whenever practical.

Last updated: **2026-08-09**

---

# Session Startup

Every new AI/developer session must:

1. read `AI_PROJECT_PLAYBOOK.md`;
2. read `README.md`;
3. read this file;
4. inspect current `main`, active branch/PR, recent commits/PRs/workflow runs;
5. identify Current Phase, Current Batch, Next Action, locked decisions and recovery refs;
6. read current-phase evidence docs;
7. only then begin work.

Current-phase references:

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_TRANSACTION_INTEGRITY_AUDIT.md`
- `docs/engineering/GATE_C_C5B_PRODUCTION_AUDIT.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`

---

# Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Broad investigation is allowed; implementation must converge to one Current Batch.
- Important changes require recovery → scoped PR → tests/CI → independent review → exact-head merge → post-main verification → recovery → handoff update.
- Never lower validation, coverage, financial-integrity or recovery gates merely to pass CI.
- Gates A–D do **not** authorize Schema 3.
- Repository merge does **not** authorize production Worker deployment unless explicitly required by the scoped Batch.
- Unknown/user-authored changes must not be overwritten.
- A Batch is not complete if this file is stale.
- `note` metadata must not become an implicit financial-ordering contract.
- Gate D must improve reproducibility/evidence before introducing architecture expansion.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Current protected `main`: `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`
- D1: **Schema 2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A / P6C: **DONE**
- Gate B / P5C3B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate C final PR #158 merged at `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`.
- Gate C post-main CI #474 / `31300456919`: **SUCCESS**.
- Gate C final C6b decision: **RETAIN calculator `CLAMP`; NO runtime migration now**.
- Post-Gate-C recovery: `backup-post-gate-c-ef9f5a1`.
- Production Worker deployment was not part of Gate C.
- Current Phase: **Gate D — deterministic reproducibility**.
- Current active Batch: **Gate D / D1a — existing reproducibility/provenance architecture audit**.

Current recovery refs:

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C audit infrastructure: `backup-post-gate-c-audit-infra-24fd65c`
- pre-C6a: `backup-pre-gate-c-c6a-aa19173`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- pre-C3-rem: `backup-pre-gate-c-c3-rem-4dd896e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- Gate C final qualified baseline: `backup-gate-c-final-qualified-f6a4c58`
- Gate C final merged state: `backup-post-gate-c-ef9f5a1`

---

# Architecture Notes

## Current Schema-2 transaction contract

- Schema 2 provides deterministic persisted-record validity order as `Date -> record id`, but no first-class broker execution timestamp/sequence/source/external execution id.
- D1 `records` has no `Timestamp` or `Sequence`; migration 0002 adds calculation jobs only.
- `prepare_transactions()` does not promote `note` metadata into financial ordering fields and sorts by `Date -> id`.
- `PortfolioCalculator` recognizes optional columns named exactly `Timestamp` and `Sequence`; it does **not** recognize `_sequence`.
- Without recognized `Timestamp` / `Sequence`, calculator same-day fallback priority is BUY → DIV → SELL using stable sort.
- Prefix validity is independently enforced on the split-adjusted source ledger before `PortfolioCalculator`.
- The same split-adjusted validation ledger is reused for downstream adjusted-ledger parity.
- Normal scheduled/manual production calculation enters through `.github/workflows/update.yml` → `tools/run_portfolio_update.py` → `main.run_update()`; no alternate authoritative production calculator path was found.

## Known representation limits carried into Gate D

- Existing Commission/Tax paths normalize with `abs()`; net-negative commission/rebate is not faithfully representable.
- Futures/derivatives remain outside Stock-journal semantics because asset-class/multiplier fields do not exist.
- Record `id` remains deterministic ledger-validity ordering, not broker chronology.
- Execution provenance remains optional free-form metadata and must not be promoted implicitly during Gate D.

---

# Master Plan

| Phase | Batch | Objective | Priority | Status | Verification |
|---|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | High | **DONE** | PR #148 + CI + production smoke |
| Gate B | P5C3B | atomic Worker record deletion | High | **DONE** | PR #149 + post-main CI + recovery |
| Gate C | C1/C2/C5/C6 | source-ledger integrity qualification + enforcement | High | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | existing reproducibility/provenance architecture audit | High | **ACTIVE / NEXT** | evidence doc + scoped proposal |
| Gate D | D1b | deterministic calculation-manifest contract | High | TODO after D1a | pure contract tests + hashing determinism |
| Gate D | D1c | market/FX/synthetic valuation provenance contract | High | TODO after D1a | fixture/provider provenance tests |
| Gate D | D1d | frozen deterministic golden replay | High | TODO after D1b/c | offline replay + exact expected outputs |
| Gate D | D1e | production runner integration / artifact boundary | High | TODO after D1b–d | fail-closed runner tests + CI/smoke if needed |
| Gate D | Closeout | independent reproducibility review + recovery | High | TODO | exact-head CI + post-main verification |
| Post-Gate-D | Architecture review | Schema 3 / canonical ledger / provider abstraction decision | Later | DEFERRED | fresh review only |

---

# Current Phase

**Gate D — Deterministic Reproducibility and Calculation Evidence**

Gate D answers a different question from Gate C:

> Given the same trusted transaction ledger and the same declared external inputs/configuration, can a future reviewer determine exactly what calculation inputs were used, distinguish why an output changed, and reproduce a known-good result offline?

Gate D must not conflate reproducibility with broker-execution redesign. It operates on the current qualified Schema-2 pipeline unless D1a proves a blocking dependency.

---

# Current Batch

## D1a — Existing reproducibility/provenance architecture audit

Status: **ACTIVE / NEXT**

### Objective

Before implementing any manifest or replay mechanism, inventory existing calculation inputs, serialization boundaries, provenance metadata and deterministic-test infrastructure so Gate D reuses what already exists rather than introducing a parallel model.

### Required investigation

1. **Snapshot/output model**
   - locate portfolio snapshot data classes/models;
   - identify JSON serialization and Worker upload boundary;
   - identify which calculated outputs are authoritative versus display/diagnostic-only;
   - identify whether private/raw fields are serialized or stripped.

2. **Transaction input identity**
   - identify exact DataFrame consumed by calculator after preparation/split handling;
   - identify stable fields that can form a canonical record/input hash;
   - determine whether record count + max id alone is insufficient and where a canonical content hash belongs.

3. **Engine/config identity**
   - identify reliable Git SHA/build identity available in GitHub Actions and local tests;
   - inventory benchmark/configuration values that materially change outputs;
   - identify runtime defaults that must enter manifest identity.

4. **Market-data provenance**
   - inventory `MarketDataClient` sources and stored attributes for prices, realtime overlays, splits, dividends and FX;
   - identify fallback/synthetic valuation behavior;
   - determine which source/date/value metadata already exists and which is currently lost;
   - do not introduce broad provider abstraction during this audit.

5. **Golden/replay infrastructure**
   - inventory existing deterministic fixtures, fake market clients, snapshot tests and golden-style expected values;
   - identify the smallest realistic fixture capable of covering transactions, prices, FX, splits, dividends, holdings, realized P&L, Daily-P&L, TWR and XIRR without network access.

6. **Artifact/storage boundary**
   - determine whether a manifest should be embedded in snapshot JSON, emitted as a separate calculation artifact, logged, or another existing boundary;
   - no schema/Worker contract change is authorized until evidence demonstrates it is necessary.

### D1a deliverable

A scoped evidence/proposal document that defines:

- authoritative calculation input set;
- deterministic canonicalization rules;
- manifest schema proposal;
- provenance fields that are already available versus missing;
- golden replay fixture boundary;
- proposed implementation batches D1b–D1e;
- risks, compatibility constraints and explicit non-goals.

### D1a completion criteria

- [ ] snapshot model/serialization/upload path audited;
- [ ] transaction canonicalization candidates audited;
- [ ] engine/config identity audited;
- [ ] market/FX/split/dividend/synthetic provenance audited;
- [ ] existing fixture/replay tests audited;
- [ ] manifest storage boundary decision proposed but not prematurely implemented;
- [ ] evidence distinguishes facts from proposed changes;
- [ ] no unnecessary Schema/Worker/provider redesign introduced;
- [ ] persistent handoff updated with results;
- [ ] only then start D1b implementation.

---

# Gate D Planned Contracts

## D1b — Deterministic calculation manifest

Target contract, subject to D1a refinement:

- manifest format/version;
- engine/build Git SHA or equivalent immutable code identity;
- canonical transaction input hash;
- record count and max record id as diagnostics, not substitutes for content hash;
- user-scoped benchmark/config hash or canonical config identity;
- declared market-data/FX/split/dividend provenance identity;
- synthetic/fallback valuation source/count where applicable;
- calculation timestamp kept separate from deterministic input identity;
- deterministic canonical JSON encoding / hash rules;
- fail-closed validation for missing/ambiguous required provenance.

The deterministic hash must not include volatile fields such as calculation time unless explicitly defined as a separate run-instance identity.

## D1c — Market / FX / valuation provenance

Target questions:

- Which price series/date/source was used for each asset?
- Which FX source/date/rate path was used?
- Which split/dividend inputs materially affected normalization/calculation?
- Was a realtime overlay or synthetic/fallback valuation used?
- Can provider/input changes be distinguished from transaction or engine changes?

This Batch must capture evidence without initiating broad provider abstraction.

## D1d — Frozen deterministic golden replay

Golden replay must run offline with frozen inputs and assert materially authoritative outputs, including as applicable:

- normalized transactions;
- market prices;
- FX;
- splits;
- dividends;
- holdings and cost basis;
- realized P&L;
- canonical Daily-P&L;
- TWR;
- XIRR;
- relevant benchmark outputs;
- manifest/input hashes.

The replay must make vendor/network/time drift impossible inside the fixture.

## D1e — Production integration

Only after D1b–d contracts are proven:

- integrate the manifest/reproducibility boundary into the authoritative runner at the smallest compatible boundary;
- do not add D1 database fields or Worker API changes unless D1a evidence establishes they are required;
- preserve current snapshot compatibility unless a separately reviewed contract migration is unavoidable;
- add fail-closed runner regressions for missing/ambiguous manifest-critical inputs;
- verify normal production calculation behavior if runtime integration changes the execution path.

---

# Gate C Final Closeout — DONE

Formal evidence: `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`

Final evidence chain:

- C5b read-only production audit #3215 / `31298163263`: **CLEAR**, 2 users / 168 records, zero prefix or duplicate-provenance findings;
- C6a PR #154: blocking split-adjusted prefix gate before calculator/upload;
- C6a final CI #462, post-main CI #463: SUCCESS;
- normal production smoke #3216 / `31299421865`: SUCCESS, 2 users / 0 failed;
- C3-rem PR #156: explicit `Sequence` versus unsupported `_sequence` regression;
- C3-rem final CI #468, post-main CI #469: SUCCESS;
- final independent closeout PR #158 final head `6a1e91b73e499d915091c9f44a50ad8c3a283805`;
- PR #158 final CI #473 / `31300367340`: SUCCESS;
- PR #158 exact-head merge → `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`;
- post-main CI #474 / `31300456919`: SUCCESS;
- post-Gate-C recovery `backup-post-gate-c-ef9f5a1`.

Final C6b decision:

- retain calculator `CLAMP` as downstream compatibility/defense-in-depth;
- authoritative source integrity is the independent pre-calculator prefix gate;
- no C6b runtime migration is justified under current Schema 2;
- mandatory reopen conditions remain recorded in `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` and Decision D-C-06 below.

Gate C status: **DONE / CLOSED**.

---

# Earlier Completed Work

## Gate A / P6C

- PR #148 merge `f3c55f4cd322c35ca163e1330f7b1e7bc14580bf`
- final PR CI #429 SUCCESS
- post-main CI #430 SUCCESS
- production smoke #3213 / `31295494999`: SUCCESS; 2 users / 0 failed
- recovery `backup-post-product-integrity-p6c-f3c55f4`

## Gate B / P5C3B

- PR #149 merge `03242d00082067333cf77ffa424094b8936b406c`
- final CI #433 SUCCESS
- post-main CI #434 SUCCESS
- recovery `backup-post-gate-b-03242d0`
- source-record delete + last-record snapshot cleanup share one D1 `batch()`; malformed result/cardinality fail closed.

## Gate C / C1–C6

- C1 established that final holdings and downstream agreement cannot certify every persisted source prefix.
- C2 introduced deterministic split-adjusted prefix validation.
- C5a/C5b safely qualified production data before enforcement.
- C6a made the source gate blocking before calculator/upload and production-verified it.
- C3-rem corrected false-positive Sequence regression coverage.
- final independent review found no unresolved Gate-C blocker and closed C6b without unnecessary runtime expansion.

---

# Decision Log

## D-C-01 — Source ledger first

**Decision:** split-adjusted `Date -> id` prefix integrity is the Schema-2 source-ledger gate.  
**Status:** LOCKED.

## D-C-02 — Record id is not broker chronology

**Decision:** `id` is a deterministic validity-order tie-breaker only.  
**Status:** LOCKED until first-class execution identity/time exists.

## D-C-03 — Audit before enforcement

**Decision:** read-only production qualification precedes blocking enforcement.  
**Status:** SATISFIED by C5b → C6a.

## D-C-04 — Public audit output counts-only

**Status:** LOCKED.

## D-C-05 — `AI_PROJECT_PLAYBOOK.md` governance baseline

**Status:** LOCKED while current on main.

## D-C-06 — C6b final decision

**Decision:** retain calculator `CLAMP` under current Schema-2 protected production path; no C6b runtime migration now.  
**Reason:** strict source preflight is authoritative and current production cannot supply alternative explicit chronology; a one-line policy switch would not constitute a complete internal execution-invariant redesign.  
**Reopen if:** first-class chronology is introduced, a production runner bypasses preflight, negative-position/derivative semantics are added, validated-ledger/FIFO divergence is proven, canonical execution identity is introduced, or an incident proves downstream compatibility behavior masks a reachable post-preflight error.  
**Status:** LOCKED subject to reopen conditions.

## D-C-07 — Do not parse free-form notes as financial chronology

**Status:** LOCKED pending explicit structured schema redesign.

## D-C-08 — `Sequence` and `_sequence` are distinct contracts

**Decision:** only recognized `Sequence` / `Timestamp` may alter explicit calculator same-day ordering; `_sequence` has no financial-ordering semantics.  
**Status:** LOCKED for Schema 2.

## D-D-01 — Evidence contract before storage/schema changes

**Decision:** D1a must audit existing serialization/provenance boundaries before choosing where the calculation manifest lives.  
**Reason:** adding D1/Worker fields prematurely would couple reproducibility to persistence design without evidence.  
**Status:** ACTIVE.

## D-D-02 — Deterministic identity excludes run-time volatility

**Decision:** calculation timestamp may identify a run instance but must not contaminate the deterministic canonical input hash unless a separate versioned contract explicitly requires it.  
**Status:** PROVISIONAL pending D1a evidence.

---

# Root Cause Log

## RC-C-01 — Invalid source prefixes could be hidden

**Fix:** split-adjusted prefix validation before calculator/upload.  
**Status:** FIXED by C6a; production verified.

## RC-C-02 — Historical `_sequence` test was a false positive

**Fix:** explicit `Sequence` versus `_sequence` regression with order-sensitive quantities.  
**Status:** FIXED by C3-rem; post-main verified.

---

# Remaining Known Issues / Technical Debt

These are **not** solved by Gate C and are not automatically in Gate D scope:

- Schema 2 lacks first-class immutable external execution identity/time/sequence.
- Net-negative commission/rebate is not faithfully representable because Commission/Tax paths normalize with `abs()`.
- Futures/derivatives lack first-class asset class / multiplier support.
- Legacy TransactionAnalyzer broad zero-on-exception behavior remains technical debt; no authoritative live consumer currently identified.
- Execution provenance remains optional free-form note metadata rather than enforced schema fields.
- Calculator/analyzer/Daily-P&L lot semantics are not consolidated into one canonical ledger engine.
- P4B net daily cash flow cannot reconstruct gross intraday Modified-Dietz timing on zero-start days.

---

# Deferred Architecture Candidates

## Schema-3 execution identity

Candidate fields include broker/source, immutable external execution id, order id, executed_at, currency, asset class and multiplier.  
**Revisit:** after Gate D closeout + fresh architecture review.

## Immutable `broker_executions` table

**Revisit:** post-Gate-D review only.

## Canonical lot-ledger consolidation

**Revisit:** post-Gate-D evidence.

## Broad provider abstraction / cleanup / typing refactor

**Revisit:** only after higher-value correctness phases converge.

---

# Next Actions

## Immediate — Finish Gate D handoff docs

1. merge this handoff-only update through a scoped PR;
2. run exact-head CI and verify changed-file/review-thread/main-drift qualification;
3. verify post-main CI;
4. create a Gate-D-start recovery from the merged handoff main;
5. start D1a from a fresh scoped branch.

## D1a — architecture audit immediately after handoff

Search/audit existing implementation before adding code:

- snapshot models and JSON serialization;
- Worker upload payload contract;
- any existing manifest/provenance/input-hash/source metadata;
- market-data/FX/split/dividend/realtime/synthetic valuation state;
- calculation timestamps/build SHA availability;
- benchmark/config identity;
- frozen/fake market clients and golden-style tests;
- deterministic snapshot/P&L/TWR/XIRR fixtures;
- any existing artifact or diagnostics boundary suitable for manifest output.

Then persist a narrow D1a evidence/proposal and only proceed to D1b after review.

## Gate D non-goals unless D1a proves a dependency

- Schema 3;
- `broker_executions` table;
- futures/derivatives support;
- broad provider abstraction;
- note-derived chronology;
- unrelated UX/refactor work.
