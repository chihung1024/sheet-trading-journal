# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority. Operational quality aid: `docs/governance/DOCUMENT_QUALITY_STANDARD.md` (subordinate to the Playbook; no independent Gate authority).

Last updated: **2026-08-12 11:31 Asia/Taipei**  
Handoff revision: **E1c-A.1 CLOSED / E1c-B MERGED + POST-MAIN VERIFIED / PRODUCTION LIFECYCLE VERIFICATION PENDING / MARKET-DATA NaN WATCH**

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

## 2. Project Status

| Area | Status | Remote-truth note |
|---|---|---|
| Gate A | DONE | closed |
| Gate B | DONE | closed |
| Gate C | DONE | closed / post-main verified |
| Gate D | DONE | D1a–D1e closed / post-main verified |
| Gate E / E0 | DONE | architecture re-review closed |
| E1a | DONE | production completed |
| E1b | DONE | production completed |
| E1c-A.1 | **CLOSED / PRODUCTION VERIFIED** | do not reopen without new material dispatch-binding evidence |
| E1c-B implementation | **MERGED** | PR #206 merged into `main` |
| E1c-B exact-head review/CI | **VERIFIED** | review PASS; exact-head CI #676 SUCCESS |
| E1c-B post-main CI | **VERIFIED** | CI #677 SUCCESS |
| E1c-B Pages deployment | **VERIFIED** | Pages deployment SUCCESS |
| E1c-B production lifecycle | **NOT YET VERIFIED** | no post-#206 production lifecycle evidence observed yet |
| Market-data NaN residual | **WATCH ONLY** | #3239/#3240/#3241 succeeded; no new diagnostic row evidence |

Primary Active Batch remains **E1c-B production verification only**. There is no remaining E1c-B implementation work unless verification reveals a material regression.

---

## 3. Stable State

### Protected `main`

Current protected-main head:

`fdc1199bea47a2e47f38e2737827f1a2e38451f2`

Commit:

`Merge PR #206: E1c-B lifecycle recovery and retained queue`

### E1c-B merge evidence

PR #206 — `E1c-B: retain browser recovery and workflow queue`

- base at implementation start: `edda781e48383d2f185d7d3c2cbe07f3feb21091`;
- final PR head: `7f6eaee6ef0ff1c03501e3e354ae7cd216013e14`;
- merge commit: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- changed files: 5;
- Independent Review: **PASS / NO REVIEW BLOCKER** on exact head;
- exact-head CI #676 / run `31559136662`: **SUCCESS**;
- post-main CI #677 / run `31559255388`: **SUCCESS**;
- Pages deployment run `31559254780`: **SUCCESS**.

### Runtime baseline carried from E1c-A.1

Deployed Worker runtime source:

`fe5f091fdb2c92970dff74c1a7c99052084adb95`

Live Worker version:

`68f32cee-c609-4624-aaff-eaa55ef0c77d`

Runtime contract:

`Worker 4.07 / API 2.60 / D1 Schema 2`

E1c-B intentionally does **not** change Worker lifecycle semantics, D1 schema, portfolio calculation semantics, snapshot semantics, or market-data semantics.

Recovery reference:

`backup-pre-e1c-a1-legacy-reconciliation-67b8735`

Always re-check remote truth before production-affecting action.

---

## 4. Architecture Notes Relevant to Current Work

Current calculation lifecycle remains:

```text
Browser / Vue
→ Cloudflare Worker API
→ GitHub Actions portfolio-update workflow
→ portfolio engine / snapshot publication
→ Worker lifecycle callback
→ browser polling/recovery
```

Authority boundaries:

- durable server lifecycle is authoritative over browser age/TTL;
- browser pending state is recovery metadata, not independent server truth;
- repository-wide portfolio calculation execution remains serialized;
- E1c-B uses GitHub-native retained pending queue semantics and does not introduce a custom scheduler;
- Worker/D1/calculation behavior remains outside E1c-B unless new production evidence proves a regression there.

---

## 5. Master Plan / Working Baseline

Current Working Baseline:

```text
E1c-B implementation merged
→ E1c-B production lifecycle verification
→ close E1c-B / E1c when acceptance is actually satisfied
→ focused Product Functionality Review
→ select one next user-impact/correctness batch
→ resume normal feature optimization and development
```

Do not replace this baseline merely because a new model/session/agent begins.

Reopen or redirect only on:

- changed user requirement;
- new material production evidence;
- Critical defect;
- architecture conflict;
- external platform change that invalidates the implementation;
- clearly superior alternative whose benefit materially exceeds migration risk.

---

## 6. Current Phase / Batch

