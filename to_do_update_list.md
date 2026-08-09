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
- Protected main: `1381f1780ea46b7878ce2667899fe16373eb2c28`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- Gate D / D1b: **DONE / POST-MAIN VERIFIED**
- Gate D / D1c: **DONE / POST-MAIN VERIFIED**
- Gate D / D1d: **ACTIVE / CODE-HEAD QUALIFIED / FINAL-HEAD CI PENDING**
- D1d PR: **#166 — Gate D D1d: deterministic golden replay**
- D1d base main: `1381f1780ea46b7878ce2667899fe16373eb2c28`
- D1d pre-change recovery: `backup-pre-gate-d-d1d-1381f17`
- D1d qualified code head before this handoff update: `f6b209fe61eb35c3894405e123eb2ccdda5b80b9`
- D1d code-head CI #512 / `31308960934`: **SUCCESS across Python / Frontend / Worker-D1**
- There is still **no production `calculation_manifest` attachment**; D1e remains the only planned production-attachment phase.

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
| Gate D | D1d | frozen deterministic golden replay | **ACTIVE / FINAL-HEAD CI PENDING** | PR #166; code-head CI #512 qualified |
| Gate D | D1e | smallest compatible production integration | TODO | D1b–D1d must be merged/post-main verified first |
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

Locked architecture decisions:

- no D1/Worker migration is required for Gate-D manifest evidence unless D1e compatibility proves otherwise;
- preferred D1e boundary is optional additive `PortfolioSnapshot.calculation_manifest`;
- source financial identity fields: `id, Date, Symbol, Type, Qty, Price, Commission, Tax, Tag`;
- exclude free-form `note`, `created_at`, ownership/auth identity from deterministic financial source hash;
- effective market/FX numeric identity is separate from provider diagnostics;
- deterministic replay requires an explicit calculation-as-of/clock seam;
- existing mixed TW/US regression should be evolved, not replaced;
- populated production `lot_ledger` is not a Gate-D prerequisite.

---

# D1b — DONE / POST-MAIN VERIFIED

PR #162 implemented pure deterministic manifest primitives in `journal_engine/core/calculation_manifest.py`.

Core contract:

- canonical UTF-8 JSON v1;
- exact finite-float canonical representation;
- SHA-256 deterministic hashes;
- exact record-id normalization including values above 2^53;
- deterministic source projection in `Date -> id` order;
- runtime config identity: benchmark/base currency/oversell policy;
- exact full lowercase 40-character Git SHA engine identity;
- combined deterministic identity over engine/source/config/market/FX/`calculation_as_of`;
- `calculated_at` excluded from deterministic identity;
- frozen/extra-forbid Pydantic models with self-consistency/tamper rejection.

Privacy boundary:

- no user email/id;
- no free-form note;
- no `created_at`;
- no auth/API data;
- no raw broker metadata.

Important hardening:

- removed >2^53 record-id float precision risk;
- explicit `pd.NA` fail-closed handling;
- D1b-introduced pandas FutureWarnings removed;
- combined identity sensitivity verified for every material component.

Evidence:

- code-head CI #484 / `31302163349`: 310 passed / 18 subtests;
- new module: **100% line/branch coverage**;
- final-head CI #485 / `31302244853`: SUCCESS;
- PR #162 exact-head merge → `ad9b98f996fdb9e3151f0ba3b201dfbeb3b5febf`;
- post-main CI #486 / `31302369991`: SUCCESS;
- recovery `backup-post-gate-d-d1b-ad9b98f`;
- closeout PR #163 merge → `4971dbb8f1df35c3ccd4061695ee9f460ce7e2d5`;
- closeout post-main CI #488: SUCCESS.

Status: **DONE / POST-MAIN VERIFIED**.

---

# D1c — DONE / POST-MAIN VERIFIED

PR #164 implemented pure/network-free effective-input provenance in `journal_engine/core/input_provenance.py`.

Market identity includes only calculation-effective state:

- symbol/date;
- `Close_Adjusted`;
- effective `Dividends`;
- effective `Split_Factor`;
- `Valuation_Source`;
- `Valuation_Source_Date`.

Synthetic source vocabulary remains exactly:

- `market`;
- `asof_carry_forward`;
- `transaction_price_seed`.

FX identity includes:

- required currencies;
- historical TWD/native rates;
- TWD constant 1.0 semantics;
- optional realtime FX state/value only when explicitly included.

Provider diagnostics are separate/non-hashed:

- `price_source`;
- `selection_reason`;
- realtime-overlay symbol diagnostics.

Hardening/debug history:

