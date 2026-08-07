# G00D — Deterministic Python Coverage Clock Acceptance

Status: IN REVIEW  
Baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`  
Recovery branch: `backup-pre-g00d-coverage-clock-2557fc5`  
Work branch: `g00d-coverage-clock-determinism`

## Trigger

The governance-only PR #112 exposed a nondeterministic Python coverage gate. The PR changed no Python runtime source, yet its Python CI job failed after all functional tests passed.

## Evidence before repair

### Passing control run on unchanged main

- Source: `main@2557fc582d3555f7b129f36d2cf5ad67c141375e`
- CI run: `31134320996`
- Python job: `92730217778`
- Result: `125 passed, 2 warnings, 7 subtests passed`
- Measured totals: 2116 statements, 591 missing lines, 748 branches, 439 covered branches, 309 missing branches, 68.57541899441341% covered.
- `daily_pnl_helper.py`: 41 statements, 13 missing, 60% displayed coverage.
- Run time was before the Taiwan 09:00 market open.

### Failing PR run with unchanged Python runtime source

- PR: `#112`
- Head: `b06a2d074ae37637d5477c332a0184603fab9e77`
- CI run: `31138346412`
- Python job: `92742686787`
- Functional result: `125 passed, 2 warnings, 7 subtests passed`
- Coverage policy result: FAIL
- Measured total missing lines increased from 591 to 595.
- The four-line delta was isolated to `journal_engine/core/daily_pnl_helper.py`, whose displayed coverage fell from 60% to 49%.
- The PR run occurred after the Taiwan 09:00 market open.

Both runs used Python 3.10.20 and coverage 7.15.3. The runtime source for `daily_pnl_helper.py` was unchanged.

## Root cause

`DailyPnLHelper` reads `datetime.now(Asia/Taipei)` directly. Existing portfolio tests exercise parts of this helper indirectly through `PortfolioCalculator`, so which helper branches are executed varies with the actual wall clock and market session when CI runs.

The coverage regression was therefore not a source regression; it was a nondeterministic measurement caused by wall-clock-dependent branch execution.

## Repair

Add deterministic unit coverage for `DailyPnLHelper` with a module-local mocked clock. The new tests explicitly exercise:

- legacy price-strategy compatibility;
- Taiwan before-open and after-open display-date paths;
- US before-09:30 and after-09:30 Eastern display-date paths;
- Taiwan-open, US-open, weekend and unknown-market paths;
- all three `get_market_stage()` outcomes.

The production helper implementation is intentionally unchanged in G00D. This batch repairs the test oracle/measurement layer only.

## Prohibited shortcuts

G00D must not:

- lower any Python coverage gate;
- weaken `docs/governance/python-coverage-baseline.json`;
- skip the coverage verification step;
- retry CI until the wall clock happens to cover the baseline paths;
- change portfolio calculations merely to make coverage stable.

## Acceptance criteria

G00D passes only if:

1. the diff contains test/governance evidence only;
2. all Python functional tests pass;
3. the existing coverage baseline verifier passes without lowering its gates;
4. Worker/security/D1 and frontend CI remain green;
5. the successful proof run occurs after the Taiwan 09:00 boundary that previously caused PR #112 to fail, demonstrating that coverage no longer depends on that session transition;
6. no production deployment or D1 operation occurs.

## Rollback

Revert the G00D PR or restore from `backup-pre-g00d-coverage-clock-2557fc5`. No service/database rollback is required because the batch changes tests/governance evidence only.
