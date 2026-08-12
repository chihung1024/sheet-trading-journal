# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Historical plans and audits are evidence sources, not automatic execution authority. Operational quality aid: `docs/governance/DOCUMENT_QUALITY_STANDARD.md` (subordinate to the Playbook; no independent Gate authority).

Last updated: **2026-08-12 11:43 Asia/Taipei**  
Handoff revision: **E1c-A.1 CLOSED / E1c-B WORKFLOW+CALCULATION PRODUCTION PATH VERIFIED / AUTHENTICATED BROWSER LIFECYCLE PENDING / MARKET-DATA NaN WATCH**

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
| E1c-B frontend deployment | **VERIFIED** | Pages deployment SUCCESS |
| E1c-B workflow/calculation/snapshot production path | **VERIFIED** | scheduled #3242 on `fdc1199...` SUCCESS; 2 users processed, 0 failed |
| E1c-B authenticated browser lifecycle | **NOT YET VERIFIED** | refresh/reopen pending identity + terminal cleanup require authenticated browser evidence |
| Market-data NaN residual | **WATCH ONLY** | #3239/#3240/#3241/#3242 succeeded; no new diagnostic row evidence |

Primary Active Batch remains **E1c-B authenticated browser lifecycle verification only**. There is no remaining E1c-B implementation work unless verification reveals a material regression.

---

## 3. Stable State

### E1c-B product implementation baseline

PR #206 merged product implementation baseline:

`fdc1199bea47a2e47f38e2737827f1a2e38451f2`

Commit:

`Merge PR #206: E1c-B lifecycle recovery and retained queue`

This SHA is the **E1c-B product-code baseline**, not a durable assertion that it remains the latest `main` after later documentation-only merges. Always re-check GitHub remote truth for the current `main` head before consequential action.

### E1c-B merge evidence

PR #206 — `E1c-B: retain browser recovery and workflow queue`

- base at implementation start: `edda781e48383d2f185d7d3c2cbe07f3feb21091`;
- final PR head: `7f6eaee6ef0ff1c03501e3e354ae7cd216013e14`;
- merge commit / product baseline: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- changed files: 5;
- Independent Review: **PASS / NO REVIEW BLOCKER** on exact head;
- exact-head CI #676 / run `31559136662`: **SUCCESS**;
- post-main CI #677 / run `31559255388`: **SUCCESS**;
- Pages deployment run `31559254780`: **SUCCESS**.

### Post-merge production workflow evidence

`Update Portfolio Data #3242` / run `31560257260`:

- event: `schedule`;
- head: E1c-B product baseline `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- workflow conclusion: **SUCCESS**;
- market-data download: **SUCCESS** for 53 symbols, including `0050.TW` and `2330.TW`;
- portfolio calculation: **SUCCESS**;
- transaction prefix integrity: **PASS** for both users;
- canonical Daily PnL reconciliation: **PASS**;
- split-adjusted ledger parity: **PASS**;
- snapshot upload: **SUCCESS** for both users;
- final result: **2 users succeeded / 0 failed**;
- no `MARKET_DATA_FAILED` or `NaN selected-price provider row` evidence observed.

Because #3242 was a scheduled run, `CALCULATION_JOB_ID` was empty and lifecycle callback steps were correctly skipped. Therefore #3242 verifies the production workflow/calculation/snapshot/market-data path but **does not** prove the changed authenticated browser pending/recovery lifecycle.

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
→ workflow/calculation/snapshot production path verified (#3242)
→ authenticated browser lifecycle verification
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

`E1c-B — authenticated browser lifecycle verification and closeout`

Status:

**IMPLEMENTATION MERGED / EXACT-HEAD VERIFIED / POST-MAIN VERIFIED / FRONTEND DEPLOYED / PRODUCTION WORKFLOW+CALCULATION+SNAPSHOT VERIFIED / AUTHENTICATED BROWSER LIFECYCLE NOT VERIFIED**

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

### Production evidence already satisfied

The following no longer need speculative re-testing unless a regression appears:

- merged E1c-B workflow syntax executes successfully in production;
- scheduled portfolio calculation on the E1c-B baseline succeeds;
- market-data acquisition succeeds for the currently processed symbol set;
- portfolio calculations and integrity checks succeed;
- snapshot publication succeeds for all users processed by #3242;
- no current NaN selected-price reproduction exists.

### Remaining acceptance evidence

The minimum remaining production verification is the **authenticated browser lifecycle** changed by E1c-B:

- trigger a production calculation from the deployed frontend;
- observe a pending/known calculation identity;
- refresh or reopen while the generation is still active and confirm the identity is recovered rather than age-forgotten;
- confirm terminal success/failure or authoritative 404 clears/resolves the generation correctly;
- confirm the frontend returns to normal usable state and refreshed portfolio/snapshot data is visible;
- observe no duplicate execution, cross-benchmark replay, or stale-generation resurrection.

A deliberate multi-run production load test is **not required by default** merely to prove GitHub queue syntax. Exact-head tests/review already validate the retained-queue contract; only escalate to additional production concurrency testing if normal production evidence shows displacement, duplicate execution, or serialization failure.

Do not mark E1c-B `CLOSED` until the applicable authenticated browser lifecycle evidence exists.

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

### NOW — authenticated browser lifecycle verification only

No speculative E1c-B implementation work is authorized. The server/workflow/calculation/snapshot production path is already verified by #3242. Perform only the minimum authenticated frontend lifecycle smoke needed to validate the changed browser behavior and close the batch if it passes.

### NOW — material residual watch, not a speculative fix

Scheduled updates #3237 and #3238 previously failed with `MARKET_DATA_FAILED` because Yahoo/yfinance produced NaN selected prices for Taiwan market data. PR #204 deployed fail-closed diagnostics only; it did **not** drop/fill/repair/substitute prices or weaken validation.

Subsequent runs:

- #3239 / run `31557518956`: **SUCCESS**;
- #3240 / run `31557676809`: **SUCCESS**;
- #3241 / run `31558309531`: **SUCCESS**;
- #3242 / run `31560257260`: **SUCCESS** on the E1c-B product baseline, with 53 symbols downloaded and 2/2 user snapshots uploaded successfully.

No run after #3238 has produced new `MARKET_DATA_FAILED` evidence in the currently observed remote truth.

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
- reopening already-closed E1a/E1b/E1c-A.1 without new material evidence;
- artificial production queue load testing without a demonstrated queue/serialization failure mode.

---

## 9. Decision Log

### D-2026-08-12-01 — E1c-A.1 remains closed

**Decision:** `CLOSED / PRODUCTION VERIFIED` remains authoritative.  
**Evidence:** successful reconciliation + production smoke + dispatch identity binding.  
**Reopen condition:** new material dispatch-binding/server-lifecycle evidence only.  
**Status:** LOCKED.

### D-2026-08-12-02 — E1c-B implementation accepted into main

**Decision:** PR #206 is the current E1c-B product implementation baseline.  
**Evidence:** focused Independent Review PASS, exact-head CI #676 SUCCESS, expected-head merge, post-main CI #677 SUCCESS, Pages deployment SUCCESS.  
**Trade-off:** authenticated browser lifecycle behavior is not inferred from CI; it remains separately NOT VERIFIED.  
**Status:** MERGED / PRODUCTION WORKFLOW PATH VERIFIED / AUTHENTICATED BROWSER VERIFICATION PENDING.

### D-2026-08-12-03 — Product functionality resumes after closeout

**Decision:** after E1c-B production verification, the project returns to a focused Product Functionality Review and one user-impact/correctness batch.  
**Reason:** product correctness/usability is the Primary Goal; governance and infrastructure are support mechanisms only.  
**Reopen condition:** a newly proven high-impact safety/data/security/production issue may preempt the functional batch.  
**Status:** WORKING BASELINE.

### D-2026-08-12-04 — Do not encode mutable `main` head as durable handoff truth

**Decision:** use immutable product/feature baseline SHAs for durable implementation evidence; retrieve the current `main` head from GitHub remote truth at execution time.  
**Reason:** a documentation-only merge itself advances `main`, so a line claiming `Current protected-main head = <pre-doc-merge SHA>` becomes stale immediately after the document is merged.  
**Status:** LOCKED DOCUMENTATION PRACTICE.

### D-2026-08-12-05 — #3242 narrows, but does not close, E1c-B production verification

**Decision:** treat #3242 as production verification of the E1c-B workflow/calculation/snapshot/market-data path, while keeping authenticated browser lifecycle recovery as the only remaining closeout evidence.  
**Evidence:** #3242 ran on `fdc1199...`, completed 2/2 users successfully, uploaded both snapshots, and produced no NaN selected-price failure; lifecycle callbacks were skipped because scheduled runs have no `CALCULATION_JOB_ID`.  
**Reason:** do not under-credit real production evidence, but do not misclassify a scheduled run as browser lifecycle proof.  
**Status:** LOCKED FOR CURRENT CLOSEOUT.

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
**Verification:** exact-head tests/review/CI PASS; workflow/calculation/snapshot production path PASS via #3242; authenticated browser lifecycle verification pending.

### RC-MD-NAN-01 — Provider selected-price NaN residual

**Symptom:** scheduled updates #3237/#3238 failed closed with `MARKET_DATA_FAILED`.  
**Current evidence:** Yahoo/yfinance returned NaN selected price rows for Taiwan market data; semantic row classification remains unproven because the condition did not reproduce in #3239/#3240/#3241/#3242.  
**Current action:** diagnostic watch only.  
**Prohibited assumption:** do not infer that dropping/filling/substituting the row is financially correct without provider-row evidence.

### RC-DOC-01 — Mutable main SHA created self-stale handoff prose

**Symptom:** a handoff update correctly recorded the pre-merge `main` head, but merging that documentation PR immediately advanced `main` and made the phrase `Current protected-main head` stale.  
**Root cause:** mutable repository head and immutable product baseline were represented as the same concept.  
**Permanent fix:** record immutable product implementation baseline SHAs in durable prose and require remote lookup for current `main`.

---

## 11. Known Issues / Risks

### K1 — Authenticated browser lifecycle evidence gap

Severity: **current E1c-B closeout blocker, not a code blocker**.  
The implementation, frontend deployment, and production workflow/calculation/snapshot path are verified. The remaining evidence gap is specifically the changed authenticated browser pending recovery across refresh/reopen and terminal cleanup. Do not broaden this back into a generic server/workflow investigation without new evidence.

### K2 — Market-data NaN may recur

Severity: **watch / conditional product correctness risk**.  
No current reproduction after #3238, including scheduled #3242 on the E1c-B product baseline. If it recurs, classify from sanitized raw provider-row diagnostics before changing financial semantics.

### K3 — Retained queue production concurrency is not force-tested

Severity: **residual confidence item, not an automatic blocker**.  
Retained queue syntax/semantics are exact-head test/review validated and normal production execution succeeds. Do not generate artificial production contention solely for process completeness. Escalate only if normal production shows pending displacement, duplicate execution, or serialization failure.

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

For SHAs, distinguish:

- **immutable implementation baseline SHA** — suitable for durable handoff evidence;
- **current mutable `main` SHA** — must be fetched from GitHub at execution time and should not be treated as permanently current prose.

This prevents a documentation-only merge from making its own handoff stale immediately.

Production verification should also distinguish evidence layers rather than using one generic `VERIFIED` label:

```text
deployed artifact
≠ workflow execution
≠ calculation/snapshot success
≠ authenticated browser lifecycle behavior
```

Credit each layer once proven; keep only the truly missing layer open.

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
- merge commit / E1c-B product baseline `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- post-main CI #677 / run `31559255388` SUCCESS;
- Pages deployment run `31559254780` SUCCESS;
- Update Portfolio Data #3239/#3240/#3241 SUCCESS;
- no new NaN provider-row evidence observed;
- E1c-B authenticated browser lifecycle remained explicitly NOT VERIFIED.

