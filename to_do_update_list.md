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
- Protected D1b base main: `88a9701a7c16f05a7f47fc02d298391f2f516746`
- D1 schema: **2**
- Worker source contract: release `4.07` / API `2.60` / required schema `2`
- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D / D1a: **DONE / POST-MAIN VERIFIED**
- Gate D / D1b: **IMPLEMENTED / VERIFYING in PR #162**
- Current D1b code+test head before this handoff commit: `ea9dbaf6826cd66ff9c0e3bd7306a5dc4a4e6a9d`
- Current branch: `pr-gate-d-d1b-manifest-primitives`
- D1b remains pure-contract only; there is **no production integration** yet.

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

---

# Master Plan

| Phase | Batch | Objective | Status | Verification / dependency |
|---|---|---|---|---|
| Gate A | P6C | generation-safe pending calculation recovery | **DONE** | PR #148 + CI + prod smoke |
| Gate B | P5C3B | atomic Worker record deletion | **DONE** | PR #149 + CI + recovery |
| Gate C | C1–C6 | source-ledger integrity qualification/enforcement | **DONE / CLOSED** | PR #150–#158 + audit/smoke/CI/recovery |
| Gate D | D1a | reproducibility/provenance architecture audit | **DONE / POST-MAIN VERIFIED** | PR #160/#161 + CI #477–#480 + recovery |
| Gate D | D1b | pure deterministic manifest primitives | **IMPLEMENTED / FINAL QUALIFICATION PENDING** | PR #162 + CI #481/#483/#484 |
| Gate D | D1c | effective market/FX/synthetic provenance | TODO | D1b merged/closed first |
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

- D1a PR #160 merge → `0d9ad8ea15599bcc7ebdc53bb6b1af98887966e7`
- PR CI #477 / `31301386915`: SUCCESS
- post-main CI #478 / `31301449682`: SUCCESS
- recovery `backup-post-gate-d-d1a-0d9ad8e`
- handoff PR #161 merge → `88a9701a7c16f05a7f47fc02d298391f2f516746`
- post-main CI #480: SUCCESS

Qualified architecture decisions:

- no D1/Worker migration is currently needed for manifest storage;
- preferred later D1e boundary is optional additive `PortfolioSnapshot.calculation_manifest` if compatibility tests pass;
- source record identity fields: `id, Date, Symbol, Type, Qty, Price, Commission, Tax, Tag`;
- exclude free-form `note`, `created_at`, user ownership identity from financial source hash;
- effective market/FX numeric identity must be separated from provider provenance;
- D1d requires one explicit `calculation_as_of`/clock seam;
- existing mixed TW/US golden fixture should be evolved, not replaced;
- populated production `lot_ledger` is not a Gate-D requirement.

---

# D1b — IMPLEMENTED / FINAL QUALIFICATION PENDING

PR: **#162 — Gate D D1b: deterministic manifest identity primitives**

Base main: `88a9701a7c16f05a7f47fc02d298391f2f516746`  
Pre-D1b recovery: `backup-pre-gate-d-d1b-88a9701`

## D1b scope actually implemented

### `journal_engine/core/calculation_manifest.py`

Pure module only; no runner/storage/market integration.

Contracts:

- `CANONICAL_JSON_VERSION = 1`
- `TRANSACTION_CANONICALIZATION_VERSION = 1`
- `RUNTIME_CONFIG_CANONICALIZATION_VERSION = 1`
- `CALCULATION_IDENTITY_VERSION = 1`
- canonical UTF-8 JSON envelope with sorted keys/fixed separators;
- finite floats encoded exactly with `float.hex()` tagged representation;
- datetime rejected from generic deterministic canonicalization; date encoded explicitly;
- SHA-256 canonical digest;
- exact positive integer record-id normalization using Decimal/string conversion, avoiding binary-float loss for ids beyond 2^53;
- normalized source record projection in deterministic `Date -> id` order;
- source record identity + count/max-id diagnostics;
- normalized runtime config identity for benchmark/base currency/oversell policy;
- exact lowercase 40-character Git SHA engine identity resolver, explicit value or `GITHUB_SHA`, no branch/short-SHA fallback;
- deterministic combined calculation identity seed containing engine/source/config plus placeholder market/FX digests and `calculation_as_of`;
- run-instance `calculated_at` deliberately excluded;
- Pydantic contracts use `extra=forbid`, frozen models, exact version literals and digest-consistency validators.

