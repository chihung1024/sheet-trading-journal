# Update Portfolio Data #3317 — Systemic RCA and Production Closeout

Date: 2026-08-18

Status: **CLOSED / PRODUCTION VERIFIED**

## Scope

This document records the system-level root causes exposed by Update Portfolio Data #3317 and its verification sequence. Individual symbols, users, and dates were diagnostic specimens only. No final production behavior is keyed to a ticker, date, security type, user, or known failure specimen.

## Original symptom

Production portfolio updates failed closed when Yahoo/yfinance daily market-data frames contained selected-price NaN values, structurally impossible OHLC rows, sparse intraday buckets, or mixed malformed rows carrying different semantic meanings. Later verification also exposed an extreme-but-finite XIRR value that calculation code treated as usable even though the upload validator rejected it. A legacy production synthetic browser/idempotency test record then exposed a separate lifecycle gap because it remained in the same global portfolio-update input set.

## Failure points

The incident was a chain of independent but interacting defects:

1. latest yfinance daily rows could be internally malformed, not merely missing one field;
2. a second daily request or `repair=True` did not provide a trustworthy independent authority;
3. yfinance historical-response caching meant identical retries could replay cached evidence rather than create a fresh observation;
4. early intraday recovery depended on a fixed representation order/pair and therefore coupled correctness to which interval failed first;
5. whole-frame recovery eligibility let a safe dividend-only row and a separate safe zero-action price row suppress one another;
6. XIRR calculation accepted any finite solver output while the upload validator separately enforced a supported range;
7. production synthetic-test-data cleanup depended on an authenticated Google-user smoke path whose OAuth credentials were not configured, even though the synthetic record itself was already machine-identifiable.

## Contributing factors

- upstream daily rows may carry impossible Open/High/Low relationships while Volume/actions remain populated;
- sparse instruments may include `keepna` intraday buckets with all price fields empty and zero Volume;
- all-empty price buckets with non-zero Volume are contradictory and must remain invalid;
- `repair=True` can require optional SciPy and still does not guarantee a structurally trustworthy daily row;
- yfinance historical-response caching makes identical retries insufficient evidence of freshness;
- different valid intraday granularities can transiently disagree;
- approximate numeric equality is not transitive, so quorum logic must reject ambiguous overlapping candidate groups;
- a symbol can legitimately contain multiple malformed row classes that require different established authorities;
- an exact-owned production test record can be harmless as test evidence but harmful if its lifecycle is not closed before normal portfolio aggregation.

## Root cause

Recovery and test-data lifecycle were modeled too much around attempts, whole frames, fixed representation order, and one specific smoke execution path instead of explicit semantic authorities and durable ownership contracts.

## Systemic cause

Freshness transport, price-evidence validation, corporate-action valuation, performance-metric safety, and production synthetic-data ownership were insufficiently separated. Independent authorities could therefore block one another, become safe only at a later validation layer, or rely on credentials unrelated to the cleanup operation itself.

---

## Final architecture

### 1. Freshness transport is separate from price truth

`YahooIntradayEvidenceSession` owns only the freshness boundary. It safely invalidates the pinned yfinance historical-response cache and fetches requested granularities lazily. If that freshness contract cannot be established, recovery fails closed.

The transport does not decide whether a price is financially valid and never mutates accounting/corporate-action truth.

### 2. Raw intraday price-evidence authority

A zero-action malformed daily price row may use same-provider, exact-date, regular-session raw intraday data only.

Every representation passes the same complete OHLC/Adj Close structural contract. Fully empty price buckets are ignored only when they carry no contradictory non-zero Volume. Partial bars, non-finite/non-positive prices, impossible OHLC structure, date/index ambiguity, and adjusted-close inconsistencies are invalid evidence.

Daily malformed Open/High/Low values are not recovery anchors. Daily Volume and corporate actions remain daily authorities and are never reconstructed from intraday price bars.

### 3. Generic multi-granularity quorum

Semantic recovery uses an ordered evidence set plus a quorum, not a primary/tie-break ticker-specific rule.

