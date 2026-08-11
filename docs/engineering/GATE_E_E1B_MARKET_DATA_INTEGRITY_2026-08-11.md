# Gate E / E1b — Historical EOD vs Realtime Valuation Integrity

Status: **IMPLEMENTATION CANDIDATE — R3 BLOCKER REMEDIATED, REVALIDATION REQUIRED**  
Date: **2026-08-11**  
Baseline protected main: `82c004c75fb23e2141b9b1bfd1b5abb6eab1fd87`

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

The candidate was frozen during review. After recording the BLOCKER, reviewer mode ended and implementation resumed. The remediation is the fail-closed action-evidence gate above. The prior CI/review does not authorize the new candidate; a new exact-head CI and fresh focused R3 review are mandatory.

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

## 7. Risk

**R3 — critical financial-correctness / effective-market-input boundary.**

The code diff is narrow, but it changes which price/date pair may enter production valuation and performance calculations. Risk is consequence-based, not diff-size-based.

## 8. Recovery

Pre-change recovery:

`backup-pre-e1b-market-data-integrity-82c004c`

Rollback is a protected revert to the exact pre-E1b baseline. No D1 migration or production Worker mutation is part of this batch.

## 9. Required Validation

Before merge:

- exact changed-file whitelist;
- Python compile/tests and full repository CI;
- regression proof for undated/same-date/newer-date/stale-date cases;
- split/dividend/capital-gain/missing-action fail-closed regression proof;
- provenance identity proof for `realtime_quote`;
- verify no calculator/financial formula, Worker, D1, workflow, or schema change;
- fresh R3 Same-AI Independent Review with financial-correctness/data-provenance competence;
- expected-head merge only.

After merge:

- post-main CI + Pages;
- post-E1b recovery reference;
- one normal `Update Portfolio Data` production smoke when available through GitHub Actions tooling, inspecting calculation/reconciliation/manifest behavior without repeating unrelated E1a production gates;
- only after production evidence closes E1b may the master handoff transition to E1c.
