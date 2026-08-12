# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-13 01:40 Asia/Taipei**  
Handoff revision: **E1c CLOSED / MD-NAN-B1 MERGED / PRODUCT FUNCTIONALITY REVIEW ACTIVE / NOW-1A MERGED + POST-MAIN VERIFIED / PRODUCTION ACTIVATION PREP — FREEZE R ONLY AFTER SAME-SHA CI + PAGES / DOCUMENT QUALITY MAINTAINED**

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
| Product Functionality Review | **ACTIVE — NOW-1** | record-create duplicate correctness defect remains the current single product line until server activation + NOW-1B close the user-visible ambiguity gap |
| NOW-1A / PR #213 | **MERGED / POST-MAIN VERIFIED / PRODUCTION ACTIVATION PENDING** | server-side create-idempotency compatibility is on protected main; runtime-changing merge commit `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`; production still runs the last verified 4.07 / 2.60 / Schema 2 contract |
| Staging D1 Recovery Evidence | **PASSED / VERIFIED** | controlled rerun `31570497634` attempt 2 completed real staging export/drop/restore/integrity/cleanup and produced verified evidence |
| Document Quality | **MAINTAINED — ACTIVATION SOURCE/EVIDENCE TIMING CONTRACT CORRECTED** | source/live/authority boundaries are explicit; production source R is frozen only after the same protected-main SHA has successful post-main CI and Pages production deployment and main is re-confirmed unchanged |

The lifecycle/control-plane work is no longer the project focus. Recovery investigation was retained only because it blocked a demonstrated product-correctness fix; that blocker is closed. The current infrastructure work is limited to the minimum production-activation boundary required to finish NOW-1A safely.

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

Rollout state is now:

```text
Recovery Evidence Gate PASS
→ server compatibility MERGED + POST-MAIN VERIFIED
→ finish pre-R main changes
→ same-SHA post-main CI SUCCESS
→ same-SHA Pages production deployment SUCCESS
→ re-fetch main and confirm same SHA
→ freeze R = exact current-main SHA
→ read-only Production Identity Evidence for exact R
→ reviewed authority A authorizes R
→ production Schema 3 migration / Worker 4.08 activation
→ production verification
→ NOW-1B frontend stable-key persistence/replay
```

Do not make the frontend depend on Schema 3 / Worker 4.08 before server activation is verified.

Independent Review for NOW-1A is PASS under the repository's Same-AI Independent Review Isolation Protocol. A separate GitHub identity / Copilot / human reviewer is not an intrinsic R2 requirement; specialist escalation remains mandatory only when the Playbook's risk/competence rules require it.

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
- Independent Review means independent evidence reconstruction and competent adversarial judgment, **not** necessarily a different GitHub account; use `AI_PROJECT_PLAYBOOK.md` §§20–24 as authority;
- historical remediation plans are evidence/candidate sources, not automatic execution roadmaps;
- a known material product defect may be promoted to NOW even if it falls outside an older scope label;
- protected-main source contract and live production runtime are separate states between merge and controlled activation; never infer production deployment from repository HEAD alone;
- Production Identity Evidence requires both `source_sha == current protected-main HEAD` and canonical Pages production deployment commit `== source_sha`; therefore do not freeze R until the same candidate SHA has successful post-main CI and Pages production deployment and protected main is re-confirmed unchanged;
- if main changes while waiting for CI/Pages, the old provisional candidate is not R; wait for the new main SHA's same-SHA CI/Pages state and re-evaluate before freezing R;
- once exact-source evidence is accepted for R, later activation-authority commit A may advance main while explicitly authorizing that immutable R.

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
- CI/CD or governance beautification;
- dedicated remote D1 record-create concurrency stress harness unless real race evidence appears.

None of these should interrupt product functionality work without a demonstrated current correctness, security, outage, or delivery blocker.

---

## 8. Exact Next Actions / Master Plan

