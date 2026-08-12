# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority.

Last updated: **2026-08-12**
Handoff revision: **PRODUCT-FIRST REBASE / E1c-A.1 external closeout blocker / E1c-B next functional batch**

---

## 1. Primary Product Goal

Deliver a reliable Trading Journal user flow:

```text
login
→ view/manage transactions
→ trigger portfolio update
→ observe durable calculation progress
→ recover after refresh/reopen
→ publish/read correct holdings and performance
→ surface actionable success/failure state
```

The project goal is product correctness and usability. Governance, CI/CD, deployment tooling, audit evidence, and documentation exist only to support that goal.

---

## 2. Single Active Functional Line

### Current functional phase

`Gate E / E1c — calculation job lifecycle and idempotency`

### Current functional batch

`E1c-B — frontend lifecycle recovery + retained workflow queue`

Status: **READY FOR IMPLEMENTATION AFTER E1c-A.1 PRODUCTION CLOSEOUT**

Locked product behavior:

1. active calculation recovery must not disappear solely because 15 minutes elapsed;
2. a known `jobId` remains recoverable across refresh/reopen until durable terminal or explicit 404 semantics;
3. ambiguous pre-job mutation state must retain/replay the same idempotency key until server outcome is resolved;
4. generation/tombstone owner and cross-tab protections remain intact;
5. pending workflow runs must not be silently displaced before lifecycle callback while repository-wide serialized calculation execution is preserved.

Primary implementation surfaces:

- `src/services/calculationJobState.js`
- `src/stores/portfolio.js`
- `.github/workflows/update.yml`
- existing relevant lifecycle tests, especially `tests/worker_frontend_job_state.test.mjs`

Out of E1c-B:

- Worker lifecycle redesign;
- D1 Schema 3;
- ledger revision / compare-and-publish;
- cursor-signing redesign;
- provider redesign;
- Decimal migration;
- tenant UUID migration;
- broad CI/CD or governance redesign.

---

## 3. External Production Blocker — Bounded, Not the Product Roadmap

E1c-A.1 production closeout is waiting on GitHub `production` Environment Required Reviewer approval.

Current reviewed reconciliation run:

- workflow: `Production Legacy Job Reconciliation #3`
- run: `31518085574`
- head: `b022a0a50145d3c91deb21d52f7ac0696332c932`
- preflight: **SUCCESS**
- production job: **WAITING** on required reviewer approval

This is an external release gate only. Do not expand it into additional scheduler, recovery, audit, or deployment framework work unless new Critical evidence appears.

After approval:

```text
verify reconciliation result + sanitized artifact + bounded mutation + production contract audit
→ verify legacy stuck browser generation reaches terminal/clears
→ perform one normal authenticated update
→ prove durable workflow_run_id binding and running/terminal callbacks
→ close E1c-A.1
→ activate E1c-B implementation
```

Do not rerun blindly, bypass the Environment reviewer, manually rewrite D1 jobs, or advance protected main in a way that invalidates reconciliation freshness while the run remains pending.

---

## 4. Product-First Priority Queue

### NOW

- Finish E1c-A.1 only to the minimum evidence required for safe closeout.
- Implement and validate E1c-B product lifecycle behavior.
- Keep user-visible calculation status/recovery coherent across refresh, long queue time, and terminal outcomes.

### NEXT

After E1c-B closes, run a focused Product Functionality Review over:

```text
login
→ records CRUD
→ calculation trigger
→ progress/recovery
→ snapshot refresh
→ holdings/P&L/performance/benchmark display
```

Select the next batch from real user-impact or calculation-correctness findings only.

### BACKLOG

Potential future work remains evidence-driven, including Schema 3, ledger revision, cursor-secret separation, Decimal/fixed-point migration, provider redesign, tenant UUID migration, and historical remediation-plan candidates.

### REJECT FOR CURRENT PHASE

- more reconciliation framework;
- scheduler-recovery framework expansion;
- CI/CD beautification without a current product blocker;
- governance/document proliferation;
- broad architecture rewrite;
- reopening already-closed E1a/E1b work without new evidence.

---

## 5. Stable Production State

Deployed Worker runtime source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Deploy Worker #4 / run `31475347673`: **SUCCESS**.

Durable deploy evidence:

`docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`

Recovery reference:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Always re-check remote truth before production-affecting action.

---

## 6. Locked Decisions

- Age alone is not liveness authority for active `queued` / `running` calculation jobs.
- Server durable lifecycle is authoritative over browser TTL.
- E1c is server-first: E1c-A production verification precedes E1c-B frontend/workflow activation.
- `main` remains a potential production candidate; do not merge half-finished functional transitions.
- Historical plans/audits inform discovery but do not independently authorize the next batch.
- Product functionality is the default execution priority; infrastructure/governance work requires a current correctness, safety, production-stability, or measurable delivery justification.

---

## 7. Documentation Quality / Handoff Rules

The live handoff must remain concise enough that the next agent can identify the product goal, active functional batch, blocker, next action, and explicit non-goals without reading historical incident detail first.

Document placement:

- `README.md`: stable product/architecture/development truth;
- `AI_PROJECT_PLAYBOOK.md`: stable engineering governance;
- `to_do_update_list.md`: current product-first execution truth only;
- `docs/engineering/`: durable RCA, ADR-like engineering records, closeout evidence with long-lived value;
- `docs/governance/evidence/`: sanitized machine-readable production evidence;
- historical audit/remediation plans: evidence/candidate sources, not live execution authority.

Prefer updating an existing authoritative document over creating a new one. A new durable document should have independent future value as a stable contract, decision, reusable runbook, material RCA/evidence record, or specification.

Completed operational detail must be compressed out of this live handoff and retained through Git history or dedicated evidence records.

Current document-quality review candidate:

`docs/engineering/DOCUMENT_QUALITY_REVIEW_2026-08-12.md`

---

## 8. Next Exact Actions

1. Do not advance production reconciliation control-plane main while run `31518085574` is still awaiting approval.
2. When the production gate clears, complete only the defined E1c-A.1 verification/closeout.
3. Start E1c-B as the single implementation batch.
4. Validate E1c-B with focused lifecycle regression plus applicable repository CI/build.
5. Perform Independent Review against exact candidate head.
6. Merge/deploy only after applicable gates pass.
7. After E1c-B closeout, perform Product Functionality Review and select one next user-impact batch.

---

## 9. Historical Authority Boundary

The following remain valuable evidence but are not automatic current execution plans:

- `docs/MASTER_REMEDIATION_PLAN.md`
- historical audit reports;
- superseded PRs/candidates;
- completed Gate records;
- old operational recovery sequences.

Reopen a historical candidate only when current evidence promotes it into NOW/NEXT and records why it is required for the active product objective.