### Current functional phase

`Gate E / E1c — calculation job lifecycle and idempotency`

### Current active batch

`E1c-B — production lifecycle verification and closeout`

Status:

**IMPLEMENTATION MERGED / EXACT-HEAD VERIFIED / POST-MAIN VERIFIED / PRODUCTION LIFECYCLE NOT VERIFIED**

### Locked E1c-B product behavior

1. active calculation recovery must not disappear solely because 15 minutes elapsed;
2. a known `jobId` remains recoverable across refresh/reopen until durable terminal or explicit 404 semantics;
3. ambiguous pre-job mutation state must retain/replay the same idempotency key until server outcome is resolved;
4. generation/tombstone owner and cross-tab protections remain intact;
5. pending workflow runs must not be silently displaced before lifecycle callback while repository-wide serialized calculation execution is preserved.

### Implemented scope in PR #206

- new / explicitly upgraded pending generations carry `lifecyclePersistent: true` and no longer expire by age;
- pre-E1c-B unmarked live generations retain the historical 15-minute rule, preventing rollout resurrection of abandoned state;
- currently-valid legacy pending state is best-effort upgraded in place without changing key / createdAt / jobId;
- cleared tombstones remain durable authority even if written by an old tab without the new marker;
- benchmark intent is scoped so an old exact-key job cannot silently replay for a different explicit benchmark;
- pre-E1c-B records without benchmark remain conservatively replayable during transition;
- server-returned authoritative job benchmark is persisted;
- terminal/404 cleanup and 20-minute active-polling resource cap remain unchanged;
- owner/generation/tombstone cross-tab protections remain intact;
- `portfolio-update` remains serialized with `cancel-in-progress: false` and retained pending queue behavior;
- no Worker, D1, schema, market-data, calculation, snapshot, or broad store redesign.

### Remaining acceptance evidence

Production lifecycle verification must confirm the changed behavior at appropriate scope, especially:

- a production calculation can be triggered successfully from the deployed frontend;
- known pending identity survives refresh/reopen rather than being forgotten merely due to browser age;
- terminal success/failure or authoritative 404 clears/resolves the pending generation correctly;
- the frontend returns to normal usable state after terminal completion;
- no duplicate execution / cross-benchmark replay / stale-generation resurrection is observed;
- retained queue behavior does not break serialized calculation execution.

Do not mark E1c-B `CLOSED` until applicable production verification exists.

---

## 7. E1c-A.1 Closed Production Baseline

E1c-A.1 is **CLOSED / PRODUCTION VERIFIED**. Durable closeout records:

- engineering: `docs/engineering/GATE_E_E1C_A1_DISPATCH_BINDING_2026-08-11.md`;
- sanitized evidence: `docs/governance/evidence/GATE_E_E1C_A1_CLOSEOUT_2026-08-12.json`;
- deploy evidence: `docs/governance/evidence/GATE_E_E1C_A1_DEPLOY_2026-08-11.json`.

Legacy reconciliation final result:

- `Production Legacy Job Reconciliation` run `31518085574`, attempt 2: **SUCCESS**;
- production job `93984614952`;
- artifact `9126247398`;
- digest `sha256:677f2c6ccea36a0b46c68a40c0f21782ac8301523f0c618d603132eefbc39a20`;
- target cardinality `before=3 / changed=3 / after=0`;
- only terminal transition: `failed / LEGACY_DISPATCH_UNBOUND_RECONCILED`;
- no transaction/snapshot mutation;
- post-contract audit: **PASS**.

Authenticated production smoke:

- `Update Portfolio Data #3239` / run `31557518956`: **SUCCESS**;
- running callback: **SUCCESS**;
- calculation + snapshot upload: **SUCCESS**;
- terminal `succeeded` callback with same GitHub run identity: **SUCCESS**.

The Worker contract rejects conflicting callback run identity, so this remains sufficient evidence for E1c-A.1 durable dispatch binding.

**Locked decision:** do not reopen E1c-A.1 reconciliation unless new material evidence demonstrates a dispatch-binding/server-lifecycle defect.

---

## 8. Product-First Priority Queue

### NOW — E1c-B production verification only

No speculative implementation work is authorized. Perform the minimum production lifecycle verification needed to validate the merged behavior and close the batch if it passes.

### NOW — material residual watch, not a speculative fix

Scheduled updates #3237 and #3238 previously failed with `MARKET_DATA_FAILED` because Yahoo/yfinance produced NaN selected prices for Taiwan market data. PR #204 deployed fail-closed diagnostics only; it did **not** drop/fill/repair/substitute prices or weaken validation.