1. Re-check GitHub remote truth. This candidate corrects the activation source/evidence timing contract; if PR #216 is not yet on protected `main`, finish its exact-head CI/review/strict-ruleset merge gate before collecting production evidence.
2. After **all intended pre-R main changes are complete**, identify the current protected-main SHA as a provisional activation candidate and re-check `worker-manifest.json`, Recovery Evidence Gate, deployment environment contract, current activation authority, Production Identity Evidence workflow, and canonical deployment workflow. Confirm no runtime/deployment-affecting diff invalidates Worker 4.08 / API 2.61 / Schema 3.
3. Require post-main CI SUCCESS and Pages production deployment SUCCESS for that **same provisional candidate SHA**. If main changes while waiting, discard that provisional candidate and restart this step for the new current-main SHA.
4. After both same-SHA CI and Pages are successful, re-fetch protected main. Only if it still equals the verified candidate SHA, freeze `R = current protected-main HEAD`.
5. Dispatch GET-only `Production Identity Evidence` with `source_sha=R`. Do not merge another pre-R change between the final main re-check and this exact-R evidence run.
6. Inspect the sanitized evidence artifact independently. Only a real PASS artifact bound to exact `R` may be transformed into the controlled production-activation evidence set and a fresh authority commit `A` that explicitly authorizes the same `R`.
7. Current authority still authorizes only `fe5f091fdb2c92970dff74c1a7c99052084adb95`; it authorizes **no NOW-1A candidate**. Do not deploy until the new exact-R authority is reviewed and on protected main.
8. Only after exact-source authorization, execute the canonical `Deploy Worker` path with `source_sha=R`. Require migration `0003_record_create_idempotency.sql` before Worker 4.08 deployment and verify exact source, Worker 4.08 / API 2.61 / Schema 3, D1 identity, health, auth/CORS, tenant isolation, and legacy no-key compatibility.
9. Before NOW-1B production activation, resolve and test both review FOLLOW-UP items: (a) delete-then-reuse idempotency-key retention semantics; (b) frontend/Worker rollback-disable coordination once stable frontend keys exist.
10. Only after production server activation is verified, begin NOW-1B frontend stable-key persistence/replay as a separate product batch.
11. Keep MD-NAN-B1 under passive production watch; only reopen if new provider evidence materially changes the safety decision.
12. Resume the remaining Product Functionality Review after NOW-1A production activation is closed; do not let infrastructure or document cleanup replace product work.

---

## 9. NOW-1 / Recovery, Review, Merge, and CI Convergence Handoff Record

### Stable State

- PR #213 runtime-changing merge is `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`; later documentation descendants may advance protected main without changing the Worker 4.08 / API 2.61 / Schema 3 runtime tree;
- post-NOW-1A documentation merge `ff9d792a98dacdc8a9e5dc9d145020320624b86a` is an evidence baseline only, **not a permanently hard-coded R**;
- exact up-to-date PR #213 CI #719 / run `31621500033` completed SUCCESS across all three required checks;
- PR #213 Independent Review Gate PASS; focused re-review on exact synchronized head PASS with no BLOCKER;
- post-main CI #720 / run `31621612621` on runtime-changing merge commit `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf` completed SUCCESS;
- document-quality PR #215 merged as `ff9d792a98dacdc8a9e5dc9d145020320624b86a`; post-main CI #723 completed SUCCESS and Pages #1500 build/deploy completed successfully at the job level;
- controlled recovery run `31570497634` attempt 2 completed SUCCESS after the stale attempt was normally cancelled;
- the recovery-evidence baseline remains `5bed9aa1058c64e87889afd9b1698921eeb2c186`; do **not** confuse that immutable evidence baseline with current protected main;
- Recovery Evidence Gate is `passed` with structured JSON proofs under the controlled evidence root;
- repository source contract is Worker 4.08 / API 2.61 / Schema 3, but production activation has **not** occurred;
- last verified live production deployment remains exact source `fe5f091fdb2c92970dff74c1a7c99052084adb95`, Worker 4.07 / API 2.60 / Schema 2, from successful Deploy Worker #4 / `31475347673`;
- current activation authority still authorizes only that older `fe5f091f...` source;
- no NOW-1A R is frozen yet; freeze R only after PR #216 (or any later intended pre-R change) is on main and that same main SHA has successful post-main CI + Pages deployment and remains current on a fresh re-check;
- no fake evidence, force push, workflow bypass, ruleset bypass, or concurrency-policy workaround was used.

### Recovery Evidence

