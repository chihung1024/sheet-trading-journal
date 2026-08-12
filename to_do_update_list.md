# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-13 00:23 Asia/Taipei**  
Handoff revision: **E1c CLOSED / MD-NAN-B1 MERGED / PRODUCT FUNCTIONALITY REVIEW ACTIVE / NOW-1 RECOVERY-GATED**

---

## 1. Primary Product Goal

Deliver a reliable Trading Journal user flow:

```text
login
→ view/add/edit/delete transactions
→ trigger portfolio update
→ observe/recover calculation progress
→ publish/read correct snapshot
→ show correct holdings / P&L / performance / benchmark
→ surface actionable success/failure/retry state
```

**Convergence = finish necessary correctness/functionality work, then stop unnecessary expansion.** Do not close with a known material bug merely to shorten the phase; do not keep expanding infrastructure when no material product defect justifies it.

---

## 2. Current Product Status

| Area | Status | Product meaning |
|---|---|---|
| Gate A–D | DONE | closed |
| Gate E / E0 | DONE | architecture re-review closed |
| E1a / E1b | DONE | production completed |
| E1c-A.1 | CLOSED / PRODUCTION VERIFIED | durable dispatch binding + legacy orphan residue resolved |
| E1c-B | **CLOSED / PRODUCTION VERIFIED** | refresh/reopen recovery, terminal cleanup, retained workflow queue implemented and verified |
| Gate E / E1c | **CLOSED** | no known material lifecycle blocker remains |
| MD-NAN-B1 | **MERGED / POST-MAIN VERIFIED / NORMAL PRODUCTION PATH PASS** | bounded same-provider re-fetch mitigation deployed; retry branch remains production-watch only |
| Product Functionality Review | **ACTIVE — NOW-1** | record-create duplicate correctness defect is current single product line |
| NOW-1A / PR #213 | **IMPLEMENTED / RECOVERY-GATED** | server-side create idempotency compatibility is implemented; exact-head applicable CI reaches the intended Recovery Evidence Gate and fails closed |
| Staging D1 Recovery Evidence | **BLOCKED — PLATFORM STATE ANOMALY** | main run `31570497634` has never executed a step; GitHub run/job and concurrency states disagree |

The lifecycle/control-plane work is no longer the project focus. The current infrastructure investigation exists only because it blocks a demonstrated product-correctness fix.

---

## 3. E1c Final Production Evidence

E1c-B implementation PR #206:

- product baseline: `fdc1199bea47a2e47f38e2737827f1a2e38451f2`;
- Independent Review: PASS;
- exact-head CI #676 / `31559136662`: SUCCESS;
- post-main CI #677 / `31559255388`: SUCCESS;
- Pages #1491 / `31559254780`: SUCCESS.

Final browser recovery smoke:

- user performed one normal authenticated update;
- after calculation became active, browser was refreshed with F5;
- after refresh the UI automatically resumed the existing calculation;
- user did not press update again;
- UI reached terminal completion successfully.

GitHub remote truth for that operation:

- `Update Portfolio Data #3245`;
- run `31567498004`;
- event `workflow_dispatch`;
- head `c51291686d8eefd8aa5a50bc7492269857a3d081`;
- running callback SUCCESS;
- calculation/reconciliation SUCCESS;
- snapshot upload SUCCESS;
- terminal `succeeded` callback SUCCESS;
- workflow SUCCESS;
- previous authenticated dispatch #3244 occurred more than one hour earlier, therefore F5 did **not** create a duplicate workflow run.

Retained queue uses GitHub-native `queue: max` with repository-wide `portfolio-update` serialization and `cancel-in-progress: false`. Exact syntax/contract is covered by CI/review. Do not manufacture concurrent production calculations solely to demonstrate queueing; revisit only if real replacement/saturation evidence appears.

Durable lifecycle record:

`docs/engineering/GATE_E_E1C_JOB_LIFECYCLE_2026-08-11.md`

---

## 4. Market-Data Correctness Residual

Production #3243 reproduced transient upstream daily-row incompleteness/inconsistency: provider rows could contain Open/High/Low/Volume while Close/Adj Close were NaN; at least one captured row was internally inconsistent enough that OHLC substitution would be unsafe.

PR #210 — bounded same-provider fresh re-fetch:

- product baseline: `a8b03877449e885df935389e63fc23e6eb765dd2`;
- exact-head Independent Review: PASS;
- exact-head CI #696 / `31565889026`: SUCCESS;
- post-main CI #697 / `31566063069`: SUCCESS;
- Pages #1495 / `31566062067`: SUCCESS.

Financial-integrity contract remains:

- no drop/fill/forward-fill/back-fill;
- no Open/High/Low/Adj Close substitution;
- no alternate provider or guessed price;
- one bounded fresh request to the same provider/request semantics is allowed only with complete action evidence, same selected price source, and preservation of every original provider daily date;
- unacceptable retry remains fail-closed.

#3245 is a post-merge production SUCCESS and proves the normal path remains compatible after the mitigation. It did not reproduce NaN, so the actual retry branch is **not claimed production-exercised**. Keep passive production watch; do not add speculative market-data repair work unless the defect recurs or new evidence shows incorrect financial results.

---

## 5. Current Active Batch — Product Functionality Review / NOW-1

Review the real user path, not architecture in isolation:

```text
1. login / session restoration
2. transaction list/read
3. add transaction
4. edit transaction
5. delete transaction
6. portfolio update trigger
7. queued/running progress and refresh/reopen recovery
8. terminal success/failure feedback
9. snapshot refresh
10. holdings correctness
11. realized/unrealized P&L and daily P&L
12. performance metrics / benchmark behavior
13. empty/error/retry states
14. mobile/responsive usability where it affects actual use
```

For each finding classify:

- **NOW** — material correctness/data bug, user-blocking failure, security/auth bypass, duplicate/lost calculation, incorrect snapshot/performance, or a defect that predictably contaminates the next functional batch;
- **NEXT** — important user-facing improvement that is safely separable;
- **BACKLOG** — genuine non-blocking technical/UX improvement;
- **REJECT** — insufficient evidence/value or infrastructure idealization without a current product problem.

Only NOW findings block the review closeout. Do not turn discovery into automatic scope expansion.

### NOW-1 — duplicate record creation after ambiguous POST outcome

Material correctness defect: `POST /api/records` historically had no durable create identity. If D1 committed an INSERT but the response was lost, a later manual resubmission could create a second valid-looking BUY/SELL/DIV row and contaminate holdings, P&L, and performance.

NOW-1A PR #213 is intentionally server-first and narrow:

- nullable internal `records.create_idempotency_hash` and `records.create_payload_hash`;
- tenant-scoped unique create-idempotency index;
- Worker `4.08` / API `2.61` / D1 Schema `3`;
- old clients remain compatible when `Idempotency-Key` is absent;
- same tenant + same key + same validated payload replays success without a second INSERT;
- same key + different validated payload fails closed with HTTP 409 `IDEMPOTENCY_CONFLICT`;
- different keys still permit intentionally identical legitimate trades;
- internal hashes never enter public record projection.

Rollout remains locked:

`Recovery Evidence Gate → merge server compatibility → production migration/Worker activation → verify → NOW-1B frontend stable-key persistence/replay`

Do not make the frontend depend on Schema 3 / Worker 4.08 before server activation is verified.

---

## 6. Known Stable Decisions / Architecture Notes

- durable server lifecycle is authoritative over browser age;
- active jobs are not expired by age alone;
- browser pending state is recovery metadata;
- exact idempotency replay and benchmark intent remain protected;
- Worker/D1 lifecycle semantics are not to be redesigned without new evidence;
- E1c by itself does not justify Schema 3, a custom scheduler, heartbeat/sweeper, ledger redesign, Decimal migration, tenant UUID migration, or broad auth redesign;
- the narrow record-create correctness defect **does** justify the isolated Schema 3 migration in NOW-1A, but does not reopen the historical broad Schema 3 roadmap;
- `RECOVERY-EVIDENCE-GATE` remains authoritative and must not be bypassed, mocked, or satisfied by fabricated metadata;
- historical remediation plans are evidence/candidate sources, not automatic execution roadmaps;
- a known material product defect may be promoted to NOW even if it falls outside an older scope label.

---

## 7. Backlog / Deferred Unless Evidence Promotes Them

- broad Schema 3 roadmap / unrelated new calculation-job columns;
- custom scheduler or queue service;
- automatic job lease/heartbeat/sweeper;
- ledger revision / compare-and-publish;
- cursor-signing redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- broad provider redesign;
- broad authentication/session redesign;
- CI/CD or governance beautification.

None of these should interrupt product functionality work without a demonstrated current correctness, security, outage, or delivery blocker.

---

## 8. Exact Next Actions / Master Plan

