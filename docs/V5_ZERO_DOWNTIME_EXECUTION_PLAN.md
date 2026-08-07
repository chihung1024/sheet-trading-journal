# V5.0 Zero-Downtime Root-Cause Remediation Plan

Status: APPROVED FOR STAGED EXECUTION  
Approved baseline: `2557fc582d3555f7b129f36d2cf5ad67c141375e`  
Approved at: `2026-08-07T09:28:00+08:00`  
Historical audit baseline remains immutable: `35e629ade1c3155ad5e44b839135d4406f9a4170`

## 1. Purpose

This document records the approved V5 execution plan so future maintainers and AI agents can reconstruct why each batch exists, what may safely change, and which compatibility guarantees must remain in force.

The plan preserves all prior B00-B15 remediation work and all previously identified risks. V5 adds root-cause sequencing around six system invariants:

1. **Identity invariant** — each tenant has a stable internal immutable identity.
2. **Ledger invariant** — every economic mutation belongs to a monotonic ledger revision.
3. **Compute invariant** — each calculation job is bound to one explicit input revision/hash.
4. **Market-truth invariant** — verified results identify the market-data/provenance version used.
5. **Publication invariant** — an older input revision can never replace a newer verified result.
6. **External-reconciliation invariant** — internal algebraic agreement does not substitute for external economic truth.

## 2. Non-negotiable operating rules

Every production-affecting change follows:

`Expand -> Backfill -> Dual-write -> Shadow-read -> Canary -> Cutover -> Observe >= 2 releases -> Contract`

Additional rules:

- Merge does not imply enablement. New data paths must be behind explicit feature flags/kill switches.
- Every batch must have an exact pre-change SHA, recovery reference, acceptance evidence, and rollback path.
- Do not fix financial defects by increasing tolerances, hiding errors, silently returning zero, or changing only the UI.
- Debugging must identify the first authoritative divergence and then perform a sibling sweep across duplicated formulas, markets, clients, transaction types, and fallbacks.
- Browser coordination is UX noise reduction only; authoritative uniqueness belongs in the server/database layer.
- Silent market-data fallback may produce degraded data but must not publish a new `verified` snapshot.
- Display rounding must never feed canonical calculations.
- No Schema 3 migration starts until governance, staging/production environment closeout, recovery evidence, and feature controls are complete.

## 3. Approved execution order

### Wave 0 — Governance control plane

- **G00A** — protect `main` with a repository ruleset/branch protection: PR required, required CI checks, force-push/delete blocked, break-glass documented.
- **G00B** — protect `production` and `staging` GitHub environments with deployment branch/source policy and approval/bypass policy.
- **G00C** — tombstone dangerous legacy deployment runbooks and mark historical worker paths non-canonical.

### Wave 1 — B02/B03 closeout

- **PR-10C9** — frontend residual correctness: truthful connection/freshness state, single-flight polling, common API timeout/abort transport, cross-tab auth logout event, accessibility-safe controls, remove hard-coded currency assumptions.
- **PR-10D3A** — generate environment-aware CSP/security policy from the reviewed deployment environment contract.
- **OPS-10D3B** — redeploy exact latest reviewed SHA to staging.
- **PR-10D3C** — real browser smoke in staging: load, dedicated staging OAuth, GET/POST/PUT/DELETE synthetic records, logout, production data unchanged, staging dispatch fails closed.
- **PR-10D4** — explicit production environment/CORS/OAuth identity; remove reviewed-deploy fallback ambiguity.
- **OPS-10D5** — first production deployment through the exact-SHA production workflow, followed by contract evidence and rollback verification.

B03 is not closed until all items above pass.

### Wave 2 — Recovery and feature control

- **PR-10R1** — recovery evidence gate: D1 recovery point/reference, schema/data export, checksum, restore manifest, staging restore drill, RPO/RTO evidence.
- **PR-10R2** — server-authoritative feature flags/kill switches. Initial flags include `FF_LEDGER_V2_WRITE`, `FF_LEDGER_V2_READ`, `FF_SNAPSHOT_V2`, `FF_JOB_V2`, `FF_MARKET_DATA_V2`, `FF_FILL_V2`, `FF_STRATEGY_V2`, `FF_DIVIDEND_V2`, `FF_ACCOUNT_NAV_V2`, `FF_COMPUTE_V2`, all default OFF.

### Wave 3 — B04 GitHub PII removal

- **PR-10E1** — job-scoped input endpoint resolves job -> tenant/input/benchmark server-side.
- **PR-10E2** — new GitHub dispatch carries opaque `calculation_job_id` only; legacy email input remains only for already queued compatibility work.
- **PR-10E3** — remove the new-email dispatch path after the compatibility drain and confirm PII scans/logs/artifacts are clean.

