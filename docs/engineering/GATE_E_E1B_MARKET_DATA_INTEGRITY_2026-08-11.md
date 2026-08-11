# Gate E / E1b — Historical EOD vs Realtime Valuation Integrity

Status: **IMPLEMENTATION CANDIDATE**  
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

Current yfinance `FastInfo.last_price` is derived from its price/history machinery and does not expose a separate last-trade timestamp through the `FastInfo` key contract. Therefore E1b does not use that undated scalar to mutate stock daily history.

FX is not part of this defect: realtime FX is already held in separate `realtime_fx_*` state and is not written back into historical FX series.

## 3. Locked E1b Contract

### Historical daily rows

- Never modify an existing downloaded daily row with a stock realtime quote.
- Same-date realtime evidence must not replace the daily `Close`, `Adj Close`, or `Close_Adjusted` value.
- Older realtime/intraday evidence must not alter or append anything.

### Realtime/current valuation

- A stock realtime synthetic row requires a positive finite intraday price **and** a provider timestamp.
- The timestamp is normalized in the provider/exchange-local calendar represented by the returned intraday index.
- A synthetic row is eligible only when its date is strictly later than the last downloaded daily-history date.
- The new row uses the proven quote date; it never relabels an older daily row.
- Corporate-action/event fields on the synthetic valuation row are zeroed.
- The row is explicitly labelled:
  - `Valuation_Source = realtime_quote`
  - `Valuation_Source_Date = <synthetic row date>`

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

3. **Intraday quote dated later than last daily row**  
   Append one explicit `realtime_quote` row at the proven date; retain the prior EOD value unchanged.

4. **Pre-market / holiday / stale intraday evidence**  
   If the latest intraday timestamp is not later than the last daily row, do not append and do not mutate history.

## 5. Scope Lock

In scope:

- `journal_engine/clients/market_data.py` stock realtime ingestion;
- effective market-input provenance enum/validation;
- deterministic regression tests.

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

## 6. Risk

**R3 — critical financial-correctness / effective-market-input boundary.**

The code diff is narrow, but it changes which price/date pair may enter production valuation and performance calculations. Risk is consequence-based, not diff-size-based.

## 7. Recovery

Pre-change recovery:

`backup-pre-e1b-market-data-integrity-82c004c`

Rollback is a protected revert to the exact pre-E1b baseline. No D1 migration or production Worker mutation is part of this batch.

## 8. Required Validation

Before merge:

- exact changed-file whitelist;
- Python compile/tests and full repository CI;
- regression proof for undated/same-date/newer-date/stale-date cases;
- provenance identity proof for `realtime_quote`;
- verify no calculator/financial formula, Worker, D1, workflow, or schema change;
- R3 Same-AI Independent Review with financial-correctness/data-provenance competence;
- expected-head merge only.

After merge:

- post-main CI + Pages;
- post-E1b recovery reference;
- one normal `Update Portfolio Data` production smoke when available through GitHub Actions tooling, inspecting calculation/reconciliation/manifest behavior without repeating unrelated E1a production gates;
- only after production evidence closes E1b may the master handoff transition to E1c.
