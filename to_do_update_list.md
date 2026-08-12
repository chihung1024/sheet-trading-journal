# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-13 00:41 Asia/Taipei**  
Handoff revision: **E1c CLOSED / MD-NAN-B1 MERGED / PRODUCT FUNCTIONALITY REVIEW ACTIVE / NOW-1A RECOVERY PASSED / PRE-MERGE REVIEW PENDING**

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
| NOW-1A / PR #213 | **IMPLEMENTED / EXACT-HEAD CI PASS / REVIEW PENDING** | server-side create idempotency compatibility and Schema 3 recovery evidence are verified; merge still requires focused Independent Review and final head/base/mergeability check |
| Staging D1 Recovery Evidence | **PASSED / VERIFIED** | controlled rerun `31570497634` attempt 2 completed real staging export/drop/restore/integrity/cleanup and produced verified evidence |

The lifecycle/control-plane work is no longer the project focus. The recovery investigation was retained only because it blocked a demonstrated product-correctness fix; that blocker is now closed.

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

Recovery Evidence Gate is now satisfied, but the remaining pre-merge review/mergeability gates still apply. Do not make the frontend depend on Schema 3 / Worker 4.08 before server activation is verified.

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

1. Re-run exact-head CI after this handoff update; require Python tests, frontend contracts/build, Worker tests, deployment metadata, Recovery Evidence Gate, and local D1 schema smoke all SUCCESS.
2. Perform a focused Independent Review on the exact PR #213 head covering concurrency/race behavior, schema compatibility, tenant isolation, replay/conflict semantics, public-data privacy, security, regression, performance, tests, documentation, and rollback.
3. Classify review findings as BLOCKER / FOLLOW-UP / BACKLOG / REJECT. Only BLOCKER prevents merge; do not reopen unrelated architecture work.
4. Immediately before merge, re-fetch protected `main`, PR head/base, mergeability, and applicable checks. Merge only if head is unchanged, main has not introduced a conflicting change, CI is exact-head green, and review has no BLOCKER.
5. After merge, verify post-main CI, then execute the reviewed production Schema 3 migration / Worker 4.08 activation path and verify exact runtime version, schema metadata, health, tenant isolation, and backward compatibility before any frontend dependency is introduced.
6. Only after production server activation is verified, begin NOW-1B frontend stable-key persistence/replay as a separate product batch.
7. Keep MD-NAN-B1 under passive production watch; only reopen if new provider evidence materially changes the safety decision.
8. Resume the remaining Product Functionality Review after NOW-1A production activation is closed; do not let infrastructure cleanup replace product work.

---

## 9. NOW-1 / Recovery and CI Convergence Handoff Record

### Stable State

- protected `main` is `5bed9aa1058c64e87889afd9b1698921eeb2c186`; this is also the exact recovery-evidence baseline;
- production/main runtime were not changed by the PR-branch convergence work;
- controlled recovery run `31570497634` attempt 2 completed SUCCESS after the stale attempt was normally cancelled;
- Recovery Evidence Gate is now `passed` with existing structured JSON proofs under the controlled evidence root;
- PR #213 exact-head CI #717 / run `31618585464` on `aff47febc0fc0b45ef0c3a7078841fb4d216d1e7` completed SUCCESS across Python, frontend, Worker tests, deployment metadata, Recovery Evidence Gate, and local D1 schema smoke;
- no fake evidence, production recovery drill, force push, workflow bypass, or concurrency-policy workaround was used.

### Recovery Evidence

- workflow run: `31570497634`, attempt `2`, conclusion `success`;
- original/main baseline: `5bed9aa1058c64e87889afd9b1698921eeb2c186`;
- artifact id: `9150025501`;
- artifact name: `staging-d1-recovery-evidence-5bed9aa1058c64e87889afd9b1698921eeb2c186`;
- artifact ZIP SHA-256: `ded4e5e3c264775b663571bb9b59d79826482e419a6210c268a9c37192b1b716`, independently matched after download;
- measurements SHA-256: `fd2848d62f88d8c751098dcd1967b172117322c615e21a7996037d097a984e0f`;
- measured restore duration: `2907 ms`;
- verified operations: synthetic export, destructive drop, restore, sentinel/checksum integrity, owned-table cleanup;
- required evidence documents: `export_backup`, `restore_drill`, `rollback_timing`, `integrity_verification`, `migration_rollback_forward_strategy`, `d1_recovery_proof`, all `status=passed` and bound to the same baseline/measurements digest.

