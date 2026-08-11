# Gate E / E1b — Historical EOD vs Realtime Valuation Integrity

Status: **CLOSED / PRODUCTION VERIFIED**  
Date: **2026-08-11**  
Baseline protected main before E1b: `82c004c75fb23e2141b9b1bfd1b5abb6eab1fd87`  
Merged E1b main: `419ef87604bd35485c1df6dfce963016cb7aa0cb`

## 1. Problem

`MarketDataClient.download_data()` previously downloaded Yahoo daily history, obtained a scalar "latest" price, and then unconditionally wrote that value into `hist.index[-1]` for `Close` and `Adj Close` before `Close_Adjusted` was prepared.

That made an undated/current quote capable of changing the economic value attached to an older historical date.

A pre-market, holiday, delayed-daily-bar, provider-lag, or request-timing condition could therefore turn:

`historical EOD row on D -> quote observed later -> historical row D mutated`

The defect propagated through `Close_Adjusted` into portfolio valuation, history, Daily P&L, linked TWR, benchmark return, XIRR terminal context, and the deterministic market-input manifest.

Provider diagnostics could show that a realtime overlay occurred, but diagnostics could not repair an already contaminated historical date.

## 2. Root Cause

The implementation conflated two different data products:

1. vendor daily historical observations;
2. current/intraday valuation observations.

The legacy scalar quote did not carry date evidence at the mutation boundary. Nevertheless the code assumed the quote belonged to the existing last historical date.

Current yfinance `FastInfo.last_price` is derived from its price/history machinery and does not provide the date-evidence contract required by this mutation boundary. E1b therefore does not use an undated stock scalar to mutate daily history.

FX is not part of this defect: realtime FX is already held in separate `realtime_fx_*` state and is not written back into historical FX series.

## 3. Locked E1b Contract

### Historical daily rows

- Never modify an existing downloaded daily row with a stock realtime quote.
- Same-date realtime evidence must not replace the daily `Close`, `Adj Close`, or `Close_Adjusted` value.
- Older realtime/intraday evidence must not alter or append anything.

### Realtime/current valuation

A stock synthetic realtime valuation requires **both date proof and no-corporate-action proof**.

- Source must be a positive finite intraday price with a provider timestamp.
- Intraday history is explicitly requested with `actions=True`, `auto_adjust=False`, `prepost=False`.
- The timestamp is normalized in the exchange-local calendar represented by the returned intraday index.
- A synthetic row is eligible only when its date is strictly later than the last downloaded daily-history date.
- The intraday payload must explicitly contain `Dividends` and `Stock Splits` for the quote date; missing or malformed action evidence fails closed.
- Every quote-date `Dividends` and `Stock Splits` value must be zero.
- If `Capital Gains` is present, every quote-date value must also be valid and zero.
- Any non-zero split/dividend/capital-gain event disables the synthetic realtime row. E1b does not reconstruct current-day corporate-action accounting from intraday data.
- Only after those checks pass may the new row use the proven quote date; it never relabels an older daily row.
- Corporate-action/event fields copied into an eligible no-action synthetic row are zeroed, consistent with the evidence that no action exists on that date.
- The row is explicitly labelled:
  - `Valuation_Source = realtime_quote`
  - `Valuation_Source_Date = <synthetic row date>`

This fail-closed rule is deliberate: on a split/dividend/action date where authoritative daily history has not yet arrived, retaining the prior EOD valuation is safer than combining a post-action quote with pre-action holdings/Split_Factor semantics.

### yfinance 1.5.2 upstream contract checked for this batch

The repository pins yfinance `1.5.2`. Its `PriceHistory.history()` accepts `actions=True`, requests dividend/split/capital-gains events, merges dividends and stock splits into the returned frame, and fills their missing values with zero; capital gains is likewise represented for instruments where it is expected. Action columns are dropped only when `actions=False`.

Therefore missing required `Dividends` / `Stock Splits` columns under the explicit `actions=True` E1b request are treated as incomplete provider evidence rather than silently assumed to mean zero.

### Deterministic provenance

- `realtime_quote` is an allowed synthetic effective-market source.
- Its source date must equal the synthetic valuation row date.
- The row's effective price/date/source enters the existing deterministic market-input projection/hash.
- `realtime_overlay_symbols` remains a provider diagnostic identifying symbols for which a synthetic realtime row was actually applied.

## 4. Required Boundary Cases

1. **Undated scalar only / no intraday timestamp**  
   Historical daily row remains unchanged; no realtime overlay is recorded.

2. **Same-date intraday quote**  
   Existing daily row remains unchanged; no duplicate/synthetic row is created.

3. **Intraday quote dated later than last daily row + complete zero-action evidence**  
   Append one explicit `realtime_quote` row at the proven date; retain the prior EOD value unchanged.

4. **Pre-market / holiday / stale intraday evidence**  
   If the latest intraday timestamp is not later than the last daily row, do not append and do not mutate history.

5. **Missing/malformed corporate-action evidence**  
   Do not create a synthetic row.

6. **Quote-date stock split**  
   Do not create a synthetic row; preserve prior EOD and prior split semantics until authoritative daily data arrives.

7. **Quote-date dividend or capital gain**  
   Do not create a synthetic row; do not guess current-day corporate-action accounting.

