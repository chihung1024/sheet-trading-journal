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
- Production default behavior must remain unchanged unless a Batch explicitly authorizes behavior change.
- A Batch is not complete if this file is stale.

---

# Current Stable State

- Repository: `chihung1024/sheet-trading-journal`
- Protected main: `62b13dc7c29591a7fcff24a20b48fe06aa8177ea`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- Gate D / D1b: **DONE / POST-MAIN VERIFIED**
- Gate D / D1c: **DONE / POST-MAIN VERIFIED**
- Gate D / D1d: **DONE / POST-MAIN VERIFIED**
- D1d PR #166 final head: `71d6b4445ed8e139352f73f0ba669dffc9575ad2`
- D1d final-head CI #513 / `31311239217`: **SUCCESS**
- D1d exact-head merge → `62b13dc7c29591a7fcff24a20b48fe06aa8177ea`
- D1d post-main CI #514 / `31311341049`: **SUCCESS**
- D1d recovery: `backup-post-gate-d-d1d-62b13dc`
- Current active Batch after this closeout handoff merge: **Gate D / D1e — smallest compatible production `calculation_manifest` integration**.
- D1e has **not** yet modified production code in this closeout branch.

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
- post-D1c: `backup-post-gate-d-d1c-768fdb6`
- pre-D1d: `backup-pre-gate-d-d1d-1381f17`
- post-D1d: `backup-post-gate-d-d1d-62b13dc`

---

# Master Plan

| Phase | Batch | Objective | Status | Verification / dependency |
|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | **DONE** | PR #148 + CI + prod smoke |
| Gate B | P5C3B | atomic Worker record deletion | **DONE** | PR #149 + CI + recovery |
| Gate C | C1–C6 | source-ledger integrity qualification/enforcement | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | reproducibility/provenance architecture audit | **DONE / POST-MAIN VERIFIED** | PR #160/#161 + CI #477–#480 + recovery |
| Gate D | D1b | pure deterministic manifest primitives | **DONE / POST-MAIN VERIFIED** | PR #162/#163 + CI #485/#486/#488 + recovery |
| Gate D | D1c | effective market/FX/synthetic provenance | **DONE / POST-MAIN VERIFIED** | PR #164/#165 + CI #495–#498 + recovery |
| Gate D | D1d | frozen deterministic golden replay | **DONE / POST-MAIN VERIFIED** | PR #166 + CI #513/#514 + recovery |
| Gate D | D1e | smallest compatible production integration | **ACTIVE / NEXT** | D1b–D1d proven |
| Gate D | Closeout | independent reproducibility review | TODO | D1e + exact-head/post-main + recovery |
| Post-D | Architecture review | Schema 3 / canonical ledger / provider abstraction | DEFERRED | fresh review after Gate D |

---

# Gate D Objective

Given the same trusted transaction ledger and declared external inputs/configuration, a future reviewer must be able to:

1. identify exactly what was calculated;
2. distinguish why an output changed;
3. reproduce a known-good result offline;
4. separate deterministic calculation identity from volatile run-instance metadata;
5. prove production compatibility before attaching reproducibility evidence to snapshots.

Gate D remains on the qualified Schema-2 pipeline unless evidence proves a blocking dependency.

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

Locked architecture decisions:

- no D1/Worker migration is required for Gate-D manifest evidence unless D1e compatibility proves otherwise;
- preferred D1e boundary is optional additive `PortfolioSnapshot.calculation_manifest`;
- source financial identity fields are `id, Date, Symbol, Type, Qty, Price, Commission, Tax, Tag`;
- exclude free-form `note`, `created_at`, ownership/auth identity from deterministic financial source hash;
- effective market/FX numeric identity is separate from provider diagnostics;
- deterministic replay requires an explicit calculation-as-of/clock seam;
- populated production `lot_ledger` is not a Gate-D prerequisite.

---

# D1b — DONE / POST-MAIN VERIFIED