- CI #489 exposed test-fixture duplicate-symbol collisions and one-shot generator consumption;
- CI #492 exposed scalar/vector ambiguity from `pd.isna(["x"])`;
- root fix uses explicit scalar validation before missingness conversion;
- CI #493 had all functional tests green but coverage governance blocked residual branch debt;
- missing branches were covered with regression tests instead of lowering policy.

Qualification:

- code-head CI #494 / `31306406517`: SUCCESS;
- final-head CI #495 / `31306660733`: SUCCESS;
- PR #164 exact-head merge → `768fdb6e290dca36c0fd8fc1209a87c3357935d6`;
- post-main CI #496 / `31306794910`: SUCCESS;
- recovery `backup-post-gate-d-d1c-768fdb6`;
- closeout PR #165 merge → `1381f1780ea46b7878ce2667899fe16373eb2c28`;
- closeout post-main CI #498: SUCCESS.

Status: **DONE / POST-MAIN VERIFIED**.

---

# D1d — ACTIVE / CODE-HEAD QUALIFIED / FINAL-HEAD CI PENDING

PR: **#166 — Gate D D1d: deterministic golden replay**  
Base main: `1381f1780ea46b7878ce2667899fe16373eb2c28`  
Pre-D1d recovery: `backup-pre-gate-d-d1d-1381f17`  
Qualified code head before this handoff update: `f6b209fe61eb35c3894405e123eb2ccdda5b80b9`

## Objective

Prove deterministic, network-free replay of a known-good mixed TW/US portfolio using D1b/D1c identity contracts, while eliminating replay wall-clock ambiguity without changing normal production defaults.

## Implemented clock/as-of seam

`PortfolioCalculator` now accepts optional `calculation_now`.

Rules:

- injected clock must be timezone-aware or construction fails closed;
- injected clock is normalized to `Asia/Taipei`;
- `calculation_as_of` is exposed explicitly;
- replay mode returns the same injected timestamp at every clock decision point;
- `DailyPnLHelper` accepts an optional `now_provider` and normalizes it to Taipei;
- provider returning a naive/non-datetime value fails closed.

### Production-default compatibility rule

This was independently reviewed and hardened as a merge blocker.

Without an injected replay clock:

- existing market-stage/today decisions continue to use Taipei-aware wall clock as before;
- existing `updated_at` and group date-range boundaries continue to call naive system-local `datetime.now()` at their original call sites;
- production does **not** inherit the deterministic replay timestamp behavior.

Therefore deterministic replay is opt-in and normal production timing semantics are preserved.

No FIFO, financial formula, TWR, XIRR, dividend, split, FX, Daily-P&L or transaction-ordering algorithm was changed by the seam.

## Versioned frozen replay fixture

New fixture:

`tests/fixtures/golden_replay_mixed_tw_us_v1.json`

The replay is deliberately mixed and material:

- benchmark: `SPY`;
- Taiwan security: `2330.TW`;
- US security: `NVDA`;
- fixed calculation time: `2026-01-05T15:00:00+08:00`;
- stable transaction record ids;
- split-sensitive NVDA transaction with cumulative `Split_Factor` semantics;
- dividends on both TW and US holdings;
- variable historical USD/TWD FX;
- explicit realtime USD/TWD FX;
- one `transaction_price_seed` synthetic valuation source;
- extreme Jan-6 future market/FX rows to prove as-of cutoff isolation;
- provider diagnostics separated from numeric input identity.

The fixture's `declared_fixture_engine_source_commit` is explicitly labeled:

`declared_test_input_not_runtime_attestation`

It exists only to exercise deterministic identity composition. It is **not** an assertion that the fixture SHA is the real repository/production engine SHA. D1e production integration must resolve the actual full runtime Git SHA.

## Replay execution path

Replay remains fully offline and uses the production calculation order:

1. raw transaction fixture;
2. `PortfolioCalculator` with explicit replay clock;
3. calculator split adjustment and portfolio calculation;
4. canonical `reconcile_snapshot_daily_pnl(snapshot, calculator.df, calculator)`;
5. D1b source/config/engine/as-of identities;
6. D1c effective market/FX/synthetic identities;
7. deterministic snapshot projection excluding volatile `updated_at`;
8. exact content SHA-256.

Tests explicitly fail if `requests` or `yfinance.download` is invoked.

## Reviewed golden economics

The fixture is not blessed from opaque output alone. Economic invariants were manually derived and then asserted before final hashes were locked.

Expected economics:

