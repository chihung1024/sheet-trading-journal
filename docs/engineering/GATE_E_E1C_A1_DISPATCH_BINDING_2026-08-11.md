# Gate E / E1c-A.1 — Dispatch Binding and Legacy Orphan Reconciliation

Status: **IMPLEMENTATION CANDIDATE**  
Date: **2026-08-11**

## 1. Production blocker

After E1c-A Worker runtime `94215c9dfec54a9da80ceac9782a6aca16bee8ad` was deployed and reached stable production contract, a normal authenticated frontend trigger remained at `計算中...`. Repeated GitHub remote-truth checks showed no new `Update Portfolio Data` run. The latest existing run (#3235 / `31455526265`) had completed successfully with a terminal `succeeded` callback before the E1c-A deployment.

The frontend had therefore received and was polling an existing durable active job, while GitHub had no corresponding newly created workflow. E1c-A's server-first cross-key guard prevented duplicate work as designed, but production exposed a rollout residue: a legacy durable `queued` row without a durable GitHub run identity can remain indistinguishable from a legitimately pending pre-binding job.

## 2. Root cause

Before this hotfix, the Worker dispatched `update.yml` using GitHub REST API version `2022-11-28` and treated any HTTP success as sufficient. The Worker recorded only the GitHub request ID. `calculation_jobs.github_run_id` was populated later, when the workflow itself reached the system-only `running` callback.

That leaves a blind interval for every queued job and leaves historical `queued + github_run_id IS NULL` residue with no positive dispatch identity if the workflow never reaches its first callback.

GitHub REST API version `2026-03-10` returns HTTP 200 with `workflow_run_id` for a successful workflow dispatch. Schema 2 already contains the `github_run_id` column, so the forward fix needs no D1 schema migration.

## 3. Locked E1c-A.1 runtime correction — future dispatch binding

1. Worker workflow dispatch uses GitHub API version `2026-03-10`.
2. A dispatch is accepted only when GitHub returns HTTP 200 and a valid positive `workflow_run_id`.
3. Legacy HTTP 204 or malformed/missing run identity is treated as an invalid upstream response and fails closed.
4. The returned run ID is durably bound into the calculation job before the Worker returns HTTP 202 to the browser.
5. Binding is idempotent for the same run ID and conflicts if the durable row already carries a different run ID.
6. Exact idempotency-key replay remains first-class and active exact-key jobs never expire by elapsed age.
7. E1c-A's active same-tenant/same-benchmark cross-key guard remains lifecycle-based for `queued/running`; this hotfix does **not** reintroduce an age heuristic to decide whether a legacy active row is dead.
8. Different benchmark remains a distinct calculation intent.
9. Public job projection remains unchanged; GitHub run identity is not exposed to the tenant-facing response.

## 4. Explicitly rejected candidate

An earlier E1c-A.1 prototype considered ignoring `queued + github_run_id IS NULL` rows after a 60-second grace. Targeted tests passed, but rollout review rejected that design before PR creation.

Reason: a legitimately accepted workflow can remain pending for longer than 60 seconds. Treating an unbound queued row as dead by elapsed time would recreate the same class of lifecycle bug E1c is intended to remove.

The 60-second prototype is **BLOCKED / SUPERSEDED** and has no merge authority.

## 5. Legacy production residue — controlled reconciliation, not runtime guessing

The currently observed legacy orphan must be reconciled separately from the forward runtime fix.

The safe order is:

```text
merge + production-deploy forward dispatch binding
-> prove new Worker stable
-> controlled production reconciliation of legacy queued/unbound rows
   only under explicit exact-source authority and live GitHub-run checks
-> normal frontend retry/smoke
-> E1c-A.1 production verification
-> E1c-B
```

The reconciliation must not infer liveness from age alone. Before mutating legacy rows it must prove there is no corresponding live `Update Portfolio Data` workflow that could still legitimately advance the row. The reconciliation is a production-control operation and requires the same reviewer-protected mutation discipline as Worker deployment.

## 6. Scope

Runtime implementation scope:

- `worker.js`
- `tests/worker_dispatch.test.mjs`
- `tests/worker_calculation_jobs.test.mjs`
- this engineering record

Explicitly unchanged in the runtime hotfix:

- frontend pending TTL / generation semantics
- `.github/workflows/update.yml` concurrency
- D1 schema / migrations
- financial calculation code
- E1d cursor-signing secret
- tenant/public job projection

A later activation/control-plane batch may add the narrowly authorized one-time legacy reconciliation after the exact runtime SHA is known. That control-plane work is not runtime merge authority for this candidate.

## 7. Risk and recovery

**R3 — production lifecycle / dispatch identity / duplicate-execution correctness.**

A defect can duplicate work, suppress a legitimate active calculation, or report dispatch success without a durable run identity.

Recovery: `backup-pre-e1c-a1-dispatch-binding-6e4e464`.

Required before merge:

- exact 4-file runtime/doc scope;
- full repository exact-head CI;
- successful dispatch requires HTTP 200 + valid `workflow_run_id`;
- invalid/missing run identity fails closed;
- run binding same-ID idempotency and conflicting-ID rejection;
- existing exact-key and cross-key active lifecycle protections remain intact without age expiry;
- dispatch timeout/running race regression remains PASS;
- fresh R3 Same-AI Independent Review;
- expected-head merge only.

Required after merge:

- fresh exact-source production identity and activation authority;
- exact-source Worker deployment;
- controlled legacy orphan reconciliation under explicit production authority;
- normal frontend terminal smoke proving a new workflow is durably bound and reaches terminal state.

E1c-B remains deferred until E1c-A.1 is production verified.