PR #162 implemented pure deterministic manifest primitives in `journal_engine/core/calculation_manifest.py`.

Core contract:

- canonical UTF-8 JSON v1;
- exact finite-float representation;
- SHA-256 deterministic hashes;
- exact record-id normalization including >2^53 ids;
- deterministic source projection in `Date -> id` order;
- runtime config identity for benchmark/base currency/oversell policy;
- exact full lowercase 40-character Git SHA engine identity;
- combined deterministic identity over engine/source/config/market/FX/`calculation_as_of`;
- `calculated_at` excluded from deterministic identity;
- frozen/extra-forbid models with self-consistency/tamper rejection.

Privacy boundary excludes user id/email, note, `created_at`, auth/API data and raw broker metadata.

Evidence:

- code-head CI #484 / `31302163349`: 310 passed / 18 subtests;
- new module: **100% line/branch coverage**;
- final-head CI #485 / `31302244853`: SUCCESS;
- PR #162 merge → `ad9b98f996fdb9e3151f0ba3b201dfbeb3b5febf`;
- post-main CI #486 / `31302369991`: SUCCESS;
- recovery `backup-post-gate-d-d1b-ad9b98f`;
- closeout PR #163 merge → `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`;
- closeout post-main CI #488: SUCCESS.

---

# D1c — DONE / POST-MAIN VERIFIED

PR #164 implemented pure/network-free effective-input provenance in `journal_engine/core/input_provenance.py`.

Market identity includes calculation-effective symbol/date, `Close_Adjusted`, effective dividends/splits, `Valuation_Source`, and `Valuation_Source_Date`.

Synthetic vocabulary remains exactly:

- `market`;
- `asof_carry_forward`;
- `transaction_price_seed`.

FX identity includes required currencies, historical TWD/native rates, TWD constant 1.0 semantics, and optional realtime FX only when explicitly included.

Provider diagnostics remain separate/non-hashed.

Hardening/debug evidence:

- CI #489 exposed fixture duplicate collisions + one-shot generator consumption;
- CI #492 exposed scalar/vector ambiguity;
- CI #493 showed functional green but coverage governance correctly blocked residual branch debt;
- missing branches were covered rather than weakening gates.

Qualification:

- code-head CI #494: SUCCESS;
- final-head CI #495 / `31306660733`: SUCCESS;
- PR #164 merge → `768fdb6e290dca36c0fd8fc1209a87c3357935d6`;
- post-main CI #496: SUCCESS;
- recovery `backup-post-gate-d-d1c-768fdb6`;
- closeout PR #165 merge → `1381f1780ea46b7878ce2667899fe16373eb2c28`;
- closeout post-main CI #498: SUCCESS.

---

# D1d — DONE / POST-MAIN VERIFIED

PR: **#166 — Gate D D1d: deterministic golden replay**  
Base main: `1381f1780ea46b7878ce2667899fe16373eb2c28`  
Pre-D1d recovery: `backup-pre-gate-d-d1d-1381f17`  
Final PR head: `71d6b4445ed8e139352f73f0ba669dffc9575ad2`  
Merge: `62b13dc7c29591a7fcff24a20b48fe06aa8177ea`  
Post-D1d recovery: `backup-post-gate-d-d1d-62b13dc`

## Implemented clock/as-of seam

`PortfolioCalculator` accepts optional `calculation_now`:

- injected clock must be timezone-aware;
- normalized to `Asia/Taipei`;
- explicit `calculation_as_of` available;
- replay uses one fixed timestamp;
- `DailyPnLHelper` accepts optional `now_provider`;
- invalid/naive provider values fail closed.

### Production-default compatibility — independently reviewed BLOCKER resolved

An early seam version could have changed normal production run-level wall-clock semantics. This was blocked before merge.

Final behavior:

- replay mode: fixed injected clock;
- normal production market-stage/today logic: existing Taipei-aware wall clock;
- normal production `updated_at`/group date-range call sites: existing naive system-local `datetime.now()` semantics preserved;
- each original default wall-clock call site remains independently evaluated as before.

