# Product Integrity Audit & Execution Ledger

This is the single current engineering ledger for the post-D3D product-correctness program.
It records confirmed root causes, phased remediation, compatibility constraints, recovery
points, and verification evidence. Historical governance records remain forensic context;
this file is the current product-engineering navigation point.

## Baseline

- Program audit baseline: `a1466e6733203c4a3ec9aa00b5b90edb52a1e045`
- Baseline tree: `abe39d70b7789cc81cc7c770257b6a91f309b5e6`
- Current completed product-integrity baseline before P2: `cde4c770d0c64b582083764a55d3ffbfc5e603ad`
- Runtime identity remains Worker 4.07 / API 2.60 / D1 schema 2.
- Production activation remains fail-closed; this program does not reopen D3D.

## Engineering principles

1. Preserve valid current behavior unless a value is demonstrably incorrect.
2. Fix the earliest trustworthy root boundary; late checks are defense-in-depth, not substitutes.
3. Do not retry or fallback through ambiguous financial/data failures.
4. Every financial-semantic change needs a regression/golden test before merge.
5. Every batch uses pre-change recovery, scoped PR, CI, second diff review, exact-head merge,
   post-merge verification, and a post-change recovery checkpoint.
6. Do not lower coverage or validation thresholds merely to make a refactor pass.
7. Do not deploy a production Worker merely because repository source changed; production
   activation follows the separate protected deployment/recovery gates.

## Confirmed findings

### PI-001 — Python transaction domain contract drift

Status: **P1 completed**

The Worker write boundary requires `qty > 0`, finite values, and `price >= 0`. The Python
batch runner previously checked only parseability/finite values and therefore trusted a weaker
contract than the persistent source of record. A malformed or legacy row could reach financial
calculation even though it violates the current write contract.

P1 aligned the runner to `qty > 0` and `price >= 0`. Price zero remains temporarily compatible
because current Worker semantics explicitly permit it; tightening to `price > 0` requires a
production-record preflight first.

### PI-002 — Required market price validator existed but was not wired into orchestration

Status: **P1 completed**

`PortfolioValidator.validate_price_data()` rejects missing `Close_Adjusted`, NaN, zero, and
negative prices, but had no orchestration caller. Low-level market accessors intentionally return
`0.0` as a missing-price sentinel. P1 now validates every required transaction symbol and per-user
benchmark after download and before transaction-calendar/calculation work. Missing, empty, NaN,
zero, or negative required price data fails the batch before snapshot generation/upload.

### PI-003 — Pending dividend withholding policy was duplicated and wrong for Taiwan

Status: **P2 in progress**

Both calculator pending-dividend logic and canonical Daily P&L reconciliation hardcoded a `0.7`
net multiplier. The frontend explicitly defaults Taiwan dividend tax to zero and confirmation
writes the actual net amount as a DIV record. Therefore a Taiwan dividend could be valued at 70%
while pending and 100% after confirmation solely because the user confirmed it.

P2 root fix:
- one shared dividend-withholding policy;
- Taiwan 0%, US/default current model 30%;
- calculator and canonical reconciler consume the same policy;
- serialized pending dividend carries explicit `tax_rate` matching the policy;
- regression tests lock Taiwan/US behavior and pending-to-confirmed economic-value invariance.

P2 safety points:
- pre-change recovery: `backup-pre-product-integrity-p2-cde4c77`
- work branch: `pr-product-integrity-p2-dividend-policy`
- no Worker runtime, D1/schema/data, production deployment, or multi-currency expansion is in P2.

### PI-004 — Non-USD/TWD currency valuation is dimensionally unsafe

Status: **confirmed; P3 queued**

Currency detection recognizes several non-USD currencies but returns FX multiplier `1.0` for
them. Korean `.KS/.KQ` symbols are not recognized and fall through to USD, causing KRW prices
to be multiplied by USD/TWD. This can produce materially wrong portfolio values while remaining
finite.

P3 action is split in two: first make unsupported valuation currencies explicit and fail closed;
then add a real currency-aware historical/realtime FX pipeline before claiming support. No
warning-plus-1.0 fallback will remain as a supported valuation path.

### PI-005 — XIRR failure and precision semantics are ambiguous

Status: **confirmed design debt; P4 queued**

XIRR currently uses rounded serialized final holdings and converts any solver exception into
`0.0`. That conflates a true 0% return with an undefined/uncomputable result and loses precision.

P4 action: use raw final market value, establish explicit undefined-XIRR semantics, record a
machine-readable diagnostic rather than `except: pass`, and lock behavior with cash-flow/golden
regressions before changing the serialized/UI contract.

### PI-006 — Frontend `fetchAll()` swallows failure from callers

Status: **confirmed; P5 queued**

