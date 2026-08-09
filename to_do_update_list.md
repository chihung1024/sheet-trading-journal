# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Handoff required by `AI_PROJECT_PLAYBOOK.md`. A new AI session must be able to continue from this file without the previous chat.
>
> **Mandatory update rule:** after every material implementation, CI result, PR review, merge, production smoke/audit, recovery ref, blocker, scope decision, or main drift, update this file in the same scoped branch/PR whenever practical.

Last updated: **2026-08-10**

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
- Protected main: `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- Gate D / D1b: **DONE / POST-MAIN VERIFIED**
- Gate D / D1c: **DONE / POST-MAIN VERIFIED**
- Gate D / D1d: **DONE / POST-MAIN VERIFIED**
- Gate D / D1e: **MERGED / POST-MAIN VERIFIED / PRODUCTION SMOKE PENDING**
- D1d PR #166 final head: `71d6b4445ed8e139352f73f0ba669dffc9575ad2`
- D1d final-head CI #513 / `31311239217`: **SUCCESS**
- D1d exact-head merge → `62b13dc7c29591a7fcff24a20b48fe06aa8177ea`
- D1d post-main CI #514 / `31311341049`: **SUCCESS**
- D1d recovery: `backup-post-gate-d-d1d-62b13dc`
- D1d closeout PR #167 merge → `b235d9f8861186b547a7de1a1812cbf5d40f6f1a`; closeout post-main CI #516: **SUCCESS**.
- D1e PR #168 final head: `8caaf05236b4b86ded4dac2262228fad657c71b4`.
- D1e final-head CI #537 / `31327377673`: **SUCCESS across Python / Frontend / Worker-D1**; Python **402 passed + 18 subtests**, 2 pre-existing warnings; coverage **82.65571800520729%**.
- D1e exact-head merge → `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`.
- D1e post-main CI #538 / `31327529828`: **SUCCESS across Python / Frontend / Worker-D1**.
- D1e independent review: **PASS after realtime-FX BLOCKER resolution**; final qualification had 0 reviews / 0 threads / 0 comments and no protected-main drift.
- Post-D1e recovery: `backup-post-gate-d-d1e-f10a8de`.
- Current active work: **Gate D closeout — controlled production portfolio-update smoke is the only unresolved operational verification before final Gate-D closeout**.
- Current connected GitHub action set can read/rerun existing workflow runs but does not expose creation of a new `workflow_dispatch` run. Do not bypass the connector permission model; use the next scheduled `Update Portfolio Data` run on verified main or a manually initiated workflow dispatch, then inspect its logs/results here.

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
- pre-D1e: `backup-pre-gate-d-d1e-b235d9f`
- post-D1e: `backup-post-gate-d-d1e-f10a8de`

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
| Gate D | D1e | smallest compatible production integration | **MERGED / POST-MAIN VERIFIED** | PR #168 + CI #537/#538 + recovery; prod smoke pending |
| Gate D | Closeout | independent reproducibility review + production smoke | **ACTIVE** | D1e merged/post-main; smoke remaining |
| Post-D | Architecture review | Schema 3 / canonical ledger / provider abstraction | DEFERRED | fresh review only after Gate D closes |

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

# D1e — MERGED / POST-MAIN VERIFIED / PRODUCTION SMOKE PENDING

PR: **#168 — Gate D D1e: production calculation manifest integration**  
Base main: `b235d9f8861186b547a7de1a1812cbf5d40f6f1a`  
Pre-D1e recovery: `backup-pre-gate-d-d1e-b235d9f`  
Qualified code head: `199a67c21775bf61c8ac0397e31daa13e9baa23d`  
Final PR head: `8caaf05236b4b86ded4dac2262228fad657c71b4`  
Merge: `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`  
Post-D1e recovery: `backup-post-gate-d-d1e-f10a8de`

## Authoritative compatibility conclusion

Merged-main read proved the preferred D1a boundary is compatible:

- Worker stores snapshot `data` as opaque JSON and returns it without root-field reconstruction;
- existing Worker payload policy remains **1 MiB**;
- frontend preserves `json.data` as the snapshot root rather than whitelisting fields;
- no D1 schema migration is required;
- no Worker route/schema redesign is required;
- no frontend production change is required.

D1e therefore remains on Schema 2 and uses optional additive `PortfolioSnapshot.calculation_manifest`.

## E1 — manifest model / serialization / cross-layer compatibility

Implemented:

- strict/frozen `CalculationManifest` with `manifest_version=1`;
- deterministic-identity ↔ market/FX component consistency validation;
- timezone-aware ISO-8601 `calculated_at` validation;
- optional `PortfolioSnapshot.calculation_manifest`;
- `None` manifest is excluded from serialization so legacy snapshot JSON shape remains unchanged;
- real `PortfolioSnapshot` upload uses Pydantic `model_dump(mode="json")`, making nested `date` values JSON-safe;
- Worker contract test proves additive manifest survives opaque `POST /api/portfolio` storage path;
- Worker >1 MiB rejection remains enforced;
- frontend contract proves root additive field is preserved by `rawData.value = json.data`.

No Worker/frontend production code changed.

## E2 — minimal structured market/provider sidecars

`MarketDataClient` now records only the structured provenance already known by existing code:

- `price_metadata_by_symbol` from `AutoPriceSelector`;
- `realtime_overlay_symbols` when latest-price overlay is actually applied.

Concurrency contract:

- worker threads return metadata/overlay state;
- only the main `as_completed` loop mutates shared sidecars;
- sidecars reset at the start of every `download_data()` generation;
- price/FX/split/dividend formulas and downloaded numeric values are unchanged.

No provider abstraction was introduced.

## E3 — production manifest assembly / runner integration

New narrow orchestration boundary: `journal_engine/core/production_manifest.py`.

It:

- resolves one timezone-aware `Asia/Taipei` calculation context;
- builds source identity from only the current user's records;
- includes only current-user symbols plus resolved benchmark;
- bounds effective market/FX inputs to the required calculation window and `calculation_as_of`;
- uses D1b runtime config with explicit `CLAMP` oversell policy;
- uses the exact full runtime `GITHUB_SHA`; missing/invalid full SHA fails before network/API work;
- keeps provider diagnostics separate/non-hashed;
- includes realtime FX only when the calculation can actually execute an as-of realtime valuation path;
- never includes user email/id, note, `created_at`, API keys/auth data, or raw broker payload in the manifest.

`main.py` now:

1. resolves one Taipei `calculation_now` and exact engine Git SHA at batch start;
2. passes the same clock to transaction-calendar validation and `PortfolioCalculator`;
3. preserves the calculator's explicit `CLAMP` production policy;
4. calculates and canonically reconciles Daily PnL as before;
5. validates split-adjusted ledger parity as before;
6. builds/attaches the manifest;
7. runs existing snapshot validation;
8. uploads through the existing Worker snapshot route.

The `PortfolioCalculator` constructor default behavior remains unchanged for callers that do not inject a clock. The production runner now **explicitly opts in** to the D1d clock seam, as authorized by D1a/D1e, so calculation-as-of/today/realtime semantics use one Taipei run clock rather than mixed implicit clocks. Because this is a production-runner semantic change in addition to the additive snapshot field, production smoke remains a mandatory closeout step.

## Independent review BLOCKER resolved — realtime FX over-hash

Initial D1e helper logic included realtime FX whenever any foreign currency was required. Independent review found that this could hash a Sunday/holiday realtime quote even when the calculator had no `calculation_as_of` valuation row and therefore could not use realtime FX.

Resolution was test-first:

- a regression test proved realtime FX must remain included when an actual as-of foreign valuation path exists;
- a regression test proved changing an unused realtime quote must not change FX or combined deterministic identity when all required market rows end before `calculation_as_of`;
- helper now gates realtime FX on an actual as-of portfolio valuation date and only the foreign required symbols whose own effective market row is also as-of.

CI #535 intentionally went red only on this new regression test (**401 passed + 1 expected failure + 18 subtests**). The root fix produced CI #536 full green.

## CI / hardening chronology

- CI #517: intentional E1 test-first red; manifest model absent;
- CI #519: exposed evidence-layer `None` serialization/golden pollution and legacy fake `model_dump()` contract; root-fixed without rewriting golden hashes;
- CI #521: E1 Python/model core green;
- CI #523: Worker manifest contract green; frontend static test exposed an incorrect test assumption about the shared parser;
- CI #524: E1 fully green across Python / Frontend / Worker-D1;
- CI #525: intentional E2 test-first red on exactly the three missing sidecar contracts;
- CI #526: E2 fully green;
- CI #527: intentional E3 helper test-first red on missing production manifest helpers;
- CI #530: E3 helper fully green with coverage source registration and unchanged coverage gates;
- CI #531: intentional runner-wiring test-first red on missing clock/SHA/manifest attachment;
- CI #532: production wiring reached only two stale FakeCalculator signatures; no production defect;
- CI #534: stale test doubles updated; full green;
- CI #535: independent-review realtime-FX regression test intentionally red only on the confirmed BLOCKER;
- CI #536 / `31327042973`: code-head **SUCCESS across all three jobs**;
- CI #537 / `31327377673`: final-head **SUCCESS across all three jobs**, Python **402 passed + 18 subtests**, 2 pre-existing warnings, coverage **82.65571800520729%**;
- exact-head merge guarded by `8caaf05236b4b86ded4dac2262228fad657c71b4` → `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`;
- post-main CI #538 / `31327529828`: **SUCCESS across Python / Frontend / Worker-D1**.

Final-head coverage evidence from CI #537:

- covered lines: **3063**;
- missing lines: **558**;
- covered branches: **1064**;
- missing branches: **308**;
- statements: **3621**;
- branches: **1372**;
- combined coverage: **82.65571800520729%**;
- coverage policy passed; no gate was weakened.

## Final qualification / merge evidence

Final changed files were exactly the 14 qualified D1e code/test/governance files plus `to_do_update_list.md`.

No D1 migration, Worker production route/schema change, deployment workflow change, provider abstraction, broker-execution redesign, canonical lot-ledger expansion, or unrelated UX work existed in the diff.

Qualification:

- final PR head: `8caaf05236b4b86ded4dac2262228fad657c71b4`;
- CI #537: SUCCESS;
- reviews: **0**;
- review threads: **0**;
- comments: **0**;
- protected main remained exactly PR base before merge; **no drift**;
- compare `199a67c... → 8caaf052...` proved the only post-review change was `to_do_update_list.md`;
- independent semantic/privacy/scope review: **PASS after realtime-FX BLOCKER resolution**;
- exact-head merge succeeded to `f10a8de3ca51dd20fa72a42c96212d73fa6d6226`;
- post-main CI #538 succeeded;
- post-D1e recovery exists: `backup-post-gate-d-d1e-f10a8de`.

## Remaining production smoke

A controlled production calculation/upload remains required because D1e changes both the uploaded snapshot shape and the production runner's explicit calculation clock context.

Preferred smoke:

- workflow: `Update Portfolio Data` (`.github/workflows/update.yml`);
- ref: verified `main` at/after `f10a8de3...`;
- target only `chired@gmail.com` when manually dispatched;
- normal calculation/upload mode, **not** transaction-integrity audit-only;
- no calculation-job callback is required;
- verify successful record fetch, market-data validation, calculation/reconciliation, manifest assembly, snapshot validation and Worker upload;
- do not expose snapshot payloads, API keys or authentication data in the handoff.

Current connector limitation: the available GitHub actions can inspect and rerun existing runs but do not expose creation of a new `workflow_dispatch`. Therefore this smoke was not fabricated or bypassed. The next scheduled workflow on verified main can satisfy the same production path; alternatively a manual dispatch can be initiated in GitHub and then inspected here.

Status: **MERGED / POST-MAIN VERIFIED / PRODUCTION SMOKE PENDING**.

---

# Gate D Closeout Criteria

- [x] D1a evidence merged/post-main/recovery complete.
- [x] D1b source/config/engine identity merged/post-main/recovery complete.
- [x] D1c effective market/FX/synthetic provenance merged/post-main/recovery complete.
- [x] D1d deterministic offline replay merged/post-main/recovery complete.
- [x] D1e compatible production attachment proven.
- [x] change-cause distinction proven at replay-contract level.
- [x] independent final Gate-D code/reproducibility review finds no unresolved code-level blocker after D1e.
- [x] D1e final exact-head merge/post-main verification complete.
- [ ] D1e production smoke complete.
- [x] post-D1e recovery created.
- [ ] final Gate-D handoff merged after production smoke.

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
- **D-D-04 SATISFIED BY D1e:** optional snapshot manifest is compatible with existing Worker/D1/frontend boundaries; no migration/API redesign required.
- **D-D-05 LOCKED BY D1b:** exact canonical source identity; no binary-float record-id path.
- **D-D-06 LOCKED BY D1b:** production engine identity requires exact full lowercase Git SHA.
- **D-D-07 LOCKED BY D1c:** provider diagnostics are separate from numeric digests.
- **D-D-08 LOCKED BY D1c:** ambiguous market/FX/synthetic provenance fails closed.
- **D-D-09 LOCKED BY D1d:** deterministic replay uses explicit timezone-aware calculation clock/as-of.
- **D-D-10 LOCKED BY D1d:** calculator default clock injection semantics remain backward-compatible for callers that do not opt in.
- **D-D-11 LOCKED BY D1d:** declared fixture engine SHA is test input only, not production attestation.
- **D-D-12 LOCKED BY D1e:** production runner resolves one Taipei calculation context and exact full `GITHUB_SHA`; missing/invalid source identity fails before network/API work.
- **D-D-13 LOCKED BY D1e:** realtime FX enters deterministic identity only when the calculation can actually execute the corresponding as-of realtime valuation path.
- **D-D-14 LOCKED BY D1e:** Gate-D production evidence remains Schema 2 with no Worker/frontend production redesign.

---

# Root Cause / Risk Log

- **RC-D-01 NEARLY CLOSED:** identity primitives/provenance/replay/production attachment/exact-head merge/post-main/recovery are complete; controlled production smoke remains.
- **RC-D-02 CLOSED:** wall-clock replay ambiguity fixed with explicit seam; D1e production runner deliberately resolves one Taipei calculation context.
- **RC-D-03 CLOSED:** effective market/FX/synthetic provenance identity complete.
- **RC-D-04 CLOSED:** mixed TW/US deterministic golden replay covers split, dividend, FX, synthetic provenance, Daily-P&L, TWR/XIRR and exact digests.
- **RC-D-05 CLOSED:** >2^53 record-id precision risk fixed.
- **RC-D-06 CLOSED:** one-shot iterable consumption fixed.
- **RC-D-07 CLOSED:** vector-like provenance missingness ambiguity fixed.
- **RC-D-08 CLOSED:** coverage regressions resolved by tests, not weaker gates.
- **RC-D-09 CLOSED:** fixture engine identity cannot be confused with production attestation.
- **RC-D-10 CLOSED AT REPOSITORY BOUNDARY:** production snapshot has a compatible optional reproducibility manifest and is merged/post-main verified; runtime smoke remains an operational closeout criterion.
- **RC-D-11 CLOSED:** realtime FX over-hash on non-as-of/holiday valuation paths was caught by independent review and regression-tested before merge.

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

## Complete the one remaining production smoke

1. Use the next `Update Portfolio Data` workflow run whose `head_sha` is verified main `f10a8de3ca51dd20fa72a42c96212d73fa6d6226` or a later closeout-only main commit containing no production-code changes; scheduled execution is acceptable.
2. Prefer a manual dispatch targeted to `chired@gmail.com` if the initiating client exposes workflow-dispatch; otherwise inspect the next scheduled normal update run.
3. The run must be normal calculation/upload mode, not `transaction_integrity_audit_only`.
4. Inspect the job result and logs. Required path: records → market data → transaction-calendar/coverage validation → calculator → canonical Daily-PnL reconciliation → manifest assembly → snapshot validation → Worker upload.
5. If it fails, stop Gate-D closeout and root-cause the exact failure; do not weaken validation or remove the manifest to force success.

## Then close Gate D

1. Update this docs-only closeout branch with the production-smoke run ID/result.
2. Open/qualify the docs-only closeout PR; whitelist must remain `to_do_update_list.md` only.
3. Exact-head merge and verify its post-main CI.
4. Mark Gate D **DONE / CLOSED / POST-MAIN VERIFIED** only after the smoke and docs closeout are both complete.
5. Only then begin the deferred post-D architecture review; do not automatically authorize Schema 3, provider abstraction, canonical ledger redesign, broker-execution redesign or unrelated refactors.
