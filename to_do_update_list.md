# TO-DO / UPDATE LIST — Product-First Current Handoff

> FIRST READ: `AI_PROJECT_PLAYBOOK.md` → `README.md` → this file → re-check GitHub remote truth before consequential action. Remote systems override stale prose. Documentation exists to prevent project amnesia/distortion, not to become the project.

Last updated: **2026-08-13 12:44 Asia/Taipei**  
Handoff revision: **WHOLE-PROJECT RECHECK / E1c CLOSED / MARKET-DATA ROOT CAUSES CLOSED + PASSIVE WATCH / NOW-1A PRODUCTION ACTIVATED / PUBLIC CONTRACT VERIFIED / AUTHENTICATED CREATE ACCEPTANCE PENDING / THREE-BATCH CONVERGENCE LOCKED**

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
| Product Functionality Review | **ACTIVE — NOW-1** | server duplicate-create protection is live; authenticated create acceptance and NOW-1B still close the user-visible ambiguity gap |
| NOW-1A / PR #213 | **PRODUCTION ACTIVATED / PUBLIC CONTRACT VERIFIED / AUTHENTICATED CREATE ACCEPTANCE PENDING** | exact `R=842e566...` is live as Worker 4.08 / API 2.61 / Schema 3; no real-user ledger was used for the remaining authenticated create smoke |
| Staging D1 Recovery Evidence | **PASSED / VERIFIED** | controlled run `31570497634` attempt 2 proved isolated staging export/drop/restore/integrity/cleanup |
| Production Identity Evidence #16 | **PASS — EXACT `R=842e566...` / AUTHORITY + DEPLOY COMPLETED** | genuine exact-R evidence was persisted in PR #222 and used by the canonical deployment after relevance review |
| Document Quality | **WHOLE-PROJECT RECHECKED / HANDOFF REVALIDATED / THREE-BATCH CONVERGENCE LOCKED** | handoff now makes clear that deployment governance is a necessary guardrail inside Batch 1, not a new project direction |

The lifecycle/control-plane work is no longer the project focus. Recovery work was retained only because it blocked a demonstrated product-correctness fix; that blocker is closed. NOW-1A's runtime mutation is complete; only its isolated authenticated acceptance remains. The only infrastructure work allowed to interrupt Product Functionality Review now is the minimum boundary required to finish that acceptance safely, or a newly demonstrated material product/security/data failure.

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