1. Preserve the current reviewed recovery workflow and its evidence; do **not** change workflow code, concurrency group, staging policy, or Recovery Evidence Gate as a workaround.
2. Resolve GitHub Actions run `31570497634` with one controlled **normal cancel**; immediately verify that the stale `staging-d1-recovery-evidence` concurrency lease is released.
3. Only after release is verified, rerun the same recovery job/run against original main SHA `5bed9aa1058c64e87889afd9b1698921eeb2c186` and require real staging export/drop/restore/integrity evidence.
4. If the rerun again becomes `queued` with no runner/steps while the concurrency group reports `in_progress`, stop retrying and classify GitHub platform orchestration as an externally reproducible BLOCKER.
5. Independently verify the generated recovery artifact and gate metadata before changing Recovery Evidence Gate status.
6. Re-run PR #213 exact-head CI after legitimate gate evidence is committed; require all applicable checks success, focused Independent Review, unchanged head/base/mergeability, and only then consider merge.
7. After server migration/Worker production activation is verified, begin NOW-1B frontend stable-key persistence/replay as a separate batch.
8. Keep MD-NAN-B1 under passive production watch; only reopen if new provider evidence materially changes the safety decision.
9. Continue the remaining Product Functionality Review only after NOW-1 is no longer blocked.

---

## 9. NOW-1 / Recovery Blocker Handoff Record

### Stable State

- protected `main` remains at `5bed9aa1058c64e87889afd9b1698921eeb2c186` during this batch;
- PR #213 branch only was modified; production and main runtime were not changed;
- PR #213 exact-head CI #714 / run `31617117349` reaches the intended fail-closed Recovery Evidence Gate with Python tests SUCCESS, frontend tests/build SUCCESS, Worker test suite SUCCESS, and Worker deployment metadata SUCCESS;
- no Recovery Evidence Gate bypass, fake evidence, production mutation, force push, or workflow workaround was used.

### Change Log

PR #213 branch compatibility/contract convergence:

- `064162b15eaa1e0b7c58866a52b92a0e0eb0d05c` — align `tests/worker_deployment.test.mjs` with Worker 4.08 / API 2.61 / Schema 3;
- `0e29810fd74b116b7472cb2637f33686c6e97c21` — synchronize canonical `worker-manifest.json`, tracked `wrangler.toml`, and deployment checker with Worker 4.08 / API 2.61 / migration 0003;
- `4d132fde2a574b7fdd640a7a0aef8954da85fbb8` — align manifest exporter regression expectations with 4.08 / 2.61 / 3;
- `5b669b3ab55dceb66e654852b8e29b9c852ee6b3` — restore explicit migration 0002 `calculation_jobs` validation while retaining migration 0003 Schema 3/idempotency validation.

### Root Cause Log

1. **PR #213 CI contract drift — FIXED on branch**
   - Symptom: Worker tests/config checks initially failed before Recovery Evidence Gate.
   - Root cause: runtime implementation had already advanced to Worker 4.08 / API 2.61 / Schema 3 while active deployment tests, manifest, Wrangler metadata, exporter expectations, and latest-migration checker still encoded 4.07 / 2.60 / Schema 2.
   - Fix: synchronize only active deployment contract sources and regression expectations; preserve previous migration validation coverage.
   - Regression: exact-head CI #714 reaches Recovery Evidence Gate with all preceding applicable checks successful.

2. **Staging recovery workflow scheduling — PROBABLE EXTERNAL PLATFORM ROOT CAUSE / NOT REPO-FIXED**
   - run `31570497634` and job `94031248237` remain `queued`; job has no runner and no executed steps;
   - staging environment has no pending approval and permits `main`;
   - repository concurrency API simultaneously lists the same run as `in_progress` in `staging-d1-recovery-evidence`;
   - run-specific concurrency lookup does not consistently recognize that membership;
   - later ordinary GitHub-hosted CI jobs in the same repository acquire runners normally.
   - Current classification: GitHub Actions concurrency lease / workflow-run state desynchronization is the strongest evidence-based hypothesis. Backend service root cause is not directly observable and therefore is not claimed proven.

### Known Issues / Risks

- Recovery drill has executed zero steps, therefore there is still **no acceptable Schema 3 recovery evidence**.
- PR #213 must remain blocked even though its implementation/tests now converge correctly.
- The connected GitHub action interface available to this session does not expose normal workflow-run cancellation or full-run rerun; do not substitute a job rerun against a still-queued job.
- A controlled cancel/rerun is diagnostic only after the stale concurrency lease is verified released.
- Independent Review for current PR #213 head remains pending and must occur after the blocker is resolved and exact-head applicable CI can pass.

### Deferred / Rejected Candidates

- **REJECT NOW:** remove/rename recovery concurrency group to force scheduling;
- **REJECT NOW:** remove `environment: staging`;
- **REJECT NOW:** fabricate or manually mark recovery evidence passed;
- **REJECT NOW:** merge PR #213 while the Recovery Evidence Gate is red;
- **BACKLOG:** any broader GitHub Actions queue/orchestration redesign unless the controlled rerun reproduces the platform anomaly.