- each valid representation is one complete price candidate;
- an invalid/unavailable representation does not decide the whole recovery;
- a candidate is accepted only when a **unique** quorum agrees under the unchanged strict tolerance;
- fetching stops when quorum is proven or mathematically impossible;
- incompatible qualified candidate groups fail closed;
- no temporal retry, tolerance widening, alternate provider, ticker/date exception, or guessed price is permitted.

This rule is symbol/date agnostic and applies to every supported instrument under the same contract.

### 4. Row-level authority composition

Malformed rows are classified independently.

- zero-action malformed price rows use the intraday price quorum;
- proven pure positive dividend-only rows retain the established stable two-observation `asof_carry_forward` valuation authority;
- unsupported split/capital-gain/action rows remain unresolved;
- one recoverable row class cannot suppress another recoverable row class in the same frame;
- residual unresolved rows remain visible to the canonical validator and therefore fail closed.

### 5. Shared performance-metric safety domain

XIRR calculation and upload validation share the same supported safety boundary. A solver result outside that boundary is represented as `undefined` with a machine-readable reason and the existing sentinel value. It is never clipped, fabricated, or allowed to travel downstream as `ok` until the upload validator rejects it.

### 6. Shared production synthetic-record ownership

The legacy browser test record and current API-smoke records now use one shared exact ownership contract. The authenticated API smoke consumes the same contract as the operational reconciliation path, so two different cleanup definitions cannot drift independently.

`DELETE /api/records` remains **user-only**. No system delete backdoor was added.

### 7. Reviewer-protected atomic D1 reconciliation

Synthetic-data lifecycle recovery no longer requires Google OAuth credentials. The canonical production reconciliation control plane:

1. requires the exact current protected-main SHA;
2. requires zero nonterminal Update Portfolio Data runs before the reviewer gate;
3. enters the existing `production` Environment required-reviewer gate;
4. verifies the exact production D1 identity;
5. requires three consecutive zero-active portfolio-update observations immediately before mutation;
6. discovers only candidate synthetic tags;
7. validates every candidate against the exact shared ownership payload;
8. reads every record belonging to each candidate owner and rejects the entire operation if any tenant contains non-owned/real data;
9. freezes the record/owner/payload snapshot, rejecting duplicate legacy markers, invalid owners, forged rows, or drift;
10. executes one atomic DELETE guarded by exact record/owner/payload predicates plus whole-target-tenant and exact-match cardinality subqueries;
11. requires exact expected `changes()` and zero tenant rows after mutation;
12. persists only sanitized aggregate evidence — never tenant identities or record IDs.

Any last-moment insert/update/delete changes the cardinality guard and the operation fails closed rather than partially deleting the tenant.

---

## Regression invariants

The test suite now proves, among other cases:

1. early consistent intraday representations can establish quorum without unnecessary requests;
2. an earlier invalid/unavailable representation can be outvoted by later consistent evidence;
3. one disagreeing valid representation can be outvoted only by a unique quorum;
4. three distinct valid representations remain fail closed;
5. a single surviving valid representation is insufficient;
6. non-transitive tolerance overlap cannot create ambiguous quorum acceptance;
7. quorum processing stops when success or mathematical impossibility is known;
8. mixed dividend-only and zero-action malformed rows compose independently under their own authorities;
9. unstable dividend evidence and unsupported corporate actions remain fail closed;
10. no-stage recovery returns the original frame unchanged;
11. XIRR outside the shared supported domain becomes explicit undefined output;
12. production synthetic ownership accepts only exact payloads;
13. a candidate tenant containing normal records fails before mutation;
14. duplicate legacy markers, invalid owner identity, forged smoke-looking payloads, and pre-mutation snapshot drift fail closed;
15. atomic D1 mutation must change the entire expected set or none; partial cleanup is rejected;
16. reconciliation evidence excludes tenant identities and record IDs;
17. branch-coverage and workflow supply-chain governance remain enforced without lowering their gates.

## Explicit non-solutions

