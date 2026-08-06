# PR-10B4 Acceptance — Active Market-Data Invariants and Non-Finite FX Safety

## Purpose

This batch raises B01 test coverage around the actively used market-data boundary and fixes one test-first defect: non-finite FX quotes could pass through normalization and contaminate downstream valuation.

Tracking issue: #84  
Pull request: #85

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `dddcc3f001c7b580e8de1f2a0a0bd602332c6716`
- Main tree before change: `4029cd9077439b5cfbc02e5949359cee1df75018`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10b4-dddcc3f`
- Work branch: `pr10b4-market-data-tests`
- Cost policy: free-only

## Test-first defect evidence

The first commit added only deterministic in-memory tests and a hard yfinance constructor guard.

- Test-first head: `7f237b23b2efdddb8cf2d4faf4e2749a682429c8`
- CI run: `31076484926`
- Python job: `92535545776`
- Result: 2 failed, 115 passed, 1 existing warning, 5 subtests passed
- Worker/security/config/local-D1: passed
- Frontend contracts/build: passed
- Network guard: not triggered

The two failures proved:

- `NaN` was returned as an FX rate instead of the configured fallback.
- positive infinity was returned as an FX rate instead of the configured fallback.

Finite direct quotes, inverse quotes, zero, negative, non-numeric, and `None` behavior passed. All price-selection, preparation, split-factor, as-of, previous-date, transaction-multiplier, and dividend tests passed.

## Minimal production correction

`MarketDataClient._normalize_twd_per_usd()` now requires the parsed value to be finite and positive before direct or reciprocal normalization.

- Correction head: `dd9e6cc0e5df6473e369dd0d09ec3337077c535b`
- Successful CI run: `31076669037`
- Python job: `92536087188`
- Result: 115 passed, 1 existing warning, 7 subtests passed
- Worker/security/config/local-D1: passed
- Frontend contracts/build: passed

The behavior for every finite positive rate is unchanged. No market source, request path, pricing formula, split method, dividend method, or date-selection rule changed.

## Network and external-service isolation

The new test class patches `journal_engine.clients.market_data.yf.Ticker` to raise immediately. The covered tests use only in-memory pandas objects.

This batch performs no:

- yfinance HTTP request;
- IBKR account or transaction request;
- Cloudflare deployment or resource creation;
- Google Cloud or OAuth operation;
- hosted coverage upload;
- paid or potentially metered service call.

## Covered invariants

- Close is preferred over Adj Close for Scheme A valuation.
- Adj Close is used only as the documented fallback.
- Missing price fields return an aligned empty float series.
- Returned price series is isolated from the source DataFrame.
- Direct and reciprocal finite FX quotes normalize to TWD per USD.
- zero, negative, malformed, missing, NaN, and infinite FX values fall back safely.
- data preparation preserves Close semantics and builds cumulative split factors.
- missing Stock Splits is normalized to zero and factor one.
- exact, as-of, before-history, and missing-symbol price behavior is deterministic.
- effective valuation dates and previous trading dates are explicit.
- transaction multipliers use exact/as-of/first-known semantics, including timezone-aware input.
- Scheme A dividend adjustment remains one and dividend lookup remains exact-date only.

## Coverage before and after

| Metric | PR-10B3 baseline | PR-10B4 observed | Change |
|---|---:|---:|---:|
| Statements | 2,113 | 2,114 | +1 |
| Covered lines | 1,431 | 1,523 | +92 |
| Missing lines | 682 | 591 | -91 |
| Branches | 748 | 748 | 0 |
| Covered branches | 404 | 439 | +35 |
| Missing branches | 344 | 309 | -35 |
| Combined coverage | 64.13841314225795% | 68.55345911949685% | +4.4150459772389 pp |

New gates are strictly stronger:

- coverage at least 68.55%;
- covered lines at least 1,523;
- covered branches at least 439;
- missing lines at most 591;
- missing branches at most 309.

The governance file retains the complete PR-10B3 measurement and gates in `history`. The verifier now rejects a current gate set weaker than the retained latest history.

## Unused market-stage module debt

Repository search found no production call site for `market_stage_detector.py`. It remains measured at 0% but is not promoted to an active contract by this PR. Its activation, retirement, or redesign requires a separate reviewed decision because its market-calendar semantics are broader than this network-free test batch.

## Changed paths

- `journal_engine/clients/market_data.py`
- `tests/test_market_data_pure_invariants.py`
- `docs/governance/python-coverage-baseline.json`
- `tools/verify_python_coverage.py`
- `tests/test_python_coverage_policy.py`
- `docs/PR10B4_ACCEPTANCE.md`

## Explicit exclusions

No change to:

- finite positive FX normalization;
- pricing, holdings, PnL, TWR, XIRR, benchmark, split, or dividend formulas;
- market-data download behavior or provider;
- frontend, Worker, D1, records, jobs, snapshots, or authentication;
- workflow triggers, dependencies, secrets, production URLs, release, API, or schema versions.

## Acceptance gates

1. The retained defect-discovery run proves the original failure.
2. The minimal correction passes all new and existing Python tests.
3. The network guard remains untriggered.
4. Exact coverage totals reconcile and pass stronger gates.
5. Historical coverage gates cannot be silently weakened.
6. Worker, local D1, frontend-contract, and build gates pass.
7. Exact diff is restricted to the six paths listed above.
8. Independent exact-head review confirms the runtime change is limited to non-finite FX fail-safe handling.
9. Merge uses expected-head locking.
10. A post-merge backup is created from the exact merge SHA.
11. Main exact-SHA CI passes.

## Rollback

Revert the merge or restore the source, tests, verifier, and governance files from `backup-pre-pr10b4-dddcc3f`.

No D1, Worker, frontend, OAuth, IBKR, or data rollback is required. Reverting the source correction would reintroduce non-finite FX propagation and is therefore for emergency compatibility only.
