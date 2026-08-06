# Master Remediation Plan

## Purpose

This plan converts the retained three-round audit into a sequence of independently reviewable changes. It is intentionally designed so that every completed batch leaves the current application usable and provides an immediate rollback path.

Baseline:

- Repository: `chihung1024/sheet-trading-journal`
- Main SHA: `35e629ade1c3155ad5e44b839135d4406f9a4170`
- Worker release/API/schema: `4.07` / `2.60` / `2`
- Risk register: `docs/governance/risk-register.json`
- Change policy: `docs/ZERO_DOWNTIME_CHANGE_POLICY.md`

## Program rules

1. No runtime remediation begins before B00 and B01 are accepted.
2. Every schema change is additive first.
3. Every semantic replacement is introduced as dual-write or shadow output first.
4. Existing frontend, Worker, queued jobs, snapshots, and service-worker clients remain compatible during migration.
5. No legacy contract is removed until at least two compatible releases have been observed in production.
6. A failed new path must leave the last verified production snapshot readable.
7. Exact-SHA evidence and a rollback reference are required for every production-affecting batch.
8. No tolerance may be widened merely to make a reconciliation test pass.

## Batch map

### B00 — Audit baseline and recovery evidence

Goal: preserve findings and create the governance control plane without changing production behavior.

Deliverables:

- Three-round audit archive.
- Machine-readable risk register.
- Zero-downtime change policy.
- Master remediation plan.
- Deterministic governance tests.
- Exact baseline and pre-change backup reference.

Risks primarily governed: RISK-029, RISK-030 and all other risks through traceability.

Runtime effect: none.

Rollback: revert-only.

### B01 — Test, observability, and supply-chain baseline

Goal: make later changes observable and independently verifiable before changing financial behavior.

Deliverables:

- Frontend unit and component tests.
- Browser E2E tests.
- Accessibility tests.
- Python coverage and property tests.
- Worker integration and concurrency tests.
- PII scanning for logs and artifacts.
- Dependency review, npm audit, pip audit, CodeQL, SBOM, and provenance.
- GitHub Actions pinned by full commit SHA.
- Broker-statement and independent-market golden fixtures.
- Protected liveness, readiness, dependency, and data-quality checks.
- One release evidence manifest per release.

Risks: RISK-019, RISK-031, RISK-032, RISK-049.

Runtime effect: no financial or API contract change; protected observability may be feature-flagged.

Rollback: revert-only or feature flag.

### B02 — Safe frontend correctness fixes

Goal: remove clear browser defects without changing financial methodology or schema.

Deliverables:

- Fetch every records page with bounded count and cycle protection.
- Remove transaction caching from localStorage.
- Fix GroupManager HTTP status handling and false success.
- Correct local date generation, sell totals, currency labels, stale state, event emission, and display precision.
- Add API timeouts, cancellation, stale-response protection, and mutation-aware retries.
- Implement cross-tab leader election and page-visibility handling.
- Make pause stop the refresh timer.
- Consolidate token decoding and ensure refresh watches session state.
- Display published benchmark separately from pending benchmark.

Risks: RISK-007, RISK-008, RISK-009, RISK-022, RISK-023, RISK-039, RISK-040, RISK-041, RISK-048.

Runtime effect: frontend-only; Worker contract remains compatible.

Rollback: prior Pages deployment.

### B03 — Preview, staging, and production isolation

Goal: prevent previews from reaching production data while retaining usable PR previews.

Order:

1. Create staging Worker, D1, secrets, OAuth client, and Pages environment.
2. Point preview builds to staging.
3. Verify preview login and CRUD in staging.
4. Restrict production CORS and OAuth origins to exact production origins.
5. Add build-time checks preventing cross-environment URLs.

Risk: RISK-003.

Runtime effect: production remains on existing endpoints; preview moves first.

Rollback: restore exact production origin allowlist and previous Pages environment values.

### B04 — Remove personal identifiers from GitHub compute inputs

Goal: keep the current computation plane functional while replacing email workflow inputs with opaque job identity.

Deliverables:

- System endpoint resolving a job to server-side tenant scope.
- Workflow accepts only opaque calculation job ID.
- Runner fetches tenant-scoped input through a short-lived service authorization.
- Public log and artifact PII scanners.
- Transitional support for already queued legacy jobs.

Risk: RISK-001.

Runtime effect: dual contract; old queued work remains supported.

Rollback: legacy job input path remains available behind a temporary flag.

### B05 — Tenant identity, admission control, service scope, and session transition

Goal: reduce credential blast radius and decouple tenant identity from email.

Deliverables:

- Internal tenant UUID keyed by Google subject.
- Mutable profile email.
- Tenant status, allowlist, and quotas.
- Separate service credentials for records read, snapshot write, job callback, and cursor signing.
- Audience, scope, expiry, key ID, replay prevention, and dual-key rotation.
- Cached Google JWKS.
- Revocable HttpOnly SameSite session alongside legacy bearer token support.
- Single Google Identity Services integration.

Risks: RISK-002, RISK-025, RISK-026, RISK-043.

