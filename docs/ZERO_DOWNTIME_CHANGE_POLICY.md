# Zero-Downtime Change Policy

## Scope

This policy is mandatory for every change that can affect the production frontend, Worker, D1 schema or data, calculation engine, market data, authentication, calculation jobs, snapshots, or deployment process.

A green unit-test run alone is not evidence that a change is safe. Each batch must prove compatibility with deployed clients, queued work, stored data, and the rollback path.

## Standard migration lifecycle

Every semantic or storage replacement follows these stages in order:

1. **Expand**
2. **Backfill**
3. **Dual-write**
4. **Shadow-read or shadow-calculate**
5. **Canary**
6. **Cutover**
7. **Contract**

A stage may be skipped only when the change is documentation-only or test-only and the PR records why the skipped stage is inapplicable.

### 1. Expand

Allowed actions:

- Add a table.
- Add a nullable column.
- Add an index using a production-safe procedure.
- Add optional API response fields.
- Add a new endpoint.
- Add a new job or snapshot version.
- Add a feature flag whose default preserves current behavior.

Prohibited actions:

- Drop or rename an active table or column.
- Reinterpret an existing field silently.
- Require a new request field before deployed clients support it.
- Change a stored enum so that an old Worker cannot read it.

Exit gate:

- Old Worker can operate on the expanded schema.
- Old frontend can operate against the expanded Worker.
- Migration is idempotent and verified in staging.

### 2. Backfill

Requirements:

- Process data in bounded batches.
- Store a restartable checkpoint.
- Avoid a long exclusive lock.
- Be safe to pause and rerun.
- Record source count, target count, checksum, error count, and unresolved rows.
- Do not make the new field authoritative during backfill.
- Do not fabricate missing economic facts such as transaction time or strategy allocation.

Exit gate:

- Counts and checksums reconcile.
- Every unresolved row is classified.
- Production reads still use the legacy source.

### 3. Dual-write

Requirements:

- Legacy write remains authoritative initially.
- New write failure must not make the successful legacy write appear failed unless atomicity is required and proven.
- Every divergence emits a non-sensitive anomaly with request ID and mutation identity.
- Duplicate delivery is safe.
- The dual-write path is feature-flagged and can be disabled without schema rollback.

Exit gate:

- New and legacy writes agree for the observation window.
- Retry and concurrent mutation tests pass.
- No unexplained divergence remains.

### 4. Shadow-read or shadow-calculate

Requirements:

- The shadow result cannot update the production latest pointer.
- General users cannot mistake shadow output for authoritative output.
- Inputs, methodology, market-data version, and output checksum are retained.
- Differences are decomposed into classified causes rather than hidden by tolerance changes.
- External broker or market truth is included where applicable.

Exit gate:

- Observation window and sample size are declared before review.
- Every material difference is explained or fixed.
- Error, latency, and cost remain within the batch budget.

### 5. Canary

Requirements:

- Start with an owner or designated test tenant.
- Use version affinity when multiple Worker versions may serve one workflow.
- Limit traffic or tenant scope explicitly.
- Define abort thresholds before enabling the canary.
- Ensure rollback does not require a data downgrade.
- Monitor at least error rate, latency, stale snapshots, reconciliation differences, job backlog, and security events.

Exit gate:

- Canary completes the declared observation period.
- No abort threshold is crossed.
- Rollback has been tested in staging or by deterministic simulation.

### 6. Cutover

Requirements:

- Change only a feature flag, routing percentage, or atomic latest pointer when possible.
- Keep the last verified legacy output available.
- Do not combine cutover with a destructive migration.
- Record exact SHA, Worker Version ID, schema version, input revision, and rollback reference.

Exit gate:

- Full production traffic or tenant scope uses the new path.
- Legacy path remains available for the compatibility window.

### 7. Contract

Requirements:

- Wait at least two compatible production releases unless an approved security emergency requires faster retirement.
- Prove no supported frontend, Worker, queued job, snapshot, or service worker depends on the old contract.
- Export or archive data before destructive removal.
- Perform a final restore test.
- Remove legacy documentation and flags with the same PR or a linked cleanup PR.

Exit gate:

- Contract-removal review explicitly approves destructive changes.
- Recovery evidence is current.

## Five mandatory compatibility dimensions

Every production-affecting PR must document these dimensions:

| Dimension | Required evidence |
|---|---|
| Old frontend → new Worker | Existing deployed API calls, response shapes, CORS, auth, and error handling remain supported. |
| Old Worker → expanded schema | Migrations do not remove fields or introduce unreadable required states. |
| Pre-deployment queued jobs | Inputs, service credentials, callback routes, and state transitions remain valid until the queue drains or jobs are explicitly superseded. |
| Old snapshots → new frontend | Missing V2 metadata has a safe legacy rendering path and cannot be mislabeled as V2 verified data. |
| Legacy service worker → new deployment | Previously installed workers are tested, tombstoned, or retained until they cannot serve incompatible bundles. |

