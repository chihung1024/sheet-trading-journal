# Product Integrity Audit & Execution Ledger

This is the current engineering ledger for the post-D3D product-correctness program. It records confirmed root causes, phased remediation, recovery points, compatibility constraints, and verification evidence. Historical governance material remains forensic context; this file is the current product-engineering navigation point.

## Current baseline and protected boundaries

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`
- Current merged product-integrity baseline: `1a4496dec4f1cfc07f07831f2db1819bf5d333bd` (P4A)
- Runtime identity remains Worker 4.07 / API 2.60 / D1 schema 2.
- Production activation remains fail-closed; this program does not reopen D3D.
- Schema 3 remains prohibited until the separate recovery-evidence gate passes.
- P4B is isolated to repository calculation semantics/tests/docs. It does not deploy a production Worker or mutate D1.

## Engineering principles

1. Preserve valid current behavior unless a value is demonstrably incorrect.
2. Fix the earliest trustworthy root boundary; late checks are defense-in-depth, not substitutes.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Every financial-semantic change needs a regression/golden test before merge.
5. Every batch uses pre-change recovery, scoped PR, CI, second diff review, exact-head merge, post-merge verification, and post-change recovery.
6. Do not lower coverage or validation thresholds merely to make a refactor pass.
7. Do not deploy a production Worker merely because repository source changed.
8. Treat monetary values as dimensioned quantities; a finite number is not valid if its currency or quote-unit scale is wrong.
9. Distinguish a mathematically undefined/unavailable performance metric from a genuine numeric zero.

## Completed findings

### PI-001 — Python transaction domain contract drift

Status: **P1 completed**

The Worker write boundary requires `qty > 0`, finite values, and `price >= 0`. The Python runner previously trusted a weaker contract. P1 aligned the runner with the source-of-record boundary. Price zero remains temporarily compatible because the current Worker explicitly permits it.

Verification:
- PR #133
- final reviewed head: `02bfa592e0150e03ddf9d078a615b4d723797fc8`
- PR CI #322 / run `31178543829`: SUCCESS
- merge/main: `cde4c770d0c64b582083764a55d3ffbfc5e603ad`
- post-main CI #323 / run `31178674939`: SUCCESS
- Pages #1422 / run `31178670006`: SUCCESS
- pre recovery: `backup-pre-product-integrity-p1-a1466e6`
- post recovery: `backup-post-product-integrity-p1-cde4c77`

### PI-002 — Required market-data validation was not fully enforced

Status: **P1 completed; P3 strengthened historical coverage**

P1 wired required price validation into orchestration. P3 added a deeper trust-boundary rule: a non-empty price/FX series is still invalid if usable as-of data begins after the first required calculation date. Benchmarks require data before the first user transaction because linked returns need a beginning value.

### PI-003 — Pending dividend withholding policy was duplicated and wrong for Taiwan

Status: **P2 completed**

The calculator and canonical Daily P&L reconciler independently hardcoded a `0.7` net multiplier. That incorrectly applied 30% withholding to Taiwan pending dividends. P2 centralized reviewed policy and proved the mixed-market golden correction from `56` to `62` exactly matched the repaired Taiwan withholding defect.

Current reviewed automatic pending-dividend policy:
- TWD: 0%
- USD: 30% under the current model
- KRW/HKD/CNY/JPY/GBp/EUR: no guessed withholding; automatic accrual is deferred and records `DIVIDEND_POLICY_REVIEW_REQUIRED`
- confirmed `DIV` transactions remain exact actual cash flows

Verification:
- PR #134
- final reviewed head: `f5f1ccdc9ed86b7307221c028fc6ec51c1a4efba`
- PR CI #326 / run `31180093666`: SUCCESS
- merge/main: `8735d5849850e957b1ddd67c7a3c5d84db1491b8`
- post-main CI #327 / run `31180405084`: SUCCESS
- Pages #1423 / run `31180403135`: SUCCESS
- pre recovery: `backup-pre-product-integrity-p2-cde4c77`
- post recovery: `backup-post-product-integrity-p2-8735d58`

### PI-004 — Non-USD/TWD currency valuation was dimensionally unsafe

Status: **P3 completed**

Pre-P3 defects included one USD/TWD-centric FX series, known foreign currencies falling back to `1.0`, Korean suffixes falling through to USD, USD-oriented Daily P&L/reconciliation assumptions, and a London GBp-vs-GBP 100x unit risk.

P3 delivered:
- canonical per-currency `TWD per native quote unit` historical/realtime FX contexts;
- cross-rates derived as `(TWD/USD) / (native/USD)`;
- explicit quote-unit scaling for GBp (`GBP × 0.01`);
- explicit TWD/KRW/HKD/CNY/JPY/GBp/EUR detection;
- no known-foreign scalar `1.0`/default-FX valuation fallback;
- consistent date-specific FX for BUY/SELL/DIV cash flows, historical/current valuation, history provenance, Daily P&L, and canonical reconciliation;
- legacy `us_pnl_twd` API key retained but interpreted/rendered as the non-TWD/overseas bucket;
- price/FX historical-coverage gates at the earliest required dates;
- reviewed-only automatic dividend accrual for foreign markets.

Regression matrix includes KRW valuation, KRW price-vs-FX P&L attribution, confirmed KRW DIV, unreviewed foreign pending dividends, foreign benchmark fail-closed dividend handling, suffix/native-unit mappings, cross-rate construction, and explicit London GBp 100x regression.

Debug/verification evidence:
- PR #135
- base: `8735d5849850e957b1ddd67c7a3c5d84db1491b8`
- pre recovery: `backup-pre-product-integrity-p3-8735d58`
- CI #328: failed with 8 tests due to an accidental reconciler dependency on calculator internals; root-fixed by using `CurrencyDetector` directly.
- CI #329: 151 tests passed; only absolute missing-line/branch gates failed after new FX logic. Gates were not lowered; meaningful regressions were added.
- CI #336 / run `31211143651`: SUCCESS after regression coverage was added.
- final PR CI #340: SUCCESS.
- exact-head merge/main: `de4d1d1deed6fd4ba1fef9d720a23a0557e3887a`
- post-main CI #341 / run `31212198856`: SUCCESS
- post-main Pages run `31212196946`: SUCCESS
- post recovery: `backup-post-product-integrity-p3-de4d1d1`

### PI-005A — XIRR failure, precision, and valuation-date semantics were ambiguous

Status: **P4A completed**

Pre-P4A XIRR used rounded serialized holdings for the terminal value, dated that value at batch execution time rather than the actual valuation date, and converted solver failure/no-solution into `0.0`. That conflated a true 0% return with an unavailable metric and distorted annualization on weekends/holidays.

P4A delivered:
- raw `_raw_total_value` terminal valuation;
- actual last valuation date for the terminal cash flow;
- one XIRR primitive with machine-readable status/provenance;
- legacy numeric `xirr: float` retained for compatibility;
- `xirr_status`: `ok` / `not_applicable` / `undefined`;
- `xirr_reason`;
- `xirr_asof_date`;
- strict `xirr_cashflow_conventional` provenance;
- true 0% distinguished from unavailable `0.0` sentinel;
- explicit solver error/no-solution/non-finite handling;
- non-conventional cash-flow ambiguity marking because multiple IRR roots may exist;
- upload validator consistency checks while accepting legacy snapshots without status;
- frontend unavailable state rendered as `--`, not `+0.00%`;
- exact coverage inventory extended without lowering gates.

Important regression: serialized holding market value may be rounded to `30`, while the XIRR helper must receive raw terminal value approximately `30.12` and terminal date `2026-01-02`.

Debug/verification evidence:
- PR #136
- base: `de4d1d1deed6fd4ba1fef9d720a23a0557e3887a`
- pre recovery: `backup-pre-product-integrity-p4-de4d1d1`
- CI #342 exposed Pydantic bool coercion; fixed with `StrictBool`, not a weaker test.
- CI #345/#346 exposed integration-fixture/date-range and binary-float assertion issues; fixed without accepting the old rounded `30.0` behavior.
- CI #348: Python/frontend/Worker SUCCESS on code/test head.
- final PR CI #349 / run `31214417882`: SUCCESS on head `b88a99222e5a99992d483264571f08637ca6b4dd`.
- exact-head merge/main: `1a4496dec4f1cfc07f07831f2db1819bf5d333bd`
- post-main CI #350 / run `31237290331`: SUCCESS
- post-main Pages #1425 / run `31237289807`: SUCCESS
- post recovery: `backup-post-product-integrity-p4a-1a4496d`

## Active finding

### PI-005B — Modified Dietz/TWR undefined-vs-zero semantics

Status: **P4B active**

The current Modified Dietz helper can return `0.0` when the period is not reliably computable, including negative beginning value, denominator near zero, or non-finite result. This can make an undefined subperiod indistinguishable from a genuine 0% return and then propagate that false zero through linked TWR history.

P4B objective:
- map every current zero-return fallback to its exact mathematical precondition;
- distinguish genuine 0% from unavailable/undefined periods without silently changing valid historical values;
- define machine-readable period status/reason before changing serialized/UI behavior;
- add primitive and calculator-level golden regressions around zero denominator, negative beginning value, extreme cash flow, and non-finite paths;
- quantify impact on linked TWR before any formula semantic change;
- do not touch XIRR semantics, Worker/D1/schema, deployment, P3 currency/dividend logic, or P5 frontend fetch contracts.

Safety:
- P4B base/main: `1a4496dec4f1cfc07f07831f2db1819bf5d333bd`
- pre recovery: `backup-pre-product-integrity-p4b-1a4496d`
- work branch: `pr-product-integrity-p4b-twr-semantics`

## Remaining confirmed findings

### PI-006 — Frontend `fetchAll()` swallows failure from callers

Status: **confirmed; P5 queued**

The portfolio store catches `fetchAll()` failures, sets connection state to error, and does not rethrow. Callers using `try/catch` around `await store.fetchAll()` can therefore show success after a failed refresh. P5 owns an explicit caller contract plus stale-snapshot/read-failure UX and structured anomaly surfacing.

### PI-007 — Dead calculation paths are coupled to absolute coverage floors

Status: **confirmed; P7 queued**

Dormant calculation modules/imports cannot yet be deleted safely because CI locks absolute covered line/branch counts. P7 will redesign coverage protection around current-source/change behavior, then remove dead modules/imports/dependencies atomically rather than lowering gates.

### PI-008 — Model/runtime deprecation and contract consolidation

Status: **confirmed; P8 queued**

Current CI still reports Pydantic V2 class-based `Config` deprecation. P8 owns `ConfigDict`, explicit default factories, central domain invariants, and Worker/Python/frontend contract-drift tests. P4B does not mix this refactor into performance-metric semantics.

## Areas reviewed and currently lower priority

- Cloudflare API client has explicit timeouts, strict pagination, explicit `success=true`, and upload confirmation.
- Transaction calendar fails closed on missing/empty data, future dates, and unavailable prior valuation dates.
- Canonical Daily P&L reconciliation has per-symbol ledger/formula/finite checks; P2/P3 removed the known dividend/FX duplication.
- Cross-tab market-refresh leadership appears structurally robust; load/race testing remains P6.
- Browser calendar-date formatting uses the resolved local IANA timezone rather than UTC slicing.
- Current maintenance warnings include Pydantic V2 config deprecation and an invalid regex escape in `tests/test_python_coverage_policy.py`; neither is a P4B financial-semantic blocker.

## Phased execution plan

- **P1 — Source-record and required market-data integrity:** completed.
- **P2 — Dividend semantic unification:** completed.
- **P3 — Currency-aware valuation / FX dimensional integrity:** completed.
- **P4A — XIRR validity / precision / valuation-date semantics:** completed.
- **P4B — Modified Dietz/TWR undefined-vs-zero semantics:** active.
- **P5 — Frontend state and mutation UX correctness:** queued.
- **P6 — Performance, load, and race audit:** queued.
- **P7 — Coverage architecture and dead-code removal:** queued.
- **P8 — Contract/model consolidation:** queued.

P4B is not complete until its exact-head PR CI, second diff/review, exact-head merge, post-main CI/Pages, and post-change recovery checkpoint all succeed.