- workflow run: `31570497634`, attempt `2`, conclusion `success`;
- immutable recovery-evidence baseline: `5bed9aa1058c64e87889afd9b1698921eeb2c186`;
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
- `aff47febc0fc0b45ef0c3a7078841fb4d216d1e7` — bind local D1 schema smoke metadata verification to canonical `worker-manifest.json`, eliminating the final 4.07/Schema 2 stale assertion;
- `14e8d1d262117b35c2ce2867988d8a4f626ec255` — record recovery PASS and CI convergence before final review;
- `cea2b5a66f884c3414e18d0764d75285e67e5a89` — merge current main into PR #213 branch without force so strict up-to-date required checks could run on the actual candidate;
- `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf` — merge PR #213 to protected main;
- CI #720 / `31621612621` — post-main full CI SUCCESS on `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`.

Post-NOW-1A document quality:

- `e28620ed5b3fd0d7404fd2cd4b9e1ffdc2750b90` — separate repository runtime contract from last verified live production in `docs/DEPLOYMENT.md` and lock activation behind exact-source authority;
- `92b98b98b26e5e908a5d994e48502cd7263ce72c` — align the live handoff with PR #213 merged/post-main state and record governance/ruleset root causes;
- `4a50e698bef3a5a6f698bacf9570b80a196644e5` — resolve the first docs-review self-staleness BLOCKER by making the handoff durable across its own merge;
- `ff9d792a98dacdc8a9e5dc9d145020320624b86a` — merge PR #215 document-quality corrections to protected main;
- `28b834c3fdba5bd16824beb26d2c54e548f728ae` — correct the activation source-selection runbook after tracing the exact-main-only Production Identity Evidence contract;
- `22cdf13457a9e0dd4123505d6ef708f9db9da144` — add the same-SHA Pages propagation requirement before exact-R production identity evidence;
- this handoff commit — mirror that exact-main + exact-Pages timing contract and record the second PR #216 review finding.

### Root Cause Log

1. **PR #213 active deployment-contract drift — FIXED**
   - Symptom: CI successively failed in Worker deployment tests, deployment metadata, manifest exporter expectations, and finally local D1 schema smoke after Schema 3 became eligible.
   - Root cause: implementation had advanced to Worker 4.08 / API 2.61 / Schema 3 while several active contract checks still encoded 4.07 / 2.60 / Schema 2.
   - Systemic prevention: canonical manifest now drives local D1 final metadata expectation; active manifest/Wrangler/migration checks are synchronized and previous migration coverage remains retained.
   - Regression proof: CI #719 and post-main CI #720 are green, including local application of migrations 0001, 0002, and 0003.

2. **Staging recovery workflow scheduling anomaly — RESOLVED OPERATIONALLY / PLATFORM BACKEND ROOT CAUSE UNPROVEN**
   - Original symptom: run `31570497634` was `queued` with no runner/steps while concurrency API simultaneously treated it as `in_progress`.
   - Controlled action: user performed one normal cancel; the stale concurrency lease cleared.
   - Diagnostic result: attempt 2 immediately acquired a GitHub-hosted runner, concurrency/run state became consistent, and the full drill succeeded.
   - Conclusion: evidence strongly supports a transient GitHub Actions orchestration/concurrency state desynchronization. Internal GitHub backend cause is not observable and is therefore not claimed proven.
   - Reopen condition: only if the same queued/no-runner + concurrency-in-progress contradiction recurs.

3. **Local D1 schema smoke stale metadata assertion — FIXED**
   - Symptom: after Recovery Gate passed, all three migrations applied successfully but `tools/test_d1_schema.mjs` rejected the valid row `{schema_version:3, release_version:"4.08"}`.
   - Failure point: hard-coded final expectation remained Schema 2 / 4.07.
   - Root cause: smoke checker was not bound to the canonical runtime manifest.
   - Fix: read `worker-manifest.json` and compare local D1 metadata against its schema/release contract.
   - Regression proof: CI #719 and post-main CI #720 local D1 schema step SUCCESS.

