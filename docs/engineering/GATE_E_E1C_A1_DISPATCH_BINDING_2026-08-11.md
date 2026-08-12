# Gate E / E1c-A.1 — Dispatch Binding and Legacy Orphan Reconciliation

Status: **CLOSED / PRODUCTION VERIFIED**  
Document revision: **5**  
Date: **2026-08-12**

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

The reconciliation cohort was narrowly defined as:

```text
status = queued
AND github_run_id IS NULL
AND created_at < reviewed E1c-A.1 deployment cutover
```

The cutoff is only a rollout-cohort boundary. It is not liveness authority.

Before D1 mutation, the protected workflow proved exact runtime/Worker identity, activation authority, production D1 identity, zero nonterminal `Update Portfolio Data` runs, exact reviewed control-plane blobs, and bounded target cardinality. The mutation only transitioned matching legacy jobs to:

```text
status = failed
error_code = LEGACY_DISPATCH_UNBOUND_RECONCILED
```

It did not delete rows, clear source transactions, mutate snapshots, or record tenant/job identity in evidence. SQLite `changes()` was required to exactly equal the pre-mutation target count. The same reviewer-protected production job then ran the system contract audit.

## 5. R3 review hardening of the reconciliation control plane

The first exact candidate (`ebc27b3d23c19d03be5ad7002845f603400cf4dd`) passed CI #636 but fresh R3 review correctly rejected it before merge.

Three safety defects were identified and fixed rather than waived:

1. **Operation-code source mismatch.** Production checks out exact runtime `R_C1`, which predates the reconciliation tool. The fixed workflow materializes the immutable reviewed workflow-event control-plane commit separately and executes the reconciliation tool from that reviewed commit while the workspace remains the exact runtime checkout for Worker/D1 verification.
2. **Incomplete active-run proof.** First-page inference was replaced by status-scoped GitHub API queries for every supported nonterminal workflow status, using authoritative `total_count`.
3. **Late control-plane drift window.** Immediately before D1 mutation, the workflow re-fetches latest protected main and revalidates request values, activation authority, and exact workflow/tool blob identity.

The reviewed operation tool also records actual mutation cardinality via SQLite `changes()` and requires it to equal the reviewed pre-mutation target count. No safety gate was weakened to obtain CI success.

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

PR #198 remains **SUPERSEDED / NO MERGE AUTHORITY** and must not be reopened or merged.

The first reviewer-approved reconciliation execution (`31479868929`) was cancelled after a GitHub scheduler stall left the production job runnerless and stepless. The one-shot scheduler recovery proved the stall safely, cancelled only that target run, then retired itself. The first successor correctly failed closed after protected main advanced. PR #202 emitted the final fresh reconciliation event without changing the reviewed mutation boundary.

## 7. Final production reconciliation result

Final reconciliation workflow run:

- workflow: `Production Legacy Job Reconciliation #3`;
- run ID: `31518085574`;
- final successful attempt: **attempt 2**;
- production job: `93984614952`;
- conclusion: **SUCCESS**.

Verified mutation result:

```text
target_before = 3
changed       = 3
target_after  = 0
```

All three target rows transitioned only to terminal `failed` with:

`LEGACY_DISPATCH_UNBOUND_RECONCILED`

No transaction or snapshot mutation occurred. The post-mutation production system contract audit passed.

Sanitized artifact:

- artifact ID: `9126247398`;
- SHA-256: `677f2c6ccea36a0b46c68a40c0f21782ac8301523f0c618d603132eefbc39a20`.

The evidence contains no tenant identity or calculation-job identifier.

## 8. Normal authenticated production smoke

After reconciliation and after the fail-closed market-data diagnostic patch reached main, one normal authenticated frontend update was performed.

Result:

- workflow: `Update Portfolio Data #3239`;
- run ID: `31557518956`;
- event: `workflow_dispatch`;
- head: `7439c8fb39ec8885b0b16ffdb46b3996e64dc42f`;
- attempt: `1`;
- conclusion: **SUCCESS**.

Lifecycle proof from the production job log:

1. `Mark calculation job running` succeeded and sent `github_run_id=31557518956`, `github_run_attempt=1` to the production Worker status callback.
2. Calculation fetched the authenticated tenant's records, downloaded required market data, completed calculation/reconciliation, and uploaded the snapshot successfully.
3. `Report calculation job result` sent terminal `status=succeeded` with the same `github_run_id=31557518956`, `github_run_attempt=1` and succeeded.
4. Current Worker repository contract rejects a callback whose GitHub run identity conflicts with the durably bound identity. Therefore successful running and terminal callbacks with the same run ID are production evidence that the new dispatch identity was durably bound consistently before lifecycle advancement.
5. A fresh normal workflow was created instead of being deduplicated into the legacy orphan row, proving the reconciled residue no longer blocks normal frontend dispatch.

Browser-local storage itself is not remotely observable from GitHub evidence. That does not reopen E1c-A.1: the server-side orphan/binding defect is closed, while long-lived browser recovery/age semantics are explicitly the E1c-B scope.

Sanitized closeout evidence:

`docs/governance/evidence/GATE_E_E1C_A1_CLOSEOUT_2026-08-12.json`

## 9. Material residual issue discovered during closeout

Scheduled updates #3237 and #3238 failed with `MARKET_DATA_FAILED` after Yahoo/yfinance returned NaN selected prices for Taiwan market data. This is a real product correctness issue but is independent of E1c-A.1 dispatch binding.

PR #204 added fail-closed provider-row diagnostics only; it does not drop, fill, repair, substitute, or accept invalid prices. Exact-head CI #665, Independent Review, merge, and post-main CI #666 passed. The authenticated smoke #3239 then completed successfully and did not reproduce the NaN condition.

Therefore no semantic price-repair change is currently justified. The next recurrence must be classified from exact provider-row OHLC/Volume/Dividend/Split/Capital-Gain evidence before choosing a financially safe fix.

## 10. Closeout decision and next batch

E1c-A.1 is **CLOSED / PRODUCTION VERIFIED** because:

- the forward runtime binds GitHub run identity before browser acknowledgement;
- conflicting callback identity is fail-closed;
- all reviewed legacy unbound queued residue was reconciled with exact cardinality and system audit;
- one fresh authenticated frontend trigger created a real `workflow_dispatch` run;
- running and terminal callbacks succeeded with the same run identity;
- calculation and snapshot publication succeeded;
- no material E1c-A.1 server lifecycle blocker remains.

Next implementation batch:

`Gate E / E1c-B — frontend lifecycle recovery + retained workflow queue` **ACTIVE**.

E1c-B remains responsible for browser pending-age removal, durable refresh/reopen recovery, ambiguous pre-job idempotency retention, generation/tombstone protections, and retained workflow queue semantics. E1d and Schema 3 remain deferred.

Current execution truth belongs in `to_do_update_list.md`; this record now remains the durable E1c-A.1 RCA/contract/closeout reference.
