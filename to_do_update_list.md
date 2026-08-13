# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-13 11:03 Asia/Taipei**  
Handoff revision: **WHOLE-PROJECT RECHECK / E1c CLOSED / MARKET-DATA ROOT CAUSES CLOSED + PASSIVE WATCH / PRODUCT FUNCTIONALITY REVIEW ACTIVE / NOW-1A R=`842e566...` EVIDENCE PASS / AUTHORITY + PRODUCTION ACTIVATION PENDING / HANDOFF REVALIDATED**

---

## 0. Future-AI Bootstrap / Authority Map

Do not start by executing the most detailed historical plan you can find. Reconstruct current truth in this order:

1. **Governance:** `AI_PROJECT_PLAYBOOK.md` — product-first priority, RCA, scope convergence, review/risk rules.
2. **Product/architecture orientation:** `README.md`.
3. **Live handoff:** this file — current Phase/Batch, blockers, exact next actions, known evidence boundaries.
4. **Remote truth:** protected `main`, open PRs, CI, Pages/deployments, current workflow runs, production observations.
5. **Machine contracts:** `worker-manifest.json`, `wrangler.toml`, `config/production-activation-authority.json`, `config/recovery-evidence-gate.json`, `config/deployment-environments.json`, current workflows/verifier tests.
6. **Production runbook:** `docs/DEPLOYMENT.md`.
7. **Documentation map:** `docs/README.md`.
8. **Historical evidence/closeouts:** `docs/engineering/`, `docs/governance/evidence/`, `audits/`, PR/Git history — provenance only unless a current authority explicitly reactivates them.

Key identity rule — **do not collapse these into one “current SHA”**:

- repository source contract;
- current protected-main HEAD;
- last verified live production runtime `P`;
- selected activation runtime source `R`;
- later activation-authority commit `A`;
- immutable recovery-evidence baseline.

A PASS artifact proves the exact source/conditions to which it is bound. It does not authorize a different source SHA. Conversely, a later unrelated/non-deployed main commit does not automatically invalidate an already-evidenced `R`; use exact diff/relevance review and the canonical two-SHA deployment contract.

If this file disagrees with fresh remote state or a machine-readable authority, stop and update the handoff before consequential mutation.

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

**Functional correctness always outranks optimization, document beautification, and infrastructure idealization.** If a real user path breaks, pause lower-priority work, perform RCA, repair the generic root cause, regress it, then resume the prior main line.

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
| MD-NAN-B1 | **MERGED / POST-MAIN VERIFIED / NORMAL PRODUCTION PATH PASS** | bounded same-provider re-fetch mitigation deployed; retry branch remains passive watch |
| MD-EVENT-ROW / PR #217 | **MERGED / POST-MAIN VERIFIED / NORMAL PRODUCTION PATH VERIFIED / SPECIAL BRANCH REGRESSION-VERIFIED** | provider rows are classified by semantics rather than ticker/date; only stable pure cash-dividend-only rows may become explicit `asof_carry_forward`; split/capital-gain/mixed/ambiguous cases remain fail-closed |
| Product Functionality Review | **ACTIVE — NOW-1** | record-create duplicate correctness defect remains the current product line until server activation + NOW-1B close the user-visible ambiguity gap |
| NOW-1A / PR #213 | **R SELECTED + IDENTITY EVIDENCE PASS / AUTHORITY + PRODUCTION ACTIVATION PENDING** | Worker 4.08 / API 2.61 / Schema 3 source is merged; exact `R=842e566...` has CI/Pages/Production Identity Evidence PASS; live production is still 4.07 / 2.60 / Schema 2 |
| Staging D1 Recovery Evidence | **PASSED / VERIFIED** | controlled run `31570497634` attempt 2 proved isolated staging export/drop/restore/integrity/cleanup |
| Production Identity Evidence #16 | **PASS — EXACT `R=842e566...`** | artifact is genuine exact-R evidence; authority A has not yet been created; later non-deploy changes require relevance review, not automatic invalidation |
| Document Quality | **WHOLE-PROJECT RECHECKED / HANDOFF REVALIDATED** | stale Gate-E document authority, activation chronology, and evidence-lifecycle interpretation corrected; root README/Playbook remain stable |