No FIFO, transaction ordering, TWR, XIRR, dividend, split, FX or Daily-P&L formula changed.

## Frozen network-free replay

Fixture: `tests/fixtures/golden_replay_mixed_tw_us_v1.json`

Covers:

- SPY benchmark;
- 2330.TW;
- NVDA;
- fixed `2026-01-05T15:00:00+08:00` replay clock;
- stable source record ids;
- split-sensitive transaction;
- TW + US dividends;
- variable historical USD/TWD FX;
- realtime FX;
- `transaction_price_seed` provenance;
- extreme post-as-of future rows to prove cutoff isolation;
- provider diagnostics separated from numeric identity.

Replay execution path matches production calculation order:

1. raw ledger;
2. calculator with injected clock;
3. split adjustment/calculation;
4. canonical Daily-P&L reconciliation;
5. D1b identities;
6. D1c identities;
7. deterministic snapshot projection excluding volatile `updated_at`;
8. exact SHA-256.

Network access is explicitly forbidden in replay tests.

## Reviewed golden economics

- invested capital: **11,433 TWD**;
- total value: **12,250 TWD**;
- pending/realized dividend contribution: **111 TWD**;
- total P&L: **928 TWD**;
- Daily-P&L: **961 TWD**;
- breakdown: TW **120** / foreign price+dividend **741** / FX **100**;
- linked TWR: **8.16%**, status `ok`;
- XIRR: **1,329,427.60%**, status `ok`, as-of `2026-01-05`.

The XIRR is intentionally extreme because the fixture spans only three days; it is deterministic regression evidence, not an investment benchmark.

Frozen identities:

- snapshot content SHA-256: `257117e2ee7516e25a37d24d52525c6e8ae08c8ff00e785a1beb268cd005a21c`;
- combined D1b+D1c deterministic input SHA-256: `6f213201279bf7ff6a58d0cb7af237e5fdcb8db1f2006c1f368c61c0cc85fe05`.

Fixture engine identity is explicitly marked `declared_test_input_not_runtime_attestation`; D1e must resolve the real runtime full Git SHA.

## Change-cause isolation proven

D1d can distinguish changes caused by:

- source records;
- effective market state;
- FX state;
- synthetic valuation provenance;
- engine identity;
- runtime configuration.

Provider diagnostics and post-as-of future rows do not pollute deterministic numeric identity.

## CI / review chronology

- CI #499: intentional red test-first seam baseline;
- CI #501: minimum clock seam green;
- CI #503: only content-digest placeholder remained;
- CI #505: reviewed economic assertions all passed; only combined-input placeholder remained;
- CI #506: first no-placeholder full green;
- CI #509: engine-attestation wording + clock hardening green;
- independent review found production-default clock drift BLOCKER;
- root fix restored original default wall-clock call-site semantics;
- code-head CI #512 / `31308960934`: SUCCESS, **387 passed + 18 subtests**, 2 pre-existing warnings;
- final-head CI #513 / `31311239217`: **SUCCESS across Python / Frontend / Worker-D1**;
- exact-head merge guarded by `71d6b4445ed8e139352f73f0ba669dffc9575ad2`;
- merged main: `62b13dc7c29591a7fcff24a20b48fe06aa8177ea`;
- post-main CI #514 / `31311341049`: **SUCCESS across all three jobs**;
- recovery: `backup-post-gate-d-d1d-62b13dc`.

Code-head coverage evidence from CI #512:

- covered lines: 2867;
- missing lines: 564;
- covered branches: 1006;
- missing branches: 300;
- statements: 3431;
- branches: 1306;
- combined coverage: **81.760607979734%**;
- coverage policy passed without weakening any gate.

Final qualification before merge:

- changed files exactly: calculator clock seam, DailyPnL helper seam, versioned replay fixture, clock tests, replay tests, handoff;
- reviews: 0;
- review threads: 0;
- comments: 0;
- protected main had no drift;
- independent semantic/privacy/scope review: PASS after BLOCKER resolution.

Status: **DONE / POST-MAIN VERIFIED**.

---

# D1e — ACTIVE / NEXT

## Objective

Attach the already-proven D1b/D1c/D1d reproducibility evidence at the **smallest compatible production boundary**, without redesigning Worker/D1/schema unless compatibility evidence proves necessary.

## Required authoritative read before modification

From the verified main after this docs-only closeout:

1. `journal_engine/models.py` — current `PortfolioSnapshot` contract and additive-field behavior;
2. `main.py` — exact authoritative boundary after calculator + canonical Daily-P&L reconciliation and before validation/upload;
3. `journal_engine/core/calculation_manifest.py` — D1b identity models/full Git SHA resolver;
4. `journal_engine/core/input_provenance.py` — D1c market/FX/provider contracts;
5. D1d clock/as-of semantics and replay fixture;
6. Worker snapshot GET/POST storage behavior and payload-size limits;
7. frontend snapshot parsing/consumption contracts;
8. existing snapshot compatibility/security tests.

Do not implement until these are re-read on merged main.

## Planned minimal implementation

Subject to the authoritative read:

1. add optional versioned `calculation_manifest` to `PortfolioSnapshot`;
2. build manifest only after source ledger, effective market/FX state, calculator result and canonical Daily-P&L reconciliation are all known;
3. resolve the real full runtime Git SHA — never use branch, short SHA or D1d declared fixture SHA;
4. use D1b source/config/combined identity and D1c market/FX/provider diagnostics;
5. attach before final snapshot validation/upload;
6. keep legacy snapshots without manifest valid;
7. prove Worker stores/returns the field opaquely without route/schema changes;
8. prove 1 MiB payload policy remains safe;
9. prove frontend behavior is unchanged by the additive field;
10. fail closed on missing/ambiguous manifest-critical identity rather than uploading misleading evidence.

## D1e explicit non-goals

- no Schema 3;
- no D1 migration unless compatibility evidence proves it unavoidable;
- no Worker API redesign;
- no provider abstraction;
- no broker-execution redesign;
- no canonical lot-ledger expansion;
- no unrelated frontend/UX changes.

## D1e verification requirements

- model backward compatibility;
- exact manifest version/shape validation;
- real full-Git-SHA resolution/fail-closed tests;
- source/market/FX/config/as-of identity composition tests;
- provider diagnostics remain non-hashed as designed;
- Worker opaque round-trip test;
- Worker payload-size boundary test;
- frontend additive-field compatibility test;
- focused/full CI;
- independent semantic/privacy/scope review;
- exact-head merge → post-main CI → recovery → handoff closeout;
- production smoke only if runtime behavior materially changes and smoke can be performed safely.

---

# Gate D Closeout Criteria

- [x] D1a evidence merged/post-main/recovery complete.
- [x] D1b source/config/engine identity merged/post-main/recovery complete.
- [x] D1c effective market/FX/synthetic provenance merged/post-main/recovery complete.
- [x] D1d deterministic offline replay merged/post-main/recovery complete.
- [ ] D1e compatible production attachment proven.
- [x] change-cause distinction proven at replay-contract level.
- [ ] independent final Gate-D review finds no unresolved reproducibility blocker after D1e.
- [ ] final Gate-D exact-head merge/post-main verification complete.
- [ ] post-Gate-D recovery created.
- [ ] handoff updated before post-Gate-D architecture review.

---

# Gate C — DONE / CLOSED

Formal evidence: `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`.

Key chain:

- C5b audit #3215: CLEAR, 2 users / 168 records, zero prefix/duplicate findings;
- C6a PR #154: blocking split-adjusted source-prefix gate; CI #462/#463; prod smoke #3216 succeeded 2/0;
- C3-rem PR #156: explicit `Sequence` vs unsupported `_sequence`; CI #468/#469;
- final PR #158 merge `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`; post-main CI #474;
- recovery `backup-post-gate-c-ef9f5a1`;
- Gate-D handoff PR #159 merge `41338e598f027a502a81c7d08eaec3c2f4069a04`; CI #476.

C6b decision remains locked: retain calculator `CLAMP` as downstream compatibility/defense-in-depth. Source-prefix preflight remains authoritative.

---

# Decision Log

- **D-C-01 LOCKED:** split-adjusted `Date -> id` prefix integrity is the Schema-2 source gate.
- **D-C-02 LOCKED:** record id is deterministic validity order, not broker chronology.
- **D-C-06 LOCKED:** retain CLAMP under protected Schema-2 path absent documented reopen conditions.
- **D-C-07 LOCKED:** free-form note is not chronology.
- **D-C-08 LOCKED:** `Sequence`/`Timestamp` are recognized contracts; `_sequence` is not.
- **D-D-01 SATISFIED:** D1a found no Gate-D need for D1/Worker migration.
- **D-D-02 LOCKED:** deterministic identity excludes volatile run metadata.
- **D-D-03 LOCKED:** effective market/FX identity is separate from provider diagnostics.
- **D-D-04 ACTIVE FOR D1e:** optional snapshot manifest remains the preferred production boundary pending compatibility proof.
- **D-D-05 LOCKED BY D1b:** exact canonical source identity; no binary-float record-id path.
- **D-D-06 LOCKED BY D1b:** production engine identity requires exact full lowercase Git SHA.
- **D-D-07 LOCKED BY D1c:** provider diagnostics are separate from numeric digests.
- **D-D-08 LOCKED BY D1c:** ambiguous market/FX/synthetic provenance fails closed.
- **D-D-09 LOCKED BY D1d:** deterministic replay uses explicit timezone-aware calculation clock/as-of.
- **D-D-10 LOCKED BY D1d:** replay clock injection must not change default production wall-clock semantics.
- **D-D-11 LOCKED BY D1d:** declared fixture engine SHA is test input only, not production attestation.

---

# Root Cause / Risk Log

- **RC-D-01 PARTIALLY FIXED:** identity primitives/provenance/replay are complete; production attachment remains D1e.
- **RC-D-02 CLOSED:** wall-clock replay ambiguity fixed with explicit seam while production defaults remain compatible.
- **RC-D-03 CLOSED:** effective market/FX/synthetic provenance identity complete.
- **RC-D-04 CLOSED:** mixed TW/US deterministic golden replay now covers split, dividend, FX, synthetic provenance, Daily-P&L, TWR/XIRR and exact digests.
- **RC-D-05 CLOSED:** >2^53 record-id precision risk fixed.
- **RC-D-06 CLOSED:** one-shot iterable consumption fixed.
- **RC-D-07 CLOSED:** vector-like provenance missingness ambiguity fixed.
- **RC-D-08 CLOSED:** coverage regressions resolved by tests, not weaker gates.
- **RC-D-09 CLOSED:** fixture engine identity cannot be confused with production attestation.
- **RC-D-10 OPEN FOR D1e:** production snapshot currently carries no reproducibility manifest; D1e must attach it compatibly or prove a different minimal boundary is necessary.

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

## Finish D1d docs-only closeout

1. Open a docs-only PR from `pr-gate-d-d1d-closeout`.
2. Verify single-file whitelist, exact-head CI, reviews/threads/comments and main drift.
3. Exact-head merge and verify post-main CI.

## Then start D1e

1. Create fresh pre-D1e recovery from verified closeout main and one scoped D1e branch.
2. Perform the Required Authoritative Read above on merged main.
3. Produce the smallest additive implementation proposal based on actual model/Worker/frontend compatibility evidence.
4. Implement in small batches with existing production behavior preserved.
5. Do not introduce D1/schema/Worker API changes unless tests prove they are required.
