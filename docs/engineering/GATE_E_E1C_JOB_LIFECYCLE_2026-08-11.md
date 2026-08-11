# Gate E / E1c — Calculation Job Lifecycle and Idempotency

Status: **E1c-A SERVER-FIRST IMPLEMENTATION CANDIDATE**  
Date: **2026-08-11**  
Baseline protected main: `624b40f5b4bf40544050e6783adc0b6bc65bfb64`

## 1. Problem

The durable calculation-job implementation has explicit lifecycle states, but duplicate prevention and browser recovery were still controlled by fixed elapsed-time windows rather than durable lifecycle state.

Three clocks can disagree:

- browser pending calculation state: 15 minutes;
- Worker idempotency release: 15 minutes from job creation;
- GitHub workflow job timeout: 20 minutes, excluding queue delay.

The shared GitHub Actions concurrency group can also replace an already-pending run before the workflow reaches its first lifecycle callback.

This creates two correctness classes:

1. an active `queued` / `running` job can lose duplicate protection because enough wall-clock time elapsed;
2. an accepted or ambiguous dispatch can leave a durable `queued` orphan that later interacts badly with browser key rotation or pending-run replacement.

## 2. Root Causes

### 2.1 Worker released active idempotency by age

`calculationJobsRepository.createOrGet()` previously set the same tenant/key `idempotency_hash = NULL` once `created_at` was older than 15 minutes.

The SQL had no lifecycle predicate. A legitimate `queued` or `running` job could therefore lose its unique `(user_id, idempotency_hash)` protection solely because it was old.

### 2.2 Legacy browser can rotate the key while a server job is still active

The current production frontend deliberately expires local pending calculation state after 15 minutes. Once expired, a later user retry can generate a new idempotency key even though the original durable job is still `queued` or `running`.

Therefore a server-first Worker fix that protects only the original hash is insufficient for zero-downtime rollout: the still-old frontend can legitimately arrive with a different key during the transition.

### 2.3 Dispatch exceptions could leave a queued orphan

Explicit GitHub non-2xx responses already transition a newly inserted job to `failed`.

A thrown dispatch `fetch()` error, including timeout/network failure, previously returned `502` without terminalizing the already-created durable job. The job could remain `queued` without a trustworthy dispatch result.

### 2.4 Pending GitHub runs can be replaced before callback

The current workflow uses one repository-wide concurrency group with `cancel-in-progress: false`, but platform-default concurrency keeps only a limited pending slot. A newer pending run can replace an older pending run before the older workflow reaches `Mark calculation job running`.

That issue will be addressed in E1c-B after the server-first Worker compatibility layer is deployed.

## 3. Zero-Downtime Transition BLOCKER and Phase Split

The first E1c candidate attempted to change Worker, frontend pending semantics, and workflow pending retention in one PR. Exact-head CI passed, but a pre-deployment transition review found that this was not safe.

### New frontend + old Worker is unsafe

If Pages activates lifecycle-based browser recovery before production Worker deployment, the browser can keep replaying the same key beyond 15 minutes while the old Worker has already released that hash by age. A duplicate job can then be created.

### New Worker + old frontend is unsafe without compatibility guard

If Worker is deployed first but only protects the same idempotency hash, the still-old frontend can expire after 15 minutes and generate a new key. That different hash can create a second active job.

### Locked correction

E1c is therefore split into two independently safe batches:

```text
E1c-A server-first compatibility Worker
-> deploy and production-verify E1c-A
-> E1c-B frontend lifecycle + workflow retained queue
-> production smoke / E1c closeout
```

The former one-shot three-layer candidate is superseded. Its CI is historical evidence only and does not authorize the server-first candidate.

## 4. E1c-A Locked Contract — Server First

### 4.1 Active same-key jobs never expire by age

- `queued` and `running` are active states.
- Their idempotency hash is never released by `created_at` age.
- Only terminal `succeeded` / `failed` jobs may release the exact hash after an explicit replay-retention interval.
- Release is based on `completed_at`, not creation time.

### 4.2 Exact-key replay remains first-class

Before creating anything, the Worker checks for the exact tenant + idempotency hash.

If that row exists, active or terminal, the exact job is returned and no new dispatch occurs. This preserves idempotent transport replay semantics.

### 4.3 Legacy key-rotation compatibility is active tenant + benchmark scoped

If no exact-key row exists, creation is guarded atomically by the presence of an already-active job for the same:

```text
user_id + benchmark + status in {queued, running}
```

A rotated legacy browser key for the same tenant and benchmark therefore returns the existing active job instead of creating another dispatch.

Different benchmark remains a distinct calculation intent and is not silently collapsed.