### Change Log

PR #213 branch compatibility/contract convergence:

- `064162b15eaa1e0b7c58866a52b92a0e0eb0d05c` — align `tests/worker_deployment.test.mjs` with Worker 4.08 / API 2.61 / Schema 3;
- `0e29810fd74b116b7472cb2637f33686c6e97c21` — synchronize canonical `worker-manifest.json`, tracked `wrangler.toml`, and deployment checker with Worker 4.08 / API 2.61 / migration 0003;
- `4d132fde2a574b7fdd640a7a0aef8954da85fbb8` — align manifest exporter regression expectations with 4.08 / 2.61 / 3;
- `5b669b3ab55dceb66e654852b8e29b9c852ee6b3` — restore explicit migration 0002 `calculation_jobs` validation while retaining migration 0003 Schema 3/idempotency validation;
- `d761554850f20dc89303ddf5458a040914166a28` — record the original NOW-1 recovery blocker handoff;
- `6548e70697fd87ee8e28222d818792ab15fea331` — persist the independently verified recovery evidence and set Recovery Evidence Gate to passed;
- `aff47febc0fc0b45ef0c3a7078841fb4d216d1e7` — bind local D1 schema smoke metadata verification to canonical `worker-manifest.json`, eliminating the final 4.07/Schema 2 stale assertion.

### Root Cause Log

1. **PR #213 active deployment-contract drift — FIXED**
   - Symptom: CI successively failed in Worker deployment tests, deployment metadata, manifest exporter expectations, and finally local D1 schema smoke after Schema 3 became eligible.
   - Root cause: implementation had advanced to Worker 4.08 / API 2.61 / Schema 3 while several active contract checks still encoded 4.07 / 2.60 / Schema 2.
   - Systemic prevention: canonical manifest now drives local D1 final metadata expectation; active manifest/Wrangler/migration checks are synchronized and previous migration coverage remains retained.
   - Regression proof: CI #717 is fully green, including real local application of migrations 0001, 0002, and 0003.

2. **Staging recovery workflow scheduling anomaly — RESOLVED OPERATIONALLY / PLATFORM BACKEND ROOT CAUSE UNPROVEN**
   - Original symptom: run `31570497634` was `queued` with no runner/steps while concurrency API simultaneously treated it as `in_progress`.
   - Controlled action: user performed one normal cancel; the stale concurrency lease cleared.
   - Diagnostic result: attempt 2 immediately acquired a GitHub-hosted runner, concurrency/run state became consistent, and the full drill succeeded.
   - Conclusion: the evidence strongly supports a transient GitHub Actions orchestration/concurrency state desynchronization. Internal GitHub backend cause is not observable and is therefore not claimed proven.
   - Reopen condition: only if the same queued/no-runner + concurrency-in-progress contradiction recurs.

3. **Local D1 schema smoke stale metadata assertion — FIXED**
   - Symptom: after Recovery Gate passed, all three migrations applied successfully but `tools/test_d1_schema.mjs` rejected the valid row `{schema_version:3, release_version:"4.08"}`.
   - Failure point: hard-coded final expectation remained Schema 2 / 4.07.
   - Root cause: smoke checker was not bound to the canonical runtime manifest.
   - Fix: read `worker-manifest.json` and compare local D1 metadata against its schema/release contract.
   - Regression proof: CI #717 local D1 schema step SUCCESS.

### Known Issues / Risks

- Focused Independent Review for the final PR #213 head is still pending; do not merge until it has no BLOCKER findings.
- Production Schema 3 migration / Worker 4.08 activation is **not yet performed**; current verification is PR/local/staging recovery evidence only.
- NOW-1B frontend stable-key persistence/replay remains intentionally blocked until production server compatibility is verified.
- Recovery evidence proves controlled isolated staging recoverability for the reviewed migration strategy; it does not justify unrelated Schema 3 expansion.

### Deferred / Rejected Candidates

- **REJECT NOW:** remove/rename recovery concurrency group;
- **REJECT NOW:** remove `environment: staging`;
- **REJECT NOW:** fabricate or manually mark recovery evidence without structured proof;
- **REJECT NOW:** merge PR #213 without focused review merely because CI is green;
- **BACKLOG:** broader GitHub Actions queue/orchestration redesign unless the exact platform anomaly recurs;
- **BACKLOG:** unrelated broad Schema 3 roadmap items.
