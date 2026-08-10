# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Root-Cause Log / AI Handoff required by `AI_PROJECT_PLAYBOOK.md`.
>
> Update this file after every material implementation, CI result, independent review, merge, deployment, production smoke/audit, recovery ref, blocker or scope decision. Historical detail belongs in dedicated evidence documents and Git history; this file stays **current-state-first**.

Last updated: **2026-08-10**

---

# 1. Mandatory Session Startup

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Inspect protected `main`, active branch/PR, Worker deployment state and latest Actions.
5. Verify Current Phase / Current Batch / Next Action below against GitHub.
6. Read the current-phase evidence document.
7. Only then change code.

## Current authoritative evidence

- `docs/engineering/PRODUCT_INTEGRITY_EXECUTION.md`
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md`
- `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md`
- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — current Gate-E roadmap authority
- `docs/governance/risk-register.json` — historical 2026-08-06 baseline; do not copy priorities forward without revalidation

---

# 2. Locked Engineering Rules

- Evidence before conclusion; root cause before symptom fix.
- Investigation may expand; implementation must converge to one Current Batch.
- New findings do not automatically enter implementation scope.
- Important changes follow: recovery → scoped branch/PR → test-first where practical → fresh CI → independent review → handoff → final-head CI → exact-head merge → post-main CI → deployment if scoped → deployment verification → recovery → production smoke when runtime behavior changes.
- Never lower validation, coverage, financial-integrity, privacy, reproducibility or recovery gates merely to pass CI.
- Do not overwrite unknown/user-authored changes.
- `note` is never an implicit financial ordering or identity field.
- Repository merge does **not** imply Worker deployment. `deploy-worker.yml` is manual and exact-main-SHA gated.
- Every batch and rollout phase must leave the product usable.
- A batch is not DONE while this file is stale.

---

# 3. Current Stable State

Repository: `chihung1024/sheet-trading-journal`

Verified protected main before E1a compatibility rollout:

`87b5949a588bb6f655387ded554cb0a69d8a6f95`

Runtime contracts:

- D1 schema: **2**
- Worker release: **4.07**
- Worker API: **2.60**
- required schema: **2**

Program state:

- Gate A: **DONE**
- Gate B: **DONE**
- Gate C: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate D D1a–D1e: **DONE / CLOSED / POST-MAIN VERIFIED**
- Gate E E0 Post-D Architecture Review: **DONE / POST-MAIN VERIFIED**
- Gate E E1a Opaque GitHub Calculation Targeting: **ACTIVE — staged zero-downtime rollout**
- E1a-A pre-cutover Worker compatibility: **ACTIVE / FINAL-HEAD CI PENDING after handoff update**
- E1a-B privacy cutover: **BLOCKED until E1a-A is merged, post-main verified and deployed to production Worker**
- E1b/E1c/E1d: planned, not active
- Schema 3: **NOT IMPLEMENTED**; conditionally authorized later only for the narrow ledger-revision protocol after E1 + E2-pre audit.

## E0 terminal evidence

- PR #170 final head `4d342a340f2448006a1c8e6f13e05f1da7d70911`
- CI #542 success
- merge `32f272c973459158a18e71c89a63337bbdfd4dfa`
- post-main CI #543 success
- recovery `backup-post-gate-e-e0-32f272c`
- closeout PR #171 merge `87b5949a588bb6f655387ded554cb0a69d8a6f95`
- closeout post-main CI #545 success

---

# 4. Recovery Index

Do not delete during normal cleanup.

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D final: `backup-post-gate-d-2332116`
- Gate-E E0: `backup-post-gate-e-e0-32f272c`
- pre-E1a: `backup-pre-gate-e-e1a-87b5949`

Full intermediate Gate-D recovery refs remain in Git history and prior handoff revisions.

---

# 5. Completed Gate Index

| Gate / Batch | Status | Terminal authority |
|---|---|---|
| Gate A | DONE | generation-safe pending calculation recovery |
| Gate B | DONE | atomic record deletion |
| Gate C | CLOSED | `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` |
| Gate D D1a | DONE | reproducibility architecture audit |
| Gate D D1b | DONE | source/config/engine deterministic identities |
| Gate D D1c | DONE | market/FX/synthetic provenance identities |
| Gate D D1d | DONE | deterministic offline replay + explicit clock seam |
| Gate D D1e | DONE | production manifest attachment + production smoke |
| Gate D closeout | CLOSED | main `2332116...`, CI #541, final recovery |
| Gate E E0 | DONE | Post-D review, PR #170/#171, CI #542/#543/#544/#545 |

## Gate-C decisions still active

- Schema-2 source validity order is deterministic `Date -> record id`.
- Record id is a persistence tie-breaker, not broker-time proof.
- Source prefix integrity is authoritative; calculator `CLAMP` remains downstream compatibility/defense-in-depth.
- Public `Timestamp` / `Sequence` are recognized calculator contracts; `_sequence` is not.
- Broker chronology is deferred until a documented Gate-C reopen condition occurs.

## Gate-D decisions still active

- Deterministic identity excludes volatile run metadata.
- Source identity excludes user email/id, free-form note and created_at.
- Effective market/FX numeric identity is separate from provider diagnostics.
- Engine identity requires exact full Git SHA.
- Ambiguous/non-finite provenance fails closed.
- Deterministic replay uses explicit timezone-aware calculation clock/as-of.
- Production manifest is additive and compatible with existing Worker/D1/frontend boundaries.

---

# 6. Gate E — Safety & State Integrity

Formal authority:

`docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`

Gate E fixes remaining current-production safety/state-integrity problems without a broad rewrite.

Rejected as the immediate next step:

- generic Schema-3 redesign;
- broker-execution table;
- cash/account ledger;
- broad provider abstraction;
- tenant UUID migration;
- Decimal migration;
- derivatives support;
- GitHub Actions replacement.

---

# 7. Current Post-D Risk Delta

## P0-A — public GitHub calculation dispatch carries tenant email

**ACTIVE remediation: E1a.**

## P0-B — realtime quote can overwrite last historical EOD row

**OPEN. E1b only after E1a closes.**

## P0-C — active job idempotency/recovery lifetime shorter than supported workflow duration

**OPEN. E1c.**

## P0-D — record mutations lack mutation idempotency / optimistic row revision

**OPEN / structural. Conditional Schema-3 E2.**

## P0-E — pagination not bound to one ledger revision

**OPEN / structural. E2.**

## P0-F — calculation jobs do not bind source ledger revision

**OPEN / structural. E2.**

## P0-G — stale calculation can become latest published snapshot

**OPEN / structural. E2 compare-and-publish.**

P1 security/session, tenant identity and market-calendar work remain separate later programs.

---

# 8. Gate-E Master Plan

| Batch | Objective | Status | Schema impact |
|---|---|---|---|
| E0 | Post-D architecture re-baseline | DONE | none |
| E1a-A | Pre-cutover Worker opaque-target compatibility + production deploy | **ACTIVE** | none |
| E1a-B | Remove tenant email from normal public GitHub calculation dispatch | **NEXT after A deployment** | none |
| E1b | Immutable EOD history + explicit realtime valuation | PLANNED | none |
| E1c | Active-job idempotency/recovery lifetime alignment | PLANNED | none unless proven unavoidable |
| E1d | Separate cursor-signing secret from system API auth | PLANNED | none |
| E2-pre | D1 atomicity / Schema-3 pre-migration audit | CONDITIONAL | audit only |
| E2a–E2f | Narrow ledger-revision protocol / rollout | CONDITIONAL after E1 | additive Schema 3 |

---

# 9. E1a — Privacy Objective

Normal user-triggered public GitHub calculation execution must not contain the tenant email in workflow dispatch inputs. The durable Worker calculation job's opaque `public_id` is the public handle; the owner is resolved only on a trusted system boundary.

Gate-C audit-only targeting remains separately scoped and may retain explicit operator email input until that audit path receives its own privacy redesign.

No D1 migration is permitted in E1a.

---

# 10. E1a Rollout BLOCKER and staged decision

## BLOCKER discovered during independent review of prototype PR #172

Worker production deployment is **manual**, not automatic on repository merge:

`.github/workflows/deploy-worker.yml`

requires workflow dispatch with an exact full `main` SHA and deploys only after verifying that SHA is current protected main.

The original all-at-once E1a prototype would have changed GitHub workflow/runner to require system opaque-job lookup at repository merge time, while production Worker could still be the old user-only job-GET implementation until a later manual deployment.

Failure window:

`new workflow/wrapper -> system GET /api/calculation-jobs/:id -> old production Worker -> 403`

User-triggered calculations would fail during that interval.

### Decision

**Do not merge the all-at-once prototype. Use compatibility-first A/B rollout.**

This is a reliability requirement, not scope expansion.

---

# 11. E1a prototype evidence — PR #172, CLOSED / NOT MERGED

PR #172 is retained only as test-first/cutover evidence:

`[SUPERSEDED PROTOTYPE] Gate E E1a-B opaque targeting cutover`

Final prototype head:

`25b43ed852124799b50cf8a7b27d272334c5ccd0`

Important evidence:

- CI #546: intentional test-first red; only missing E1a interfaces + one test precondition.
- CI #552: Worker/Frontend green; Python reduced to two hosted/test-precondition boundaries.
- CI #554: **415 functional tests green**, only unchanged coverage governance blocked new branch debt.
- Added fail-closed API-client branch tests; coverage gate itself unchanged.
- CI #555: full green, Python **418 passed + 18 subtests**, missing branches restored to stable-main **308**, exact combined coverage **82.77302566142829%**.
- Added route-level user/system privacy regressions.
- CI #556: full green.
- independent review confirmed main user logs mask user ids; no new full-email logging introduced.
- no `main.py`, migration, Schema 3, E1b/E1c/E2 changes.

PR #172 was explicitly closed without merge after the deployment-order BLOCKER was identified.

Its implementation ideas must be **reapplied from the deployed E1a-A stable main**, not merged directly.

---

# 12. Current Batch — E1a-A Pre-cutover Worker Compatibility

Branch:

`pr-gate-e-e1a-a-worker-compat`

PR:

**#173 — Gate E E1a-A: pre-cutover Worker opaque-target compatibility**

Base main:

`87b5949a588bb6f655387ded554cb0a69d8a6f95`

Pre-E1a recovery:

`backup-pre-gate-e-e1a-87b5949`

## A objective

Deploy one backward-compatible system-only opaque-job owner lookup **before** the workflow privacy cutover.

The existing production dispatch/workflow/runner remains unchanged during A.

## Implementation

Only active `worker-entry.js` is changed.

Temporary compatibility shim:

- only matches `GET /api/calculation-jobs/job_<opaque-id>`;
- only intercepts when `X-API-KEY` constant-time matches `env.API_SECRET`;
- user/no-key/invalid-key requests continue to canonical `worker.js` behavior;
- system response is narrow:
  - `id`
  - `target_user_id`
  - `benchmark`
  - `status`
- direct query is by opaque `public_id` only;
- invalid/malformed DB state fails closed;
- explicit origin policy is checked before the shim;
- no owner value is logged;
- no schema/dispatch/workflow/runner/CRUD change.

This shim is temporary and must be removed in E1a-B after canonical `worker.js` takes over the same system route.

## A test / CI chronology

- test-first PR head `a155eafce20938a5cfb5707e767e9696193e890a`;
- CI #557: Frontend/Python green; Worker had exactly one expected failure — valid system lookup still received canonical 403;
- implementation commit `7e4423e7033a6cacb9f2f84298f743d3537e8d9e`;
- changed files before this handoff update exactly:
  - `worker-entry.js`
  - `tests/worker_opaque_target_compat.test.mjs`
- CI #558 / run `31344979114`: **SUCCESS across Python / Frontend / Worker-D1**;
- independent review: **PASS / no code-level BLOCKER**;
- protected main remained `87b5949a588bb6f655387ded554cb0a69d8a6f95`; no drift;
- reviews: 0;
- review threads: 0;
- comments: 0.

## A remaining execution sequence

1. This handoff update creates the new final PR head.
2. Run fresh full CI on that exact head.
3. Confirm changed-file whitelist is exactly shim + test + handoff.
4. Re-check reviews/threads/comments/main drift.
5. Mark PR #173 ready and exact-head merge.
6. Verify post-main CI.
7. Create post-E1a-A recovery.
8. **Manually dispatch `Deploy Worker` with the exact verified protected-main SHA.**
9. Verify deployment workflow success, source-commit metadata and health endpoint.
10. Confirm old normal user-triggered dispatch/workflow remains functional; no privacy cutover has happened yet.
11. Only then create fresh E1a-B branch from the deployed stable main.

No production calculation smoke beyond Worker deployment/health is required for A because the calculation dispatch path itself is unchanged. The B cutover requires targeted production smoke.

---

# 13. E1a-B — Next after A is deployed

## Required cutover contract

Recreate from deployed A stable main; do not merge superseded PR #172.

- canonical `worker.js` authorizes system GET `/api/calculation-jobs/:id` while preserving tenant user GET.
- system projection returns narrow owner target; user projection remains owner-free.
- Worker dispatch sends only benchmark + opaque job id, no tenant email.
- normal calculation workflow uses `CALCULATION_JOB_ID`, never `TARGET_USER_ID`.
- thin `tools/run_portfolio_update.py` resolves owner by system Worker lookup before unchanged financial `main.run_update()`.
- hosted GitHub run with no job is all-user and clears stale target state.
- local non-GitHub legacy targeting may remain temporarily compatible.
- temporary `worker-entry.js` A shim is removed because canonical Worker now owns the route.
- Gate-C audit-only target email remains isolated; calculation-job + audit mode remains explicitly rejected.
- no schema migration.

## Required B verification

- reuse/recreate prototype test-first contracts from PR #172;
- fresh full CI;
- independent privacy/security review including Actions log scan;
- handoff + final-head CI;
- exact-head merge/post-main;
- post-B recovery;
- manually deploy exact merged Worker SHA;
- verify Worker deployment metadata/health;
- controlled **user-triggered targeted production calculation smoke** demonstrating opaque targeting end-to-end and no email in normal dispatch inputs/log evidence;
- only then mark E1a DONE and activate E1b.

---

# 14. E1b — Planned: Immutable EOD + Explicit Realtime Valuation

- historical EOD data never mutated by live quote;
- live value/time/source explicit;
- live value affects only eligible current/as-of valuation;
- prior EOD date never relabeled with live quote;
- historical TWR/chart/benchmark invariant to later live quote;
- Gate-D manifest hashes actual effective numeric input;
- no provider abstraction, no D1 migration.

Independent financial review + production smoke required.

---

# 15. E1c — Planned: Active Job Lifetime Alignment

- queued/running job idempotency cannot expire merely by age;
- browser recovery lifetime covers supported workflow runtime + queue/retry margin;
- terminal retry window explicit;
- generation-safe current/tombstone behavior retained;
- prefer no schema change; stop and move to E2-pre if lease state is actually required.

---

# 16. E1d — Planned: Cursor Secret Separation

- cursor HMAC secret separated from system API auth secret;
- controlled compatibility/rotation window;
- cursor scope/tenant binding unchanged;
- no schema migration.

---

# 17. Conditional Schema 3 — Ledger Revision Protocol ONLY

Schema 3 is not open for implementation until E1 closes and E2-pre audits current Cloudflare D1 atomicity semantics from primary documentation.

Authorized conceptual objective only:

`record mutation -> paginated read -> calculation job -> Gate-D source identity -> snapshot publication`

must bind to one monotonic tenant ledger generation.

Phases:

- E2a monotonic tenant ledger revision;
- E2b mutation idempotency + optimistic record revision;
- E2c revision-bound pagination;
- E2d jobs bind requested revision;
- E2e compare-and-publish snapshot/latest pointer;
- E2f additive rollout/cutover/audit/recovery.

Explicit exclusions: broker execution fields/table, tenant UUID, cash/account tables, derivative multipliers, Decimal/fixed-point columns, provider tables.

---

# 18. Deferred Programs

Separate later reviews are required for:

- HttpOnly/SameSite session + removal of browser credential persistence + CSP tightening;
- internal tenant UUID / Google `sub` ownership and scoped service credentials;
- authoritative exchange calendars / benchmark calendar policy;
- first-class broker chronology under Gate-C reopen conditions;
- cash/account NAV;
- provider abstraction;
- Decimal/fixed point;
- derivatives.

---

# 19. Decision Log — Gate E

- **E-D-01 LOCKED:** Gate D CLOSED; final recovery `backup-post-gate-d-2332116`.
- **E-D-02 LOCKED:** old risk register is evidence, not current roadmap.
- **E-D-03 LOCKED:** broad immediate Schema-3/provider/broker/cash redesign rejected.
- **E-D-04 LOCKED:** Gate E Safety & State Integrity is active.
- **E-D-05 REFINED:** E1a requires compatibility-first A/B rollout because Worker deployment is manual and exact-main-SHA gated.
- **E-D-06 LOCKED:** E1a-A changes only the Worker system compatibility boundary; existing email dispatch remains until B.
- **E-D-07 LOCKED:** superseded PR #172 must never be merged; it is B prototype evidence only.
- **E-D-08 NEXT AFTER A DEPLOYMENT:** E1a-B performs the actual privacy cutover from a deployed compatible baseline.
- **E-D-09 PLANNED:** E1b immutable EOD vs realtime valuation.
- **E-D-10 PLANNED:** E1c active job lifetime alignment.
- **E-D-11 PLANNED:** E1d cursor-secret separation.
- **E-D-12 CONDITIONAL:** Schema 3 only for ledger revision after E1 + E2-pre.

---

# 20. Root-Cause / Risk Log

- **RC-E-01 ACTIVE:** normal public GitHub dispatch exposes tenant email → E1a-B; A is the zero-downtime prerequisite.
- **RC-E-01A CONTROLLED:** all-at-once cutover would fail between repo merge and manual Worker deploy → compatibility-first A/B rollout.
- **RC-E-02 OPEN:** realtime quote can mutate prior EOD row → E1b.
- **RC-E-03 OPEN:** active job TTL can expire before supported execution window → E1c.
- **RC-E-04 OPEN:** API secret and cursor signing share one trust key → E1d.
- **RC-E-05 OPEN:** record mutations lack mutation identity/row revision → E2.
- **RC-E-06 OPEN:** pagination not bound to ledger revision → E2.
- **RC-E-07 OPEN:** job not bound to requested ledger revision → E2.
- **RC-E-08 OPEN:** stale calculation can publish latest snapshot → E2.
- **RC-E-09 CONTROLLED:** broker chronology absent but not immediate migration driver under current Gate-C contract.
- **RC-E-10 DEFERRED:** browser credential/CSP and email tenant key require separate security/identity program.

---

# 21. Immediate Next Actions

## Finish E1a-A PR #173

1. Run fresh full CI on the handoff-containing exact head.
2. Confirm whitelist: `worker-entry.js`, `tests/worker_opaque_target_compat.test.mjs`, `to_do_update_list.md` only.
3. Re-check reviews/threads/comments and protected-main drift.
4. Exact-head merge.
5. Verify post-main CI.
6. Create post-E1a-A recovery.
7. Manually dispatch `Deploy Worker` using the exact verified protected-main SHA.
8. Verify deploy workflow, health/source metadata and no schema drift.
9. Do not claim privacy fixed yet; old dispatch intentionally remains during A.

## Then E1a-B only

Create a fresh branch from the **deployed A stable main**, reapply the cutover contracts from superseded PR #172, remove temporary shim, qualify/merge/deploy, and perform targeted production smoke. Only after that activate E1b.
