# Three-Round Independent Audit Archive

## Status

This document preserves the conclusions of the three independent reviews completed on 2026-08-05 and 2026-08-06. It is an audit archive, not a claim that the findings have already been remediated.

- Repository: `chihung1024/sheet-trading-journal`
- Exact reviewed baseline: `35e629ade1c3155ad5e44b839135d4406f9a4170`
- Worker release: `4.07`
- API version: `2.60`
- D1 schema version: `2`
- Machine-readable register: `docs/governance/risk-register.json`

The reviews were static and architecture-oriented. They did not mutate production data, inspect private Cloudflare or Google console settings, or perform a live destructive penetration test.

## Review history

### Round 1 — calculation and correctness review

The first review concentrated on the financial calculation engine and identified a mismatch between engineering controls and the economic model represented by the ledger. It retained the following findings:

- The application is a useful personal securities-position research tool, but it is not a complete brokerage-account ledger.
- Cash, deposits, withdrawals, settlement, liabilities, receivables, and account identity are absent (`RISK-004`).
- The displayed TWR and XIRR are security-project measures rather than complete account measures (`RISK-005`).
- Group tags can duplicate complete transactions across strategies (`RISK-006`).
- Dividend estimation and confirmation do not form a structured entitlement, receivable, withholding, and payment ledger (`RISK-012`).
- yfinance, FX fallbacks, price fallbacks, split fallbacks, and unsupported currencies can produce internally consistent but economically false outputs (`RISK-013`, `RISK-014`, `RISK-015`, `RISK-016`).
- Market calendars and benchmark calendars are not authoritative or unified (`RISK-017`, `RISK-018`).
- Canonical Daily P&L reconciliation is valuable but shares the main engine's assumptions and therefore does not independently prove external truth (`RISK-019`).
- Financial values rely on binary floating-point and SQLite REAL (`RISK-027`).

The first review recommended preserving the existing fail-closed reconciliation, split-ledger parity, pagination protection, tenant scope, and exact-SHA deployment controls while redesigning the accounting model.

### Round 2 — full repository, security, operations, and product review

The second review widened the scope to frontend, Worker, D1, GitHub Actions, deployment, privacy, documentation, supply chain, and disaster recovery. It retained all Round 1 findings and added:

- Public workflow execution can expose authenticated email and tenant identity (`RISK-001`).
- Application-level admission control, quotas, and tenant status are absent (`RISK-002`).
- Preview deployments can reach production infrastructure (`RISK-003`).
- GroupManager can report false success and apply non-atomic sequential edits (`RISK-007`).
- The frontend silently truncates records after the first API page (`RISK-008`).
- Full records are written to localStorage without a valid offline use case (`RISK-009`).
- Record mutations have no idempotency or optimistic concurrency (`RISK-010`).
- Snapshots are not bound to an input revision or methodology identity (`RISK-011`).
- GitHub Actions is not a suitable production data plane for interactive three-minute refresh (`RISK-021`).
- UI date, currency, formulas, labels, state, and precision can misrepresent backend data (`RISK-022`, `RISK-023`).
- PWA claims and implementation are disconnected and a legacy worker may remain installed (`RISK-024`).
- Google token and identity data are kept in localStorage and GIS initialization is duplicated (`RISK-025`).
- Email is the persistent tenant key (`RISK-026`).
- Snapshot JSON can grow beyond the request and storage model (`RISK-028`).
- Documentation, version naming, historical deployment guidance, licensing, privacy, and security governance are incomplete or stale (`RISK-029`, `RISK-030`).
- CI and supply-chain controls do not cover frontend behavior, accessibility, dependency provenance, or immutable action pins (`RISK-031`).
- Production release evidence is scattered (`RISK-032`).
- User export, deletion, retention, backup, restore drill, and immutable audit export are absent (`RISK-033`).

The second review recommended the product be described as a private securities-position and transaction-cash-flow analysis tool until the account and cash ledger is completed.

### Round 3 — concurrency, compatibility, migration, and overlooked-corner review

The third review retained all prior findings and focused on assumptions that existing reconciliation or tests could jointly miss, plus the practical requirement that each remediation batch must not interrupt normal use. It added:

- Same-day transaction execution order is not stored, causing the calculator to fall back to BUY → DIV → SELL ordering (`RISK-034`).
- The all-user runner performs shared market preparation before tenant isolation, allowing one tenant to block unrelated tenants (`RISK-035`).
- Signed pagination is not a consistent snapshot because cursors are not bound to a ledger revision (`RISK-036`).
- Snapshot insertion and retention cleanup are not atomic (`RISK-037`).
- Job dispatch timeout, callback loss, reruns, and unexpected failures can create orphan or false job states (`RISK-038`).
- Multiple tabs and devices independently trigger refresh, while the pause control does not stop the timer (`RISK-039`).
- Token refresh lifecycle ordering and duplicated JWT decoding can leave refresh disabled (`RISK-040`).
- Benchmark settings can change before the displayed snapshot identifies the corresponding benchmark (`RISK-041`).
- API validation accepts records that are structurally valid but economically unsupported or calculation-blocking (`RISK-042`).
- One system secret spans records read, snapshot write, job callback, and cursor signing (`RISK-043`).
- Unsupported asset classes can pass symbol syntax and be treated as ordinary USD equities (`RISK-044`).
- Fee rebates, tax refunds, and cash corrections cannot be represented (`RISK-045`).
- Snapshot time has minute precision and no timezone or monotonic identity (`RISK-046`).
- Partial success in an all-user workflow lacks an explicit batch model (`RISK-047`).
- General browser API calls have no bounded timeout, cancellation, or stale-response control (`RISK-048`).
- Health checks do not verify operational readiness or data quality (`RISK-049`).
- CSP is permissive relative to the sensitivity of localStorage credentials and financial data (`RISK-050`).

## Controls that should be preserved

The audit does not recommend discarding the entire system. The following controls are valuable and should be preserved or extended:

1. User and system principals are distinct.
2. User records and settings are tenant-scoped.
3. Cursor pagination is HMAC-signed and scope-bound.
4. The Python client follows all pages and fails closed on malformed pagination.
5. Daily P&L has a canonical component reconciler.
6. Split-adjusted ledger parity and transaction-calendar gates exist.
7. Calculation jobs have an opaque public identity and guarded state transitions.
8. Worker deployment is exact-SHA and schema-aware.
9. D1 migrations are additive.
10. Version and health endpoints expose non-secret build identity.
11. CI covers Python, Worker security, D1 migration, deployment configuration, and frontend build.

## Current product positioning

Until the later accounting phases are complete, the supported positioning is:

> A private securities-position and transaction-cash-flow analysis tool. It is not a complete brokerage account, accounting, tax, or statutory performance system.

## Non-negotiable remediation principles

Every later batch must follow `docs/ZERO_DOWNTIME_CHANGE_POLICY.md` and satisfy all five compatibility dimensions:

1. Old frontend against new Worker.
2. Old Worker against expanded schema.
3. Jobs queued before deployment.
4. Old snapshots rendered by the new frontend.
5. Existing clients controlled by a legacy service worker.

No finding may be closed solely because an internal formula agrees with another implementation that uses the same inputs and assumptions. External broker and market truth must be included where applicable.

## Traceability

The authoritative risk identifiers are `RISK-001` through `RISK-050` in `docs/governance/risk-register.json`. The phased execution order and PR decomposition are in `docs/MASTER_REMEDIATION_PLAN.md`. PR-10A scope and evidence requirements are in `docs/PR10A_ACCEPTANCE.md`.