### Wave 4 — B05 identity/auth split

- **PR-10F1** — internal tenant/user UUID foundation; Google `sub` is the stable IdP key, email is mutable metadata.
- **PR-10F2** — scoped service credentials: records read, snapshot write, job callback, cursor signing, audit read; include audience/scope/expiry/kid/current-next rotation.
- **PR-10F3** — admission, tenant status, quota and disable controls.
- **PR-10F4** — revocable application session (HttpOnly/Secure/SameSite) while retaining legacy Bearer compatibility for at least two releases; cached JWKS and logout/revocation semantics included.

### Wave 5 — B06 ledger consistency

- **PR-11A** — monotonic ledger revision and dirty snapshot state.
- **PR-11B** — database-backed client mutation idempotency and optimistic locking.
- **PR-11C** — immutable record revision/audit history.
- **PR-11D** — revision-aware pagination and stale snapshot contract.

All mutation + revision + audit + receipt writes must be atomic.

### Wave 6 — B07 Snapshot/Job V2

- **PR-11E** — Snapshot V2 metadata/provenance in shadow mode.
- **PR-11F** — compare-and-swap publication transaction; older input revisions cannot replace newer verified snapshots.
- **PR-11G** — Job V2 state machine with lease, heartbeat, retry, expiry, cancellation, supersession, input revision/hash and result snapshot linkage.

### Wave 7 — Market Truth V2

- instrument master and explicit supported asset/currency set;
- separated EOD vs live quote series;
- provider/as-of/received-at/quality provenance;
- one exchange-calendar authority;
- independent external-truth reconciliation and broker golden fixtures;
- fallbacks produce `degraded`, never silent `verified` publication.

### Wave 8 — Immutable fills and fixed precision

- immutable fills with `executed_at_utc`, exchange/session identity, source/external fill identifiers;
- legacy date-only records remain explicitly date-only rather than receiving invented timestamps;
- ledger financial values migrate away from SQLite floating-point truth toward fixed/scaled integer or canonical decimal representations.

### Wave 9 — Strategy allocation

Replace semantic dependence on free-text tags with explicit strategies and allocation rows. Conservation of quantity, fee, tax and sleeve inventory is a hard invariant.

### Wave 10 — Corporate actions/dividends

Introduce corporate-action events, entitlement/receivable/payment and withholding-tax events. Confirmation of an already-earned dividend must never create additional economic profit.

### Wave 11 — Cash ledger / Account NAV

Introduce accounts, cash events/balances, external flows, FX conversions, settlements, receivables and liabilities. Only after these exist may account-level NAV/TWR/MWRR be promoted.

### Wave 12 — Durable compute plane

Move interactive compute away from GitHub Actions to a tenant-isolated durable queue/workflow architecture. Delivery retries remain idempotent at the database publication layer.

### Wave 13 — Browser security / PWA / accessibility

Tombstone legacy service worker first, then rebuild only if required. Tighten CSP after session tokens leave localStorage; remove unsafe constructs, add semantic accessibility and frontend state-machine testing.

### Wave 14 — Legal, data rights and DR

Complete export/delete/retention, privacy/terms/license/security policy, incident response, data/provider licensing, RPO/RTO and recurring restore drills.

## 4. Debug protocol

Every defect investigation must record the exact source SHA, Worker/API/schema version, tenant, ledger revision, snapshot id/input revision, job id, market-data version and request id when available.

The sequence is:

1. freeze evidence;
2. reproduce in a deterministic fixture and then a staging synthetic tenant;
3. state the violated invariant;
4. trace UI -> API -> D1 -> job input -> market data -> calculator -> snapshot -> UI and identify the first divergence;
5. add a failing test before the repair;
6. repair the authoritative layer, not the presentation symptom;
7. sweep sibling implementations and duplicated assumptions in parallel;
8. verify financial defects against an external truth source where possible;
9. shadow/canary before cutover;
10. record exact post-deploy evidence and rollback reference before closeout.

## 5. Historical evidence policy

For every batch, keep:

- `backup-pre-*` branch fixed at the pre-change SHA;
- a dedicated work branch;
- an acceptance/recovery document in `docs/governance/` or the batch documentation area;
- PR number, head SHA, merge SHA and CI/workflow run identifiers;
- deployment evidence for staging/production when applicable;
- migration recovery/export/restore evidence when schema/data is touched.

Never rewrite prior audit baselines merely to reflect newer progress. Add a new execution/status record instead.

## 6. Current starting point

At approval, production code baseline remains:

- main: `2557fc582d3555f7b129f36d2cf5ad67c141375e`
- Worker release: `4.07`
- API: `2.60`
- D1 schema: `2`

Wave 0 begins with governance-only work; no runtime, D1 or financial-calculation behavior changes are allowed in G00.