The guard is implemented in the same D1 `INSERT ... WHERE NOT EXISTS(active same tenant+benchmark)` statement. This avoids a check-then-insert race across two different keys without adding a new schema/index.

If the insert is suppressed, the Worker resolves in this order:

1. exact hash, in case another concurrent request inserted it;
2. active same tenant + benchmark, deterministically oldest first.

### 4.4 Terminal replay retention

Terminal same-key rows retain the hash for 24 hours from `completed_at`.

This is a conservative transport-replay window. It does not change active lifecycle semantics and does not depend on browser TTL.

### 4.5 Ambiguous dispatch exception recovery is conditional

When dispatch throws after a new durable job was inserted:

- timeout uses `GITHUB_DISPATCH_TIMEOUT`;
- other thrown dispatch failure uses `GITHUB_DISPATCH_FAILED`;
- Worker attempts only conditional `queued -> failed`;
- if GitHub actually accepted the run and its callback already advanced the job to `running`, recovery changes nothing.

This avoids both a permanent queued orphan and the opposite race of falsely overwriting a real running job as failed.

## 5. E1c-B Locked Follow-up — Only After E1c-A Worker Production Verification

E1c-B will change no Worker lifecycle semantics. It will finish the client/workflow side after the compatibility Worker is live.

Planned E1c-B scope:

1. browser pending state stops expiring active recovery solely by age;
2. known `jobId` state clears on durable terminal/404 semantics rather than 15-minute TTL;
3. pre-job ambiguous mutation state retains/replays the same key until server outcome is resolved;
4. generation/tombstone owner/cross-tab protections remain intact;
5. workflow pending runs use retained queue semantics while keeping repository-wide serialized execution.

The exact supported workflow syntax must be revalidated against current GitHub Actions behavior at E1c-B implementation time.

## 6. Residual Fail-Closed Recovery

E1c deliberately does not add an automatic lease/heartbeat/sweeper or Schema 3 job columns.

A rare active job whose terminal callback is permanently lost is not guessed dead by elapsed time. It remains active/fail-closed. Existing system-only job status transition authority can explicitly move a known `queued` / `running` job to `failed` with an auditable error code.

A future automatic lease/sweeper remains a separate evidence-driven decision and may be revisited with the later ledger-revision architecture if operational evidence justifies it.

## 7. E1c-A Scope Lock

In scope now:

- `worker.js` lifecycle-based exact-key release;
- active same tenant + benchmark cross-key compatibility guard;
- race-safe dispatch-exception recovery;
- Worker regression tests;
- this phased engineering record.

Explicitly deferred to E1c-B:

- frontend pending TTL/lifecycle changes;
- GitHub workflow retained pending queue change;
- their corresponding tests.

Out of E1c entirely:

- D1 Schema 3 / new job columns;
- ledger revision / compare-and-publish;
- E1d cursor-signing secret separation;
- provider redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- derivatives;
- broad authentication/session redesign.

## 8. Risk and Recovery

**R3 — production lifecycle / duplicate-execution correctness.**

E1c-A changes the deployed Worker trigger/idempotency boundary. A defect can create duplicate calculations or incorrectly suppress intended work.

Pre-E1c recovery:

`backup-pre-e1c-lifecycle-624b40f`

No D1 migration is part of E1c-A.

## 9. Required E1c-A Regression Proof

Before merge:

- exact changed-file scope: Worker + Worker lifecycle tests + this record only;
- full repository CI;
- active exact-key `queued/running` jobs have no `created_at` expiry;
- terminal hash release requires terminal status + non-null old `completed_at`;
- same exact key resolves to the same job;
- different key + same tenant + same benchmark + active job resolves to the existing active job;
- same tenant + different benchmark remains distinct;
- atomic insertion contains an active same-tenant+benchmark `NOT EXISTS` guard;
- thrown dispatch timeout closes only a still-queued inserted job;
- timeout race cannot overwrite a job already advanced to `running`;
- legacy frontend/workflow files are unchanged from protected main;
- fresh R3 Same-AI Independent Review;
- expected-head merge only.

## 10. Production Activation Requirement

E1c-A changes `worker.js`; merge and Pages deployment do **not** activate the server fix.

The current production activation authority authorizes the older E1a-B runtime source only. It must not be reused.

After E1c-A implementation merge:

```text
post-main CI + Pages
-> exact E1c-A runtime production identity evidence
-> controlled activation evidence + new exact-source authority
-> Deploy Worker exact E1c-A runtime source
-> post-deploy Worker contract verification
-> server-first compatibility production proof
-> only then open E1c-B
```

No frontend TTL or workflow retained-queue change may be merged before E1c-A Worker production verification closes the transition blocker.
