# Update Portfolio Data #3317 — Root Cause & Recovery Architecture

Date: 2026-08-18 (Asia/Taipei)

## Executive outcome

`Update Portfolio Data #3317` exposed a provider-data integrity failure, not an accounting, transaction, Worker, D1, or portfolio-formula defect. Yahoo/yfinance returned a malformed latest daily row for 2026-08-17 across multiple US stocks/ETFs: selected `Close` / `Adj Close` values were `NaN`, and some rows also contained impossible daily OHLC relationships.

The fix intentionally does **not** relax the portfolio validator, guess prices, add symbol/date exceptions, or introduce another data provider. Recovery remains same-provider, evidence-based, bounded, and fail-closed.

## Root-cause chain

### 1. Symptom

The production calculation terminated with `MARKET_DATA_FAILED` because selected valuation prices still contained `NaN` after the normal two daily observations.

### 2. Provider failure mode

Yahoo/yfinance supplied malformed latest-day daily data. Depending on the symbol, the row could contain:

- finite Open/High/Low with `Close` and `Adj Close` missing;
- structurally impossible OHLC values;
- sparse intraday no-trade buckets represented as all price fields empty with zero volume.

The strict validator correctly rejected these inputs.

### 3. Why daily repair was insufficient

`yfinance repair=True` is heuristic and does not establish an independent financial authority. In this incident it could enter optional SciPy-backed unit-repair paths, and even when that dependency was present some repaired daily rows still retained impossible OHLC structure. Adding the dependency alone would therefore treat only one implementation symptom.

### 4. Why raw intraday evidence is appropriate

Raw regular-session 1h observations could reconstruct a structurally valid daily OHLC/Close for affected zero-action rows. Cross-checking against a second raw granularity (15m) provides an independent representation from the same Yahoo provider while preserving the existing daily row as authority for volume and corporate actions.

### 5. Why a naive retry is not a fresh observation

The deeper defect was in the recovery freshness assumption. In pinned `yfinance==1.5.2`, sufficiently old historical `Ticker.history(start=..., end=...)` requests are routed through `YfData.cache_get`, and `cache_get` is LRU-backed. Repeating the same historical request after a delay can therefore replay cached response bytes instead of observing Yahoo again.

A same-parameter retry cannot be treated as independent evidence merely because time elapsed.

## Final architecture

Recovery is split into two authorities with an explicit boundary.

### A. `YahooIntradayEvidenceSession` — transport / freshness only

Responsibilities:

- same Yahoo/yfinance provider only;
- exact affected calendar date;
- raw regular-session data only;
- 1h and 15m evidence intervals;
- explicitly clear the pinned yfinance historical HTTP-response LRU before each bounded observation;
- serialize cache-clear + observation through a class-level lock so concurrent semantic recoveries cannot invalidate each other's freshness boundary;
- lazily construct/fetch intervals so invalid 1h evidence fails fast without an unnecessary 15m request;
- if yfinance's pinned cache-clear contract disappears or is non-callable, fail closed.

This layer **does not decide whether a price is financially valid** and never mutates daily/accounting data.

### B. `SemanticMarketDataClient` — evidence acceptance / financial semantics

Responsibilities:

1. Intraday recovery is considered only after normal daily retrieval remains invalid.
2. Only a daily row with proven zero dividend, zero split, and zero capital-gain action can enter price reconstruction.
3. Original daily Volume and corporate-action fields remain authoritative.
4. Every non-empty intraday bar must contain complete finite positive Open/High/Low/Close/Adj Close values with structurally valid OHLC.
5. `Close` and `Adj Close` must agree within the existing strict tolerance.
6. A fully price-empty keepna bucket is ignored only when Volume is zero or absent; price-empty/non-zero-volume or partially populated bars are contradictory evidence and fail closed.
7. 1h and 15m must reconstruct the same daily Open/High/Low/Close/Adj Close.
8. First-round agreement succeeds immediately.
9. If the first fresh 1h/15m pair disagrees, exactly one bounded fresh observation is allowed after a short delay.
10. Second-round 1h/15m must agree with each other **and** the consensus must match one of the two values actually observed in round one. Convergence to a new third value fails closed.
11. Rebuilt data returns through the existing canonical preparation and portfolio validation path.

## Explicit non-goals / rejected shortcuts

- no alternate market-data provider;
- no ticker/date hard-coded exception;
- no tolerance widening;
- no guessed or forward-filled ordinary market price;
- no intraday takeover of dividend/split/capital-gain authority;
- no validator weakening;
- no unbounded retry loop;
- no accounting, FX, transaction, Worker, or D1 contract change;
- no reliance on changing a timeout or another incidental cache-key argument as the long-term freshness mechanism.

## Regression and governance evidence

Frozen candidate head before documentation: `27176f8a8123f52530a84ac83a47437d1113cb6a`.

CI #1313 / run `32132151273`:

- Frontend contracts/build: PASS;
- Python: 649 passed + 18 subtests;
- new `yahoo_intraday_evidence.py`: 100% statements and branch coverage;
- repository coverage policy: PASS at 87.24285925706674%; existing coverage gates were not lowered;
- Worker security/deployment/D1 baseline: PASS.

The final documentation commit must receive a new exact-head CI before merge; #1313 is evidence for the code architecture, not permission to skip the final gate.

## Production closeout gate

This incident is not closed by unit/CI evidence alone. After merge, `Update Portfolio Data` must be dispatched from the merged `main` and complete successfully through the normal production calculation/upload workflow. The production run number, merged SHA, and final conclusion are recorded in the live handoff only after authoritative evidence exists.

## Rollback

The change is migration-free. Rollback is a normal revert of the final PR merge. No D1 restore, transaction rewrite, accounting migration, or market-data backfill is required.