### Privacy / scope boundary

Deterministic source identity does **not** include:

- user email/id;
- free-form notes;
- `created_at`;
- API/auth data;
- raw broker metadata.

D1b does **not** attach anything to production snapshot or upload paths.

### `tests/test_calculation_manifest.py`

Contract coverage includes:

- exact canonical bytes including UTF-8 non-ASCII text;
- mapping-order determinism;
- sequence sensitivity and type separation;
- reject NaN/Inf/datetime/unsupported types;
- source row/column reorder invariance under semantic `Date -> id` order;
- note/created-at exclusion;
- exact preservation of integer ids above 2^53;
- digest sensitivity to every material source field;
- missing/empty/duplicate/bad-id/date/text/numeric/tag fail-closed paths;
- `pd.NA` text handling;
- bool numeric rejection;
- runtime-config normalization and sensitivity;
- runtime-config digest/version/self-consistency validation;
- exact engine SHA resolution/fail-closed behavior;
- combined identity deterministic repeatability;
- combined identity sensitivity to engine/source/config/market/FX/as-of components;
- combined digest tamper rejection;
- direct model-level datetime-as-of rejection;
- extra field/version rejection.

### Coverage governance

`docs/governance/python-coverage-baseline.json` adds only:

- `journal_engine/core/calculation_manifest.py`

to exact source inventory.

Existing coverage gates are unchanged:

- minimum percent: 68.55
- minimum covered lines: 1523
- minimum covered branches: 439
- maximum missing lines: 591
- maximum missing branches: 309

No observed/gate floor was weakened.

## D1b CI / hardening evidence

### CI #481 / run `31301845162`

Initial implementation: **SUCCESS** across Python, Frontend, Worker/D1.

Python evidence:

- 300 passed / 18 subtests;
- new module initially 100% statement coverage under first implementation;
- overall coverage ~79.62%;
- coverage policy passed.

Independent review then identified three quality issues inside D1b scope:

1. record ids were initially normalized through binary float and could lose precision above 2^53;
2. `pd.NA` required text could escape as pandas ambiguous-bool instead of `CalculationManifestError`;
3. invalid-value tests introduced pandas FutureWarnings due incompatible dtype assignment.

### Hardening commits

- `36405e1e2fe5b80a5ff0e43186aa8420b2c64bec` — exact id/text/model hardening
- `c49d65e004b23790fcc9584a981f49ccf57ebdc4` — test hardening/warning cleanup
- `ea9dbaf6826cd66ff9c0e3bd7306a5dc4a4e6a9d` — final component-sensitivity and direct-validator regressions

### CI #483 / run `31302023107`

Correct hardening head evidence for `c49d65e...`: **SUCCESS**.

- 307 passed / 18 subtests;
- new pandas FutureWarnings removed;
- only 2 pre-existing repository warnings remained;
- module 99% with only two direct-validator lines unexecuted;
- overall coverage ~79.78%;
- coverage policy passed.

### CI #484 / run `31302163349`

Final D1b code/test head `ea9dbaf...`: **SUCCESS** across all three CI jobs.

Python evidence:

- **310 passed, 2 existing warnings, 18 subtests passed**;
- `journal_engine/core/calculation_manifest.py`: **234 statements, 0 missing, 70 branches, 0 partial, 100%**;
- overall:
  - statements 3142
  - covered lines 2577
  - missing lines 565
  - branches 1166
  - covered branches 864
  - missing branches 302
  - coverage **79.87465181058496%**
- coverage policy: **PASS**.

The two remaining warnings are pre-existing and unrelated to D1b:

- legacy class-based Pydantic config in `journal_engine/models.py`;
- existing invalid escape sequence warning in `tests/test_python_coverage_policy.py`.

## Independent D1b review conclusion

**PASS for current D1b scope.**

Verified:

- no production runner changes;
- no `PortfolioSnapshot` schema/field change;
- no Worker/D1/API change;
- no market/FX extraction yet;
- no clock refactor;
- no provider abstraction;
- no user/note/private provenance leakage into deterministic identity;
- canonical versions are explicit;
- all deterministic component digests are material-sensitive;
- malformed/tampered identity models fail closed;
- coverage governance strengthened by source registration only, never weakened.

### Remaining D1b completion steps

