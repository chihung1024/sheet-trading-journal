# Gate E / E1c-A.1 — Dispatch Binding and Legacy Orphan Reconciliation

Status: **DEPLOYED / RECONCILIATION WORKFLOW WAITING FOR PRODUCTION APPROVAL**  
Document revision: **4**  
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

Before the D1 mutation, the protected workflow must prove:

- exact runtime `R_C1` is live;
- live Worker version matches reviewed Deploy #4 evidence;
- current production activation authority still authorizes `R_C1`;
- production D1 identity matches reviewed authority;
- every GitHub nonterminal status for `Update Portfolio Data` is empty: `queued`, `in_progress`, `waiting`, `pending`, `requested`;
- zero-nonterminal state is observed three consecutive times and again immediately before mutation;
- reviewed request values and reviewed operation-code/workflow blobs still match latest protected main;
- candidate row count does not exceed reviewed `max_rows`.

The mutation only transitions matching legacy jobs to:

```text
status = failed
error_code = LEGACY_DISPATCH_UNBOUND_RECONCILED
```

It does not delete rows, clear source transactions, mutate snapshots, or record tenant/job identity in evidence. SQLite `changes()` must exactly equal the pre-mutation target count; a cardinality mismatch fails closed instead of inferring mutations from before/after counts. The operation is idempotent: once reconciled, the target query returns zero rows.

The same reviewer-protected production job then runs `verify_production_contract.mjs` with `REQUIRE_SYSTEM_CHECKS=1`, so reconciliation and post-mutation system contract proof share one production approval instead of creating another manual gate.

## 5. R3 review hardening of the reconciliation control plane

The first exact candidate (`ebc27b3d23c19d03be5ad7002845f603400cf4dd`) passed CI #636 but fresh R3 review correctly rejected it before merge.

Three safety defects were identified and fixed rather than waived:

1. **Operation-code source mismatch.** Production checks out exact runtime `R_C1`, which predates the new reconciliation tool. The fixed workflow materializes the immutable reviewed workflow-event control-plane commit separately and executes the reconciliation tool from that reviewed commit while the workspace remains the exact runtime checkout for Worker/D1 verification.
2. **Incomplete active-run proof.** First-page `per_page=100` inference was replaced by status-scoped GitHub API queries for every supported nonterminal workflow status. Each status query uses authoritative `total_count`, so the proof does not depend on recency ordering or pagination position.
3. **Late control-plane drift window.** Immediately before D1 mutation, the workflow re-fetches latest protected main, revalidates request values, activation authority, and exact blob identity of both the reviewed workflow and mutation tool. Any request/code drift cancels the old operation.

The reviewed operation tool also records actual mutation cardinality via SQLite `changes()` and requires it to equal the reviewed pre-mutation target count.

No safety gate was weakened to obtain CI success.

## 6. Final merged reconciliation control plane

Authoritative PR: **#197**.

Final candidate:

`dca0ae34495da8cf8b52d4bf6d27411e38ac166a`

Verification chain:

- exact-head CI #637: **SUCCESS**;
- fresh R3 Same-AI Independent Review: **PASS / NO BLOCKER**;
- expected-head merge: `8f9f942cc22b70e5bbec0f05438b0a74fefb8057`;
- post-main CI #638: **SUCCESS**.

Recovery before the control-plane batch:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Risk remains **R3 — production lifecycle/data-control operation**.

### Superseded PR #198

PR #198 was created from stale base after #197 had already merged. Relative to the new protected main it would have replaced #197's stronger workflow/tool controls with a weaker candidate. It was therefore closed as:

`SUPERSEDED / NO MERGE AUTHORITY`

The branch may remain forensic evidence of earlier pre-PR findings, but it must not be reopened or merged.

## 7. Live production workflow state

PR #197's request-path merge automatically started:

`Production Legacy Job Reconciliation #1`

Run ID:

`31479868929`

Control-plane head:

`8f9f942cc22b70e5bbec0f05438b0a74fefb8057`

Current verified state:

- preflight job `Verify reconciliation request before reviewer gate`: **SUCCESS**;
- exact protected-main request validation: PASS;
- activation authority before reviewer gate: PASS;
- zero nonterminal `Update Portfolio Data` proof before reviewer gate: PASS;
- production job `Reconcile legacy unbound queued jobs and audit production`: **WAITING** for GitHub `production` Environment Required Reviewer.

No additional Action start, SHA entry, rerun, or manual D1 operation is required.

## 8. Remaining closeout sequence

```text
production Environment approval for run 31479868929
-> revalidate latest request / reviewed operation code / authority
-> verify live Worker source + reviewed Worker version
-> verify production D1 identity
-> repeated + final zero-nonterminal-run proof
-> bounded legacy cohort reconciliation
-> post-mutation system contract audit
-> verify sanitized artifact and digest
-> confirm stuck frontend generation reaches terminal / clears
-> one normal authenticated frontend update
-> prove new dispatch has durable workflow_run_id + running/terminal callbacks
-> E1c-A.1 closeout evidence/docs
-> E1c-B ACTIVE
```

E1c-B remains responsible for frontend pending-age removal and `update.yml` queue semantics. E1d and Schema 3 remain out of scope.

## 9. Documentation / continuation contract

This engineering record owns root cause, safety invariants, rejected alternatives, review findings, and production-control evidence for E1c-A.1. Current execution status belongs in `to_do_update_list.md`; production results belong in sanitized evidence JSON.

When reconciliation run #1 completes, update this document to a final closeout revision instead of appending duplicate narrative. Remove stale "waiting" language, record the exact reconciliation result/artifact/digest, then advance the handoff to E1c-B only after the final authenticated dispatch-binding smoke passes.
