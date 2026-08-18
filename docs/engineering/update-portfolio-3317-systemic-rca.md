# Update Portfolio Data #3317 — Systemic RCA and Recovery Architecture

Date: 2026-08-18

## Scope

This document records the system-level root cause exposed by Update Portfolio Data #3317 and subsequent production verification runs. Individual symbols are diagnostic samples only. No production behavior is keyed to a symbol, date, security type, or known failure specimen.

## Symptom

Production portfolio updates failed closed when Yahoo/yfinance daily market-data frames contained selected-price NaN values, structurally impossible OHLC rows, sparse intraday buckets, or mixed malformed rows carrying different semantic meanings. Later verification also exposed an extreme-but-finite XIRR value that calculation code treated as usable even though the upload validator rejected it.

## Failure Point

The failures were not one defect:

1. repeated historical yfinance requests could replay its response cache instead of creating a fresh observation;
2. daily repair/re-fetch logic could not reconstruct every malformed daily row while preserving strict price structure;
3. intraday recovery initially treated one interval failure or a fixed interval disagreement sequence as the recovery decision;
4. recovery eligibility was evaluated at whole-frame level, so a safe dividend-only row and a separate safe zero-action price row could suppress one another;
5. XIRR calculation accepted any finite solver output while the upload validator enforced a supported range.

## Contributing Factors

- upstream daily rows may be internally inconsistent rather than merely missing Close;
- sparse instruments may include keepna intraday buckets with all price fields empty and zero Volume;
- all-empty price buckets with non-zero Volume are contradictory and must remain invalid;
- yfinance historical-response caching makes identical retries insufficient evidence of freshness;
- different valid intraday granularities can transiently disagree;
- approximate numeric equality is not transitive, so quorum logic must reject ambiguous overlapping candidate groups;
- a symbol can legitimately contain multiple malformed row classes that require different established authorities.

## Root Cause

Recovery was modeled too much around attempts, whole frames, and a fixed representation order instead of explicit semantic evidence authorities. This made correctness depend on retry timing or on which invalid row/interval was encountered first.

## Systemic Cause

Freshness transport, price-evidence validation, corporate-action valuation, and performance-metric safety were insufficiently separated. Independent authorities could therefore block one another or only become safe at a later validation layer.

## Architecture after remediation

### 1. Freshness transport

`YahooIntradayEvidenceSession` owns only the freshness boundary. It clears the pinned yfinance historical-response cache under a class-level lock and fetches requested granularities lazily. If the cache contract cannot be cleared safely, recovery fails closed.

The transport does not decide whether a market price is financially valid and does not mutate daily/accounting data.

### 2. Price evidence authority

A zero-action malformed daily price row may use same-provider, exact-date, regular-session raw intraday data only.

Every representation is normalized by the same full OHLC/Adj Close structural contract. Completely empty price buckets are ignored only when they carry no contradictory non-zero Volume. Partial bars, non-finite/non-positive prices, impossible OHLC structure, date/index ambiguity, and adjusted-close inconsistencies are invalid evidence.

### 3. General multi-granularity quorum

Semantic recovery uses an ordered set of intraday granularities and a configured quorum. It is not a fixed primary/tie-break rule.

- each valid representation is one candidate;
- an invalid or unavailable representation does not by itself decide the whole recovery;
- a candidate is accepted only when a unique quorum of complete price candidates agrees;
- fetching stops when quorum is proven or mathematically impossible;
- multiple incompatible qualified candidate groups fail closed;
- no temporal retry, tolerance widening, alternate provider, symbol/date exception, or guessed price is permitted.

This makes the rule applicable to any supported symbol and any affected date under the same data contract.

### 4. Row-level authority composition

Malformed rows are classified independently.

- zero-action price rows use the intraday price quorum;
- proven pure positive dividend-only rows retain the existing stable two-observation `asof_carry_forward` valuation authority;
- unsupported split/capital-gain/action rows remain unresolved;
- intraday evidence never invents Volume or corporate actions;
- one recoverable row class cannot suppress a different recoverable row class in the same symbol frame;
- residual unresolved rows remain visible to the final validator and therefore fail closed.

### 5. Performance metric safety

XIRR calculation and upload validation share the supported safety domain. A solver result outside that domain is represented as `undefined` with a machine-readable reason and the existing sentinel value; it is not clamped, fabricated, or allowed to fail later at upload validation.

## Regression invariants

The test suite now proves, among other cases:

1. first two consistent intraday representations can establish quorum without unnecessary requests;
2. an earlier invalid or unavailable representation can be outvoted by later consistent evidence;
3. one disagreeing valid representation can be outvoted only by a unique quorum;
4. three distinct valid representations remain fail closed;
5. a single surviving valid representation remains insufficient;
6. non-transitive tolerance overlap cannot create ambiguous quorum acceptance;
7. quorum processing stops when success or mathematical impossibility is known;
8. mixed dividend-only and zero-action price-gap rows compose independently under their own authorities;
9. unstable dividend evidence and unsupported corporate actions remain fail closed;
10. no-stage recovery returns the original frame unchanged;
11. branch-coverage governance remains enforced without lowering its gates.

## Explicit non-solutions

The remediation does not use:

- ticker/date/security-specific patches;
- higher price tolerances to force agreement;
- economic-field similarity or guessed values;
- an alternate market-data provider hidden behind the existing authority;
- automatic unbounded retries;
- corporate-action reconstruction from intraday prices;
- validator weakening;
- XIRR clipping;
- accounting, FX, transaction-identity, Worker, or D1 behavior changes to mask market-data failures.

## Verification state

Before this document commit, PR #376 exact-head CI #1349 completed successfully across:

- Frontend contracts and build;
- 658 Python tests plus branch-coverage governance;
- Worker security/deployment tests and D1 baseline.

PR #376 remains unmerged until the final exact-head CI and frozen review are complete. Closure of #3317 additionally requires a successful Update Portfolio Data run from the merged `main`; CI alone is not production evidence.