Runtime effect: dual identity and dual authentication.

Rollback: legacy email and bearer lookups remain valid until contract phase.

### B06 — Ledger revision, mutation idempotency, and immutable audit

Goal: guarantee a consistent ledger input and prevent duplicate or lost mutations.

Deliverables:

- Tenant ledger state with monotonic revision.
- Record revision and updated_at.
- Client mutation ID and mutation receipt.
- Optimistic concurrency using expected revision.
- Cursor bound to ledger revision.
- Mid-pagination mutation returns a deterministic restart response.
- Immutable audit event for create, update, delete, and conflict.
- Soft-delete or revision history before destructive removal.

Risks: RISK-010, RISK-036.

Runtime effect: additive schema and dual-write metadata; old clients continue to work during compatibility window.

Rollback: disable new read path and continue legacy records table reads.

### B07 — Snapshot V2 and complete job lifecycle

Goal: make publication revision-safe and every job terminally explainable.

Deliverables:

- Snapshot ID, job ID, input revision/hash, methodology version, market-data version, benchmark identity, checksum, UTC timestamps, quality status, and publication pointer.
- Staged snapshot write and validation.
- Compare-and-swap latest pointer.
- Asynchronous idempotent retention cleanup.
- Job states for dispatching, queued, running, retrying, succeeded, failed, expired, cancelled, and superseded.
- Dispatch identity, heartbeat, lease, sweeper, callback nonce, rerun metadata, and result snapshot linkage.
- Bounded snapshot storage model.

Risks: RISK-011, RISK-020, RISK-028, RISK-037, RISK-038, RISK-046.

Runtime effect: V1 and V2 snapshots coexist; V1 remains the production read until V2 acceptance.

Rollback: atomic latest pointer returns to last verified V1 or V2 snapshot.

### B08 — Market Data V2 shadow path

Goal: establish immutable, attributable, fail-closed market truth before changing production values.

Deliverables:

- Separate immutable EOD bars and live quotes.
- FX series with provider and as-of metadata.
- Source, received_at, provider timestamp, staleness, and quality status.
- Exchange calendar service using UTC instants, holidays, and early closes.
- Independent benchmark calendar and join policy.
- Explicit supported currency list.
- Corporate-action source table.
- No silent fallback in verified snapshots.
- Licensing and operational fallback decision.
- Shadow snapshot comparison against the legacy source.

Risks: RISK-013, RISK-014, RISK-015, RISK-016, RISK-017, RISK-018.

Runtime effect: shadow only until a defined observation window and external reconciliation pass.

Rollback: stop shadow execution; production continues on legacy data.

### B09 — Transaction Fill and Decimal Ledger V2

Goal: preserve actual transaction order, precision, instrument identity, and cash corrections.

Deliverables:

- Immutable fills with executed_at_utc, exchange timezone, broker order/fill identity, and sequence.
- Explicit date-only legacy precision marker without fabricated times.
- Fixed-point or Decimal amount and quantity fields.
- Instrument master with exchange, currency, asset class, multiplier, and support status.
- Type-specific transaction validation.
- Explicit fee, tax, rebate, refund, interest, and cash-adjustment events.
- Dual-write from the existing BUY/SELL/DIV form.

Risks: RISK-027, RISK-034, RISK-042, RISK-044, RISK-045.

Runtime effect: legacy records remain authoritative until parity passes.

Rollback: disable V2 reads and continue legacy calculation.

### B10 — Strategy allocation model

Goal: replace ambiguous multi-tag accounting with either explicit overlapping analysis or conserved accounting sleeves.

Preferred deliverables:

- Strategies table.
- Transaction allocation table.
- Quantity, fee, and tax sum invariants.
- Atomic batch allocation API.
- Migration wizard that does not infer allocations without confirmation.
- Shadow strategy results before cutover.

Risks: RISK-006 and remaining RISK-007 atomicity concerns.

Runtime effect: existing tags remain readable and editable until user-confirmed migration.

Rollback: display legacy tag groups.

### B11 — Dividend and corporate-action ledger

Goal: represent estimated, entitled, receivable, paid, reconciled, and cancelled events separately.

Deliverables:

- Corporate action event identity and deduplication.
- Dividend entitlement, receivable, payment, gross, withholding, net, currency, ex date, record date, and pay date.
- Return of capital, special dividend, ADR fee, stock dividend, and cash-in-lieu support.
- Broker-payment reconciliation.
- Migration report for legacy DIV records without automatic destructive conversion.

Risk: RISK-012.

Runtime effect: V2 is initially reconciliation-only.

Rollback: continue legacy dividend display.

### B12 — Cash ledger and Account NAV/TWR shadow model

Goal: produce complete account-level performance without silently replacing legacy results.

Deliverables:

- Accounts, cash balances, deposits, withdrawals, FX conversions, settlement, interest, receivables, liabilities, and transfers.
- Account NAV identity.
- Account TWR and MWRR.
- Explicit distinction between external and internal flows.
- Broker-statement daily reconciliation.
- Side-by-side Legacy and Account V2 presentation.

