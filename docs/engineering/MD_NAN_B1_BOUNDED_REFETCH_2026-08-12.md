# MD-NAN-B1 — Bounded Same-Provider Re-fetch for Transient Selected-Price NaN

## Objective

Prevent a transient incomplete Yahoo/yfinance daily row from unnecessarily blocking an otherwise valid portfolio update, without changing financial semantics or weakening fail-closed validation.

## Production reproduction

`Update Portfolio Data #3243` / run `31563691963` failed with `MARKET_DATA_FAILED` during an authenticated dispatch on main `1b8ed8f60c804de1964e76dbf0008f093cbb4798`.

Twenty symbols had a `2026-08-11` provider row where `Close` and `Adj Close` were NaN while Open/High/Low/Volume were present. TMGN additionally had Open greater than High, proving at least one row was internally inconsistent beyond the missing selected price.

Sanitized row evidence is stored in:

`docs/governance/evidence/MARKET_DATA_NAN_RUN_31563691963_2026-08-12.json`

A few minutes later, `Update Portfolio Data #3244` / run `31563887062` succeeded on the same application code and portfolio path without NaN diagnostics.

## Minimum-safe root-cause classification

Transient upstream market-data daily-row incompleteness/inconsistency observed through Yahoo/yfinance retrieval.

The exact responsibility layer is not proven. Current evidence does not justify attributing the defect specifically to Yahoo's raw response, yfinance processing, or yfinance/session/cache behavior.

## Permanent mitigation for current requirements

For a ticker whose prepared selected `Close_Adjusted` still contains NaN:

1. keep the first invalid response unchanged for diagnostics;
2. create a fresh ticker request;
3. re-fetch once using the same symbol, provider, start date, `auto_adjust=False`, and `actions=True` semantics;
4. accept the second response only if it is itself complete under the existing selected-price and validator contract;
5. if the second response remains invalid, preserve it unchanged and let the existing validator fail closed.

## Explicit non-goals

- no `dropna` to hide a provider row;
- no forward-fill/back-fill;
- no Open/High/Low substitution;
- no Adj Close substitution while canonical Close exists;
- no alternate-provider fallback;
- no price repair mode;
- no validator weakening;
- no dividend/split/capital-gain semantic change;
- no Worker, D1, lifecycle, workflow callback, calculator, snapshot, or scheduler redesign.

## Regression contract

`tests/test_market_data_nan_refetch.py` proves:

- invalid first response followed by a clean fresh response uses the second provider Close directly;
- the mitigation does not infer a price from OHLC or a previous day;
- clean symbols are not needlessly retried;
- a persistently invalid response is retried only within the bounded policy;
- persistent NaN remains present and is rejected by `PortfolioValidator.validate_price_data()`.

## Rollback

Revert the MD-NAN-B1 product commit(s). The pre-fix behavior is fail-closed and therefore financially conservative, although operationally less resilient to the reproduced transient provider defect.

## Production verification

NOT YET VERIFIED. After merge, observe a normal production update. A clean first response proves no regression; a reproduced NaN followed by a successful bounded same-provider re-fetch provides direct mitigation verification; two invalid responses must still fail closed.
