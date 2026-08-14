# NOW-1B Durable Record Create Intent

Date: 2026-08-14 Asia/Taipei  
Risk: R2 — browser persistence and record-create behavior.

## Current status

The market-data incident that interrupted product work is closed and remains passive watch. NOW-1B is the active product line.

NOW-1B-A — rollback-safe backend transport — is **PRODUCTION VERIFIED**:

- compatibility path: `POST /api/records/idempotent`;
- canonical runtime source: `a0213f05c64f8b1636711e5e3bfdea650f42f2df`;
- Production Identity Evidence #17: run `31757896091`, artifact `9203733363`, PASS;
- Deploy Worker #6: run `31759350109`, SUCCESS;
- deployed version: `ea9c129f-6e8f-4071-be36-e22721f82ef8`;
- post-deploy evidence artifact `9205266306`;
- three consecutive full production-contract passes after propagation;
- D1 schema remains 3 and no new migration was required.

The new path is the rollback-safe capability boundary. A runtime that does not contain the compatibility entry route returns 404 before record mutation. Frontend code must never fall back from this path to legacy `POST /api/records`.

NOW-1B-B — durable browser create intent — is implemented in PR #231. Candidate exact head after functional-test correction: `9b13dc1f2cae53a2ec1ffa7b1a47c90663f47210`. Exact-head CI #783 / run `31763766650` is SUCCESS across Frontend contracts/build, Worker security/deployment tests, and Python tests. Merge/post-main verification remains the final gate.

## Product objective

```text
one logical trade create
-> persist intent before POST
-> one stable idempotency key + immutable payload
-> timeout / token refresh / reload may occur
-> recovery reuses the same key and payload
-> verified replay/success produces one record
-> completed intent is cleared before follow-up UI refresh
```

The user should not have to decide whether an ambiguous create probably succeeded before retrying.

## Implemented persistence contract

Implementation owner: `src/services/recordCreateIntent.js`.

- intent schema version: 1;
- live recovery TTL: 24 hours;
- dynamic intent prefix: `pending_record_create.v1.`;
- fixed mutation barrier: `record_mutation_barrier.v1`;
- storage key contains only the opaque idempotency key, never email/PII;
- stored value is owner-validated and contains the immutable serialized request body needed for exact replay;
- secure random idempotency/barrier identifiers use `crypto.randomUUID()` or `crypto.getRandomValues()`;
- persist operations are read-back verified before the caller may send the POST;
- malformed, cross-owner, unsupported-version, impossible-future, stale, terminal, or superseded intents fail closed;
- logout removes both the barrier and every dynamic record-create intent through `clearSensitiveProjectStorage()`.

Browser storage remains non-authoritative. D1 remains the transaction source of truth.

## Network and recovery contract

`src/stores/portfolio.js` now follows this order for a create:

1. derive owner from the signed auth-store identity;
2. rotate/persist the mutation barrier;
3. serialize and persist the exact create intent;
4. send one `POST /api/records/idempotent` with the stored `Idempotency-Key` and exact stored body;
5. token refresh, when needed, recursively reuses the same endpoint/options object;
6. verified success clears the exact intent before record refresh;
7. a later record-refresh failure never changes the create back to ambiguous and never generates another logical create.

Recovery is outside `addRecord()` so the normal create call never contains a blind retry loop. `fetchAll()` may recover the current same-owner eligible intent. Recovery is single-flight and bounded to at most one automatic attempt per intent key per store lifetime; a later distinct intent remains eligible. Reload starts a new bounded recovery opportunity for a still-live intent.

## Error semantics

- verified success: committed; clear the exact intent before refreshing records;
- HTTP/application 4xx, including `IDEMPOTENCY_CONFLICT` and unsupported-path 404: terminal; never rotate a replacement key automatically for that logical submission;
- timeout, network failure, 5xx, or other outcome that does not prove rollback: ambiguous; retain the exact live intent/key/body for bounded recovery;
- storage unavailable before POST: fail before mutation;
- token refresh: preserve exact key/body;
- storage cleanup after a server-confirmed commit is best effort only; the same server idempotency key remains the safety net if the local entry survives unexpectedly.

## Correctness boundary: later record mutations supersede stale create replay

A pending create may auto-replay only while no later explicit record mutation has superseded it. Starting a newer logical create rotates the shared barrier. UPDATE/DELETE first check for an eligible pending create and, when present, rotate the barrier before their network mutation. Older intents remain non-replayable even though their historical storage entries may still exist until logout.

This is a browser-side replay-eligibility fence, not a new distributed transaction protocol. It prevents future automatic replay from a superseded local intent. It does not claim to reorder a request that was already dispatched before another tab starts a later mutation. Server idempotency still protects duplicate create dispatches. A backend idempotency-tombstone/transaction-ordering subsystem remains out of scope unless production evidence demonstrates that stronger distributed ordering is required.

## Correctness boundary: frontend/backend capability coordination

A simple `/api/version` preflight was rejected because runtime rollback could occur between preflight and mutation. The dedicated compatibility path removes that TOCTOU: new runtime rewrites only the exact POST alias to canonical `/api/records`; old runtime rejects the alias before mutation. Frontend must not add a legacy fallback.

## Required regressions

The PR now carries both source-contract and executable storage-service regressions for:

1. persist-before-send;
2. same logical recovery uses the same key/body;
3. distinct creates get distinct keys even for identical payloads;
4. payload is immutable for a key;
5. conflict/404 do not rotate a new key or fall back to the legacy endpoint;
6. ambiguous failure retains intent;
7. same-owner reload/fetch recovery;
8. cross-owner state cannot replay;
9. logout clears create-intent/barrier state while preserving unrelated storage;
10. token refresh preserves key/body;
11. later create/update/delete supersede older replay eligibility;
12. terminal/stale/malformed/future state fails closed;
13. recovery is bounded per intent and has no tight retry loop;
14. storage failure aborts before POST;
15. existing mutation-outcome callers remain compatible;
16. no financial-engine, snapshot-calculation, Worker, or D1 behavior change.

## Completion rule

Close NOW-1B-B after PR #231 is independently reviewed, merged, exact post-main CI passes, and the production Pages deployment for that merge succeeds. Do not create or delete a real-user transaction solely as a smoke test. The already-production-verified transport plus exact-head frontend regressions are the acceptance basis unless a dedicated isolated production test tenant becomes available without blocking product work.

After closure, resume Phase 2 — Automatic Recalculation:

```text
confirmed mutation
-> mark snapshot stale
-> debounce/coalesce
-> auto trigger one calculation intent
-> poll durable job
-> publish/read fresh snapshot
-> UI refresh
```

Target UX: a normal transaction mutation should require zero manual “update portfolio” clicks.