The portfolio store catches `fetchAll()` failures, sets connection status to error, and does not
rethrow. Callers that wrap `await store.fetchAll()` in `try/catch` can therefore show a success
message after a failed refresh. This is a control-flow contract mismatch, not a networking issue.

P5 action: trace all callers and replace the ambiguous void contract with an explicit failure
contract (rethrow or structured result), then align success/error UI and stale-snapshot state.

### PI-007 — Dead calculation paths are coupled to absolute coverage floors

Status: **confirmed; P7 queued**

Dormant calculation modules/imports cannot be safely deleted because CI locks absolute covered
line/branch counts. Lowering the floor would hide a regression.

P7 action: redesign coverage governance around meaningful current-source coverage/change
protection, then remove confirmed dead modules/imports and unused dependencies atomically.

## Areas reviewed and currently lower priority

- Cloudflare API client: explicit timeouts, explicit `success=true`, strict pagination and upload
  confirmation are present.
- Transaction calendar: missing/empty symbol data, future transaction dates, and unavailable
  prior valuation dates fail closed; synthetic dates clear corporate-action cash fields.
- Canonical Daily P&L reconciliation: per-symbol ledger, formula reconciliation, finite checks,
  and root/group synchronization are strong; P2 removes the known duplicated dividend policy.
- Frontend request layer: timeout/abort classification, malformed-response handling, and mutation
  outcome ambiguity are already explicit; generic retries are not recommended.
- Cross-tab market-refresh leadership: lease identity, settle confirmation, lifecycle epochs, and
  pause fail-safe design appear robust from static review; concurrency tests remain part of P6.
- Browser calendar-date formatting uses the resolved local IANA timezone rather than UTC slicing.

## Phased execution plan

### P1 — Source-record and required market-data integrity gates

Status: **completed**

Scope delivered:
- aligned Python transaction domain checks with current Worker write semantics;
- activated required ticker/benchmark price-series validation before calculation;
- added regression tests for invalid quantities/prices and missing/zero/negative/NaN market data.

Verification:
- PR #133
- reviewed head: `02bfa592e0150e03ddf9d078a615b4d723797fc8`
- PR CI #322 / run `31178543829`: SUCCESS
- merge/main SHA: `cde4c770d0c64b582083764a55d3ffbfc5e603ad`
- post-merge CI #323 / run `31178674939`: SUCCESS
- post-merge Pages #1422 / run `31178670006`: SUCCESS
- pre-change recovery: `backup-pre-product-integrity-p1-a1466e6`
- post-change recovery: `backup-post-product-integrity-p1-cde4c77`

No financial formula, Worker runtime, D1/schema/data, frontend behavior, or production activation
change was made in P1.

### P2 — Dividend semantic unification

Status: **in progress**
Risk class: high financial correctness / controlled user-visible correction.

Scope:
- shared withholding policy;
- Taiwan 0%, US 30% under current policy;
- calculator/reconciler/model-output consistency;
- pending/confirmed invariance tests;
- preserve current API/schema shape.

### P3 — Currency safety, then real multi-currency FX

Risk class: critical dimensional correctness.

P3A safety:
- detect KRW and other known currencies explicitly;
- fail closed for currencies without a real TWD conversion path;
- correct capability documentation.

P3B capability:
- per-currency historical FX series;
- per-currency as-of and realtime valuation FX;
- mixed-currency transaction/cash-flow tests;
- only then re-enable documented KRW/HKD/etc support.

### P4 — Performance metric semantics

Scope:
- raw-value XIRR terminal cash flow;
- explicit undefined-XIRR state/diagnostics;
- audit Modified Dietz zero-denominator/negative-base behavior;
- golden comparisons before any formula semantic change.

### P5 — Frontend state and mutation UX correctness

Scope:
- `fetchAll()` error propagation contract;
- stale snapshot/read failure distinction;
- TradeForm domain feedback aligned to backend;
- DividendManager amount/tax constraints and currency semantics;
- caller-level regression tests.

### P6 — Performance, load and race audit

Scope:
- profile dataframe filtering and repeated as-of lookups;
- pre-index transaction/date/symbol paths only after golden equivalence tests;
- cache safe immutable/as-of lookups;
- slow-response, tab-leadership and polling race tests;
- no performance rewrite that changes financial outputs.

### P7 — Coverage architecture and dead-code removal

Scope:
- replace fossilized absolute coverage coupling with current-source/change protection;
- remove confirmed dormant DailyPnLEngine/TransactionAnalyzer paths only after dependency proof;
- remove unused npm dependencies with lockfile regeneration;
- orphan tool review.

### P8 — Contract/model consolidation

Scope:
- central transaction domain model/invariants;
- explicit model defaults/default factories;
- currency/dividend/benchmark provenance;
- Worker/Python/frontend contract-drift tests.
