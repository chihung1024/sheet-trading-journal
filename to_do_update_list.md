# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical detail belongs in engineering/evidence records and Git history.

Last updated: **2026-08-11**  
Handoff revision: **E1c-A.1 / reconciliation workflow waiting for production approval**

---

## 1. Current Production / Control-Plane Truth

Repository: `chihung1024/sheet-trading-journal`

Protected-main control-plane HEAD at this handoff:

`8f9f942cc22b70e5bbec0f05438b0a74fefb8057` — merge of PR #197.

Deployed production Worker runtime:

`R_C1 = fe5f091fdb2c92970dff74c1a7c99052084adb95`

Production activation authority:

`A_C1 = baa07bafe4d3438abf488bcca703aa4848975083`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract remains:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Deploy Worker #4 / run `31475347673`: **SUCCESS**.

- exact runtime source `R_C1`;
- Worker tests 162 PASS / 0 FAIL;
- production D1 identity PASS;
- remote migrations: none;
- stable production contract: 3 consecutive PASS;
- post-deploy artifact `9095595916`;
- independently verified ZIP SHA-256: `665cb83a56a6dc36f49df7759c09df978b9b5a44b73757441d2fac94d4aa3497`.

Durable deploy evidence:

`docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`

**Always re-read protected `main` and the active workflow run before acting.**

---

## 2. Current Gate State

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a-A compatibility activation: `CLOSED / PRODUCTION VERIFIED`.
- E1a-B opaque/email-free privacy cutover: `CLOSED / PRODUCTION VERIFIED`.
- E1b historical EOD / realtime valuation integrity: `CLOSED / PRODUCTION VERIFIED`.
- E1c-A server-first lifecycle compatibility: `DEPLOYED`.
- E1c-A.1 durable GitHub dispatch binding: **`DEPLOYED / LEGACY RECONCILIATION WAITING FOR PRODUCTION APPROVAL`**.
- E1c-B frontend lifecycle + workflow pending queue: `DEFERRED UNTIL E1c-A.1 CLOSEOUT`.
- E1d cursor-signing secret separation: `PLANNED`.
- Schema 3 / E2: `DEFERRED`.

Primary E1c-A.1 record:

`docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`

---

## 3. Production Finding Being Closed