The lifecycle/control-plane work is no longer the project focus. Recovery work was retained only because it blocked a demonstrated product-correctness fix; that blocker is closed. The only infrastructure work allowed to interrupt Product Functionality Review now is the minimum production-activation boundary required to finish NOW-1A safely, or a newly demonstrated material product/security/data failure.

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
- UI automatically resumed the same calculation without a second update dispatch;
- UI reached terminal completion successfully.

GitHub evidence: `Update Portfolio Data #3245` / `31567498004`, exact `c512916...`, running callback/calculation/reconciliation/snapshot/terminal callback/workflow all SUCCESS.

Retained queue uses GitHub-native `queue: max`, repository-wide `portfolio-update` serialization, and `cancel-in-progress: false`. Do not manufacture concurrent production calculations solely to prove queueing.

Durable record: `docs/engineering/GATE_E_E1C_JOB_LIFECYCLE_2026-08-11.md`.

---

## 4. Market-Data Correctness — Root Causes Closed / Passive Watch

### MD-NAN-B1 — transient incomplete price row

Production #3243 reproduced upstream daily-row incompleteness/inconsistency. PR #210 permits one bounded fresh request to the same provider/request semantics while preserving fail-closed financial integrity.

Contract remains: no guessed prices; no OHLC/Adj Close substitution; no alternate provider fallback; inconsistent retry remains fail-closed. PR CI/post-main passed and #3245 proved normal-path compatibility; retry branch was not falsely claimed production-exercised.

### MD-EVENT-ROW — provider event row misclassified as price bar

A later production failure exposed a distinct semantic root cause: a provider may retain a corporate-action row with no usable price observation. Treating every retained row as a valuation bar caused a stable action-only row to block the portfolio update.

PR #217 generic fix:

- exact candidate `0a0eb00304de7bf48c94f235f93e350eed49f313`;
- no ticker/date/dividend-amount special cases;
- two successful prepared responses must reproduce the same semantic signature and selected price source;
- only stable **pure positive cash-dividend-only** rows may receive explicit `Close_Adjusted` as-of effective valuation from the latest prior finite selected valuation;
- raw OHLC/`Close_Raw` remain missing and provenance records `asof_carry_forward` + actual source date;
- split, dividend+split, capital gain, partial/mixed bars, unstable retry, second-request failure, malformed semantics, or no prior valuation remain fail-closed.

Verification:

- CI #738 / `31661392819`: SUCCESS;
- 479 Python tests + 18 subtests;
- semantic client 98% measured coverage; raw missing-branch gate remained 309;
- Independent Review PASS;
- merge `0f4676f995db890b3a8c5fdb2310f7b47a80f207`;
- post-main CI #739 SUCCESS;
- authenticated production #3254 / `31661928574`: 146 records, 45 symbols, prefix integrity PASS, Daily PnL reconciliation PASS, split-ledger parity PASS, snapshot upload SUCCESS, user success 1/failure 0, terminal job `succeeded`, workflow SUCCESS.

Evidence boundary: #3254 did not emit the semantic-normalizer warning. Full normal-path production compatibility is verified; the persistent dividend-only branch is regression/coverage verified and not falsely claimed live-hit.

Durable record: `docs/engineering/MD_EVENT_ROW_SEMANTIC_NORMALIZATION_2026-08-13.md`.

Both market-data fixes are passive watch. Reopen only on new material correctness/provider-semantic evidence; no speculative ticker exception, alternate provider, guessed-price repair, or broad redesign.

---

## 5. Current Active Batch — Product Functionality Review / NOW-1

Review the real user path, not architecture in isolation:

```text
login/session
→ record read/add/edit/delete
→ update trigger
→ queued/running + refresh recovery
→ terminal feedback
→ snapshot refresh
→ holdings / realized-unrealized-daily P&L
→ performance / benchmark
→ empty/error/retry/mobile usability where functionally material
```

Classify findings NOW / NEXT / BACKLOG / REJECT. Only material correctness/data/security/user-blocking findings may interrupt the current line. Discovery is not automatic scope expansion.

### NOW-1 — duplicate record creation after ambiguous POST outcome