- 2330.TW cost: **5,001 TWD**;
- NVDA split-adjusted economic cost: **201 USD × 32 = 6,432 TWD**;
- invested capital: **11,433 TWD**;
- Jan-5 2330.TW market value: **5,100 TWD**;
- Jan-5 NVDA market value: **7,150 TWD**;
- total value: **12,250 TWD**;
- pending/realized dividend contribution: **111 TWD**;
- total P&L: **928 TWD**;
- canonical Jan-5 Daily-P&L: **961 TWD**;
- Daily-P&L breakdown: TW **120** / foreign price+dividend **741** / FX **100**;
- daily P&L base value: **11,400 TWD**;
- daily ROI: **8.43%**;
- linked TWR: **8.16%**, status `ok`;
- XIRR: **1,329,427.60%**, status `ok`, as-of `2026-01-05`, conventional cash flow `true`.

The extreme XIRR is a mathematical consequence of a deliberately short 3-day fixture and is used only as deterministic regression evidence, not as an investment-performance benchmark.

Per-symbol canonical day ledger:

- 2330.TW: **120 TWD**;
- NVDA: **841 TWD**.

Pending dividend values:

- 2330.TW: **20 TWD**;
- NVDA: **91 TWD**.

## Frozen deterministic identities

Reviewed snapshot-content digest:

`257117e2ee7516e25a37d24d52525c6e8ae08c8ff00e785a1beb268cd005a21c`

Reviewed D1b+D1c combined deterministic input digest:

`6f213201279bf7ff6a58d0cb7af237e5fdcb8db1f2006c1f368c61c0cc85fe05`

Repeated replay must produce identical snapshot projection, content digest, combined input identity and provider diagnostics.

## Change-cause isolation proven

D1d regression proves material changes can be distinguished among:

- source records;
- effective market values;
- effective FX values/state;
- synthetic valuation provenance;
- engine identity;
- runtime configuration.

Additional invariants:

- provider diagnostic changes alone do not alter numeric market/FX/combined identity;
- market/FX rows strictly after `calculation_as_of` do not alter replay output or input identity;
- synthetic provenance can alter deterministic market/combined identity even when numeric output is unchanged.

## D1d test-first / debugging chronology

### CI #499 — intentional red baseline

First clock-seam tests failed only because `calculation_now` / `now_provider` did not yet exist. Existing suites remained otherwise healthy. This established a clean test-first baseline.

### CI #501 — minimum clock seam green

Initial explicit seam passed the full suite.

### CI #503 — first frozen replay

Only one failure remained: the intentionally unset snapshot-content digest placeholder. Replay invariance/change-cause tests were already passing.

### CI #505 — economic qualification before hash lock

All manually reviewed economic assertions passed. The only remaining failure was the intentionally unset combined-input digest placeholder.

### CI #506 — first no-placeholder full green

Clock seam + offline replay + reviewed economics + exact content/input identities all passed together.

### Independent review hardening

Review identified one semantic ambiguity:

- fixture engine SHA could be misread as current-repository attestation.

Resolution:

- rename to `declared_fixture_engine_source_commit`;
- add explicit `engine_identity_semantics=declared_test_input_not_runtime_attestation`;
- document that D1e production must resolve the real full Git SHA.

Additional clock contracts were added for:

- naive provider fail-closed;
- non-Taipei timezone normalization.

CI #509 passed after this hardening.

### Independent review BLOCKER — production default clock drift

A genuine compatibility blocker was then found:

- an earlier seam version unintentionally changed normal production run-level clock semantics from naive system-local `datetime.now()` to Taipei-aware/frozen-style clock behavior.

This could change `updated_at`/group date boundaries around timezone/day transitions.

Root fix:

- explicit replay mode uses the fixed injected clock;
- default production mode delegates each original run-level call site to naive system-local `datetime.now()`;
- Taipei market-stage/today logic still uses the pre-existing Taipei-aware wall-clock semantics.

No financial algorithm changes were required.

## Code-head qualification — CI #512 / `31308960934`

Exact PR head: `f6b209fe61eb35c3894405e123eb2ccdda5b80b9`

Result: **SUCCESS across all 3 jobs**.

Python:

- **387 passed**;
- **18 subtests passed**;
- **2 pre-existing warnings** only;
- `daily_pnl_helper.py`: **100%**;
- `calculation_manifest.py`: **100%**;
- coverage policy: **PASS**.

Exact measured repository coverage:

- covered lines: **2867**;
- missing lines: **564**;
- covered branches: **1006**;
- missing branches: **300**;
- statements: **3431**;
- branches: **1306**;
- combined coverage: **81.760607979734%**.

Existing governance gates were not weakened:

- minimum percent: 68.55;
- minimum covered lines: 1523;
- minimum covered branches: 439;
- maximum missing lines: 591;
- maximum missing branches: 309.

## Independent third-party-style review — qualified code head

Result: **PASS / no remaining BLOCKER**.

Changed-file whitelist is exactly:

- `journal_engine/core/calculator.py`;
- `journal_engine/core/daily_pnl_helper.py`;
- `tests/fixtures/golden_replay_mixed_tw_us_v1.json`;
- `tests/test_calculation_clock_seam.py`;
- `tests/test_deterministic_replay.py`.

This handoff update adds only `to_do_update_list.md` to that final whitelist.

Scope/security/privacy findings:

- no `main.py` production runner integration yet;
- no `PortfolioSnapshot.calculation_manifest` attachment;
- no Worker route/code change;
- no D1/schema migration;
- no provider abstraction;
- no Schema 3 / broker execution redesign;
- no user email/id, free-form note, auth/API secret or raw vendor payload enters deterministic replay identity;
- no network access in replay;
- production default clock behavior preserved after BLOCKER fix;
- no financial formulas or ordering contracts changed;
- coverage policy unchanged.

PR governance at qualified code head:

- reviews: **0**;
- review threads: **0**;
- comments: **0**;
- protected main remained exactly `1381f1780ea46b7878ce2667899fe16373eb2c28`;
- no main drift before this handoff update.

## D1d remaining execution plan

1. Resolve the new final PR head created by this handoff commit.
2. Run fresh full CI on that exact final head; CI #512 is code-head evidence only.
3. Confirm final changed-file whitelist is the 5 D1d code/test files plus `to_do_update_list.md`.
4. Re-check reviews, unresolved threads/comments and protected-main drift.
5. If no BLOCKER, mark PR #166 ready and exact-head merge using the final head SHA.
6. Verify post-main CI.
7. Create post-D1d recovery from verified merged main.
8. Persist merge/CI/recovery in a docs-only closeout handoff if needed.
9. Only then activate D1e.

---

# D1e — PLANNED / NOT STARTED

D1e begins only after D1d is merged and post-main verified.

Objective: attach the already-proven D1b/D1c/D1d reproducibility evidence at the smallest compatible production boundary.

Planned scope:

1. add optional versioned `calculation_manifest` to `PortfolioSnapshot`;
2. construct it at the authoritative runner boundary after effective market/FX/synthetic inputs are known;
3. resolve the **real full engine Git SHA**, not a branch/short/test SHA;
4. attach before final snapshot validation/upload;
5. preserve legacy snapshots that do not contain the field;
6. prove Worker opaque JSON round-trip and 1 MiB boundary compatibility;
7. prove frontend remains unchanged by the additive field;
8. fail closed on missing/ambiguous manifest-critical identity;
9. run production smoke only if the runtime path materially changes.

No D1 migration or Worker API change unless compatibility tests prove opaque snapshot storage insufficient.

Explicit non-goals remain:

- no Schema 3;
- no first-class broker execution redesign;
- no provider abstraction;
- no canonical lot-ledger expansion;
- no unrelated frontend/UX work.

---

# Gate D Closeout Criteria

- [x] D1a evidence merged/post-main/recovery complete.
- [x] D1b source/config/engine identity merged/post-main/recovery complete.
- [x] D1c effective market/FX/synthetic provenance merged/post-main/recovery complete.
- [ ] D1d deterministic offline replay merged/post-main/recovery complete. **Code-head qualified; merge pending.**
- [ ] D1e compatible production attachment proven.
- [x] D1d proves change-cause distinction among source / market / FX / engine / runtime config / synthetic valuation at replay-contract level.
- [ ] independent final Gate-D review finds no unresolved reproducibility blocker after D1e.
- [ ] final exact-head merge/post-main verification complete.
- [ ] post-Gate-D recovery created.
- [ ] handoff updated before post-Gate-D architecture review.

---

# Gate C — DONE / CLOSED

Formal evidence: `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`.

Key chain:

- C5b audit #3215: CLEAR, 2 users / 168 records, zero prefix/duplicate findings;
- C6a PR #154: blocking split-adjusted source-prefix gate before calculator/upload; CI #462/#463; prod smoke #3216 succeeded 2/0;
- C3-rem PR #156: explicit `Sequence` vs unsupported `_sequence`; CI #468/#469;
- final PR #158 merge `ef9f5a1740b3c8b7c7fc726f5f1f024bcfaad311`; post-main CI #474;
- recovery `backup-post-gate-c-ef9f5a1`;
- Gate-D handoff PR #159 merge `41338e598f027a502a81c7d08eaec3c2f4069a04`; CI #476.

