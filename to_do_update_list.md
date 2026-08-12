# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority. Operational quality aid: `docs/governance/DOCUMENT_QUALITY_STANDARD.md` (subordinate to the Playbook; no independent Gate authority).

Last updated: **2026-08-12**
Handoff revision: **PRODUCT-FIRST REBASE / COMPLETE-THEN-CONVERGE / E1c-A.1 current closeout blocker / E1c-B next functional implementation**

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

**Convergence means finish the necessary work and stop unnecessary expansion. It does not mean closing a Batch while a known material functional/correctness defect remains unresolved.**

---

## 2. Single Active Functional Line

### Current functional phase

`Gate E / E1c — calculation job lifecycle and idempotency`

### Current closure obligation

`E1c-A.1 — durable GitHub dispatch binding / production closeout`

Status: **BLOCKED — waiting on external GitHub production Environment Required Reviewer approval**

This is the only unfinished prerequisite in the current product line. It must be completed correctly, but it must not expand into a new infrastructure roadmap without evidence.

### Next functional implementation batch

`E1c-B — frontend lifecycle recovery + retained workflow queue`

Status: **PLANNED / READY TO START ONLY AFTER E1c-A.1 CLOSEOUT**

Locked E1c-B product behavior:

1. active calculation recovery must not disappear solely because 15 minutes elapsed;
2. a known `jobId` remains recoverable across refresh/reopen until durable terminal or explicit 404 semantics;
3. ambiguous pre-job mutation state must retain/replay the same idempotency key until server outcome is resolved;
4. generation/tombstone owner and cross-tab protections remain intact;
5. pending workflow runs must not be silently displaced before lifecycle callback while repository-wide serialized calculation execution is preserved.

Primary E1c-B implementation surfaces:

- `src/services/calculationJobState.js`
- `src/stores/portfolio.js`
- `.github/workflows/update.yml`
- existing relevant lifecycle tests, especially `tests/worker_frontend_job_state.test.mjs`

Out of E1c-B unless evidence promotes an item to NOW:

- Worker lifecycle redesign;
- D1 Schema 3;
- ledger revision / compare-and-publish;
- cursor-signing redesign;
- provider redesign;
- Decimal migration;
- tenant UUID migration;
- broad CI/CD or governance redesign.

`Out of Scope` is not permission to ignore a newly proven material defect. If investigation shows one of these areas is actually required to prevent a core functional/correctness regression, reclassify with evidence before continuing.

---

## 3. External Production Blocker — Bounded, Not the Product Roadmap

E1c-A.1 production closeout is waiting on GitHub `production` Environment Required Reviewer approval.

Current reviewed reconciliation run:

- workflow: `Production Legacy Job Reconciliation #3`
- run: `31518085574`
- head: `b022a0a50145d3c91deb21d52f7ac0696332c932`
- preflight: **SUCCESS**
- production job: **WAITING** on required reviewer approval

This is an external release gate only. Do not expand it into additional scheduler, recovery, audit, or deployment framework work unless new material correctness/safety evidence requires it.

After approval:

```text
verify reconciliation result + sanitized artifact + bounded mutation + production contract audit
→ verify legacy stuck browser generation reaches terminal/clears
→ perform one normal authenticated update
→ prove durable workflow_run_id binding and running/terminal callbacks
→ verify no material E1c-A.1 functional defect remains
→ close E1c-A.1
→ activate E1c-B implementation
```

Do not rerun blindly, bypass the Environment reviewer, manually rewrite D1 jobs, or advance protected main in a way that invalidates reconciliation freshness while the run remains pending.

---

## 4. Product-First Priority Queue

### NOW

- Finish E1c-A.1 to the evidence required for safe and functionally correct closeout; do not create additional control-plane work without evidence.
- If E1c-A.1 verification exposes a material bug affecting calculation lifecycle, correctness, or E1c-B safety, fix/validate it before declaring E1c-A.1 `CLOSED`.
- After E1c-A.1 closes, implement and validate E1c-B product lifecycle behavior.
- Keep user-visible calculation status/recovery coherent across refresh, long queue time, and terminal outcomes.
- Before E1c-B `CLOSED`, resolve known material regressions within its functional impact radius rather than moving them to backlog merely to shorten the Batch.

### NEXT

After E1c-B implementation/deployment verification, run a focused Product Functionality Review over:

```text
login
→ records CRUD
→ calculation trigger
→ progress/recovery
→ snapshot refresh
→ holdings/P&L/performance/benchmark display
```

Classify findings by evidence:

- **NOW** — material bug/correctness issue required for the current Stable State or necessary to prevent immediate obstruction/corruption of the next functional batch; resolve before phase close.
- **NEXT** — important, safely separable functional work that should become the next Batch.
- **BACKLOG** — genuinely non-blocking improvement or technical debt.
- **REJECT** — insufficient evidence/value.

Only after material current-scope defects are closed or explicitly proven safe to defer should the next functional optimization/development Batch be selected.

### BACKLOG

Potential future work remains evidence-driven, including Schema 3, ledger revision, cursor-secret separation, Decimal/fixed-point migration, provider redesign, tenant UUID migration, and historical remediation-plan candidates.

A BACKLOG label must not be used to hide a known defect that invalidates the current functional Stable State or predictably blocks the next functional batch.

### REJECT FOR CURRENT PHASE