Historical defect: `POST /api/records` had no durable create identity, so response loss after committed INSERT could lead to a second valid-looking transaction on resubmission.

NOW-1A / PR #213 server-first compatibility:

- nullable internal create-idempotency/payload hashes;
- tenant-scoped unique idempotency index;
- Worker 4.08 / API 2.61 / D1 Schema 3;
- old clients work without `Idempotency-Key`;
- same tenant+key+payload replays success without second INSERT;
- same key + different payload => 409 `IDEMPOTENCY_CONFLICT`;
- different keys may intentionally create identical trades;
- internal hashes excluded from public record projection.

Current rollout state:

```text
Recovery Evidence PASS
→ server implementation MERGED / CI VERIFIED
→ R=842e566... selected on then-current main
→ same-R CI #727 PASS
→ same-R Pages #1501 attempt 2 PASS
→ Production Identity Evidence #16 PASS for exact R
→ CURRENT: persist/review controlled activation evidence + authority A for exact R
→ Deploy Worker(source_sha=R)
→ migration 0003 + Worker 4.08
→ production verification
→ NOW-1B frontend stable-key persistence/replay
```

Before authority A, perform a final deployment-affecting drift review from R to current main. Do not discard R merely because unrelated Python/docs commits exist; do discard/re-evidence it if Worker/D1/manifest/migration/deploy-path semantics changed.

Do not make frontend behavior depend on Schema 3 / Worker 4.08 before production server activation is verified.

---

## 6. Known Stable Decisions / Architecture Notes

- functional correctness outranks optimization/document/process work;
- durable server lifecycle is authoritative over browser age; browser pending state is recovery metadata;
- exact idempotency replay and benchmark intent remain protected;
- Worker/D1 lifecycle semantics are not redesigned without new evidence;
- E1c does not justify broad Schema 3, custom scheduler, heartbeat/sweeper, ledger redesign, Decimal migration, tenant UUID migration, or broad auth redesign;
- narrow NOW-1 does justify migration 0003 but not the historical broad Schema 3 roadmap;
- Recovery Evidence Gate is authoritative and cannot be bypassed/fabricated;
- Independent Review = isolated evidence reconstruction + competent adversarial judgment, not account identity;
- historical plans are provenance, not automatic current roadmaps;
- protected-main source contract and live production are separate;
- Production Identity Evidence requires exact current-main and exact Pages SHA **at collection time**;
- PASS evidence is exact-R evidence and never authorizes a different SHA;
- later unrelated/non-deployed main commits do not automatically invalidate the same R; perform deployment-relevance diff review;
- Worker/D1/manifest/migration/deploy-path drift after evidence requires new R/evidence;
- activation authority A may be newer than R because canonical deployment verifies R is main-reachable and reads authority from latest main.

---

## 7. Backlog / Deferred Unless Evidence Promotes Them

- broad Schema 3 roadmap / unrelated calculation-job columns;
- custom scheduler/queue service;
- automatic job lease/heartbeat/sweeper;
- ledger revision / compare-and-publish;
- cursor-signing redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- broad provider redesign;
- broad auth/session redesign;
- CI/CD/governance beautification;
- dedicated remote D1 create-concurrency stress harness unless real race evidence appears.

None may interrupt product functionality without demonstrated correctness/security/outage/delivery evidence.

---

## 8. Exact Next Actions / Master Plan