C6b decision remains locked: retain calculator `CLAMP` as downstream compatibility/defense-in-depth. Source prefix preflight remains authoritative; reopen only under documented Gate-C conditions.

---

# Decision Log

- **D-C-01 LOCKED:** split-adjusted `Date -> id` prefix integrity is the Schema-2 source gate.
- **D-C-02 LOCKED:** record id is deterministic validity order, not broker chronology.
- **D-C-06 LOCKED:** retain CLAMP under the protected Schema-2 path absent documented reopen conditions.
- **D-C-07 LOCKED:** free-form note is not chronology.
- **D-C-08 LOCKED:** `Sequence`/`Timestamp` are recognized contracts; `_sequence` is not.
- **D-D-01 SATISFIED:** D1a audited evidence/storage boundaries before migrations; no D1/Worker migration required.
- **D-D-02 LOCKED:** deterministic identity is separate from volatile run metadata; `calculation_as_of` deterministic, `calculated_at` not.
- **D-D-03 LOCKED:** hash effective market/FX inputs separately from provider diagnostics.
- **D-D-04 QUALIFIED, NOT YET IMPLEMENTED:** optional snapshot manifest is the preferred D1e production boundary.
- **D-D-05 LOCKED BY D1b:** source identity uses exact versioned canonical JSON + SHA-256; exact ids never round-trip through binary float.
- **D-D-06 LOCKED BY D1b:** production engine identity requires exact full lowercase Git SHA; branch/short/test SHA is not production attestation.
- **D-D-07 LOCKED BY D1c:** provider diagnostics remain separate from calculation-effective numeric digests.
- **D-D-08 LOCKED BY D1c:** ambiguous/non-scalar/non-finite market, FX or synthetic provenance fails closed.
- **D-D-09 QUALIFIED BY D1d CODE HEAD:** deterministic replay uses an explicit timezone-aware calculation clock/as-of seam.
- **D-D-10 QUALIFIED BY D1d CODE HEAD:** replay clock injection must not alter default production wall-clock semantics.
- **D-D-11 QUALIFIED BY D1d CODE HEAD:** golden replay engine SHA is a declared test input only; D1e must resolve real runtime full Git SHA.

---

# Root Cause / Risk Log

- **RC-D-01 PARTIALLY FIXED:** source/config/engine identity (D1b), effective market/FX/synthetic identity (D1c), and deterministic offline replay (D1d code head) exist; production attachment remains D1e.
- **RC-D-02 CODE-HEAD FIXED / MERGE PENDING:** wall-clock ambiguity has a narrow explicit replay seam while production default call-site semantics remain preserved.
- **RC-D-03 CLOSED:** effective market/FX/synthetic state has deterministic identity and separate provider diagnostics.
- **RC-D-04 CODE-HEAD FIXED / MERGE PENDING:** previous shallow golden regression is supplemented by a versioned mixed TW/US replay with split, dividend, FX, synthetic provenance, Daily-P&L, TWR/XIRR and exact identity assertions.
- **RC-D-05 CLOSED:** record-id canonicalization does not risk >2^53 float precision loss.
- **RC-D-06 CLOSED:** one-shot iterables are materialized once.
- **RC-D-07 CLOSED:** vector-like pandas provenance values are rejected before missingness conversion.
- **RC-D-08 CLOSED:** coverage regressions are resolved by tests, not weaker gates.
- **RC-D-09 CODE-HEAD FIXED / MERGE PENDING:** fixture engine identity is explicitly distinguished from production engine attestation.

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

## Finish D1d PR #166

1. Resolve the exact head after this handoff commit.
2. Run fresh full CI on that exact head.
3. Confirm final whitelist = five D1d code/test/fixture files + `to_do_update_list.md` only.
4. Re-check reviews, unresolved threads/comments and protected-main drift.
5. If no BLOCKER, mark PR #166 ready and exact-head merge.
6. Verify post-main CI.
7. Create post-D1d recovery.
8. Persist D1d merge/CI/recovery closeout evidence.

## Then start D1e

1. Create fresh pre-D1e recovery from verified stable main and one scoped D1e branch.
2. Re-read merged main models, authoritative runner, Worker snapshot storage/size limits, frontend snapshot consumers and D1b/D1c/D1d contracts.
3. Propose the smallest additive `calculation_manifest` attachment only after compatibility evidence is re-confirmed.
4. Do not introduce D1/schema/Worker API changes unless actual compatibility tests prove they are required.
