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
2. retry only when the first response has complete numeric `Dividends` and `Stock Splits` evidence under the existing `actions=True` contract;
3. create a fresh ticker request;
4. re-fetch once using the same symbol, provider, start date, `auto_adjust=False`, and `actions=True` semantics;
5. require the fresh response to retain complete numeric `Dividends` and `Stock Splits` evidence;
6. require the fresh response to select the same price source as the first response, so a failed `Close` fetch cannot silently turn into an `Adj Close` rescue;
7. accept the fresh response only when the selected price no longer contains NaN; all existing downstream validation still applies unchanged;
8. if the fresh request is empty, throws, changes price source, lacks/malforms required action evidence, or remains NaN, preserve an invalid provider response and let the existing validator fail closed.

This is retrieval retry, not price repair.

## Explicit non-goals

- no `dropna` to hide a provider row;
- no forward-fill/back-fill;
- no Open/High/Low substitution;
- no Adj Close substitution while canonical Close is the selected source;
- no alternate-provider fallback;
- no price repair mode;
- no validator weakening;
- no dividend/split/capital-gain semantic change;
- no Worker, D1, lifecycle, workflow callback, calculator, snapshot, or scheduler redesign.

## Independent review findings already remediated

The first candidate exposed a fail-closed evidence preservation gap: if the initial response was invalid but the fresh request returned empty data or raised an exception, the candidate could discard the first invalid frame and change the downstream failure shape. The implementation now retains the first invalid response in both cases.

A second financial-semantics review identified two acceptance boundaries required by the already-closed E1b market-integrity contract:

- the retry may not change selected price source;
- the retry may not be accepted without complete numeric `Dividends` and `Stock Splits` evidence.

Both are now explicit code gates and regression-tested. These findings are within MD-NAN-B1 because they prevent the retry itself from becoming a new price/action correctness defect.

## Regression contract

`tests/test_market_data_nan_refetch.py` proves:

- invalid first response followed by a clean fresh response uses the second provider `Close` directly;
- the mitigation does not infer a price from OHLC or a previous day;
- clean symbols are not needlessly retried;
- persistent NaN remains present and is rejected by `PortfolioValidator.validate_price_data()`;
- an empty or exceptioning fresh request preserves the first invalid response for fail-closed validation;
- a fresh response that changes selected source from `Close` to `Adj Close` is rejected;
- missing or malformed required daily action evidence is rejected;
- an initial invalid frame without complete required action evidence is not retried;
- helper boundary cases are covered so the repository coverage gate is not weakened.

## CI note

One intermediate candidate passed the complete Python test suite but failed the repository's existing missing-branch coverage gate. The gate is not being weakened; additional branch regressions were added and a fresh exact-head CI is required before merge.

## Rollback

Revert the MD-NAN-B1 product commit(s). The pre-fix behavior is fail-closed and therefore financially conservative, although operationally less resilient to the reproduced transient provider defect.

## Production verification

NOT YET VERIFIED. After merge, observe a normal production update. A clean first response proves no regression; a reproduced NaN followed by a successful bounded same-provider re-fetch provides direct mitigation verification; an unacceptable or persistently invalid fresh response must still fail closed.