1. **Re-check remote truth.** If the whole-project handoff revalidation PR that produced this text is not yet on protected `main`, finish its exact-head CI + focused Independent Review + normal ruleset merge. If already merged, do not recreate/repeat the docs batch.
2. Re-fetch final protected main and compare exact `R=842e5667b6ae3e75ea947f9ed08d7a8344337f9d` to that main. Explicitly inspect Worker source/entry, `worker-manifest.json`, Wrangler/deployment config, migration 0003/schema, Recovery/authority/deploy verifiers, and `.github/workflows/deploy-worker.yml`.
3. If that focused compare still shows **no Worker/D1/manifest/migration/deploy-path drift**, retain exact R and Production Identity Evidence #16; do **not** manufacture a redundant evidence rerun merely because main contains unrelated Python/tests/docs commits.
4. If relevant deployment drift is found, stop the retained-R path: select a new current-main R only after same-SHA CI + Pages PASS, then collect fresh Production Identity Evidence for that new R.
5. For retained R, independently verify artifact #16 metadata/document and transform/retain the required reviewed evidence under `docs/governance/evidence/production-activation/...`; create/update `config/production-activation-authority.json` so authority commit `A` explicitly authorizes exact R. Artifact id `9165344610`; digest `sha256:b3273cf207d0a84fdbdaef298c4794d4f955cadd1059ac437eab456bc86cce9a`.
6. Run exact-head CI and Independent Review for authority A, merge normally, then re-confirm latest main authority passes for `EXPECTED_SHA=R` and R remains main-reachable.
7. Execute canonical `Deploy Worker` with `source_sha=R`. Require remote additive migration `0003_record_create_idempotency.sql` before Worker 4.08 and verify exact source, Worker 4.08 / API 2.61 / Schema 3, production D1 identity, health, auth/CORS, tenant isolation, and legacy no-key compatibility.
8. Before NOW-1B production activation, resolve/test: (a) delete-then-reuse idempotency-key retention semantics; (b) frontend/Worker rollback-disable coordination once stable frontend keys exist.
9. Only after server activation is production-verified, implement NOW-1B frontend stable-key persistence/replay as a separate product batch.
10. Keep MD-NAN-B1 and MD-EVENT-ROW passive watch; reopen only on new material evidence.
11. Resume remaining Product Functionality Review after NOW-1 closes; do not let infrastructure/document cleanup replace product work.

---

## 9. NOW-1 / Recovery / Activation Handoff Record

### Stable State

- NOW-1A Worker/D1 provenance merge: `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`;
- selected/evidenced activation source: `R=842e5667b6ae3e75ea947f9ed08d7a8344337f9d`;
- product calculation semantic fix later merged as `0f4676f995db890b3a8c5fdb2310f7b47a80f207`;
- market-data docs closeout #218 merged as `c3b578f543d74794b2d6a40e30d0475b36f9fa9b`;
- whole-project recheck compared `842e566... → 0f4676...`: only Python market-data/main/tests/coverage files changed; `0f4676... → c3b578...`: docs only;
- no Worker source/entry, manifest/Wrangler, migration, deploy workflow, Recovery Gate, or activation-verifier change was identified in those compare results;
- therefore R is **retained pending final post-doc drift recheck**, not silently invalidated;
- repository Worker/D1 contract is Worker 4.08 / API 2.61 / Schema 3;
- production activation has not occurred;
- live production remains exact `P=fe5f091fdb2c92970dff74c1a7c99052084adb95`, Worker 4.07 / API 2.60 / Schema 2, Deploy Worker #4 / `31475347673`;
- current activation authority still authorizes only P, not R;
- Recovery Evidence Gate remains passed against immutable staging baseline `5bed9aa1058c64e87889afd9b1698921eeb2c186`;
- no fake evidence, force push, workflow/ruleset/recovery bypass was used.

### Current R — Production Identity Evidence #16

Evidence chain for `R=842e566...`:

- CI #727 / `31624183902`: SUCCESS;
- Pages #1501 / `31624182324`: attempt 2 SUCCESS after attempt 1's prolonged no-runner queue was normally cancelled;
- Production Identity Evidence #16 / `31658614001`: SUCCESS;
- artifact id `9165344610`;
- artifact name `production-identity-evidence-842e5667b6ae3e75ea947f9ed08d7a8344337f9d`;
- artifact/GitHub digest `sha256:b3273cf207d0a84fdbdaef298c4794d4f955cadd1059ac437eab456bc86cce9a` independently matched after download;
- document `status=passed`, collected `2026-08-13T01:44:25.662Z`;
- `evidence_source_sha=842e566...`;
- canonical Pages production deployment exact same SHA;
- production D1 GET / Worker deployment binding / active versions / Pages config / live frontend HTTP+CSP checks all PASS;
- `errors=[]`.

No authority A and no NOW-1A production mutation followed yet. The correct next gate is **final deployment-affecting drift review → controlled evidence/authority A**, not a blind evidence rerun and not direct deployment.

### Recovery Evidence