## 5. R3 Review Finding and Remediation

First exact-head candidate `f47900901d93dc59f7f1c985c4382b408ea2c523` passed CI #609 but was **not** merge-ready.

R3 Same-AI Independent Review found one BLOCKER: the candidate copied the prior daily row into a newer synthetic row and zeroed action fields without first proving the quote date had no corporate action. On a split day this could combine a post-split quote with pre-split holdings / `Split_Factor` semantics.

The candidate was frozen during review. After recording the BLOCKER, reviewer mode ended and implementation resumed. The remediation was the fail-closed action-evidence gate above. A new exact candidate was created and independently re-reviewed; the old CI/review was not reused as merge authority.

Fresh final reviewed candidate:

`1e0f40b2491dfdcdc5e6fa150d86b760f270d66f`

Fresh R3 review result: **PASS — previous blocker remediated, no BLOCKER**.

## 6. Scope Lock

In scope:

- `journal_engine/clients/market_data.py` stock realtime ingestion;
- effective market-input provenance enum/validation;
- deterministic regression tests;
- E1b engineering evidence.

Out of scope:

- FX architecture;
- calculator formulas;
- Daily PnL reconciliation formulas;
- benchmark policy;
- provider abstraction / second provider;
- D1/schema/migrations;
- Worker/auth/privacy routes;
- cash ledger / Decimal / derivatives / tenant UUID work;
- E1c/E1d/E2.

The merged implementation retained this scope exactly.

## 7. Risk

**R3 — critical financial-correctness / effective-market-input boundary.**

The code diff was narrow, but it changed which price/date pair may enter production valuation and performance calculations. Risk was consequence-based, not diff-size-based.

The later evidence/handoff closeout is R2 because it changes decision state but does not change runtime behavior.

## 8. Recovery

Pre-change recovery:

`backup-pre-e1b-market-data-integrity-82c004c`

Post-merge recovery:

`backup-post-e1b-market-data-integrity-419ef87`

Rollback remains a protected revert to the exact pre-E1b baseline if a new evidence-backed correctness regression is discovered. No D1 migration or production Worker mutation was part of E1b.

## 9. Pre-Merge and Post-Merge Validation

Final exact-head CI:

- CI #612 / run `31449796567`;
- exact candidate `1e0f40b2491dfdcdc5e6fa150d86b760f270d66f`;
- Python PASS: 444 tests + 18 subtests;
- coverage raw-count policy PASS; `missing_branches=309`, policy maximum 309;
- Worker security/deployment PASS;
- Frontend contracts/build PASS;
- no coverage-policy weakening.

Expected-head merge:

`419ef87604bd35485c1df6dfce963016cb7aa0cb`

Post-main verification on the exact merge SHA:

- CI #613 / run `31450139272`: SUCCESS;
- Pages #1476 / run `31450139000`: SUCCESS.

No Worker deployment was required because E1b changes the GitHub calculation engine / market-data processing path, not the deployed Worker runtime.

## 10. Production Smoke

Authoritative sanitized evidence:

`docs/governance/evidence/GATE_E_E1B_PRODUCTION_SMOKE_2026-08-11.json`

Production smoke:

- workflow: `Update Portfolio Data`;
- run #3230 / `31453892608`;
- event: `workflow_dispatch`;
- exact source: `419ef87604bd35485c1df6dfce963016cb7aa0cb`;
- normal opaque calculation-job path;
- conclusion: **SUCCESS**.

Observed production evidence:

- 108 transaction records fetched;
- 33 requested market symbols processed;
- no legacy `即時報價覆蓋` application log was emitted;
- no realtime synthetic row was required under the observed market state, which is valid for same-date / fail-closed behavior;
- transaction-prefix integrity PASS;
- canonical Daily PnL reconciliation PASS for 2 groups;
- Daily PnL formula and components both `-24975.10` with 15 symbols;
- legacy Daily PnL diagnostics: 0;
- split-adjusted ledger parity PASS for 108 BUY/SELL rows;
- snapshot upload SUCCESS;
- final processing: successful users 1, failed users 0;
- durable calculation-job terminal callback: `succeeded`.

The production smoke did not happen to require a newer-date realtime synthetic row. That branch is covered by exact-head regression tests; production evidence here proves the merged source runs normally, does not re-enter the historical-overwrite path under the observed market state, preserves reconciliation/ledger integrity, and uploads a valid snapshot successfully.

Large-price-move validator warnings and non-conventional XIRR warnings were diagnostic and did not represent E1b failures; all correctness gates above completed successfully.

## 11. Closeout Decision

E1b acceptance criteria are satisfied:

```text
IMPLEMENTED
-> VALIDATED
-> READY TO MERGE
-> MERGED
-> PRODUCTION VERIFIED
-> CLOSED
```

There is no remaining E1b blocker and no reason to repeat E1a deployment/audit loops or E1b smoke solely for conversational continuity.

**Next Gate E batch: E1c active-job lifecycle / idempotency.**

E1c must address lifecycle semantics rather than merely increasing a fixed TTL. Queued/running jobs must remain active independently of age, with explicit terminal/recovery semantics and fail-closed duplicate-dispatch behavior.
