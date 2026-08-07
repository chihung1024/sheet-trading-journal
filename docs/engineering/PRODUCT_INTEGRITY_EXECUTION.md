# Product Integrity Audit & Execution Ledger

This is the single current engineering ledger for the post-D3D product-correctness program.
It records confirmed root causes, phased remediation, compatibility constraints, recovery points,
and verification evidence. Historical governance records remain forensic context; this file is
the current product-engineering navigation point.

## Current baseline and protected boundaries

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`
- Baseline tree: `abe39d70b7789cc81cc7c770257b6a91f309b5e6`
- Current merged product-integrity baseline: `8735d5849850e957b1ddd67c7a3c5d84db1491b8` (P2)
- Runtime identity remains Worker 4.07 / API 2.60 / D1 schema 2.
- Production activation remains fail-closed; this program does not reopen D3D.
- Schema 3 remains prohibited until the separate recovery-evidence gate passes.
- P3 changes only repository calculation/frontend source and tests; it does not deploy a production Worker or mutate D1.

## Engineering principles

1. Preserve valid current behavior unless a value is demonstrably incorrect.
2. Fix the earliest trustworthy root boundary; late checks are defense-in-depth, not substitutes.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Every financial-semantic change needs a regression/golden test before merge.
5. Every batch uses pre-change recovery, scoped PR, CI, second diff review, exact-head merge,
   post-merge verification, and a post-change recovery checkpoint.
6. Do not lower coverage or validation thresholds merely to make a refactor pass.
7. Do not deploy a production Worker merely because repository source changed; production
   activation follows the separate protected deployment/recovery gates.
8. Treat monetary values as dimensioned quantities. A finite number is not valid if its currency
   unit or quote-unit scale is wrong.

## Confirmed findings and disposition

### PI-001 — Python transaction domain contract drift

Status: **P1 completed**

The Worker write boundary requires `qty > 0`, finite values, and `price >= 0`. The Python batch
runner previously checked only parseability/finite values and therefore trusted a weaker contract
than the persistent source of record. P1 aligned the runner to `qty > 0` and `price >= 0`.

Price zero remains temporarily compatible because current Worker semantics explicitly permit it;
tightening to `price > 0` requires a production-record preflight first.

### PI-002 — Required market price validator existed but was not wired into orchestration

Status: **P1 completed; P3 strengthens historical coverage**

`PortfolioValidator.validate_price_data()` rejects missing `Close_Adjusted`, NaN, zero, and
negative prices, but previously had no orchestration caller. P1 activated it before calculation.

P3 found a deeper form of the same trust-boundary problem: a price/FX series can be non-empty and
valid yet begin too late for the first required calculation date. P3 therefore also verifies that
each required symbol has a positive finite price as-of its earliest transaction date and that each
required foreign currency has a positive finite FX value as-of that date. A per-user benchmark
requires data by the day before that user's first transaction, because the linked benchmark needs
a beginning value.

### PI-003 — Pending dividend withholding policy was duplicated and wrong for Taiwan

Status: **P2 completed**

The calculator and canonical Daily P&L reconciler independently hardcoded a `0.7` net multiplier.
That incorrectly applied 30% withholding to Taiwan pending dividends while confirmation used the
actual net amount. P2 centralized the policy and proved the mixed-market golden correction from
`56` to `62` exactly matched the repaired Taiwan withholding defect.

P2 delivered:
- one shared dividend policy;
- TWD 0%, USD/current application model 30%;
- calculator/reconciler/serialized metadata consistency;
- pending-to-confirmed economic-value invariance tests;
- no coverage gate reduction.

Verification:
- PR #134
- final reviewed head: `f5f1ccdc9ed86b7307221c028fc6ec51c1a4efba`
- final PR CI #326 / run `31180093666`: SUCCESS
- merge/main SHA: `8735d5849850e957b1ddd67c7a3c5d84db1491b8`
- post-merge CI #327 / run `31180405084`: SUCCESS
- post-merge Pages #1423 / run `31180403135`: SUCCESS
- pre-change recovery: `backup-pre-product-integrity-p2-cde4c77`
- post-change recovery: `backup-post-product-integrity-p2-8735d58`

### PI-004 — Non-USD/TWD currency valuation was dimensionally unsafe

Status: **P3 in progress; root implementation verified by CI #336, merge not yet performed**

Pre-P3 behavior had several coupled defects:
- the engine had one USD/TWD series;
- recognized non-USD currencies could fall back to multiplier `1.0`;
- Korean `.KS/.KQ` symbols were not recognized and fell through to USD;
- transaction cash flow, historical/current valuation, dividends, Daily P&L, and canonical
  reconciliation all inherited USD-oriented assumptions;
- the legacy `us_pnl_twd` name could mislabel non-TWD P&L as US-only;
- Yahoo/LSE `.L` equities are commonly quoted in GBp (pence), so treating their quote as GBP
  creates a 100x dimensional error.

P3 root design:
- preserve `fx_rates` / `realtime_fx_rate` as USD/TWD compatibility fields;
- add canonical per-currency historical/realtime `TWD per native quote unit` contexts;
- derive major-unit foreign crosses as `(TWD/USD) / (native/USD)`;
- apply explicit native quote-unit scaling (`GBp = GBP × 0.01`);
- explicitly detect TWD/KRW/HKD/CNY/JPY/GBp/EUR, with suffixless/unknown compatibility as USD;
- remove known-foreign scalar `1.0` fallback;
- use one date-specific FX context for BUY/SELL/DIV cash flows, historical/realtime valuation,
  history provenance, Daily P&L, and canonical reconciliation;
- preserve the legacy `us_pnl_twd` snapshot key for compatibility but treat/render it as the
  non-TWD/overseas price-and-transaction bucket.

P3 dividend safety refinement discovered during implementation:
- multi-currency valuation support does **not** imply all jurisdictions have reviewed tax policy;
- automatic pending accrual is reviewed only for TWD 0% and USD 30% under the current model;
- KRW/HKD/CNY/JPY/GBp/EUR automatic market dividends are not assigned a guessed tax rate;
- an unreviewed holding dividend is deferred, contributes no estimated cash, and records a
  `DIVIDEND_POLICY_REVIEW_REQUIRED` anomaly;
- an actual confirmed `DIV` transaction remains exact and is converted using its native FX;
- a foreign benchmark can be priced without a tax guess when no dividend occurs, but if an
  actual benchmark dividend occurs while policy is unreviewed, benchmark total-return fails
  closed rather than silently dropping the dividend or applying US withholding.

P3 trust-boundary strengthening:
- required price series must have usable as-of data by the symbol's earliest transaction date;
- required FX series must have usable as-of data by the same required date;
- benchmarks must have usable price/FX data before the first user transaction;
- a series that exists but starts too late is now rejected before calculation/upload.

P3 regression matrix includes:
- KRW market value and price P&L;
- KRW FX P&L attribution separated from foreign price P&L;
- confirmed KRW DIV exact native cash flow;
- unreviewed KRW automatic dividend defer + anomaly;
- foreign benchmark no-dividend success and unknown-policy dividend fail-closed behavior;
- all supported suffix-to-native-unit mappings and invalid/missing FX contexts;
- historical/realtime cross-rate construction;
- explicit London GBp 100x unit regression (`250 GBp × 0.4 TWD/GBp = 100 TWD`);
- price/FX series that are valid but start after a required date.

P3 debug / verification history retained as evidence:
- PR #135 base/main: `8735d5849850e957b1ddd67c7a3c5d84db1491b8`
- pre-change recovery: `backup-pre-product-integrity-p3-8735d58`
- CI #328 / run `31182989746`: FAILED with 8 tests sharing one root cause. Adding currency
  provenance had made the reconciler depend on `calculator.currency_detector`, silently expanding
  the calculator test-double contract. Root fix: reconciler now uses pure `CurrencyDetector`
  directly instead of requiring calculator internals.
- CI #329 / run `31210310485`: 151 tests passed; only the absolute missing-lines/missing-branches
  coverage gate failed after adding production FX logic. Gates were not lowered. Meaningful FX,
  currency, dividend, and trust-boundary regressions were added instead.
- CI #336 / run `31211143651`: SUCCESS across Python, frontend, and Worker jobs. Python result:
  `161 passed`, `18 subtests passed`, coverage `75.238095%`, covered lines `1855`, covered branches
  `594`, missing lines `528`, missing branches `278`; existing coverage policy passed unchanged.
- final documentation/diff closeout CI is intentionally recorded in PR #135 after the final head is
  fixed, avoiding a self-triggering documentation loop in this ledger.

P3 is not complete until final-head CI, exact-head merge, post-change recovery, post-main CI, and
Pages verification all succeed.

### PI-005 — XIRR failure and precision semantics are ambiguous

Status: **confirmed design debt; P4 queued**

XIRR currently uses rounded serialized final holdings and converts any solver exception into
`0.0`. That conflates a true 0% return with an undefined/uncomputable result and loses precision.

P4 action: use raw final market value, establish explicit undefined-XIRR semantics, record a
machine-readable diagnostic rather than `except: pass`, and lock behavior with cash-flow/golden
regressions before changing the serialized/UI contract.

### PI-006 — Frontend `fetchAll()` swallows failure from callers

Status: **confirmed; P5 queued**

The portfolio store catches `fetchAll()` failures, sets connection status to error, and does not
rethrow. Callers that wrap `await store.fetchAll()` in `try/catch` can therefore show a success
message after a failed refresh. This is a control-flow contract mismatch, not a networking issue.

P5 action: trace all callers and replace the ambiguous void contract with an explicit failure
contract (rethrow or structured result), then align success/error UI and stale-snapshot state.
P5 also owns user-facing surfacing of structured calculation anomalies such as
`DIVIDEND_POLICY_REVIEW_REQUIRED` and final DividendManager currency/tax UX.

### PI-007 — Dead calculation paths are coupled to absolute coverage floors

Status: **confirmed; P7 queued**

Dormant calculation modules/imports cannot be safely deleted because CI locks absolute covered
line/branch counts. Lowering the floor would hide a regression. P3 intentionally demonstrated the
correct response: add meaningful tests until the existing gate passes; do not weaken the gate.

P7 action: redesign coverage governance around meaningful current-source/change protection, then
remove confirmed dead modules/imports and unused dependencies atomically.

### PI-008 — Model/runtime deprecation and default semantics

Status: **confirmed; P8 queued**

Current CI still emits the Pydantic V2 class-based `Config` deprecation warning from
`journal_engine/models.py`. Model mutable/default-factory semantics and Worker/Python/frontend
contract drift also remain candidates for consolidation. P8 owns migration to current Pydantic
configuration/default factories and explicit contract tests; P3 does not mix that refactor into
financial FX changes.

## Areas reviewed and currently lower priority

- Cloudflare API client: explicit timeouts, explicit `success=true`, strict pagination and upload
  confirmation are present.
- Transaction calendar: missing/empty symbol data, future transaction dates, and unavailable
  prior valuation dates fail closed; synthetic dates clear corporate-action cash fields.
- Canonical Daily P&L reconciliation: per-symbol ledger, formula reconciliation, finite checks,
  and root/group synchronization are strong; P2/P3 remove the known dividend/FX duplication.
- Frontend request layer: timeout/abort classification, malformed-response handling, and mutation
  outcome ambiguity are explicit; the store-level swallowed `fetchAll()` result remains P5.
- Cross-tab market-refresh leadership: lease identity, settle confirmation, lifecycle epochs, and
  pause fail-safe design appear robust from static review; concurrency tests remain part of P6.
- Browser calendar-date formatting uses the resolved local IANA timezone rather than UTC slicing.
- CI #336 also reports an invalid-regex-escape deprecation warning in
  `tests/test_python_coverage_policy.py`; it is a small test-maintenance item, not a P3 financial
  blocker.

## Phased execution plan

### P1 — Source-record and required market-data integrity gates

Status: **completed**

Verification:
- PR #133
- reviewed head: `02bfa592e0150e03ddf9d078a615b4d723797fc8`
- PR CI #322 / run `31178543829`: SUCCESS
- merge/main SHA: `cde4c770d0c64b582083764a55d3ffbfc5e603ad`
- post-merge CI #323 / run `31178674939`: SUCCESS
- post-merge Pages #1422 / run `31178670006`: SUCCESS
- pre-change recovery: `backup-pre-product-integrity-p1-a1466e6`
- post-change recovery: `backup-post-product-integrity-p1-cde4c77`

### P2 — Dividend semantic unification

Status: **completed**

Verification is recorded under PI-003 above and PR #134.

### P3 — Currency-aware valuation and FX dimensional integrity

Status: **in progress; implementation CI green, final closeout pending**
Risk class: critical financial dimensional correctness.

Remaining merge gates:
- README/current capability text matches actual support boundaries;
- final changed-file inventory contains no Worker runtime, D1 migration/schema, or deployment
  workflow change;
- high-risk patches (`market_data.py`, `calculator.py`, `daily_pnl_reconciler.py`, `main.py`,
  currency/dividend policy) are manually re-reviewed for unrelated edits/fallbacks;
- no known foreign valuation path silently substitutes `1.0` or `DEFAULT_FX_RATE`;
- coverage gates remain unchanged;
- final-head CI succeeds;
- PR has no unresolved review thread and `main` has not moved unexpectedly;
- merge uses exact expected head SHA;
- post-merge CI + Pages succeed before P3 is marked complete.

### P4 — Performance metric semantics

Scope:
- raw-value XIRR terminal cash flow;
- explicit undefined-XIRR state/diagnostics;
- audit Modified Dietz zero-denominator/negative-base behavior;
- golden comparisons before any formula semantic change.

### P5 — Frontend state and mutation UX correctness

Scope:
- `fetchAll()` error propagation contract;
- stale snapshot/read failure distinction;
- TradeForm domain feedback aligned to backend;
- DividendManager amount/tax/currency semantics and anomaly surfacing;
- caller-level regression tests.

### P6 — Performance, load and race audit

Scope:
- profile dataframe filtering and repeated as-of lookups;
- pre-index transaction/date/symbol paths only after golden equivalence tests;
- cache safe immutable/as-of lookups;
- slow-response, tab-leadership and polling race tests;
- no performance rewrite that changes financial outputs.

### P7 — Coverage architecture and dead-code removal

Scope:
- replace fossilized absolute coverage coupling with current-source/change protection;
- remove confirmed dormant DailyPnLEngine/TransactionAnalyzer paths only after dependency proof;
- remove unused npm dependencies with lockfile regeneration;
- orphan tool review.

### P8 — Contract/model consolidation

Scope:
- central transaction domain model/invariants;
- Pydantic `ConfigDict` and explicit default factories;
- currency/dividend/benchmark provenance;
- Worker/Python/frontend contract-drift tests.