## 5. Current Active Product Line — NOW-1

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
→ final R→main deployment-affecting drift review PASS
→ controlled evidence + authority A merged in PR #222
→ exact-head CI + Independent Review passed for authority
→ deployment request + authority-bound dispatch test merged in PR #223
→ canonical Deploy Worker run #31678943942 SUCCESS after production approval
→ remote additive migration 0003 + Worker 4.08 deployment SUCCESS
→ three consecutive public production-contract passes
→ CURRENT: isolated authenticated legacy/no-key + idempotency replay/conflict acceptance
→ NOW-1B frontend stable-key persistence/replay
```

Do not make frontend behavior depend on Schema 3 / Worker 4.08 before production server activation is verified.

### NOW-1A Production Activation Execution — 2026-08-13

Completed production mutation and public verification:

- PR #222 persisted the reviewed exact-R evidence and made protected-main authority A authorize `R=842e5667b6ae3e75ea947f9ed08d7a8344337f9d`; PR #223 requested that exact source and changed the dispatch test from a stale hard-coded SHA to an authority-equality invariant.
- The canonical [Deploy Worker run #31678943942](https://github.com/chihung1024/sheet-trading-journal/actions/runs/31678943942) completed successfully after protected-environment approval. It applied the additive remote migration `0003_record_create_idempotency.sql` before deploying the canonical Worker entry.
- Post-deploy artifact `9173729753` (`production-post-deploy-842e5667b6ae3e75ea947f9ed08d7a8344337f9d`, digest `sha256:64c381e6f73471715eb924d1709831239aa4dccedf00ba635f9a6bdf9b5eb75b`) records exact source `R`, Worker 4.08 / API 2.61 / Schema 3, health/version success, anonymous record access rejected, allowed production CORS origins accepted, and disallowed origins rejected.
- The workflow required three consecutive propagated public production-contract passes; the activation is therefore live and publicly verified.

Still required before Batch 1 can close:

- No authenticated tenant record-create probe has been run. The deployment's system principal cannot impersonate a user, and no real-user ledger was used as a substitute.
- Use a dedicated isolated production test tenant with a documented cleanup plan to verify: legacy create without `Idempotency-Key`; same tenant/key/payload replay creates exactly one record; same key with different payload returns `409 IDEMPOTENCY_CONFLICT`; then delete only the test records and retain sanitized evidence.

### Project Convergence Lock — Only Three Active Batches

The project must now be understood as **three functional batches**, not as a chain of governance mini-projects.

#### Batch 1 — NOW-1A Production Activation

**Single product objective:** make the already-implemented server-side duplicate-create protection actually live in production.

Completed guarded activation:

```text
retain exact R=842e566...
→ persist/review exact-R activation evidence
→ create authority A that explicitly authorizes exact R
→ exact-head CI + Independent Review
→ canonical Deploy Worker(source_sha=R)
→ remote additive migration 0003
→ Worker 4.08 / API 2.61 / Schema 3 public production verification
```

The runtime mutation and public contract are complete. Batch 1 remains open only for an isolated authenticated acceptance probe: legacy clients without `Idempotency-Key` must still create normally; same tenant+key+payload must replay without a second record; the same key with a different payload must return `409 IDEMPOTENCY_CONFLICT`. Do not use a real-user ledger to perform this test.

`R`, `A`, evidence, CI, review, migration ordering, and deploy verification are **guardrails inside this one production-activation batch**. They are not separate project phases and must not be expanded or beautified after they satisfy the existing deployment contract.

Do **not** add architecture work to Batch 1 merely because Schema 3 is involved. In particular, do not reopen broad Schema 3, queue/scheduler, heartbeat/sweeper, ledger, UUID, Decimal, auth, or deployment-framework redesign without new material evidence.

#### Batch 2 — NOW-1B Product Function

**Single product objective:** complete the user-visible exactly-once/retry behavior after server compatibility is live.

Required product behavior:

```text
user starts create
→ frontend generates a stable create key
→ timeout / ambiguous response / retry / recoverable reload
→ retry reuses the same logical key
→ server returns replay success instead of creating a duplicate record
→ UI reaches one correct final record state
```

Before activation of stable frontend keys, resolve and test the two already-known correctness boundaries:

1. **delete-then-reuse retention semantics** — define the intended lifetime of create identity so deletion does not silently create a false exactly-once claim;
2. **frontend/Worker rollback coordination** — once stable keys are in use, prevent rollback to an older Worker that ignores them from silently reopening duplicate-create risk.

Keep this narrow. Do not generalize it into a universal idempotency framework unless actual product evidence requires that scope.

#### Batch 3 — Resume Product Functionality Review

After NOW-1 closes, immediately resume the real product path:

```text
login / session restoration
→ record CRUD
→ portfolio update trigger
→ queued/running/reopen recovery
→ terminal success/failure feedback
→ snapshot refresh
→ holdings correctness
→ realized / unrealized / daily P&L
→ performance / benchmark
→ empty / error / retry states
→ mobile/responsive usability where functionally material
```

Only a demonstrated NOW-class defect opens a new blocking batch. NEXT/BACKLOG/REJECT findings must not displace functional verification.

### What Is Explicitly Not a New Project Line

Do not turn the following into independent phases after their current requirement is satisfied:

- Production Identity Evidence;
- R/A terminology or evidence packaging;
- CI/review mechanics;
- deployment-document beautification;
- broad Schema 3 redesign;
- custom scheduler/queue service;
- heartbeat/sweeper;
- ledger redesign;
- Decimal/fixed-point migration;
- tenant UUID migration;
- broad provider redesign;
- broad authentication/session redesign;
- CI/CD/governance beautification.

**Project direction in one sentence:** finish duplicate-create protection in production, complete the frontend retry/idempotency behavior, then return to end-to-end product functionality review.

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
- activation authority A may be newer than R because canonical deployment verifies R is main-reachable and reads authority from latest main;
- governance/evidence steps exist to protect product activation; they are not independent optimization targets.

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

## 8. Exact Next Actions / Three-Batch Master Plan

### Batch 1 — NOW-1A Post-deploy authenticated acceptance — **ACTIVE NOW**

1. Re-check protected-main and the live/public contract evidence before any further mutation. The deployed exact runtime is `R=842e5667b6ae3e75ea947f9ed08d7a8344337f9d`; canonical deployment run `31678943942` and post-deploy artifact `9173729753` are successful.
2. Provision or designate a dedicated isolated production test tenant that can complete the supported login flow. Define test-only record markers and a cleanup plan before writing anything. Do not use a personal or operational trading ledger.
3. With that tenant, verify and retain sanitized evidence for: (a) a legacy create without `Idempotency-Key`; (b) repeated same tenant/key/payload requests returning replay success with exactly one persisted record; and (c) same key with a different payload returning `409 IDEMPOTENCY_CONFLICT`.
4. Read back and delete only the test records, confirm the test tenant ledger is clean, and record the result. A read-only Production Contract Audit may complement this evidence but cannot substitute for authenticated create behavior.
5. Close Batch 1 only when the three authenticated behaviors and cleanup are evidenced; then start NOW-1B. Do not add further deployment/governance optimization.

### Batch 2 — NOW-1B Product Function — **NEXT**

1. Resolve/test delete-then-reuse idempotency-key retention semantics.
2. Resolve/test frontend/Worker rollback-disable coordination for stable keys.
3. Implement frontend stable-key generation, persistence, retry/replay behavior, and ambiguous-response recovery.
4. Run regression + real user-path verification proving one logical create cannot become two records under the supported retry/recovery paths.
5. Close NOW-1 when server + frontend behavior is production-verified.

### Batch 3 — Remaining Product Functionality Review — **AFTER NOW-1**

1. Resume the end-to-end user-path review from the first not-yet-closed functional area.
2. Prioritize correctness of CRUD, update/recovery, snapshot, holdings, P&L, performance/benchmark, and material error/mobile states.
3. Promote only demonstrated material defects to NOW. Keep NEXT/BACKLOG/REJECT work from displacing functionality.
4. Keep MD-NAN-B1 and MD-EVENT-ROW passive watch; reopen only on new material evidence.

**Do not create a fourth active batch for evidence, CI, review, documentation, deployment framework, or architecture cleanup unless new evidence demonstrates a separate material product/security/data blocker.**

---

## 9. NOW-1 / Recovery / Activation Handoff Record

### Stable State

- NOW-1A Worker/D1 provenance merge: `6ea86620475cde8ac9a412921cdc8ae6ce11b9bf`;
- selected/evidenced activation source: `R=842e5667b6ae3e75ea947f9ed08d7a8344337f9d`;
- product calculation semantic fix later merged as `0f4676f995db890b3a8c5fdb2310f7b47a80f207`;
- market-data docs closeout #218 merged as `c3b578f543d74794b2d6a40e30d0475b36f9fa9b`;
- whole-project handoff revalidation #219 merged as `a6adc98561ad1942366c9178064ac41b449d0efd`;
- PR #219 exact-head CI #742 PASS; post-main CI #743 / `31663770120` PASS; Pages #1504 / `31663769657` build/deploy/report PASS;
- final post-#219 compare `842e566... → a6adc985...` contains only documentation plus Python market-data/main/tests/coverage files introduced after R;
- no Worker source/entry, manifest/Wrangler, migration/schema, Deploy Worker workflow, Recovery Gate, or production activation verifier drift was found in that final compare;
- R remains main-reachable and the **final deployment-affecting drift review is PASS**;
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

No authority A and no NOW-1A production mutation followed yet. Final deployment-affecting drift review is now PASS; the correct next gate is **controlled evidence → authority A**, not a blind evidence rerun and not direct deployment.

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
- PR #219 — whole-project handoff revalidation; merge `a6adc985...`; CI #743 + Pages #1504 PASS.
- post-PR #219 final R→main deployment-affecting drift compare — PASS; R retained, no redundant Production Identity Evidence rerun required.
- current handoff convergence — project execution explicitly narrowed to Batch 1 NOW-1A activation → Batch 2 NOW-1B product behavior → Batch 3 remaining Product Functionality Review.

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
    - Primary evidence: compare `842e566...→0f4676...` lists only Python market-data/main/tests/coverage; later #218/#219 are docs-only. Canonical deploy checks out exact requested R, requires it to remain main-reachable, and verifies authority from latest main.
    - Fix: retain R/evidence across unrelated changes only after explicit deployment-affecting drift review; never transfer evidence to a different SHA.
    - Reopen: any Worker/D1/manifest/migration/deploy workflow/verifier drift after R, or R ceases to be main-reachable.
12. **Governance steps visually displaced product work — FIXED BY THREE-BATCH CONVERGENCE**:
    - Symptom: evidence → authority → CI → review → deploy → migration could be misread as many new project phases.
    - Root cause: safety gates inside one activation batch were represented at the same conceptual level as product batches.
    - Fix: execution is now explicitly three batches only: NOW-1A production activation, NOW-1B product function, then remaining Product Functionality Review. Governance/evidence mechanics remain subordinate guardrails inside Batch 1.
    - Reopen: only if a new material product/security/data blocker demonstrates that a separate blocking batch is genuinely necessary.

### Known Issues / Risks

- Production Schema 3 / Worker 4.08 activation is not yet performed.
- Current activation authority still authorizes exact `fe5f091...`; R is not deploy-authorized yet.
- R evidence is PASS and final deployment-affecting drift review is PASS, but controlled activation evidence/authority A still must be persisted/reviewed before deployment.
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
- **REJECT NOW:** create a separate governance/deployment-document phase after Batch 1 acceptance criteria are satisfied;
- **BACKLOG:** broad Actions queue redesign unless the same platform anomaly recurs;
- **BACKLOG:** unrelated broad Schema 3 roadmap;
- **BACKLOG:** remote D1 create-concurrency stress harness unless real race evidence appears.

---

## 10. Document Quality Review — Whole-Project Recheck 2026-08-13

Status: **HANDOFF REVALIDATED / AUTHORITY MAP + EXACT-R EVIDENCE LIFECYCLE CORRECTED / THREE-BATCH CONVERGENCE RECORDED**

Objective: allow future AI to resume from primary evidence without reopening closed Gates, redoing solved investigations, or mistaking deployment guardrails for the product roadmap.

### Reviewed / changed

- `to_do_update_list.md` — **UPDATED**: future-AI bootstrap; current R/evidence/authority state; final drift-review result; three-batch convergence; exact next actions.
- `docs/DEPLOYMENT.md` — **UNCHANGED IN THIS BATCH**: two-SHA preservation rules and exact-R evidence lifecycle remain correct from PR #219.
- `docs/README.md` — **UNCHANGED IN THIS BATCH**: current-vs-historical authority map remains correct from PR #219.

### Reviewed / no semantic change required

- `README.md` — **NO CHANGE**: product/architecture navigation remains valid and avoids live-version hardcoding.
- `AI_PROJECT_PLAYBOOK.md` — **NO CHANGE**: product-first/RCA/convergence/Independent Review rules remain correct.
- `worker-manifest.json` — **NO CHANGE**: Worker 4.08 / API 2.61 / Schema 3 source contract.
- `config/recovery-evidence-gate.json` — **NO CHANGE**: passed, immutable staging evidence.
- `config/production-activation-authority.json` — **NO CHANGE**: correctly still authorizes last verified live P only; authority change belongs to Batch 1 activation.
- Production Identity Evidence / Deploy Worker workflows — **NO CHANGE**: safety contracts, not optimization targets.

### Quality rule reinforced

Documentation quality means preserving **truth boundaries and execution priority**, not maximizing document volume. Future AI must distinguish current authority from historical evidence, product batches from deployment guardrails, repository/product changes from deployable Worker/D1 changes, current live P from selected R, and exact-R evidence from authorization for another SHA.

The project now has exactly three active execution layers:

```text
Batch 1 — NOW-1A Production Activation
→ Batch 2 — NOW-1B Product Function
→ Batch 3 — Remaining Product Functionality Review
```

Do not create additional process/document/infrastructure phases unless new evidence proves a separate material blocker.

---

## 11. Current Product Risk / Technical-Debt Triage — 2026-08-13

Status: **CURRENT-MAIN RECHECKED / PRODUCT-RISK TRIAGE RECORDED / OLD RISK REGISTER IS HISTORICAL INPUT, NOT ACTIVE BACKLOG**

Purpose: give future AI a current, product-first interpretation of remaining risks without turning every historical audit item into mandatory work.

### Source-of-truth rule

`docs/governance/risk-register.json` is a **2026-08-06 audit baseline**. Its entries are useful discovery candidates, but its status fields are not current authority: several items later received fixes while the file still says `accepted_for_remediation`. Reconstruct current truth from current code, tests, live handoff, remote CI/deployment evidence, and later acceptance/closeout records before promoting any historical risk.

Examples already corrected after that baseline include frontend all-page record pagination, legacy full-record localStorage cleanup, token-refresh lifecycle/JWT decoding, cross-tab refresh control, benchmark provenance guards, GroupManager fail-closed mutation reporting, and isolated staging Worker/browser verification. Do not reopen those old symptoms merely because the historical risk register still lists them.

### Current priority map

| Priority | Current issue / debt | Current interpretation | Action rule |
|---|---|---|---|
| **NOW** | record-create ambiguous-response duplication | production still lacks live Worker 4.08 / Schema 3 protection and frontend stable create key | finish existing Batch 1 → Batch 2; do not let unrelated debt interrupt |
| **NEXT-CANDIDATE** | same-day transaction execution order | records persist date but no authoritative executed timestamp / broker sequence; FIFO/day-trade/dividend ordering can become ambiguous | reproduce with real or broker-derived same-day cases during Batch 3 before designing migration |
| **NEXT-CANDIDATE** | record edit lost-update concurrency | update path has no record revision / optimistic locking, so stale multi-tab/device edits can overwrite newer values | validate realistic concurrent-edit scenario; promote only if materially reproducible |
| **NEXT-CANDIDATE** | ledger/snapshot read consistency | no monotonic ledger revision currently binds pagination/calculation/snapshot publication into one explicit input revision | test concurrent mutation during paginated read/calculation before opening compare-and-publish work |
| **PRODUCT-DIRECTION DECISION** | no complete cash ledger / brokerage-account NAV model | current BUY/SELL/DIV security-project model is not automatically equivalent to full brokerage NAV after cash deposits, withdrawals, settlement, interest or liquidation | first decide whether product promises security-journal analytics or complete account NAV; do not build a cash ledger by assumption |
| **SECURITY DEBT** | bearer authentication remains browser-localStorage based; residual CSP hardening remains | auth lifecycle reliability was substantially improved, but XSS blast radius remains higher than an HttpOnly/session design | keep BACKLOG unless public/multi-user exposure or concrete security evidence raises priority |
| **BACKLOG / VERIFY ON EVIDENCE** | manual market-hours calendar | frontend still computes TW/US hours and DST without one authoritative holiday/early-close exchange calendar | promote only on demonstrated holiday/DST/early-close error |
| **BACKLOG / LIMITATION** | GroupManager batch mutations are non-atomic | UI now reports partial failure honestly, but sequential committed rows are not rolled back | leave unless bulk strategy editing becomes a material workflow |
| **PASSIVE WATCH** | yfinance remains the single market-data provider | provider semantic defects have generic fail-closed handling, but availability/licensing/schema dependency remains | monitor; do not build multi-provider architecture without repeated material evidence |
| **BACKLOG** | SQLite `REAL` / Python `float` / JS `Number` financial model | binary floating-point can accumulate precision drift, but current reconciliation/tolerances exist | promote only if broker-statement/golden-case reconciliation shows material error |
| **BACKLOG** | email remains persistent tenant identity | long-term identity/privacy coupling remains despite current signed-email checks | defer until email-change/multi-user/session redesign becomes real product need |
| **LOW / TRACKER HYGIENE** | stale issues and historical risk statuses | old issues/risk entries can look open after their implementation was already completed | clean opportunistically; never let tracker cleanup displace product correctness |

### Six items future Product Functionality Review should watch most closely

After NOW-1 is production-closed, Batch 3 should preferentially validate these boundaries before broad infrastructure work:

1. **same-day trade ordering** — can actual same-day BUY/SELL/fill sequences produce materially wrong FIFO, realized P&L, oversell, or dividend entitlement because only date is authoritative?
2. **stale record updates** — can two tabs/devices silently overwrite a newer edit without a deterministic conflict?
3. **ledger revision / snapshot consistency** — can a mutation during pagination or calculation cause an internally accepted result that does not correspond to one complete ledger revision?
4. **cash-ledger/product semantics** — does the intended product need full account NAV, or are current security-project metrics intentionally sufficient?
5. **auth storage + CSP** — does deployment exposure justify migrating away from bearer token localStorage and tightening residual CSP now?
6. **market-calendar edge cases** — do holidays, early closes, DST boundaries, or Taiwan/US timezone transitions produce real refresh/as-of errors?

These are **validation candidates, not six automatic implementation projects**. The required sequence is reproduce → evidence → classify → isolate root cause → implement the smallest generic correction only when the defect is materially demonstrated.

### Explicit non-priorities unless new evidence appears

Do not start broad redesign solely because it sounds architecturally cleaner. In particular, the following remain BACKLOG/PASSIVE WATCH unless promoted by concrete product/security/data evidence:

- universal ledger redesign;
- broad Decimal/fixed-point migration;
- tenant UUID migration;
- multi-provider market-data framework;
- custom compute scheduler/queue;
- heartbeat/sweeper framework;
- broad auth/session redesign;
- full cash-account model before product semantics are decided;
- mass update of every historical audit/risk document;
- closing/relabeling old GitHub issues as a standalone project.

### Reopen / promotion rule

A technical-debt item may displace the active three-batch line only when fresh evidence shows at least one of:

- wrong financial result or corrupted/duplicated transaction data;
- user-visible core flow cannot complete or recover;
- material tenant/privacy/security exposure;
- production outage or repeated platform/provider failure that existing fail-closed behavior cannot safely absorb;
- proven delivery blocker for the current product batch.

Otherwise classify it NEXT, BACKLOG, PASSIVE WATCH, or REJECT and continue the active product line.

**Current conclusion:** the repository is not in a broad systemic-failure state. The highest-value work remains NOW-1 production exactly-once completion; the remaining technical debt should be evidence-driven during Batch 3 rather than used to justify a new refactor program.