4. **Independent Review identity interpretation drift — FIXED**
   - Symptom: a separate GitHub identity / Copilot / external reviewer was incorrectly treated as a mandatory R2 merge gate after the technical review was otherwise complete.
   - Root cause: review execution drifted from `AI_PROJECT_PLAYBOOK.md` §§20–24, which explicitly define independence as fresh judgment reconstruction rather than different identity and explicitly permit Same-AI Independent Review with isolation.
   - Fix: preserve the earlier review audit trail, add a superseding Same-AI Independent Review determination, re-establish primary evidence, perform adversarial review, and anchor the conclusion to exact candidate heads.
   - Prevention: before inventing an external identity gate, read the Playbook's primary Independent Review and competence rules. Different identity is not evidence of independence; competence + isolated evidence reconstruction are the governing criteria.
   - Reopen condition: R3/specialist requirement, competence insufficiency, or new critical residual risk.

5. **Strict required-status merge block — FIXED WITHOUT BYPASS**
   - Symptom: first PR #213 merge attempt was rejected even though GitHub's synthetic merge CI was green.
   - Root cause: the protected-main ruleset uses strict up-to-date required status checks; the PR branch itself was behind current main, so required checks were still `expected` for merge policy purposes.
   - Fix: merge current main into the PR branch non-force, run exact-head CI #719, perform focused exact-head re-review, then merge normally.
   - Prevention: before final merge, inspect branch/ruleset up-to-date requirements in addition to CI conclusion; never infer merge-policy satisfaction solely from a green synthetic merge run.

6. **Live handoff self-staleness at documentation merge boundary — FIXED**
   - Symptom: first document-quality candidate labeled Document Quality `ACTIVE` and told the next agent to finish the same PR, which would become false immediately after merge.
   - Root cause: the live handoff described transient PR execution state instead of a durable post-merge state, despite remote truth already being the higher authority for PR status.
   - Fix: describe document quality as maintained and make the first next action conditional on fresh GitHub remote truth; after merge the same text remains valid without another documentation-only cleanup loop.
   - Prevention: live handoff changes should target a durable stable state and avoid self-referential “merge this document” instructions unless phrased as a remote-truth condition.

7. **Provisional activation R hard-coded before exact-main evidence contract trace — FIXED ON PR #216 CANDIDATE**
   - Symptom: the first deployment-doc correction named the earlier PR #213 merge `6ea866...` as the intended next runtime source R; after the docs PR merged, protected main advanced, while `Production Identity Evidence` requires its `source_sha` to equal current main exactly.
   - Failure point: following the runbook literally would make a read-only evidence dispatch for `6ea866...` fail the workflow's exact-current-main assertion.
   - Root cause: runtime provenance SHA was confused with final activation-source selection. Source selection was documented before tracing the evidence collector's exact-main precondition through the complete activation sequence.
   - Fix: remove the provisional hard-coded R and select R only from a fresh current-main read after pre-R work is complete.
   - Prevention: trace all activation workflow preconditions before freezing an operational SHA in documentation; distinguish “commit that introduced runtime behavior” from “exact deployable source identity selected for activation”.

8. **Production identity evidence timing omitted same-SHA Pages propagation — FIXED ON PR #216 CANDIDATE**
   - Symptom: the first source-selection correction said to select R and immediately dispatch Production Identity Evidence after checking current main.
   - Failure point: the collector also requires the canonical Pages production deployment commit to equal the audited `source_sha`; immediately dispatching before Pages propagation could predictably fail closed against stale Pages state.
   - Root cause: review traced the workflow's exact-main assertion first but had not yet carried the collector's exact-Pages deployment equality through the operational sequence.
   - Fix: require same-SHA post-main CI SUCCESS and same-SHA Pages production deployment SUCCESS, then re-fetch main and confirm the SHA is still current before freezing R and dispatching evidence.
   - Prevention: production activation source selection must satisfy **all** workflow/collector preconditions, including asynchronous downstream propagation, before evidence collection begins.

### Known Issues / Risks

