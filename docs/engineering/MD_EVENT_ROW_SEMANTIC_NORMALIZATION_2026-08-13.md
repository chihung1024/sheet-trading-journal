# Market-Data Event-Row Semantic Normalization — Root-Cause Closeout

Status: **MERGED / POST-MAIN VERIFIED / NORMAL PRODUCTION PATH VERIFIED / SPECIAL BRANCH REGRESSION-VERIFIED**  
Date: **2026-08-13**

## 1. Problem

The market-data pipeline historically assumed that every provider daily row was also a usable valuation observation.

That assumption is not always true. A provider can legitimately retain a daily row because it contains a corporate action even when that row has no usable OHLC/selected price observation. After the existing bounded same-provider re-fetch reproduced the same shape, downstream price validation still treated the row as a broken market bar and could fail the entire portfolio update.

The defect is therefore a **provider-row semantic mismatch**, not a ticker/date-specific defect.

## 2. Root Cause

The ingestion boundary conflated two different row meanings:

1. a market-price observation; and
2. a corporate-action event row retained by the provider without a contemporaneous usable price observation.

The existing retry logic correctly answered whether the incomplete shape was transient. It did not answer what a **persistent** action-only row means. The validator consequently received a semantically valid event row through a price-observation contract and failed closed.

The observed ticker/date that first exposed the defect was used only as reproduction evidence. The final implementation contains no symbol, date, or dividend-amount special case.

## 3. Generic Production Contract

PR #217 adds a `SemanticMarketDataClient` production adapter over the existing `MarketDataClient` and keeps the original bounded same-provider re-fetch unchanged.

A selected-price-NaN row is eligible for semantic normalization only when all of the following are true:

- two **successful prepared provider responses** reproduce the same semantic signature;
- the selected price source is identical across those successful responses;
- raw OHLC fields are all absent on the event row;
- volume is zero or missing;
- the event is a finite positive **cash dividend only**;
- `Stock Splits` is zero;
- `Split_Factor` is finite and positive;
- no material or malformed `Capital Gains` event exists; and
- a prior finite positive selected valuation exists.

For an eligible persistent dividend-only event row:

- raw provider OHLC is not fabricated;
- `Close_Raw` remains missing;
- only calculation-effective `Close_Adjusted` is materialized from the latest prior finite selected valuation;
- `Valuation_Source=asof_carry_forward`;
- `Valuation_Source_Date` records the actual prior price source date;
- the dividend event itself is preserved for downstream dividend accounting and deterministic input provenance.

The following remain intentionally **fail-closed**:

- partial or mixed price bars;
- unstable action values across re-fetches;
- a failed/empty second request;
- differing selected price sources across attempts;
- stock-split events;
- mixed dividend + split events;
- material or malformed capital-gain events;
- missing/malformed semantic columns;
- non-finite/non-zero volume where a pure event row is required;
- no prior defensible valuation.

This separation is deliberate. A stock split can change both share-count basis and contemporaneous price basis; carrying a pre-split price into a split date without authoritative price evidence is financially under-specified and is not generalized from the dividend policy.

## 4. Scope Lock

In scope:

- generic semantic classification of persistent provider action-only rows;
- dividend-only as-of effective valuation using the existing provenance contract;
- symbol/date-agnostic regression coverage;
- production runner binding while preserving the existing `main.MarketDataClient` dependency-injection seam.

Out of scope:

- alternate provider selection;
- OHLC substitution;
- arbitrary forward-fill/back-fill;
- stock-split price reconstruction;
- capital-gain modeling;
- calculator FX semantics;
- Worker/D1/schema changes;
- broad provider abstraction redesign.

## 5. Exact-Head Validation

Final reviewed PR #217 candidate:

`0a0eb00304de7bf48c94f235f93e350eed49f313`

Exact-head CI:

- CI #738 / run `31661392819`: **SUCCESS**;
- Python: **479 passed + 18 subtests**;
- `journal_engine/clients/semantic_market_data.py`: **98% measured coverage**;
- repository branch-coverage policy: **PASS**;
- measured `missing_branches=309`, preserving the existing maximum rather than weakening the gate;
- Frontend contracts/build: **SUCCESS**;
- Worker security/deployment/D1 checks: **SUCCESS**.

Independent reviewer-mode audit on the exact candidate found no BLOCKER after the split-policy correction and scope cleanup. Review submission id: `4922921577`.

## 6. Merge and Post-Main Verification

PR #217 was merged using the repository-supported standard merge method after squash merge was rejected by repository policy.

Protected-main merge commit:

`0f4676f995db890b3a8c5fdb2310f7b47a80f207`

Post-main CI:

- CI #739 / run `31661520242`: **SUCCESS**;
- Python/coverage: **SUCCESS**;
- Frontend contracts/build: **SUCCESS**;
- Worker security/deployment/D1: **SUCCESS**.

No production Worker/D1 deployment was required because this change affects the GitHub-hosted portfolio calculation/market-data path.

## 7. Production Smoke

The user triggered the normal authenticated web update flow after the merge.

Authoritative GitHub run:

- workflow: `Update Portfolio Data`;
- run number: `3254`;
- run id: `31661928574`;
- event: `workflow_dispatch`;
- exact source: `0f4676f995db890b3a8c5fdb2310f7b47a80f207`;
- job: `run-and-upload` / `94328306523`;
- calculation job: `job_gKRZsSdG78pdbbQewxIIwQ`;
- workflow conclusion: **SUCCESS**.

Observed production evidence:

- calculation job running callback: SUCCESS;
- 146 transaction records fetched;
- one opaque user processed;
- 45 requested market symbols entered the market-data path;
- market-data stage completed without `MARKET_DATA_FAILED`;
- transaction-prefix integrity PASS: 146 rows / 2 scopes / 88 symbol scopes;
- canonical Daily PnL reconciliation PASS for 2 groups;
- `all`: formula `94208.45` = components `94208.45`, 20 symbols;
- `Stock`: formula `94208.45` = components `94208.45`, 20 symbols;
- legacy Daily PnL diagnostics: 0;
- split-adjusted ledger parity PASS for 146 BUY/SELL rows;
- portfolio snapshot upload: SUCCESS;
- users: successful 1 / failed 0;
- terminal calculation-job callback: `succeeded` with empty error code.

Large-price-move and non-conventional-XIRR messages remained diagnostics and did not fail any correctness gate.

## 8. Evidence Boundary — Do Not Overclaim

Production #3254 **did not emit the semantic normalizer warning**. Under the provider state observed during this smoke, all relevant symbols — including the previously problematic path — downloaded successfully without requiring the persistent dividend-only normalization branch.

Therefore the evidence statement is intentionally split:

- **production normal path:** verified on the merged source through the complete authenticated web → Worker calculation job → GitHub calculation → reconciliation → snapshot upload → terminal callback chain;
- **persistent dividend-only normalization branch:** verified by exact-head generic regression tests and coverage, but **not claimed live production-exercised** in #3254.

This is the same evidence discipline used elsewhere in the project: lack of a production recurrence is not converted into fabricated branch execution evidence.

## 9. Closeout Decision

The original product blocker is closed at the root-cause level:

```text
provider row
→ semantic classification
→ stable retry evidence
→ action-specific policy
→ safe dividend-only normalization OR fail-closed
```

The final design applies to future matching provider rows based on **row semantics**, not the original ticker/date.

No further market-data expansion is justified now. Keep passive production watch and reopen only if new evidence shows one of the following:

- an eligible persistent dividend-only event still fails after this contract;
- a newly observed provider event type requires an explicitly modeled financial policy;
- current normalization produces incorrect financial results;
- provider behavior violates the assumptions covered by the semantic classifier.

Do not add symbol/date exceptions, alternate-provider fallbacks, guessed prices, or broad market-data redesign without such evidence.