A PR cannot be classified as zero-downtime if any dimension is marked “not considered.”

## Data migration requirements

Before any production D1 migration:

1. Record exact main and deployment SHA.
2. Record current schema version and migration list.
3. Create a pre-change backup reference in Git.
4. Obtain and securely record the database recovery bookmark where available.
5. Export schema and a verified encrypted data copy to independent storage.
6. Restore the export or recovery point in staging.
7. Run the old Worker against the migrated staging schema.
8. Run the new Worker against pre-migration and migrated fixtures.
9. Confirm the migration is additive and idempotent.
10. Define the rollback command, owner, and stop condition.

A database restore is not the primary rollback for an additive deployment. Prefer a Worker version rollback, legacy-read flag, or latest-pointer rollback because a database restore can overwrite valid writes made after the restore point.

## Snapshot publication rules

- A snapshot is staged before publication.
- Publication requires schema validation, input revision match, methodology identity, market-data identity, checksum, and quality status.
- The production latest snapshot changes through a compare-and-swap pointer.
- A stale input revision is superseded, not published.
- Retention cleanup is asynchronous and idempotent.
- The previous verified snapshot remains readable after a failed calculation.
- Display time is not snapshot identity.

## Calculation job rules

- Every job has an opaque public ID and internal tenant ID.
- Idempotency survives the complete active lifetime plus a retry window.
- Every active job has a lease and heartbeat.
- Every callback binds to the intended job and execution attempt.
- Terminal states are immutable except for separately authorized recovery tooling.
- A sweeper classifies expired or orphaned jobs.
- A job succeeds only after its snapshot is published.
- A published snapshot records the job that produced it.
- Equivalent work is coalesced by tenant, input revision, benchmark, calculation type, and methodology version.

## Security and privacy rules

- No full email address, token, API key, private transaction detail, or tenant ticker universe may be placed in public workflow inputs, logs, artifacts, PR comments, or release evidence.
- Service credentials are scoped and independently rotatable.
- Credential rotation accepts current and next credentials during a bounded overlap.
- Preview environments cannot reach production data.
- Production CORS and OAuth origins are exact, not suffix-wide.
- Browser persistence is minimized and never treated as authoritative financial state.

## Financial correctness rules

- Internal formula equality is not external reconciliation.
- A new calculation method remains shadow-only until it reconciles broker or independently sourced truth.
- No unsupported currency or asset class is silently treated as USD equity.
- No missing price, FX rate, split, dividend, or calendar is silently replaced in a verified snapshot.
- Tolerances must reflect rounding or provider precision and must be documented; they cannot hide unexplained residuals.
- Legacy metric names remain visible until account-level semantics are implemented and reconciled.

## Canary abort conditions

Unless a batch defines stricter limits, abort and roll back when any condition occurs:

- Cross-tenant access or data disclosure.
- Production preview access.
- Snapshot input revision mismatch.
- Stale snapshot becomes latest.
- UI, API, and runner record counts differ.
- Duplicate mutation or dividend identity appears.
- Unclassified financial residual exceeds the declared tolerance.
- Job orphan rate is non-zero after the recovery window.
- New-path error rate materially exceeds the legacy baseline.
- p95 latency increases by more than the approved batch budget.
- A required rollback artifact is unavailable.

## Rollback hierarchy

Use the least destructive effective rollback:

1. Disable feature flag.
2. Route reads to legacy source.
3. Restore prior latest snapshot pointer.
4. Route compute to legacy plane.
5. Roll back frontend deployment.
6. Roll back Worker version.
7. Stop dual-write while preserving new data for analysis.
8. Revert additive code or documentation.
9. Restore database only when data corruption cannot be isolated by the preceding controls.

## Required PR evidence template

Every production-affecting PR description must include:

- Baseline main SHA.
- Head SHA.
- Changed runtime and data contracts.
- Risk IDs addressed.
- Migration stage.
- Five compatibility dimensions.
- Feature flags and defaults.
- Test matrix and results.
- Canary scope and abort thresholds.
- Production evidence to collect.
- Rollback procedure and recovery reference.
- Explicit exclusions.

## Emergency changes

A security or data-integrity emergency may shorten the observation window, but it does not waive:

- tenant isolation,
- backup and recovery evidence,
- exact-SHA deployment,
- a reversible change path,
- post-deployment verification,
- or a documented follow-up to restore the standard lifecycle.