Subsequent authenticated/manual runs:

- #3239 / run `31557518956`: **SUCCESS**;
- #3240 / run `31557676809`: **SUCCESS**;
- #3241 / run `31558309531`: **SUCCESS**.

No new run after #3239 has produced new `MARKET_DATA_FAILED` evidence in the currently observed remote truth.

If a future run fails and logs contain `NaN selected-price provider row`:

- extract only sanitized provider-row evidence: date, OHLC, Adj Close, Volume, Dividends, Stock Splits, Capital Gains;
- classify the row with the minimum financially safe root-cause statement supported by evidence;
- do **not** recommend drop/fill/substitution/forward-fill merely to make the workflow green;
- only promote this watch into a repair batch if evidence demonstrates a current material correctness blocker.

### NEXT — Product Functionality Review

Immediately after E1c-B production verification/closeout, review the real user flow:

```text
login
→ records CRUD
→ calculation trigger
→ progress/recovery
→ snapshot refresh
→ holdings
→ realized/unrealized P&L
→ performance/TWR/XIRR
→ benchmark display
→ actionable success/failure UX
```

Classify findings:

- **NOW** — material bug/correctness issue required for current Stable State;
- **NEXT** — important and safely separable user-impact feature/optimization;
- **BACKLOG** — genuinely non-blocking improvement/technical debt;
- **REJECT** — insufficient evidence/value.

Then select exactly one next functional implementation batch.

### BACKLOG

- D1 Schema 3;
- ledger revision / compare-and-publish;
- cursor-secret separation;
- Decimal/fixed-point migration;
- market-data provider redesign;
- tenant UUID migration;
- other historical remediation candidates without current blocker evidence.

### REJECT FOR CURRENT PHASE

- reconciliation/scheduler framework expansion without demonstrated current failure mode;
- new scheduler/queue infrastructure;
- CI/CD beautification without a product blocker;
- governance/document proliferation;
- broad architecture rewrite without correctness evidence;
- reopening already-closed E1a/E1b/E1c-A.1 without new material evidence.

---

## 9. Decision Log

### D-2026-08-12-01 — E1c-A.1 remains closed

**Decision:** `CLOSED / PRODUCTION VERIFIED` remains authoritative.  
**Evidence:** successful reconciliation + production smoke + dispatch identity binding.  
**Reopen condition:** new material dispatch-binding/server-lifecycle evidence only.  
**Status:** LOCKED.

### D-2026-08-12-02 — E1c-B implementation accepted into main

**Decision:** PR #206 is the current implementation baseline.  
**Evidence:** focused Independent Review PASS, exact-head CI #676 SUCCESS, expected-head merge, post-main CI #677 SUCCESS, Pages deployment SUCCESS.  
**Trade-off:** production lifecycle behavior is not inferred from CI; it remains separately NOT VERIFIED.  
**Status:** MERGED / AWAITING PRODUCTION VERIFICATION.

### D-2026-08-12-03 — Product functionality resumes after closeout

**Decision:** after E1c-B production verification, the project returns to a focused Product Functionality Review and one user-impact/correctness batch.  
**Reason:** product correctness/usability is the Primary Goal; governance and infrastructure are support mechanisms only.  
**Reopen condition:** a newly proven high-impact safety/data/security/production issue may preempt the functional batch.  
**Status:** WORKING BASELINE.

---

## 10. Root Cause Log

### RC-E1c-B-01 — Browser TTL incorrectly acted as lifecycle authority

**Symptom:** pending/recovery identity could disappear after the historical 15-minute browser TTL even while durable work remained active or ambiguous.  
**Root cause:** browser age was overloaded as liveness authority instead of treating durable server lifecycle as authoritative.  
**Related rollout risks found during review:**

- global TTL removal could resurrect pre-E1c-B abandoned live generations;
- permanently reusable pending keys required benchmark intent scoping;
- old-tab tombstone writes required durable authority to prevent cross-tab resurrection;
- default GitHub Actions pending behavior could displace a pending lifecycle run.

**Permanent fix:** PR #206 lifecycle persistence + rollout marker + benchmark intent + durable tombstone handling + retained GitHub-native queue semantics.  
**Verification:** exact-head tests/review/CI PASS; production lifecycle verification pending.

### RC-MD-NAN-01 — Provider selected-price NaN residual

**Symptom:** scheduled updates #3237/#3238 failed closed with `MARKET_DATA_FAILED`.  
**Current evidence:** Yahoo/yfinance returned NaN selected price rows for Taiwan market data; semantic row classification remains unproven because the condition did not reproduce in #3239/#3240/#3241.  
**Current action:** diagnostic watch only.  
**Prohibited assumption:** do not infer that dropping/filling/substituting the row is financially correct without provider-row evidence.

