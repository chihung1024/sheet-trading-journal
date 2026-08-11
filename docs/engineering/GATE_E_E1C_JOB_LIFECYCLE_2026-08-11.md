# Gate E / E1c — Calculation Job Lifecycle and Idempotency

Status: **IMPLEMENTATION CANDIDATE**  
Date: **2026-08-11**  
Baseline protected main: `624b40f5b4bf40544050e6783adc0b6bc65bfb64`

## 1. Problem

The durable calculation-job implementation had lifecycle semantics, but duplicate prevention and browser recovery were still controlled by elapsed time rather than durable job state.

Three independent clocks could disagree:

- browser pending calculation state: 15 minutes;
- Worker idempotency release: 15 minutes from job creation;
- GitHub workflow execution timeout: 20 minutes, excluding queue delay.

In addition, the shared GitHub Actions concurrency group could replace an already-pending run before its first lifecycle callback executed.

The result was a class of lifecycle correctness failures in which a legitimate `queued` or `running` job could lose duplicate protection or become locally unrecoverable solely because enough wall-clock time elapsed.

## 2. Root Causes

### 2.1 Worker released active idempotency by age

`calculationJobsRepository.createOrGet()` previously set `idempotency_hash = NULL` for the same tenant/key once `created_at` was older than 15 minutes.

The SQL did not check `status`. A still-active `queued` or `running` job therefore lost its unique `(user_id, idempotency_hash)` lock after 15 minutes.

### 2.2 Browser recovery expired independently of server lifecycle

`calculationJobState.js` previously rejected every pending generation after 15 minutes, including generations that already contained a durable `jobId`.

This contradicted the frontend's own job polling contract: the client can poll for 20 minutes and explicitly tells the user that a later refresh can continue tracking.

It also weakened ambiguous POST recovery. Before the trigger POST, the browser intentionally persists an idempotency key with `jobId = null`; if the POST outcome is transport-ambiguous, reusing that exact key is safer than silently inventing a new request identity.

### 2.3 Dispatch exceptions could leave a queued orphan

When GitHub returned an explicit non-2xx response, the Worker transitioned the newly created job to `failed`.

When the dispatch `fetch()` itself threw, including timeout/network failure, the outer trigger handler returned `502` without closing the already-created durable job. The row could remain `queued` even though no usable dispatch result was known.

### 2.4 Pending GitHub runs could be replaced before lifecycle callback

The workflow used one repository-wide concurrency group with `cancel-in-progress: false`.

GitHub's concurrency contract permits only one pending run by default; a newly queued run can replace/cancel the older pending run. A calculation job attached to that replaced run can therefore remain `queued` because the workflow never reaches its initial `running` callback.

E1c uses the supported retained-queue mode for this concurrency group so pending update runs wait rather than replacing one another.

## 3. Locked E1c Contract

### 3.1 Active job identity is lifecycle-based

- `queued` and `running` are active states.
- Active jobs retain their idempotency hash regardless of age.
- Active duplicate protection is therefore controlled by durable status, not `created_at`.
- Existing D1 Schema 2 fields remain sufficient; no Schema 3 migration is required.

### 3.2 Terminal replay retention is explicit

- Only `succeeded` or `failed` jobs may release an idempotency hash by time.
- The terminal replay-retention period is 24 hours from `completed_at`.
- The period exists to make delayed/replayed trigger responses resolve to the same terminal job for a conservative transport-ambiguity window.
- A new browser generation normally receives a new idempotency key after exact terminal cleanup, so this retention does not block ordinary subsequent updates.

### 3.3 Ambiguous dispatch failure closes only a still-queued job

If GitHub dispatch throws after a durable job has been inserted:

- the Worker attempts `queued -> failed` using a conditional update;
- timeout uses `GITHUB_DISPATCH_TIMEOUT`;
- other thrown dispatch failure uses `GITHUB_DISPATCH_FAILED`;
- if the workflow was actually accepted and already advanced the job to `running`, the conditional recovery update changes nothing.