**Files changed:** `to_do_update_list.md` only.  
**Runtime impact:** none.  
**Rollback:** revert this documentation change if any synchronized fact is later proven incorrect; do not roll back product code merely for a handoff-document error.

### 2026-08-12 — Handoff SHA semantics correction

**Scope:** documentation-only correction following the remote-truth sync.  
**Root cause:** labeling the PR #206 product merge SHA as the permanently `Current protected-main head` made the document self-stale once the documentation PR itself merged.  
**Correction:** `fdc1199...` is now identified as the immutable E1c-B product implementation baseline; current `main` must be re-fetched from GitHub remote truth.  
**Verification:** PR #208 exact-head CI #680 SUCCESS; merge `9e378c0f0f8a55ac2b37fa4ea8cfb5a1da0d412b`; post-main CI #681 SUCCESS; Pages #1493 / run `31560730310` SUCCESS.  
**Runtime impact:** none.

### 2026-08-12 — #3242 production evidence narrows E1c-B closeout

**Scope:** evidence-only handoff update; no runtime/workflow semantics changed.  
**Evidence:** `Update Portfolio Data #3242` / run `31560257260`, scheduled on E1c-B baseline `fdc1199...`, SUCCESS.  
**Result:** 53 market symbols downloaded; 2 users processed; 2 snapshots uploaded; 0 failures; no new NaN selected-price evidence.  
**Boundary:** scheduled run had no `CALCULATION_JOB_ID`, so running/terminal lifecycle callbacks were skipped and authenticated browser recovery remains NOT VERIFIED.  
**Conclusion:** production verification is narrowed to one remaining browser-lifecycle smoke rather than reopening workflow/calculation/server work.

---

## 16. Next Exact Actions

1. Treat E1c-A.1 as closed; do not spend more work on reconciliation/control-plane expansion without new material evidence.
2. Use E1c-B product implementation baseline `fdc1199bea47a2e47f38e2737827f1a2e38451f2` for feature-level provenance, but fetch the actual current `main` head from GitHub before consequential action.
3. Do **not** repeat generic workflow/calculation/snapshot production verification: #3242 already passed that layer on the E1c-B baseline.
4. Perform the remaining authenticated browser lifecycle smoke: frontend trigger → pending observed → refresh/reopen → same generation recovered → terminal resolution → normal portfolio/snapshot display.
5. Observe the resulting `Update Portfolio Data` run for same-job lifecycle callbacks and absence of duplicate/lost execution; do not manufacture additional concurrency unless normal evidence reveals a queue problem.
6. If the authenticated browser smoke passes with no material blocker, update this handoff and close E1c-B/E1c as appropriate; do not add unrelated cleanup work to the closeout.
7. Continue observing normal `Update Portfolio Data`; if `MARKET_DATA_FAILED` recurs with `NaN selected-price provider row`, extract sanitized date/OHLC/Adj Close/Volume/Dividends/Stock Splits/Capital Gains evidence and classify before proposing any financial-semantic fix.
8. Immediately after E1c-B closeout, perform the defined Product Functionality Review.
9. Select one next user-impact/correctness batch and resume normal functional optimization/development.