---

## 11. Known Issues / Risks

### K1 — E1c-B production lifecycle evidence gap

Severity: **current closeout blocker, not a code blocker**.  
The implementation is merged and deployed, but the changed browser lifecycle behavior has not yet been demonstrated in production after merge. Do not equate CI/Pages success with user lifecycle verification.

### K2 — Market-data NaN may recur

Severity: **watch / conditional product correctness risk**.  
No current reproduction after #3238. If it recurs, classify from sanitized raw provider-row diagnostics before changing financial semantics.

### K3 — Queue behavior requires production-observable confidence

Severity: **related E1c-B risk**.  
Retained pending queue syntax is test-validated, but production verification should confirm no loss of serialized execution and no lifecycle displacement behavior in realistic operation. Do not build new queue infrastructure unless the current native mechanism demonstrably fails.

---

## 12. Technical Debt / Deferred Candidates

Current deferred candidates remain evidence-driven and must not interrupt the active product line unless reclassified by new evidence:

- Schema 3;
- compare-and-publish / ledger revision;
- Decimal/fixed-point migration;
- provider redesign;
- tenant UUID migration;
- cursor secret separation;
- broader architecture modernization.

These are not current blockers merely because they may be architecturally desirable.

---

## 13. Documentation Quality / Handoff Rules

Documentation exists to prevent project amnesia and distortion, not to become the project.

Use:

- `README.md`: stable product/architecture truth;
- `AI_PROJECT_PLAYBOOK.md`: highest governance/Gate authority;
- `to_do_update_list.md`: current execution truth and handoff state;
- `docs/governance/DOCUMENT_QUALITY_STANDARD.md`: subordinate quality checklist only;
- `docs/engineering/`: durable RCA/contract/decision/closeout evidence;
- `docs/governance/evidence/`: sanitized machine-readable production evidence.

Prefer updating an existing authoritative document over creating a new one. Compress completed operational detail only after durable evidence exists, but never compress away unresolved material defects/risks.

Whenever repository prose conflicts with GitHub/CI/deployment remote truth, remote truth wins and this file should be corrected promptly.

---

## 14. Functional Closeout Integrity

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

## 15. Change Log

### 2026-08-12 — E1c-B remote-truth handoff sync

**Scope:** documentation-only synchronization of `to_do_update_list.md`; no product/runtime/workflow mutation.  
**Reason:** the previous handoff still described E1c-B as not yet implemented and still listed PR #204 as the current protected-main product source after PR #206 had merged.  
**Remote evidence synchronized:**

- PR #206 final head `7f6eaee6ef0ff1c03501e3e354ae7cd216013e14`;
- Independent Review PASS / NO REVIEW BLOCKER;
- exact-head CI #676 / run `31559136662` SUCCESS;
- merge commit `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- post-main CI #677 / run `31559255388` SUCCESS;
- Pages deployment run `31559254780` SUCCESS;
- Update Portfolio Data #3239/#3240/#3241 SUCCESS;
- no new NaN provider-row evidence observed;
- E1c-B production lifecycle remains explicitly NOT VERIFIED.

**Files changed:** `to_do_update_list.md` only.  
**Runtime impact:** none.  
**Rollback:** revert this documentation commit if any synchronized fact is later proven incorrect; do not roll back product code merely for a handoff-document error.

---

## 16. Next Exact Actions

1. Treat E1c-A.1 as closed; do not spend more work on reconciliation/control-plane expansion without new material evidence.
2. Use current `main` head `fdc1199bea47a2e47f38e2737827f1a2e38451f2` as the E1c-B implementation baseline.
3. Perform the minimum production lifecycle verification needed for E1c-B: trigger → observe pending → refresh/reopen recovery → terminal resolution → normal portfolio/snapshot display.
4. Verify that serialized portfolio execution remains intact and that retained pending behavior introduces no duplicate/lost lifecycle execution.
5. If production verification passes with no material blocker, update this handoff and close E1c-B/E1c as appropriate; do not add unrelated cleanup work to the closeout.
6. Continue observing normal `Update Portfolio Data`; if `MARKET_DATA_FAILED` recurs with `NaN selected-price provider row`, extract sanitized date/OHLC/Adj Close/Volume/Dividends/Stock Splits/Capital Gains evidence and classify before proposing any financial-semantic fix.
7. Immediately after E1c-B closeout, perform the defined Product Functionality Review.
8. Select one next user-impact/correctness batch and resume normal functional optimization/development.