- Production Schema 3 migration / Worker 4.08 activation is **not yet performed**. Repository merge and staging/local evidence are not production deployment evidence.
- Current `config/production-activation-authority.json` still authorizes exact source `fe5f091fdb2c92970dff74c1a7c99052084adb95`; it authorizes **no NOW-1A source**.
- A new NOW-1A `R` must not be guessed from PR #213 history. After PR #216 and any other intended pre-R changes are merged, require the same current-main SHA to complete post-main CI + Pages deployment, then re-fetch main unchanged before freezing R and collecting exact-R read-only evidence.
- NOW-1B frontend stable-key persistence/replay remains intentionally blocked until production server compatibility is verified.
- **FOLLOW-UP before NOW-1B:** idempotency identity currently lives on the record row; deleting a keyed-created record removes retained key memory. Define/test bounded key lifetime or retained server tombstone/ledger semantics before claiming cross-deletion exactly-once.
- **FOLLOW-UP before NOW-1B:** once frontend stable keys exist, rollback to an older Worker that ignores them can re-open duplicate-create risk. Define frontend disable/rollback coordination before frontend activation.
- Recovery evidence proves controlled isolated staging recoverability for the reviewed migration strategy; it does not justify unrelated Schema 3 expansion.

### Deferred / Rejected Candidates

- **REJECT NOW:** weaken `Production Identity Evidence` exact-current-main assertion merely to reuse an older provisional SHA;
- **REJECT NOW:** weaken the collector's canonical Pages deployment SHA equality merely to dispatch evidence earlier;
- **REJECT NOW:** remove/rename recovery concurrency group;
- **REJECT NOW:** remove `environment: staging`;
- **REJECT NOW:** fabricate or manually mark recovery evidence without structured proof;
- **REJECT NOW:** require Copilot / another GitHub account solely to manufacture reviewer identity when Playbook-compliant Independent Review is already possible;
- **REJECT NOW:** broad idempotency ledger / soft-delete redesign solely for architectural completeness;
- **BACKLOG:** broader GitHub Actions queue/orchestration redesign unless the exact platform anomaly recurs;
- **BACKLOG:** unrelated broad Schema 3 roadmap items;
- **BACKLOG:** dedicated remote D1 record-create concurrency stress harness unless real race evidence appears.

---

## 10. Document Quality Review — 2026-08-13

Status: **MAINTAINED / ACTIVATION SOURCE + EVIDENCE TIMING CONTRACT CORRECTED ON PR #216 CANDIDATE**

Objective: prevent project memory distortion before NOW-1A production activation without turning documentation into a parallel project.

### Reviewed / changed

- `to_do_update_list.md` — **UPDATED**: separates immutable recovery baseline, runtime provenance, repository source contract, live production runtime, activation-source selection, and same-SHA CI/Pages evidence timing; records review/ruleset/activation-contract root causes and durable next actions.
- `docs/DEPLOYMENT.md` — **UPDATED**: separates repository source contract from live production; removes provisional hard-coded NOW-1A R; documents both exact-current-main and exact-Pages collector prerequisites and the correct `same-SHA CI + Pages → recheck main → freeze R → evidence → later A authorizes R` sequence.

### Reviewed / no semantic change required

- `README.md` — **NO CHANGE**: it does not hard-code live Worker/API/Schema versions and correctly delegates operational deployment truth to `docs/DEPLOYMENT.md`.
- `AI_PROJECT_PLAYBOOK.md` — **NO CHANGE**: §§20–24 already explicitly define Independent Review as independent judgment reconstruction rather than separate identity and fully specify Same-AI isolation. Duplicating the rule would add governance drift surface rather than improve quality.

### Independent document review outcomes

- first PR #215 candidate review found one BLOCKER: handoff self-staleness at its own merge boundary; fixed before merge;
- post-PR #215 activation-contract trace found a second high-impact documentation flaw: provisional R was selected before respecting the exact-current-main evidence collector constraint;
- first PR #216 review found a third operational timing flaw: source selection did not wait for the same SHA's canonical Pages production deployment, even though the collector verifies exact Pages deployment SHA equality;
- each finding was recorded before implementation resumed; no failed review was silently converted to PASS;
- the corrected sequence preserves both workflow/collector strict assertions instead of weakening policy to fit an older or not-yet-propagated SHA;
- final exact-head CI / focused Independent Review / strict-ruleset merge remain required before any production evidence dispatch.

### Quality rule reinforced

Documentation quality means keeping authority boundaries, current state, historical evidence, and next actions unambiguous. Do not rewrite stable documents merely because a batch touched adjacent concepts; do not make a live handoff self-expire at its own merge boundary; do not freeze operational SHAs before tracing the exact workflow contract that consumes them; and account for asynchronous downstream propagation before treating a repository SHA as evidence-ready.