This is a race-safe fail-closed boundary: a truly orphaned queued job is terminalized, while an already-running accepted job cannot be overwritten as failed merely because the dispatch HTTP response was lost.

### 3.4 GitHub update runs retain pending work

The existing repository-wide serialization remains:

```yaml
concurrency:
  group: portfolio-update
  cancel-in-progress: false
  queue: max
```

The intent remains one active portfolio update/audit at a time. The additional queue mode changes only pending-run retention; it does not permit concurrent calculation/upload execution.

### 3.5 Browser state follows durable lifecycle

- local pending state no longer disappears because of elapsed age;
- malformed, cross-owner, invalid-job, or implausibly future state still fails closed;
- generation/tombstone semantics remain authoritative across tabs;
- a generation with `jobId` is cleared on exact terminal completion or server `404`;
- a generation without `jobId` preserves the same idempotency key after ambiguous mutation failure, so a later trigger retry lets the Worker resolve the existing durable job or create the first one;
- explicit server rejection still clears the exact pending generation.

## 4. Recovery Semantics

E1c deliberately does **not** introduce an automatic stale-job lease or sweeper.

If a `running` job loses every terminal callback in an exceptional operational failure, it remains active rather than being guessed dead by age. This can temporarily block same-key replay, but it does not authorize a duplicate calculation behind an apparently active job.

Explicit recovery already exists through the system-only calculation-job status endpoint, which accepts a valid `queued/running -> failed` transition with an auditable error code. A future automatic lease/heartbeat/sweeper remains a separate evidence-driven change and may require a broader job-schema decision.

## 5. Scope Lock

In scope:

- canonical Worker calculation-job idempotency release and dispatch-exception recovery;
- frontend pending calculation lifecycle semantics;
- GitHub update-workflow pending-run retention;
- regression tests and E1c engineering evidence.

Out of scope:

- D1 Schema 3 or new job columns;
- ledger revision / compare-and-publish;
- E1d cursor-signing secret separation;
- provider redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- derivatives;
- broad authentication/session redesign.

## 6. Risk

**R3 — production lifecycle / duplicate-execution correctness.**

The implementation is narrow but affects the production Worker trigger path, browser retry/recovery identity, and GitHub workflow queue semantics. A mistake can either allow duplicate calculations or leave work falsely blocked.

Pre-change recovery:

`backup-pre-e1c-lifecycle-624b40f`

## 7. Required Regression Proof

Before merge:

- exact changed-file scope;
- full repository CI;
- active Worker idempotency release SQL has terminal-status and `completed_at` predicates and no active `created_at` expiry;
- same tenant/key concurrent creates still resolve to one active job;
- queued dispatch exception becomes `failed`;
- dispatch timeout race cannot overwrite a job already advanced to `running`;
- frontend old known-job and pre-job generations remain recoverable after long elapsed time;
- tombstone/cross-owner/future-state protections remain intact;
- workflow YAML parses with `group=portfolio-update`, `cancel-in-progress=false`, `queue=max`;
- R3 Same-AI Independent Review;
- expected-head merge only.

## 8. Production Activation Requirement

E1c changes `worker.js`; merging to `main` and Pages deployment is **not** sufficient to activate the server-side lifecycle fix.

The currently approved production activation authority authorizes the older E1a-B runtime source only. The E1c runtime source must receive fresh production identity/activation evidence and a new exact-source authority before `Deploy Worker` is allowed.

The production sequence after implementation merge is therefore:

```text
implementation merge + post-main CI/Pages
-> exact E1c runtime source identity evidence
-> controlled activation evidence + new authority
-> Deploy Worker exact E1c runtime source
-> post-deploy Worker contract verification
-> normal calculation-job production smoke
-> E1c closeout
```

No old activation authority may be reused for the new Worker source.
