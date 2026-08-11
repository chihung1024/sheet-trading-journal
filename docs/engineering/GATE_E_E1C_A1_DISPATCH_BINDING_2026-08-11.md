# Gate E / E1c-A.1 — Dispatch Binding and Legacy Orphan Reconciliation

Status: **DEPLOYED / LEGACY RECONCILIATION ACTIVE**  
Document revision: **2**  
Date: **2026-08-11**

## 1. Production blocker and root cause

After E1c-A Worker runtime `94215c9dfec54a9da80ceac9782a6aca16bee8ad` was deployed, a normal authenticated frontend trigger remained at `計算中...` while repeated GitHub remote-truth checks showed no new `Update Portfolio Data` run. The last prior normal run (#3235 / `31455526265`) had already completed with terminal `succeeded`.

E1c-A's same-tenant/same-benchmark active guard correctly prevented duplicate dispatch, but production exposed a rollout residue: a legacy `queued` durable row without `github_run_id` is indistinguishable from a legitimate pre-binding queued job unless an external durable run identity exists.

Before E1c-A.1, Worker dispatch used GitHub API version `2022-11-28`; `github_run_id` was populated only when the workflow later reached the system `running` callback. That created a blind interval and allowed historical `queued + github_run_id IS NULL` residue when a workflow never reached the callback.

## 2. E1c-A.1 forward runtime correction

Merged runtime source:

`R_C1 = fe5f091fdb2c92970dff74c1a7c99052084adb95`

The correction:

1. uses GitHub REST API `2026-03-10`;
2. requires HTTP 200 plus a positive `workflow_run_id`;
3. fails closed on legacy 204 or malformed/missing dispatch identity;
4. durably binds the returned run ID before browser HTTP 202 acknowledgement;
5. makes same-run binding idempotent and conflicting run identity fail closed;
6. prevents workflow callbacks from overwriting an already-bound different run ID;
7. preserves lifecycle-based exact-key and same-tenant/same-benchmark active protection;
8. preserves different benchmark as a distinct calculation intent;
9. changes no tenant/public job projection and no financial calculation path.

The rejected 60-second orphan heuristic remains **BLOCKED / SUPERSEDED**. Age is not liveness authority.

## 3. Production activation evidence

Production Identity Evidence #15 / run `31473362171` passed for exact `R_C1`.

Activation authority was merged in PR #195:

`A_C1 = baa07bafe4d3438abf488bcca703aa4848975083`

Autonomous deployment transport PR #196 then merged on protected main:

`67b873529ab4cd063ec9d0b7d5c1d30bbb4b8ffc`

The deployment request broker automatically created Deploy Worker #4 / run `31475347673`; the operator did not manually select the workflow or paste the runtime SHA.

Deploy #4 production evidence:

- exact runtime checkout: `R_C1`;
- Worker tests: 162 PASS / 0 FAIL;
- production D1 identity: PASS;
- remote D1 migrations: none;
- schema remains 2;
- Worker version: `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- stable production contract: 3 consecutive PASS;
- post-deploy artifact ID `9095595916`;
- artifact ZIP SHA-256 `665cb83a56a6dc36f49df7759c09df978b9b5a44b73757441d2fac94d4aa3497`, independently recomputed and matched;
- deploy artifact is public-contract evidence only (`system_checks=skipped`).

Sanitized durable deployment evidence:

`docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`

## 4. Legacy production residue — controlled reconciliation

The forward fix intentionally does **not** guess that a legacy row is dead because it is old.

The reconciliation cohort is narrowly defined as:

```text
status = queued
AND github_run_id IS NULL
AND created_at < reviewed E1c-A.1 deployment cutover
```

The cutoff is only a rollout-cohort boundary. It is not liveness authority.

Before the D1 mutation, the protected workflow must additionally prove:

- exact runtime `R_C1` is live;
- current production activation authority still authorizes `R_C1`;
- production D1 identity matches reviewed authority;
- `Update Portfolio Data` has zero active runs;
- zero-active state is observed three consecutive times and again immediately before mutation;
- candidate row count does not exceed the reviewed `max_rows`.

The mutation only transitions matching legacy jobs to:

```text
status = failed
error_code = LEGACY_DISPATCH_UNBOUND_RECONCILED
```

It does not delete rows, clear source transactions, mutate snapshots, or record tenant/job identity in evidence. The operation is idempotent: once reconciled, the target query returns zero rows.

The same reviewer-protected production job then runs `verify_production_contract.mjs` with `REQUIRE_SYSTEM_CHECKS=1`, so reconciliation and post-mutation system contract proof share one production approval instead of creating another manual gate.

## 5. Current production-control batch

Request:

`config/production-legacy-job-reconciliation-request.json`

Workflow:

`.github/workflows/production-legacy-job-reconciliation.yml`

Recovery before this control-plane batch:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Risk remains **R3 — production lifecycle/data-control operation**.

The workflow is event-driven from a reviewed protected-main request. It does not require the operator to find an Action, choose a SHA, or press Run workflow. The GitHub `production` Environment Required Reviewer remains the only independent human mutation gate.

## 6. Required closeout sequence

```text
review + merge reconciliation request/control plane
-> event-driven reconciliation workflow
-> production environment approval
-> legacy cohort reconciliation
-> post-mutation system contract audit
-> confirm stuck frontend generation reaches terminal/clears
-> one normal authenticated frontend update
-> prove new dispatch has durable GitHub run binding and terminal callback
-> E1c-A.1 CLOSED / PRODUCTION VERIFIED
-> E1c-B ACTIVE
```

E1c-B remains responsible for frontend pending-age removal and `update.yml` queue semantics. E1d and Schema 3 remain out of scope.
