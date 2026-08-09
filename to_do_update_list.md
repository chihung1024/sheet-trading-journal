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
- Protected main: `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- Gate D / D1b: **DONE / POST-MAIN VERIFIED**
- D1b PR #162 exact-head merge → `ad9b98f996fdb9e3151f0ba3b201dfbeb3b5febf`
- D1b final-head CI #485 / `31302244853`: **SUCCESS**
- D1b post-main CI #486 / `31302369991`: **SUCCESS**
- D1b recovery: `backup-post-gate-d-d1b-ad9b98f`
- D1b closeout handoff PR #163 merge → `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`
- D1b closeout post-main CI #488: **SUCCESS**
- Current active Batch: **Gate D / D1c — effective market/FX/synthetic provenance**.
- D1c PR #164 is **ACTIVE / CODE-HEAD QUALIFIED / FINAL-HEAD CI PENDING**.
- D1c pre-change recovery: `backup-pre-gate-d-d1c-4971dbb`.
- D1c qualified code head before this handoff update: `9f2ac5dfe7c4464ff9846573c66f2eb163ed3484`.
- There is still **no production manifest attachment**; D1e remains the only planned production attachment phase.

## Recovery refs

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C audit infra: `backup-post-gate-c-audit-infra-24fd65c`
- post-C6a: `backup-post-gate-c-c6a-e5df59e`
- post-C3-rem: `backup-post-gate-c-c3-rem-5928c52`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D start: `backup-gate-d-start-41338e5`
- post-D1a: `backup-post-gate-d-d1a-0d9ad8e`
- pre-D1b: `backup-pre-gate-d-d1b-88a9701`
- post-D1b: `backup-post-gate-d-d1b-ad9b98f`
- pre-D1c: `backup-pre-gate-d-d1c-4971dbb`

---

# Master Plan

| Phase | Batch | Objective | Status | Verification / dependency |
|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | **DONE** | PR #148 + CI + prod smoke |
| Gate B | P5C3B | atomic Worker record deletion | **DONE** | PR #149 + CI + recovery |
| Gate C | C1–C6 | source-ledger integrity qualification/enforcement | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | reproducibility/provenance architecture audit | **DONE / POST-MAIN VERIFIED** | PR #160/#161 + CI #477–#480 + recovery |
| Gate D | D1b | pure deterministic manifest primitives | **DONE / POST-MAIN VERIFIED** | PR #162/#163 + CI #485/#486/#488 + recovery |
| Gate D | D1c | effective market/FX/synthetic provenance | **ACTIVE / FINAL-HEAD CI PENDING** | PR #164; code-head CI #494 qualified |
| Gate D | D1d | frozen deterministic golden replay | TODO | D1b + D1c + explicit clock/as-of seam |
| Gate D | D1e | smallest compatible production integration | TODO | D1b–D1d proven first |
| Gate D | Closeout | independent reproducibility review | TODO | exact-head CI + post-main + recovery |
| Post-D | Architecture review | Schema 3 / canonical ledger / provider abstraction | DEFERRED | fresh review after Gate D |

---

# Current Phase — Gate D

**Goal:** given the same trusted transaction ledger and declared external inputs/configuration, a future reviewer can identify exactly what was calculated, distinguish why an output changed, and reproduce a known-good result offline.

Gate D operates on the qualified Schema-2 pipeline unless evidence proves a blocking dependency.

---

# D1a — DONE / POST-MAIN VERIFIED

Formal evidence: `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`.

Closeout chain:

- PR #160 merge → `0d9ad8ea15599bcc7ebdc53bb6b1af98887966e7`
- PR CI #477 / `31301386915`: SUCCESS
- post-main CI #478 / `31301449682`: SUCCESS
- recovery `backup-post-gate-d-d1a-0d9ad8e`
- handoff PR #161 merge → `88a9701a7c16f05a7f47fc02d298391f2f516746`
- post-main CI #480: SUCCESS

Qualified architecture decisions:

- no D1/Worker migration is currently required for manifest storage;
- preferred later D1e boundary is optional additive `PortfolioSnapshot.calculation_manifest` if compatibility tests pass;
- source record identity fields are `id, Date, Symbol, Type, Qty, Price, Commission, Tax, Tag`;
- exclude free-form `note`, `created_at`, user ownership identity from financial source hash;
- effective market/FX numeric identity must be separated from provider provenance;
- D1d requires one explicit `calculation_as_of`/clock seam;
- existing mixed TW/US golden fixture should be evolved, not replaced;
- populated production `lot_ledger` is not a Gate-D requirement.

---

# D1b — DONE / POST-MAIN VERIFIED

PR: **#162 — Gate D D1b: deterministic manifest identity primitives**

Base main: `88a9701a7c16f05a7f47fc02d298391f2f516746`  
Pre-D1b recovery: `backup-pre-gate-d-d1b-88a9701`  
Final PR head: `547240967e3841afd39b536b27e9d6ed21490565`  
Merge: `ad9b98f996fdb9e3151f0ba3b201dfbeb3b5febf`  
Post-D1b recovery: `backup-post-gate-d-d1b-ad9b98f`

## Implemented contract

`journal_engine/core/calculation_manifest.py` remains a **pure module** with no production runner/storage/market integration.

Versioned contracts:

- canonical JSON v1;
- source transaction canonicalization v1;
- runtime config canonicalization v1;
- deterministic calculation identity v1.

Capabilities:

- canonical UTF-8 JSON with fixed key/separator rules;
- exact finite-float representation via tagged `float.hex()`;
- SHA-256 deterministic digests;
- exact positive record-id handling via Decimal/string conversion, including ids above 2^53;
- normalized source projection in deterministic `Date -> id` order;
- source identity diagnostics: record count + max record id;
- runtime config identity for benchmark/base currency/oversell policy;
- exact lowercase 40-character engine Git SHA resolver; no branch/short-SHA fallback;
- combined deterministic identity over engine/source/config/market-hash/FX-hash/`calculation_as_of`;
- run-instance `calculated_at` intentionally excluded;
- frozen/extra-forbid Pydantic contracts with exact version literals, digest self-consistency and tamper rejection.

Privacy boundary:

- user email/id excluded;
- free-form `note` excluded;
- `created_at` excluded;
- auth/API data excluded;
- raw broker metadata excluded.

## D1b hardening and CI evidence

Initial CI #481 / `31301845162`: SUCCESS.

Independent review identified and fixed three in-scope quality issues:

1. initial record-id normalization passed through binary float and could lose >2^53 precision;
2. `pd.NA` required text needed explicit fail-closed handling;
3. invalid-value tests introduced pandas FutureWarnings.

Hardening heads:

- `36405e1e2fe5b80a5ff0e43186aa8420b2c64bec`
- `c49d65e004b23790fcc9584a981f49ccf57ebdc4`
- `ea9dbaf6826cd66ff9c0e3bd7306a5dc4a4e6a9d`

CI #483 / `31302023107`: SUCCESS; 307 passed / 18 subtests; D1b-introduced FutureWarnings removed.

CI #484 / `31302163349`: SUCCESS; 310 passed / 18 subtests. New module achieved:

- 234 statements
- 0 missing
- 70 branches
- 0 partial
- **100% line/branch coverage**

Overall measured coverage: **79.87465181058496%**.

Coverage governance only added the new source file to exact inventory; existing floors were not lowered:

- minimum percent 68.55
- minimum covered lines 1523
- minimum covered branches 439
- maximum missing lines 591
- maximum missing branches 309

Final exact-head CI #485 / `31302244853`: SUCCESS across Python / Frontend / Worker-D1.

Final qualification:

- changed files exactly: pure module, contract tests, coverage source inventory, handoff;
- reviews 0;
- unresolved threads 0;
- protected main had no drift immediately before merge;
- independent semantic/privacy/scope review: PASS.

PR #162 exact-head merge → `ad9b98f996fdb9e3151f0ba3b201dfbeb3b5febf`.

Post-main CI #486 / `31302369991`: **SUCCESS across all three jobs**.

D1b closeout handoff PR #163 merge → `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`.

D1b closeout post-main CI #488: **SUCCESS across all three jobs**.

Status: **DONE / POST-MAIN VERIFIED**.

---

# D1c — ACTIVE / FINAL-HEAD CI PENDING

PR: **#164 — Gate D D1c: effective market and FX provenance identity**  
Base main: `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`  
Pre-D1c recovery: `backup-pre-gate-d-d1c-4971dbb`  
Qualified code head before handoff update: `9f2ac5dfe7c4464ff9846573c66f2eb163ed3484`

## Objective

Create deterministic identity and compact provenance diagnostics for the **effective market, FX and synthetic valuation inputs actually used by the current calculation model**, while remaining network-free/pure and without attaching the manifest to production.

## Implemented pure contract

`journal_engine/core/input_provenance.py` is a pure, network-free D1c module. It does not alter runner, snapshot, Worker, D1, schema, clock/as-of behavior or market download behavior.

Versioned contracts:

- market-input canonicalization v1;
- FX-input canonicalization v1;
- provider diagnostics v1.

Effective market identity includes only:

- normalized symbol/date ordering;
- `Close_Adjusted`;
- effective `Dividends` defaulting to `0.0` when absent;
- effective `Split_Factor` defaulting to `1.0` when absent;
- `Valuation_Source`;
- `Valuation_Source_Date`.

Irrelevant vendor OHLC/Volume payload is excluded from the deterministic digest.

Synthetic valuation provenance reuses only the existing vocabulary:

- `market`;
- `asof_carry_forward`;
- `transaction_price_seed`.

Effective FX identity includes:

- normalized required currency/date ordering;
- TWD constant `1.0` semantics;
- historical native/TWD rates;
- optional realtime FX state/value only when explicitly included.

Provider diagnostics remain a separate non-hashed contract:

- `price_source`;
- `selection_reason`;
- normalized realtime-overlay symbols.

No broad provider abstraction was introduced.

## D1c fail-closed / hardening behavior

- non-DataFrame/empty/missing-material market frames fail closed;
- invalid/duplicate/timezone/time-of-day market indices fail closed;
- non-finite/non-positive required prices/split factors fail closed;
- unknown/ambiguous synthetic source fails closed;
- synthetic source dates are validated against row-date semantics;
- vector-like values are rejected before pandas missingness coercion;
- `pd.NA`/missing provider metadata is handled explicitly;
- generator-based overlay symbols are materialized once and normalized deterministically;
- duplicate normalized market/provider/currency identities fail closed.

Runtime `MarketDataClient` still has compatibility fallback behavior for malformed data. D1c intentionally does not change that runtime. The reproducibility extractor is stricter: ambiguous or invalid material state is not silently assigned a reproducible identity. Any future production attachment remains D1e work and must be compatibility-tested there.

## D1c CI / debugging evidence

### CI #489 / `31302844646` — defect discovery

Frontend and Worker/D1 were green; Python reported 5 failures.

Root causes:

1. three invalid-frame test fixtures used `data.update({"AAA": ...})` on data already containing lowercase `aaa`, accidentally creating duplicate normalized symbols before reaching the intended frame validation;
2. one duplicate-symbol expectation observed a different fail-closed validation priority;
3. overlay generator was consumed once during truthiness probing and a second time during normalization.

No production-path defect was found.

### CI #492 — scalar hardening discovery

After initial fixes, Frontend and Worker/D1 remained green; Python reduced to four failures with one common root cause:

`pd.isna(["x"])` yields a one-element ndarray whose truth conversion is not guaranteed to raise, so list/vector inputs could escape the intended scalar guard.

Root fix:

- use `pd.api.types.is_scalar(value)` before missingness handling;
- reject vector-like provenance values generically rather than adding field-specific exceptions.

### CI #493 — tests green, coverage governance caught residual branch debt

- **368 passed / 18 subtests / 2 existing warnings**;
- functional tests passed;
- coverage verifier correctly blocked merge on `missing branches`;
- no coverage gate was changed or lowered.

The uncovered D1c fail-closed branches were mapped to public boundary tests instead of weakening baseline policy.

### CI #494 / `31306406517` — code-head qualification

**SUCCESS across Python / Frontend / Worker-D1.**

Python:

- **378 passed**;
- **18 subtests passed**;
- only 2 pre-existing warnings;
- `input_provenance.py`: 262 statements / 2 missing lines / 128 branches / 0 partial branches / 99% displayed coverage;
- D1c module branch coverage is fully exercised; the only uncovered lines are the defensive exception wrapper around scalar `pd.isna`.

Exact repository coverage totals:

- covered lines: **2837**;
- missing lines: **567**;
- covered branches: **992**;
- missing branches: **302**;
- statements: **3404**;
- branches: **1294**;
- exact combined coverage: **81.50276713495104%**.

Coverage policy passed with the existing hard gates unchanged:

- minimum percent: 68.55;
- minimum covered lines: 1523;
- minimum covered branches: 439;
- maximum missing lines: 591;
- maximum missing branches: 309.

## Independent third-party-style review — code head `9f2ac5d...`

Result: **PASS / no BLOCKER**.

Scope/privacy findings:

- no production runner or snapshot attachment;
- no Worker route/code change;
- no D1/schema migration;
- no clock/as-of refactor;
- no network integration;
- no Schema 3 / broker-execution redesign;
- no user id/email, free-form note, auth/API secret or raw vendor payload enters deterministic identity;
- provider/source diagnostics remain separate from effective numeric input digests;
- coverage inventory added only the new source file; thresholds/floors were not weakened.

Semantic review also re-read current `MarketDataClient` split/dividend fallback behavior. D1c keeps the runtime unchanged and fails closed on ambiguous reproducibility inputs rather than silently minting an identity for malformed state. This remains pure-contract work; D1e must separately prove production compatibility before attachment.

Changed files at qualified code head were exactly:

- `journal_engine/core/input_provenance.py`;
- `tests/test_input_provenance.py`;
- `tests/test_input_provenance_hardening.py`;
- `docs/governance/python-coverage-baseline.json` — source inventory only.

This handoff update adds only `to_do_update_list.md` to that whitelist.

## Original D1c scope

### Effective market projection

For required symbols and relevant dates, canonicalize only calculation-effective fields:

- symbol;
- date;
- `Close_Adjusted`;
- `Dividends`;
- `Split_Factor`;
- effective `Valuation_Source`;
- `Valuation_Source_Date`.

Rules:

- stable symbol/date ordering;
- use D1b canonical/hash primitives;
- exclude irrelevant vendor OHLC/Volume data;
- fail closed on missing/ambiguous material values;
- preserve exact effective numeric values, including realtime-overwritten values when present.

### Effective FX projection

For each required native currency:

- currency;
- historical date/rate rows actually available to the calculation;
- effective realtime FX value/state only when supplied to the extractor;
- stable currency/date ordering;
- use D1b canonical/hash primitives;
- non-finite/ambiguous rates fail closed.

### Synthetic valuation provenance

Reuse existing transaction-calendar semantics:

- `market`;
- `asof_carry_forward`;
- `transaction_price_seed`;
- `Valuation_Source_Date`.

Do not invent a parallel synthetic provenance vocabulary.

### Provider/source diagnostics

Keep provider/source metadata **separate from effective numeric input hashes**.

D1c may add narrow structured provenance capture for currently lost price-selection/realtime-overlay state, but must not create broad provider abstraction.

### Diagnostics

Small non-sensitive diagnostics may include:

- covered symbols/currencies;
- market row count;
- FX row count;
- synthetic row counts by source;
- realtime overlay presence/count/state;
- projection/canonicalization versions.

No user id/email/note/auth/raw vendor payload in provenance identity.

## D1c required tests

- network-free only;
- deterministic repeatability;
- DataFrame/dict insertion order invariance;
- material field/value/date/source changes alter appropriate digest;
- irrelevant OHLC/Volume changes do not alter digest;
- synthetic provenance changes alter market digest;
- historical FX change alters FX digest;
- realtime FX state/value change alters FX digest when included;
- non-finite/missing material values fail closed;
- unknown/ambiguous synthetic source fails closed unless explicitly defined compatible policy exists;
- provider metadata changes alone do not change effective numeric input digest;
- diagnostics are consistent with canonical projection.

## D1c explicit non-goals

- no broad provider abstraction;
- no production snapshot/runner attachment;
- no D1/Worker/schema change;
- no clock/as-of runtime refactor yet;
- no network integration tests;
- no Schema 3;
- no execution/broker provenance redesign.

## D1c remaining execution plan

1. Run fresh CI on the new handoff-containing final PR head.
2. Confirm final changed-file whitelist, reviews/threads and protected-main drift.
3. If no BLOCKER, mark PR #164 ready and exact-head merge using that final head SHA.
4. Verify post-main CI.
5. Create post-D1c recovery from verified merged main.
6. Perform docs-only closeout handoff if the persistent state needs merge/recovery synchronization.
7. Only then activate D1d.

---

# D1d — PLANNED

After D1c closes:

1. introduce narrow explicit `calculation_as_of`/clock context;
2. evolve/add a versioned mixed TW/US frozen fixture;
3. prohibit network in replay;
4. cover prices, FX variation, split-sensitive inputs and dividends;
5. assert authoritative snapshot projection + Daily-P&L/TWR/XIRR + manifest hashes;
6. prove repeated replay exact deterministic identity;
7. distinguish source/market/FX/engine/config/synthetic causes of change.

---

# D1e — PLANNED

Only after D1b–D1d are independently proven:

1. add optional versioned `calculation_manifest` to `PortfolioSnapshot`;
2. construct at authoritative runner boundary after effective inputs are known;
3. attach before snapshot validation/upload;
4. preserve legacy snapshots without field;
5. test Worker opaque JSON round-trip and 1 MiB boundary;
6. test frontend unchanged by additive manifest field;
7. fail closed on missing/ambiguous manifest-critical identity;
8. run production smoke only if runtime path materially changes.

No D1 migration or Worker API change unless compatibility tests prove opaque snapshot storage insufficient.

---

# Gate D Closeout Criteria

- [x] D1a evidence merged/post-main/recovery complete.
- [x] D1b source/config/engine identity merged/post-main/recovery complete.
- [ ] D1c effective market/FX/synthetic provenance proven.
- [ ] D1d deterministic offline replay proven.
- [ ] D1e compatible production attachment proven.
- [ ] change cause can be distinguished among source records / effective market or provider / FX / engine / runtime config / synthetic valuation.
- [ ] independent Gate-D review finds no unresolved reproducibility blocker.
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
- **D-D-01 SATISFIED:** D1a audited evidence/storage boundaries before migrations; no D1/Worker migration required.
- **D-D-02 LOCKED:** deterministic identity separated from volatile run metadata; `calculation_as_of` deterministic, `calculated_at` not.
- **D-D-03 LOCKED:** hash effective market/FX inputs separately from provider provenance.
- **D-D-04 QUALIFIED, NOT YET IMPLEMENTED:** optional snapshot manifest is preferred D1e production boundary.
- **D-D-05 LOCKED BY D1b:** source-record identity uses exact versioned canonical UTF-8 JSON + SHA-256 over material normalized fields; exact ids do not round-trip through binary float.
- **D-D-06 LOCKED BY D1b:** engine identity requires exact full lowercase Git SHA; branch/short SHA is not a reproducible identity.
- **D-D-07 QUALIFIED BY D1c CODE HEAD:** provider/source diagnostics remain separate from calculation-effective numeric input digests; provider abstraction is not required for deterministic input identity.
- **D-D-08 QUALIFIED BY D1c CODE HEAD:** ambiguous/non-scalar/non-finite market, FX or synthetic provenance input fails closed rather than receiving a deterministic identity.

---

# Root Cause / Risk Log

- **RC-D-01 PARTIALLY FIXED:** source/config/engine deterministic identity is complete in D1b and market/FX/synthetic identity is code-head qualified in D1c; production attachment remains D1e.
- **RC-D-02 OPEN:** wall clock breaks true replay → D1d explicit as-of/clock seam.
- **RC-D-03 CODE-HEAD FIXED / MERGE PENDING:** effective market/FX/synthetic state now has pure deterministic identity and separate provider diagnostics in PR #164.
- **RC-D-04 OPEN:** existing golden regression too shallow → D1d.
- **RC-D-05 CLOSED:** record-id canonicalization no longer risks >2^53 float precision loss.
- **RC-D-06 FIXED IN D1c:** one-shot iterables are materialized once; provider overlay generators are not consumed during truthiness probing.
- **RC-D-07 FIXED IN D1c:** vector-like pandas provenance values are rejected before missingness conversion; no single-element ndarray truthiness ambiguity remains.
- **RC-D-08 FIXED IN D1c:** coverage regression was resolved by exercising fail-closed branches; coverage gates were not weakened.

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

## Finish D1c PR #164

1. Resolve the new exact final PR head after this handoff commit.
2. Run fresh full CI on that exact head; prior CI #494 is code-head evidence only.
3. Confirm changed files are exactly D1c pure source/tests + coverage source inventory + this handoff.
4. Re-check reviews, unresolved threads and protected `main` drift.
5. If no BLOCKER, mark ready and exact-head merge PR #164.
6. Verify post-main CI.
7. Create post-D1c recovery and persist merge/CI/recovery closeout evidence.

## Then start D1d

1. Create one scoped D1d branch from verified stable main.
2. Introduce only the narrow explicit `calculation_as_of`/clock seam required for deterministic replay.
3. Evolve the existing mixed TW/US frozen fixture; do not replace proven focused tests.
4. Keep replay network-free and assert authoritative outputs + manifest digests.
5. Do not start D1e production attachment until D1d independently passes.