- run `31570497634`, attempt 2, SUCCESS;
- immutable baseline `5bed9aa1058c64e87889afd9b1698921eeb2c186`;
- artifact id `9150025501`;
- ZIP SHA-256 `ded4e5e3c264775b663571bb9b59d79826482e419a6210c268a9c37192b1b716`;
- measurements SHA-256 `fd2848d62f88d8c751098dcd1967b172117322c615e21a7996037d097a984e0f`;
- restore 2907 ms; export/drop/restore/integrity/cleanup verified.

### Key Timeline

- PR #213 — NOW-1A server compatibility; merge `6ea866...`; post-main CI #720 PASS.
- PR #214 — isolated staging recovery workflow; recovery drill later PASS attempt 2.
- PR #215 — source/live truth separation; merge `ff9d792...`.
- PR #216 — exact-main/same-Pages source-selection contract; merge `842e566...`; CI #727 + Pages #1501 attempt 2 PASS.
- Production Identity Evidence #16 / `31658614001` — PASS for exact R; authority/deploy not yet performed.
- Production #3253 exposed a product calculation blocker; functional RCA correctly took priority over activation work.
- PR #217 — generic market-row semantic root fix; merge `0f4676...`; CI #738/post-main #739/production #3254 PASS within documented evidence scope.
- PR #218 — market-data closeout docs; merge `c3b578...`; CI #741 + Pages #1503 PASS.
- whole-project recheck — confirmed #217/#218 did not touch Worker/D1/deployable NOW-1A contract; corrected handoff from overbroad “main moved => R invalid” logic to relevance-based drift review.

### Root Cause Log

1. **PR #213 deployment-contract drift — FIXED**: active metadata checks lagged Schema/Worker implementation; canonical manifest now drives expectations.
2. **Staging recovery scheduling anomaly — RESOLVED OPERATIONALLY / BACKEND CAUSE UNPROVEN**: normal cancel cleared contradictory no-runner/concurrency state; attempt 2 passed full drill.
3. **Local D1 schema-smoke stale assertion — FIXED**: hard-coded Schema2/4.07 replaced by manifest-bound expectation.
4. **Independent Review identity interpretation drift — FIXED**: independence is isolated competent judgment, not mandatory separate GitHub account.
5. **Strict required-status merge block — FIXED WITHOUT BYPASS**: branch had to be current with main for strict required checks.
6. **Live handoff self-staleness — FIXED**: next actions now condition on fresh remote truth rather than instructing future AI to finish an already-merged docs PR.
7. **Provisional R hard-coded before collector-contract trace — FIXED**: R selection follows exact evidence contract, not implementation provenance alone.
8. **Production identity timing omitted same-SHA Pages — FIXED**: new R collection requires same-SHA CI+Pages then current-main confirmation.
9. **Corporate-action-only provider row treated as price bar — FIXED / GENERALIZED**: semantic classifier handles supported pure dividend events; unsupported action shapes fail closed.
10. **Pages #1501 no-runner state — RESOLVED OPERATIONALLY / BACKEND CAUSE UNPROVEN**: bounded observation, normal cancel, job-level attempt2 success; no routine retry policy inferred.
11. **Overbroad activation-evidence invalidation inference — FIXED BY WHOLE-PROJECT RECHECK**:
    - Symptom: after PR #217/#218 advanced main, handoff drifted toward treating exact-R evidence #16 as unusable solely because main changed.
    - Root cause: “repository/product runtime changed” was conflated with “Worker/D1 deployable runtime changed”, ignoring the two-SHA deploy contract.
    - Primary evidence: compare `842e566...→0f4676...` lists only Python market-data/main/tests/coverage; `0f4676...→c3b578...` is docs only. Canonical deploy checks out exact requested R, requires it to remain main-reachable, and verifies authority from latest main.
    - Fix: retain R/evidence across unrelated changes only after explicit deployment-affecting drift review; never transfer evidence to a different SHA.
    - Reopen: any Worker/D1/manifest/migration/deploy workflow/verifier drift after R, or R ceases to be main-reachable.

### Known Issues / Risks