Risks: RISK-004, RISK-005.

Runtime effect: shadow and beta display only until statement reconciliation is accepted.

Rollback: hide Account V2 and continue legacy securities analytics.

### B13 — Durable tenant compute plane

Goal: remove GitHub Actions from interactive production calculation while preserving it as a verified fallback.

Deliverables:

- Tenant-scoped durable workflows or queue consumers.
- Coalescing key based on tenant, input revision, benchmark, and calculation type.
- Lease, retry, dead-letter, supersede, and cancellation semantics.
- Independent tenant failure isolation.
- Calculation batch/member model.
- GitHub Actions shadow parity before canary.
- GitHub Actions retained for CI, deployment, synthetic audit, nightly reconciliation, and temporary fallback.

Risks: RISK-021, RISK-035, RISK-047.

Runtime effect: dual compute paths with controlled canary.

Rollback: route new jobs back to GitHub Actions.

### B14 — PWA retirement or rebuild, CSP, accessibility, and frontend architecture

Goal: remove stale-client risk and tighten browser security after session and storage migration.

Deliverables:

- Tombstone service worker that deletes project caches and unregisters itself.
- Project-scoped legacy registration cleanup.
- Decision to remove PWA claims or rebuild with a tested versioned Workbox/Vite implementation.
- API network-only policy and explicit stale/offline state.
- CSP tightening in staging, including removal of unsafe-eval.
- Accessibility remediation.
- TypeScript and explicit frontend state machines for auth, network, jobs, and snapshot freshness.

Risks: RISK-024, RISK-050 and residual RISK-023.

Runtime effect: staged and canary rollout; old service-worker clients are explicitly handled.

Rollback: prior Pages deployment plus tombstone remains safe.

### B15 — Legal, user data rights, retention, and disaster recovery

Goal: make user rights and recovery executable and auditable.

Deliverables:

- Data export.
- Account deletion and processing-stop workflow.
- Retention schedule.
- Privacy policy, terms, security policy, contact, subprocessor list, and license.
- Daily encrypted long-term export.
- Migration bookmarks.
- Quarterly restore drill.
- RPO, RTO, incident response, and break-glass procedures.

Risks: RISK-030, RISK-033.

Runtime effect: additive.

Rollback: feature flag for new user-facing operations; backups and audit evidence are retained.

## Proposed PR sequence

| PR | Scope | Production behavior | Data change |
|---|---|---|---|
| PR-10A | Audit baseline and governance | None | None |
| PR-10B | Frontend and integration test harness | None | None |
| PR-10C | Safe frontend correctness fixes | Frontend only | None |
| PR-10D | Staging and preview isolation | Environment only | Staging only |
| PR-10E | Opaque workflow job inputs | Compatible dual path | Additive |
| PR-10F | Scoped service credentials and dual auth | Compatible dual path | Additive |
| PR-11A | Ledger revision metadata | Compatible dual write | Additive |
| PR-11B | Mutation idempotency and optimistic locking | Compatible dual contract | Additive |
| PR-11C | Snapshot V2 metadata and CAS | Shadow | Additive |
| PR-11D | Job lease, heartbeat, and orphan recovery | Compatible | Additive |
| PR-12A | Market provenance shadow path | Shadow | Additive |
| PR-12B | Immutable EOD and live quote split | Shadow | Additive |
| PR-12C | Benchmark calendar and methodology | Shadow | Additive |
| PR-13A | Fill timestamp and sequence model | Dual write | Additive |
| PR-13B | Decimal ledger | Dual write | Additive |
| PR-13C | Strategy allocations | Shadow/dual write | Additive |
| PR-13D | Dividend and corporate-action model | Shadow/dual write | Additive |
| PR-14A | Cash ledger and Account NAV | Shadow | Additive |
| PR-14B | Account TWR/MWRR beta | Shadow/beta | Additive |
| PR-15 | Durable compute-plane migration | Dual path/canary | Additive |

## Mandatory acceptance for every production-affecting PR

- Existing Python, Worker, D1, deployment, and frontend gates remain green.
- The batch-specific new tests pass.
- No private identity, transaction, secret, or ticker-universe data appears in public evidence.
- The exact head SHA is reviewed and deployed.
- Old frontend, old Worker, queued job, old snapshot, and legacy service-worker compatibility are recorded.
- A pre-change recovery reference exists.
- The rollback procedure is exercised in staging or through a deterministic simulation.
- Production canary remains within the defined error, latency, and data-difference thresholds.

## Program completion criteria

The program is not complete merely when every PR is merged. Completion requires:

- UI, API, runner, and ledger counts agree.
- Stale snapshots cannot overwrite current data.
- Duplicate mutations and dividends are impossible by database identity.
- Account NAV reconciles broker statements.
- Market and FX sources are attributable and quality-gated.
- Public PII is zero.
- Preview-to-production data access is zero.
- Silent financial fallbacks are zero.
- Orphan calculation jobs are zero.
- Restore drills meet documented RPO and RTO.
- Legacy terminology and contracts are removed only after evidence confirms no remaining dependent clients.