- [x] pure module implemented;
- [x] contract tests implemented;
- [x] exact large-id / pd.NA / non-finite robustness hardened;
- [x] warnings introduced by D1b removed;
- [x] module reaches 100% line/branch coverage;
- [x] full code-head CI #484 passes;
- [x] independent semantic/privacy/scope review passes;
- [x] this handoff updated with implementation evidence;
- [ ] final exact-head CI after handoff commit;
- [ ] final changed-file / reviews / threads / main-drift qualification;
- [ ] mark PR #162 ready;
- [ ] exact-head merge;
- [ ] post-main CI;
- [ ] post-D1b recovery;
- [ ] D1b closeout handoff;
- [ ] only then activate D1c.

---

# D1c — PLANNED / BLOCKED ON D1b CLOSEOUT

Objective: deterministic identity and provenance for effective market, FX and synthetic valuation inputs.

Planned scope:

1. effective market projection per symbol/date:
   - date
   - `Close_Adjusted`
   - `Dividends`
   - `Split_Factor`
   - effective `Valuation_Source`
   - `Valuation_Source_Date`
2. historical FX projection per required currency/date;
3. realtime FX/effective state only when calculation context can use it;
4. reuse transaction-calendar synthetic provenance;
5. retain/structure price-selection/realtime-overlay provenance where currently lost;
6. diagnostics: symbols/currencies/row counts/synthetic counts/realtime state;
7. network-free tests using existing market invariant infrastructure.

Constraints:

- hash effective inputs, not irrelevant vendor OHLC/Volume payload;
- provider/source metadata separate from effective numeric digest;
- no broad provider abstraction;
- no production attachment yet.

---

# D1d — PLANNED

After D1b/c:

1. introduce narrow explicit `calculation_as_of`/clock context;
2. evolve/add versioned mixed TW/US frozen fixture;
3. forbid network in replay;
4. cover prices, FX variation, split-sensitive inputs, dividends;
5. assert authoritative snapshot projection + Daily-P&L/TWR/XIRR + manifest hashes;
6. prove repeated replay exact deterministic identity.

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
- [ ] D1b source/config/engine identity merged/post-main/recovery complete.
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
- **D-D-01 SATISFIED:** D1a audited existing evidence/storage boundaries before migrations; no D1/Worker migration currently required.
- **D-D-02 LOCKED:** deterministic identity separated from volatile run metadata; `calculation_as_of` deterministic, `calculated_at` not.
- **D-D-03 LOCKED:** hash effective market/FX inputs separately from provider provenance.
- **D-D-04 QUALIFIED, NOT YET IMPLEMENTED:** optional snapshot manifest is preferred D1e production boundary.
- **D-D-05 LOCKED BY D1b:** source-record identity uses exact versioned canonical UTF-8 JSON + SHA-256 over only material normalized fields; exact record ids must not round-trip through binary float.
- **D-D-06 LOCKED BY D1b:** engine identity requires exact full lowercase Git SHA; branch names/abbreviations are not reproducible identities.

---

# Root Cause / Risk Log

- **RC-D-01 PARTIALLY FIXED:** source/config/engine deterministic identity primitives now exist in D1b; production attachment and market/FX identities remain D1c–D1e.
- **RC-D-02 OPEN:** wall clock breaks true replay → D1d explicit as-of/clock seam.
- **RC-D-03 OPEN:** effective market state and source provenance partly decoupled → D1c.
- **RC-D-04 OPEN:** existing golden regression too shallow → D1d.
- **RC-D-05 FIXED IN D1b CODE:** record-id canonicalization no longer risks >2^53 float precision loss.

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

## Finish D1b PR #162

1. Run final exact-head CI after this handoff commit.
2. Verify final changed files are exactly:
   - `journal_engine/core/calculation_manifest.py`
   - `tests/test_calculation_manifest.py`
   - `docs/governance/python-coverage-baseline.json`
   - `to_do_update_list.md`
3. Verify reviews/unresolved threads.
4. Re-fetch protected main; stop/requalify on drift from D1b base.
5. Update PR body with final evidence and mark ready.
6. Exact-head merge.
7. Verify post-main CI.
8. Create `backup-post-gate-d-d1b-<sha>`.
9. Persist D1b closeout evidence in handoff.
10. Only then start D1c from a fresh recovery/branch.
