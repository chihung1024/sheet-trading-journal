# PR-10B3 Acceptance — Measured Python Branch-Coverage Baseline

## Purpose

This batch advances B01 by making Python coverage measurable, reproducible, and fail-closed without changing production behavior or using a hosted coverage platform.

Tracking issue: #82  
Pull request: #83

## Exact baseline and recovery

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA before change: `a32562471849f1f35cd25da327ea5fa32835ebb7`
- Main tree before change: `5c79d42aa7de0ad0e1e946bf5beea95f195b2cc3`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Pre-change backup: `backup-pre-pr10b3-a325624`
- Work branch: `pr10b3-python-coverage-baseline`
- Runtime effect: none
- Cost policy: free-only

## Measurement-first history

The baseline was not guessed.

### Initial measurement

- Measurement commit: `d248d4a06188dfa0703726c6f98cd7ee7ab6e398`
- CI run: `31075500378`
- Result: 92 tests passed; existing Pydantic V2 deprecation warning retained.
- Terminal combined coverage display: 64%.

### Exact sanitized measurement

A second measurement added a strict aggregate reader that exposes only totals, not source contents, user identifiers, transactions, secrets, account data, or coverage artifacts.

- Exact measurement head: `1c38510f03139dce4abbe9dd1d928f2480476601`
- CI run: `31075638834`
- Python job: `92532962664`
- Result: 92 tests passed; all Worker, local D1, frontend-contract, and build jobs passed.

Observed totals:

| Metric | Observed |
|---|---:|
| Statements | 2,113 |
| Covered lines | 1,431 |
| Missing lines | 682 |
| Branches | 748 |
| Covered branches | 404 |
| Missing branches | 344 |
| Combined branch-aware coverage | 64.13841314225795% |

The combined value reconciles exactly as `(covered lines + covered branches) / (statements + branches)`.

## Enforced gates

The final verifier requires all of the following:

- branch coverage remains enabled;
- the exact 19-file production Python scope remains measured;
- aggregate line and branch counts reconcile;
- the reported percentage reconciles with raw counts;
- coverage is at least 64.13%;
- covered lines are at least 1,431;
- covered branches are at least 404;
- missing lines are at most 682;
- missing branches are at most 344.

A production Python file addition or removal intentionally fails source-scope validation until the baseline is reviewed and updated. This prevents new modules from silently escaping measurement.

## Reproducibility

- `pytest==9.0.2` remains pinned.
- `pytest-cov==7.0.0` remains pinned.
- The measured transitive engine is explicitly pinned as `coverage==7.15.3`.
- Coverage JSON remains ephemeral inside the GitHub runner.
- No Codecov, SonarCloud, external telemetry, badge, source upload, or public artifact is used.

## Known test-debt ordering

The measurement identifies the next highest-value coverage work without changing production code in this batch:

1. `market_stage_detector.py` — 0%.
2. `transaction_analyzer.py` — 15%.
3. `market_data.py` — 17%.
4. `auto_price_selector.py` — 22%.
5. API-client, validator, currency, and helper failure paths.

These are future test-only or narrowly scoped batches. Their low coverage is recorded as debt, not hidden by exclusions.

## Changed paths in final PR

- `.github/workflows/ci.yml`
- `requirements-dev.txt`
- `tools/verify_python_coverage.py`
- `tests/test_python_coverage_policy.py`
- `docs/governance/python-coverage-baseline.json`
- `docs/PR10B3_ACCEPTANCE.md`

## Explicit exclusions

No change to:

- Python production source or financial formulas;
- frontend or Worker runtime;
- D1 schema, migrations, records, jobs, or snapshots;
- market-data behavior, benchmarks, dividends, or accounting;
- authentication, Google OAuth, browser token storage, or CORS;
- Cloudflare Worker/Pages deployment;
- IBKR connectivity or account reads;
- workflow triggers, secret names, production URLs, release, API, or schema versions.

## Acceptance gates

1. Coverage-policy unit tests pass.
2. The complete existing Python suite passes under line and branch measurement.
3. The exact report passes the measured baseline verifier.
4. Worker security/deployment/config/local-D1 tests pass.
5. Frontend contracts and production build pass.
6. Exact diff is restricted to the six paths listed above.
7. Independent exact-head review finds no hidden source exclusion or runtime change.
8. Merge uses expected-head locking.
9. A post-merge backup branch is created from the exact merge SHA.
10. Main exact-SHA CI passes.

## Baseline update procedure

Future baseline changes require an independently reviewed PR containing:

- the old and new exact SHA;
- complete test and coverage runs;
- raw aggregate before/after values;
- production source-scope diff;
- an explanation for every reduced gate, if any;
- pre/post recovery references.

A gate must not be lowered solely to make CI pass.

## Rollback

Revert the merge or restore CI, development requirements, verifier, test, and governance records from `backup-pre-pr10b3-a325624`.

No production deployment or data rollback is required.