- Production Schema 3 / Worker 4.08 activation is not yet performed.
- Current activation authority still authorizes exact `fe5f091...`; R is not deploy-authorized yet.
- R evidence is PASS, but controlled activation evidence/authority A still must be persisted/reviewed before deployment.
- Final post-document merge drift review is required before relying on retained R.
- NOW-1B remains blocked until production server compatibility is verified.
- **FOLLOW-UP before NOW-1B:** define/test delete-then-reuse idempotency-key retention semantics.
- **FOLLOW-UP before NOW-1B:** define frontend disable/rollback coordination once stable frontend keys exist.
- Recovery evidence supports only the reviewed Schema 3 strategy, not unrelated expansion.

### Deferred / Rejected Candidates

- **REJECT NOW:** transfer #16 evidence to a different SHA;
- **REJECT NOW:** automatically discard #16 merely because unrelated main commits exist;
- **REJECT NOW:** weaken exact-main/Pages assertions for a new evidence collection;
- **REJECT NOW:** require Copilot/another account merely to manufacture reviewer identity;
- **REJECT NOW:** speculative market/provider repair or ticker-specific exceptions;
- **BACKLOG:** broad Actions queue redesign unless the same platform anomaly recurs;
- **BACKLOG:** unrelated broad Schema 3 roadmap;
- **BACKLOG:** remote D1 create-concurrency stress harness unless real race evidence appears.

---

## 10. Document Quality Review — Whole-Project Recheck 2026-08-13

Status: **HANDOFF REVALIDATED / AUTHORITY MAP + EXACT-R EVIDENCE LIFECYCLE CORRECTED**

Objective: allow future AI to resume from primary evidence without reopening closed Gates, redoing solved investigations, or either discarding valid exact-R evidence or transferring it to a different runtime.

### Reviewed / changed

- `to_do_update_list.md` — **UPDATED**: future-AI bootstrap; current R/evidence/authority state; durable next actions; Pages/evidence RCA; corrected deployment-relevance interpretation.
- `docs/DEPLOYMENT.md` — **UPDATED**: two-SHA preservation rules, exact-R #16 evidence, deployment-affecting drift test, Pages diagnostic precedent.
- `docs/README.md` — **UPDATED**: completed E1a plan removed from current authority; current document map + future-AI bootstrap corrected.

### Reviewed / no semantic change required

- `README.md` — **NO CHANGE**: product/architecture navigation remains valid and avoids live-version hardcoding.
- `AI_PROJECT_PLAYBOOK.md` — **NO CHANGE**: product-first/RCA/convergence/Independent Review rules remain correct.
- `worker-manifest.json` — **NO CHANGE**: Worker 4.08 / API 2.61 / Schema 3 source contract.
- `config/recovery-evidence-gate.json` — **NO CHANGE**: passed, immutable staging evidence.
- `config/production-activation-authority.json` — **NO CHANGE**: correctly still authorizes last verified live P only; authority change belongs to the next controlled activation batch.
- Production Identity Evidence / Deploy Worker workflows — **NO CHANGE**: exact-R collection and two-SHA deploy authority behavior are safety contracts, not documentation defects.

### Independent review findings

- **NOW / fixed:** `docs/README.md` still called completed E1a activation plan current.
- **NOW / fixed:** Exact Next Actions contained obsolete PR #216 condition.
- **NOW / fixed:** initial revalidation draft incorrectly inferred that PR #217 invalidated R solely because it was a product runtime change; exact file diff and canonical deploy workflow disproved that overbroad conclusion before PR creation.
- **KEEP:** root README and Playbook stable; no touch-every-file rewrite.
- **KEEP:** live production remains 4.07 / 2.60 / Schema 2 until canonical deploy proves otherwise.
- **KEEP:** R=842e566... evidence PASS, authority/deploy pending; final drift check required after docs merge.
- **KEEP:** market-data fixes passive watch; no speculative expansion.

### Quality rule reinforced

Documentation quality means preserving **truth boundaries**, not maximizing document volume. Future AI must distinguish current authority from historical evidence, repository/product changes from deployable Worker/D1 changes, current live P from selected R, and exact-R evidence from authorization for another SHA. Every consequential action starts with fresh remote truth and exact relevance review; closed investigations remain closed unless their explicit reopen condition is met.
