# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical detail belongs in dedicated engineering/evidence records and Git history.

Last updated: **2026-08-11**  
Handoff revision: **E1c-A.1 / legacy reconciliation request**

---

## 1. Current Production Truth

Repository: `chihung1024/sheet-trading-journal`

Latest verified protected-main control-plane base before the reconciliation request batch:

`67b873529ab4cd063ec9d0b7d5c1d30bbb4b8ffc` — PR #196 autonomous production dispatch.

**Always re-read protected `main` before acting; do not assume this base remains HEAD after the reconciliation PR merges.**

Deployed production Worker runtime:

`R_C1 = fe5f091fdb2c92970dff74c1a7c99052084adb95`

Production activation authority for that runtime:

`A_C1 = baa07bafe4d3438abf488bcca703aa4848975083`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract remains:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Deploy Worker #4 / run `31475347673`: **SUCCESS**.

- exact runtime source: `R_C1`;
- Worker tests: 162 PASS / 0 FAIL;
- production D1 identity: PASS;
- remote migrations: none;
- stable production contract: 3 consecutive PASS;
- post-deploy artifact: `9095595916`;
- independently verified ZIP SHA-256:
  `665cb83a56a6dc36f49df7759c09df978b9b5a44b73757441d2fac94d4aa3497`.

Durable sanitized deployment evidence:

`docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`

---

## 2. Current Gate State

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a-A compatibility activation: `CLOSED / PRODUCTION VERIFIED`.
- E1a-B opaque/email-free privacy cutover: `CLOSED / PRODUCTION VERIFIED`.
- E1b historical EOD / realtime valuation integrity: `CLOSED / PRODUCTION VERIFIED`.
- E1c-A server-first active-job lifecycle compatibility: `DEPLOYED`.
- E1c-A.1 durable GitHub dispatch binding: **`DEPLOYED / LEGACY RECONCILIATION ACTIVE`**.
- E1c-B frontend lifecycle + workflow pending queue: `DEFERRED UNTIL E1c-A.1 CLOSEOUT`.
- E1d cursor-signing secret separation: `PLANNED`.
- Schema 3 / E2: `DEFERRED`.

Primary engineering record:

`docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`

---

## 3. Current Production Blocker

A normal authenticated frontend request after E1c-A deployment remained at `計算中...`, while GitHub had no corresponding new `Update Portfolio Data` workflow.

The production finding is a **legacy rollout residue**, not a reason to restore age-based expiry:

```text
legacy durable calculation job
status = queued
github_run_id = NULL
-> E1c-A active guard correctly prevents duplicate dispatch
-> browser keeps polling durable active job
-> no GitHub workflow exists to advance it
```

E1c-A.1 prevents new occurrences by requiring GitHub HTTP 200 + `workflow_run_id` and binding that run ID before user acknowledgement.

The remaining pre-cutover residue must be reconciled explicitly.

---

## 4. Active Batch — Controlled Legacy Reconciliation

Risk: **R3 production lifecycle/data-control operation**.

Recovery:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Request:

`config/production-legacy-job-reconciliation-request.json`

Event-driven workflow:

`.github/workflows/production-legacy-job-reconciliation.yml`

Target contract:

```text
status = queued
AND github_run_id IS NULL
AND created_at < reviewed E1c-A.1 deployment cutoff
```

The cutoff defines the rollout cohort only. **Age is not liveness authority.**

Before mutation the workflow must:

1. verify exact `R_C1` activation authority from latest protected main;
2. verify live Worker exact-source contract;
3. verify production D1 identity;
4. prove `Update Portfolio Data` has zero active runs;
5. obtain three consecutive zero-active observations and one final observation immediately before mutation;
6. fail closed if target count exceeds reviewed `max_rows`.

Mutation:

```text
queued legacy target
-> failed
error_code = LEGACY_DISPATCH_UNBOUND_RECONCILED
```

No DELETE. No transaction/snapshot mutation. No tenant/job identifiers in evidence.

The same production approval also runs system contract audit with `REQUIRE_SYSTEM_CHECKS=1`.

---

## 5. Required Next Sequence

```text
merge reviewed reconciliation request/control-plane PR
-> workflow auto-starts from protected-main push
-> GitHub production Required Reviewer approval
-> reconcile legacy unbound queued cohort
-> system contract audit
-> verify sanitized artifact/digest
-> confirm stuck frontend generation reaches terminal/clears
-> one normal authenticated frontend update
-> verify new workflow_run_id durable binding + running/terminal callbacks
-> E1c-A.1 closeout evidence/docs
-> E1c-B ACTIVE
```

Do **not**:

- re-run E1a/E1b identity/audit/smoke loops;
- use elapsed age alone to expire active jobs;
- manually delete D1 calculation jobs;
- ask the operator to select normal GitHub Actions workflows or paste runtime SHA;
- reopen Schema 3, E1d, broad ledger/provider work, Decimal migration, tenant UUID migration, or unrelated product changes.

---

## 6. Production Actions Automation

PR #196 changed normal Worker deployment transport to event-driven:

```text
reviewed deployment request
-> broker
-> canonical Deploy Worker
```

Broker #1 successfully created Deploy Worker #4 automatically.

Normal deployment no longer requires manual `Run workflow` or SHA entry.

The only retained manual GitHub step is the repository `production` Environment Required Reviewer approval, because it is an independent production-secret release gate and the current connector does not expose an approval mutation.

Engineering record:

`docs/engineering/PRODUCTION_ACTIONS_AUTONOMOUS_DISPATCH_2026-08-11.md`

Production Identity Evidence auto-start remains a separate automation FOLLOW-UP after the current E1c-A.1 correctness closeout.

---

## 7. High-Value Evidence / Recovery References

Preserve:

- E1a closeout records and recoveries from PR #185–#189;
- E1b PR #190, production smoke #3230 / `31453892608`, and `backup-post-e1b-closeout-624b40f`;
- E1c-A implementation PR #192 and runtime `94215c9dfec54a9da80ceac9782a6aca16bee8ad`;
- E1c-A.1 PR #194 and runtime `R_C1`;
- Production Identity Evidence #15 / `31473362171`;
- activation authority PR #195 / `A_C1`;
- PR #196 autonomous dispatch and `backup-post-actions-autonomous-dispatch-67b8735`;
- Deploy Worker #4 / `31475347673`;
- Worker version `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- deploy artifact `9095595916` and verified digest;
- `backup-pre-e1c-a1-legacy-reconciliation-67b8735`.

Failed/superseded candidates and Pages #1482 remain forensic evidence. Do not erase them or restate them as successes.

---

## 8. Documentation Quality Rule

Every material batch must update the appropriate durable documentation **during the batch**, not only after conversation closeout:

- stable architecture/usage -> `README.md` or stable docs only when the stable contract changes;
- governance -> `AI_PROJECT_PLAYBOOK.md` only under a valid governance reopen condition;
- current execution truth -> this file;
- root cause / invariants / rejected alternatives -> engineering record;
- production facts -> sanitized evidence JSON;
- completed historical detail -> dedicated closeout/evidence record, not live handoff prose.

Remove stale current-state claims when superseded. Prefer exact remote identifiers and evidence links over narrative repetition.