- reconciliation framework expansion with no demonstrated current failure mode;
- scheduler-recovery framework expansion with no demonstrated current failure mode;
- CI/CD beautification without a current product blocker;
- governance/document proliferation;
- broad architecture rewrite without evidence it is required for correctness/current functionality;
- reopening already-closed E1a/E1b work without new material evidence.

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

## 6. Locked Decisions / Working Baseline

- Age alone is not liveness authority for active `queued` / `running` calculation jobs.
- Server durable lifecycle is authoritative over browser TTL.
- E1c is server-first: E1c-A production verification precedes E1c-B frontend/workflow activation.
- `main` remains a potential production candidate; do not merge half-finished functional transitions.
- Historical plans/audits inform discovery but do not independently authorize the next batch.
- A confirmed Master Plan remains a Working Baseline when identified here; a new session/model/reviewer/document must not silently replace it. Reopen only for changed requirements, material new evidence, Critical defect, architecture conflict, external platform change, or clearly superior benefit relative to migration risk.
- Product functionality is the default execution priority; infrastructure/governance work requires a current correctness, safety, production-stability, or measurable delivery justification.
- **Convergence is complete-then-close, not stop-early:** stop adding low-value scope, finish evidence-justified necessary work, verify regressions, preserve material residual risk, then close.
- `Out of Scope` / `BACKLOG` cannot override a newly proven material correctness or functional blocker; reclassify it to NOW when required for the Stable State.

Current Working Baseline for execution priority is this Product-First Gate E sequence:

```text
complete E1c-A.1 safely and functionally
→ E1c-B functional lifecycle
→ Product Functionality Review / residual-risk closure
→ select one next user-impact/correctness batch
```

---

## 7. Documentation Quality / Handoff Rules

Documentation quality management exists primarily to **prevent project amnesia and project distortion**. It must preserve durable facts, decisions, root causes, material residual bugs/risks, and next actions without turning documentation itself into the project.

The live handoff must remain concise enough that the next agent can identify the product goal, current closure obligation, next functional implementation batch, blocker, known material residual risks, next action, and explicit non-goals without reading historical incident detail first.

Document placement:

- `README.md`: stable product/architecture/development truth;
- `AI_PROJECT_PLAYBOOK.md`: highest stable engineering governance and mandatory Gate authority;
- `to_do_update_list.md`: current product-first execution truth;
- `docs/governance/DOCUMENT_QUALITY_STANDARD.md`: subordinate operational quality checklist only; it cannot add/override Playbook Gates;
- `docs/engineering/`: durable RCA, decisions, contracts, closeout/review evidence with long-lived value;
- `docs/governance/evidence/`: sanitized machine-readable production evidence;
- historical audit/remediation plans: evidence/candidate sources unless current evidence explicitly re-promotes them.

Prefer updating an existing authoritative document over creating a new one. A new durable document should have independent future value as a stable contract, decision, reusable runbook, material RCA/evidence record, specification, or justified R2/R3 review record.

Completed operational detail must be compressed out of this live handoff and retained through Git history or dedicated evidence records. **Compression removes noise, not unresolved material defects or risks.**

Current document-quality review candidate:

`docs/engineering/DOCUMENT_QUALITY_REVIEW_2026-08-12.md`

---

## 8. Functional Closeout Integrity

Before an important functional Batch/Phase is marked `CLOSED`, confirm at the level appropriate to its risk:

1. requirement behavior is actually satisfied;
2. applicable regression/build/production verification is complete;
3. known BLOCKERs are zero;
4. no known material functional/data/correctness bug is being deferred only because the team wants to "converge";
5. closely related defects discovered during the Batch have been classified based on impact, not convenience;
6. anything deferred to NEXT/BACKLOG has an explicit reason it is safe to defer and will not predictably corrupt/block the next functional work;
7. the handoff preserves any residual limitation that future development must know.

The goal is not zero bugs or infinite perfection. The goal is to avoid **closing with a known major functional defect that later forces rework or contaminates subsequent feature development**.

---

## 9. Next Exact Actions

1. Do not advance production reconciliation control-plane main while run `31518085574` is still awaiting approval.
2. Re-review PR #203 against its final exact candidate head and require applicable exact-head CI; do not merge it while that merge would invalidate the still-pending reconciliation freshness gate.
3. When the production gate clears, complete the defined E1c-A.1 verification/closeout, including a functional residual-risk check; fix any material E1c-A.1 lifecycle defect before `CLOSED`.
4. Start E1c-B as the single functional implementation batch.
5. Validate E1c-B with focused lifecycle regression plus applicable repository CI/build and production verification where applicable.
6. Perform Independent Review against exact candidate head, including counterexample/regression search for the core calculation lifecycle.
7. Resolve any material functional/correctness BLOCKER within the E1c impact radius before closing E1c; safely separable improvements go NEXT/BACKLOG with evidence.
8. Merge/deploy only after applicable gates pass.
9. Perform Product Functionality Review and close material residual bugs before selecting one next user-impact/correctness Batch.

---

## 10. Historical Authority Boundary

The following remain valuable evidence but are not automatic current execution plans:

- `docs/MASTER_REMEDIATION_PLAN.md` unless explicitly re-adopted as the current Working Baseline;
- historical audit reports;
- superseded PRs/candidates;
- completed Gate records;
- old operational recovery sequences.

Reopen a historical candidate only when current evidence promotes it into NOW/NEXT and records why it is required for the active product objective. Do not silently reinterpret historical documents as a new Master Plan.