A normal authenticated frontend trigger after E1c-A remained at `計算中...`, while repeated GitHub checks showed no new `Update Portfolio Data` run. The last prior normal run (#3235 / `31455526265`) had already completed with terminal `succeeded`.

Production therefore exposed a legacy rollout residue:

```text
legacy durable calculation job
status = queued
github_run_id = NULL
-> active-job guard correctly prevents duplicate dispatch
-> browser keeps polling durable active job
-> no GitHub workflow exists to advance it
```

E1c-A.1 prevents new occurrences by requiring GitHub HTTP 200 + `workflow_run_id` and binding that run identity durably before browser acknowledgement.

Do **not** restore age-based active-job expiry. Age is not liveness authority.

---

## 4. Reconciliation Control Plane — MERGED / REVIEWED

PR #197 is the authoritative reconciliation implementation.

Final candidate:

`dca0ae34495da8cf8b52d4bf6d27411e38ac166a`

Evidence:

- first candidate `ebc27b3d23c19d03be5ad7002845f603400cf4dd` passed CI #636 but fresh R3 review found production-control BLOCKERs;
- blockers were fixed, not waived;
- exact-head CI #637: **SUCCESS**;
- fresh R3 Same-AI Independent Review: **PASS / NO BLOCKER**;
- expected-head merge: `8f9f942cc22b70e5bbec0f05438b0a74fefb8057`;
- post-main CI #638: **SUCCESS**.

The merged control plane protects all of the following:

- immutable reviewed operation-code/workflow materialization;
- latest-main workflow/tool blob equality before mutation;
- latest request-value and activation-authority rechecks;
- exact live Worker source/version verification;
- production D1 identity verification;
- complete nonterminal `Update Portfolio Data` proof for `queued`, `in_progress`, `waiting`, `pending`, and `requested`;
- zero-nonterminal proof before reviewer gate, 3 consecutive observations after approval, and one final observation immediately before mutation;
- target cohort only `queued + github_run_id IS NULL + pre-cutover`;
- reviewed `max_rows` bound;
- mutation only `queued -> failed` with `LEGACY_DISPATCH_UNBOUND_RECONCILED`;
- SQLite `changes()` must equal reviewed target cardinality;
- no DELETE, transaction/snapshot mutation, tenant identity, or calculation-job ID in evidence;
- same production approval also runs `REQUIRE_SYSTEM_CHECKS=1` contract audit.

Recovery:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

### Superseded candidate

PR #198 was opened from stale base after #197 had already merged. Relative to current main it would have weakened #197's stronger controls, so it was closed as:

`SUPERSEDED / NO MERGE AUTHORITY`

Do not reopen or merge PR #198.

---

## 5. Active Workflow — Exact Current State

Event-driven workflow:

`Production Legacy Job Reconciliation #1`

Run ID:

`31479868929`

Head/control-plane SHA:

`8f9f942cc22b70e5bbec0f05438b0a74fefb8057`

Current state at this handoff:

- preflight job `Verify reconciliation request before reviewer gate`: **SUCCESS**;
- request validation: PASS;
- exact activation authority before reviewer gate: PASS;
- zero nonterminal `Update Portfolio Data` proof before reviewer gate: PASS;
- production job `Reconcile legacy unbound queued jobs and audit production`: **WAITING** on GitHub `production` Environment Required Reviewer.

No additional workflow start, SHA entry, rerun, or manual D1 operation is required.

---

## 6. Next Exact Sequence

The only external action still required by repository policy is the independent GitHub `production` Environment approval for run `31479868929`. The current connector does not expose that approval mutation.

After approval, continue automatically:

```text
run #1 production job
-> revalidate latest request / reviewed operation code / authority
-> verify live Worker source + Worker version
-> verify production D1 identity
-> prove zero nonterminal update runs repeatedly
-> final request/code/authority/active-run gate
-> bounded legacy queued-job reconciliation
-> system contract audit
-> verify sanitized artifact + digest
-> verify stuck browser generation reaches terminal / clears
-> one normal authenticated frontend update
-> prove new workflow_run_id durable binding + running/terminal callbacks
-> E1c-A.1 closeout evidence/docs
-> E1c-B ACTIVE
```

Do **not**:

- re-run E1a/E1b identity/audit/smoke loops;
- manually run or recreate the reconciliation workflow;
- manually delete or rewrite D1 calculation jobs;
- use elapsed age alone as liveness authority;
- ask the operator to select normal Actions workflows or paste runtime SHAs;
- reopen Schema 3, E1d, broad ledger/provider redesign, Decimal migration, tenant UUID migration, or unrelated product work.

---

## 7. GitHub Actions Automation Boundary

PR #196 made normal Worker deployment transport event-driven:

```text
reviewed deployment request
-> Production Deployment Dispatch Broker
-> canonical Deploy Worker
```

Broker #1 successfully created Deploy Worker #4 automatically. Normal deployment no longer requires manual `Run workflow`, SHA entry, or run discovery.

The only retained manual boundary is GitHub `production` Environment Required Reviewer approval. It is an independent production-secret release gate, not a workflow-transport task, and must not be bypassed by bot self-approval or admin override.

Engineering record:

`docs/engineering/PRODUCTION_ACTIONS_AUTONOMOUS_DISPATCH_2026-08-11.md`

Read-only Production Identity Evidence auto-start remains a separate automation FOLLOW-UP after the current E1c-A.1 correctness closeout.

---

## 8. High-Value Evidence / Recovery References

Preserve at minimum:

- E1a closeout records and recoveries from PR #185–#189;
- E1b PR #190, smoke #3230 / `31453892608`, and `backup-post-e1b-closeout-624b40f`;
- E1c-A PR #192 and runtime `94215c9dfec54a9da80ceac9782a6aca16bee8ad`;
- E1c-A.1 PR #194 and runtime `R_C1`;
- Production Identity Evidence #15 / `31473362171`;
- activation authority PR #195 / `A_C1`;
- PR #196 autonomous dispatch and `backup-post-actions-autonomous-dispatch-67b8735`;
- Deploy Worker #4 / `31475347673`;
- Worker version `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- deploy artifact `9095595916` + verified digest;
- PR #197 final candidate `dca0ae34495da8cf8b52d4bf6d27411e38ac166a`;
- reconciliation run #1 / `31479868929`;
- `backup-pre-e1c-a1-legacy-reconciliation-67b8735`;
- PR #198 as superseded forensic evidence only.

Failed/superseded candidates and Pages #1482 remain forensic evidence. Do not erase or restate them as successes.

---

## 9. Documentation Quality Rule

Every material batch updates durable documentation **during execution**, not only at conversational closeout:

- stable architecture/usage -> `README.md` or stable docs only when the stable contract changes;
- governance -> `AI_PROJECT_PLAYBOOK.md` only under a valid governance reopen condition;
- current execution truth -> this file;
- root cause / invariants / rejected alternatives -> engineering record;
- production facts -> sanitized evidence JSON;
- completed historical detail -> dedicated closeout/evidence record, not live handoff prose.

When remote truth advances, remove completed actions from the "next" section promptly. Prefer exact remote identifiers and compact evidence references over duplicated narrative.