The remediation does not use:

- ticker/date/security-specific patches;
- higher price tolerances to force agreement;
- economic-field similarity or guessed market values;
- an alternate market-data provider hidden behind the existing authority;
- automatic unbounded retries;
- corporate-action reconstruction from intraday prices;
- validator weakening;
- XIRR clipping;
- account/user exceptions;
- expansion of `DELETE /api/records` to system principals;
- disabling the production Environment reviewer gate;
- broad D1 deletion by tag without whole-tenant purity/cardinality verification.

---

## Merge history

The root-cause chain was intentionally evolved as evidence disproved earlier narrower approaches:

- PR #369 → `7642ace742eef34e1ab408c56384c3226f0a984e` — repaired-provider fallback experiment;
- PR #370 → `533b076e4beba34b72549f5bb39b9588bb14724f` — raw intraday reconstruction;
- PR #371 → `e89cf39463c69e83ffa1237554ac7d94aafaa44d` — cross-granularity evidence + sparse-bucket semantics;
- PR #372 → `e73aee8840b950d22bce0a58cbed316459cb53bc` — explicit freshness transport after yfinance cache discovery;
- PR #373 → `f7bd7b7dc2e0ae28673fca11bae88f72d138c2f0` — shared XIRR safety-domain normalization;
- PR #376 → `0537d73e0674f09a9b3f671f15caa089a75273c7` — generic multi-granularity quorum + row-level authority composition;
- PR #382 → `ae418ca2eb2efa73190395e9a7951c4badbeba20` — protected production synthetic-record ownership/reconciliation.

The sequence is retained because each production run supplied new evidence that invalidated a narrower assumption. The final code is general; historical intermediate designs are not the active authority.

---

## Final verification evidence

### Exact-head CI

PR #382 frozen exact head:

`bfe30022cda9b4bb7d14706f77e50aa8314359a2`

CI #1371: **SUCCESS** across:

- Frontend security contracts/build;
- Python tests + measured coverage governance;
- Worker security/deployment tests + D1 baseline;
- production reconciliation ownership, tenant-purity, snapshot-drift, atomicity, and evidence-sanitization tests.

Frozen review: **BLOCKER 0**.

### Production synthetic-record reconciliation

Workflow: `Production Test Record Reconciliation` run #1

Run ID: `32156834629`

Source: `main@ae418ca2eb2efa73190395e9a7951c4badbeba20`

Result: **SUCCESS**

Sanitized evidence:

```text
target_rows_before=1
test_tenants_before=1
legacy_browser_rows_before=1
api_smoke_rows_before=0
mutation_changes=1
target_rows_after=0
test_tenant_records_remaining=0
worker_authorization_changed=false
```

The operation passed exact-main, production D1 identity, and repeated zero-active-update gates before mutation.

### Post-cleanup production portfolio update

Workflow: `Update Portfolio Data #3332`

Run ID: `32157227218`

Source: `main@ae418ca2eb2efa73190395e9a7951c4badbeba20`

Result: **SUCCESS**

Observed production execution:

- 264 transaction records fetched;
- 2 real users processed;
- 58 market symbols downloaded successfully;
- transaction prefix integrity checks passed;
- canonical Daily P&L reconciliation completed;
- split-adjusted ledger parity completed;
- both portfolio snapshots uploaded successfully;
- final result: **success 2 / failure 0**.

The previously synthetic third tenant is absent after reconciliation, which independently agrees with the zero-residual D1 evidence.

---

## Closeout decision

Update Portfolio Data #3317 is **CLOSED**.

The closure criterion was not merely a green unit test or one repaired symbol. It required:

1. general recovery architecture with no specimen-specific behavior;
2. full exact-head CI under unchanged governance gates;
3. protected production synthetic-data lifecycle convergence;
4. a fresh merged-main production portfolio run with successful real-user calculations and snapshot publication.

All four are satisfied. No manual action remains for #3317. Future isolated Yahoo noise should be evaluated against these generic invariants rather than reopening symbol-specific debugging by default.
