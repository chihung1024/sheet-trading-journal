# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority. Operational quality aid: `docs/governance/DOCUMENT_QUALITY_STANDARD.md` (subordinate to the Playbook; no independent Gate authority).

Last updated: **2026-08-12**  
Handoff revision: **E1c-A.1 CLOSED / E1c-B ACTIVE / MARKET-DATA NaN WATCH**

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

**Convergence means finish necessary work and stop unnecessary expansion. It does not mean closing a Batch while a known material functional/correctness defect remains unresolved.**

---

## 2. Single Active Functional Line

### Current functional phase

`Gate E / E1c — calculation job lifecycle and idempotency`

### Current implementation batch

`E1c-B — frontend lifecycle recovery + retained workflow queue`

Status: **ACTIVE**

E1c-A.1 is now **CLOSED / PRODUCTION VERIFIED**. Durable closeout record:

- engineering: `docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`;
- sanitized evidence: `docs/governance/evidence/GATE_E_E1C_A1_CLOSEOUT_2026-08-12.json`.

Locked E1c-B product behavior:

1. active calculation recovery must not disappear solely because 15 minutes elapsed;
2. a known `jobId` remains recoverable across refresh/reopen until durable terminal or explicit 404 semantics;
3. ambiguous pre-job mutation state must retain/replay the same idempotency key until server outcome is resolved;
4. generation/tombstone owner and cross-tab protections remain intact;
5. pending workflow runs must not be silently displaced before lifecycle callback while repository-wide serialized calculation execution is preserved.

Primary implementation surfaces:

- `src/services/calculationJobState.js`
- `src/stores/portfolio.js`
- `.github/workflows/update.yml`
- existing lifecycle tests, especially `tests/worker_frontend_job_state.test.mjs`

Implementation boundary:

- no Worker lifecycle semantic redesign unless new evidence proves it necessary;
- no D1 Schema 3;
- no ledger revision / compare-and-publish;
- no cursor-signing redesign;
- no Decimal migration;
- no tenant UUID migration;
- no broad CI/CD/governance redesign.

`Out of Scope` is not permission to ignore a newly proven material defect. Reclassify only with evidence.

---

## 3. E1c-A.1 Closed Production Baseline

Forward runtime:

- Worker source `fe5f091fdb2c92970dff74c1a7c99052084adb95`;
- Worker version `68f32cee-c609-4624-aaff-eaa55ef0c77d`;
- contract `Worker 4.07 / API 2.60 / D1 Schema 2`.

Legacy reconciliation final result:

- `Production Legacy Job Reconciliation` run `31518085574`, attempt 2: **SUCCESS**;
- production job `93984614952`;
- artifact `9126247398`;
- digest `sha256:677f2c6ccea36a0b46c68a40c0f21782ac8301523f0c618d603132eefbc39a20`;
- target cardinality `before=3 / changed=3 / after=0`;
- only terminal transition: `failed / LEGACY_DISPATCH_UNBOUND_RECONCILED`;
- no transaction/snapshot mutation;
- post-contract audit: **PASS**.

Normal authenticated production smoke:

- `Update Portfolio Data #3239` / run `31557518956`;
- event `workflow_dispatch`;
- head `7439c8fb39ec8885b0b16ffdb46b3996e64dc42f`;
- running callback: **SUCCESS**;
- calculation + snapshot upload: **SUCCESS**;
- terminal `succeeded` callback with same GitHub run identity: **SUCCESS**;
- workflow conclusion: **SUCCESS**.

The current Worker contract rejects conflicting callback run identity, so the successful callbacks are evidence that production durable dispatch binding is functioning as intended.

Do not reopen E1c-A.1 unless there is new material evidence of a dispatch-binding/server-lifecycle defect.

---

## 4. Product-First Priority Queue

### NOW — E1c-B

Implement E1c-B as one narrow functional batch:

- remove age-only invalidation of a known active pending calculation identity;
- distinguish "stop active polling for now" from "forget durable pending job";
- preserve same idempotency key through ambiguous pre-job outcome;
- retain current generation/tombstone cross-tab safety;
- solve GitHub Actions pending-run displacement without sacrificing serialized portfolio calculation execution;
- add focused regression for refresh/reopen, long pending state, terminal/404 clear, ambiguous request replay, cross-tab owner safety, and retained queue behavior.

Before changing workflow queue semantics, revalidate current GitHub Actions concurrency behavior against official GitHub documentation. Do not assume historical pending-slot semantics are unchanged.

### NOW — material residual watch, not a speculative fix

Scheduled updates #3237 and #3238 failed with `MARKET_DATA_FAILED` because Yahoo/yfinance produced NaN selected prices for Taiwan market data. PR #204 deployed a fail-closed diagnostic only. It does **not** drop/fill/repair/substitute prices or weaken validation.

Authenticated smoke #3239 succeeded and did not reproduce the NaN condition. Therefore:

- continue observing normal/scheduled runs;
- if NaN recurs, use the logged provider-row date + OHLC + Adj Close + Volume + Dividends + Stock Splits + Capital Gains to classify the row;
- only then choose the minimum financially safe semantic fix;
- do not forward-fill/drop/substitute merely to make the workflow green.

This residual issue may preempt E1c-B only if new evidence shows it is a material current product correctness blocker requiring immediate action.

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

Classify findings:

- **NOW** — material bug/correctness issue required for current Stable State;
- **NEXT** — important and safely separable functional work;
- **BACKLOG** — genuinely non-blocking improvement/technical debt;
- **REJECT** — insufficient evidence/value.

### BACKLOG

Schema 3, ledger revision, cursor-secret separation, Decimal/fixed-point migration, provider redesign, tenant UUID migration, and historical remediation candidates remain evidence-driven future work.

### REJECT FOR CURRENT PHASE

- reconciliation/scheduler framework expansion with no demonstrated current failure mode;
- CI/CD beautification without a product blocker;
- governance/document proliferation;
- broad architecture rewrite without correctness evidence;
- reopening already-closed E1a/E1b/E1c-A.1 without new material evidence.

---

## 5. Stable Production State

Deployed Worker runtime source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract:

`Worker 4.07 / API 2.60 / D1 Schema 2`

Current protected-main product source after PR #204:

`7439c8fb39ec8885b0b16ffdb46b3996e64dc42f`

PR #204 exact-head CI #665 and post-main CI #666: **SUCCESS**.

Durable deploy evidence:

`docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`

Recovery reference:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Always re-check remote truth before production-affecting action.

---

## 6. Locked Decisions / Working Baseline

- Age alone is not liveness authority for active `queued` / `running` calculation jobs.
- Server durable lifecycle is authoritative over browser TTL.
- `main` remains a potential production candidate; do not merge half-finished functional transitions.
- Historical plans/audits inform discovery but do not independently authorize the next batch.
- Product functionality is the default execution priority; infrastructure/governance work requires current correctness, safety, stability, or delivery justification.
- **Convergence is complete-then-close, not stop-early.**
- `Out of Scope` / `BACKLOG` cannot hide a newly proven material correctness or functional blocker.
- E1c-A.1 dispatch-binding fix is closed; do not alter it while implementing E1c-B unless an actual regression requires it.
- E1c-B changes no Worker lifecycle semantics by default.

Current Working Baseline:

```text
E1c-B frontend lifecycle + retained workflow queue
→ production verification
→ Product Functionality Review / residual-risk closure
→ select one next user-impact/correctness batch
```

---

## 7. Documentation Quality / Handoff Rules

Documentation exists to prevent project amnesia and distortion, not to become the project.

Use:

- `README.md`: stable product/architecture truth;
- `AI_PROJECT_PLAYBOOK.md`: highest governance/Gate authority;
- `to_do_update_list.md`: current execution truth;
- `docs/governance/DOCUMENT_QUALITY_STANDARD.md`: subordinate quality checklist only;
- `docs/engineering/`: durable RCA/contract/decision/closeout evidence;
- `docs/governance/evidence/`: sanitized machine-readable production evidence.

Prefer updating an existing authoritative document over creating a new one. Compress completed operational detail out of this handoff once durable evidence exists, but never compress away unresolved material defects/risks.

---

## 8. Functional Closeout Integrity

Before E1c-B or E1c is marked `CLOSED`, confirm at appropriate risk level:

1. required behavior is actually satisfied;
2. applicable regression/build/production verification passes;
3. known BLOCKERs are zero;
4. no known material functional/data/correctness bug is being deferred merely to converge;
5. closely related defects are impact-classified;
6. deferred work is explicitly safe to defer;
7. residual limitations remain visible in the handoff.

The goal is not zero bugs. The goal is not to close on a known major defect that contaminates the next batch.

---

## 9. Next Exact Actions

1. Treat E1c-A.1 as closed; do not spend more work on reconciliation/control-plane expansion without new evidence.
2. Revalidate current GitHub Actions concurrency/pending semantics using official GitHub documentation before editing `.github/workflows/update.yml`.
3. Implement E1c-B narrowly in the existing browser state/store/workflow surfaces; no Worker/D1/schema redesign by default.
4. Add focused lifecycle/queue regressions using the existing test suites.
5. Run applicable exact-head CI and focused Independent Review; resolve actual blockers rather than waiving them.
6. Merge with expected-head protection, verify post-main CI, then perform production lifecycle smoke appropriate to the changed behavior.
7. Continue observing `Update Portfolio Data`; if market-data NaN recurs, extract the new sanitized provider-row diagnostics and choose a semantic fix from evidence rather than imputation.
8. After E1c-B production verification, perform the defined Product Functionality Review and select the next single product batch.
