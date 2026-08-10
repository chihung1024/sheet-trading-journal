# TO-DO / UPDATE LIST — Product Integrity Execution Handoff

> **FIRST-READ EXECUTION STATE.** Persistent Master Plan / Progress Tracker / Decision Log / Root-Cause Log / AI Handoff required by `AI_PROJECT_PLAYBOOK.md`.
>
> Update this file after every material implementation, CI result, independent review, merge, deployment, production smoke/audit, recovery ref, blocker or scope decision. Historical detail belongs in dedicated evidence documents and Git history; this file stays **current-state-first**.

Last updated: **2026-08-10**

---

# 1. Mandatory Session Startup

1. Read `AI_PROJECT_PLAYBOOK.md`.
2. Read `README.md`.
3. Read this file.
4. Inspect protected `main`, active branch/PR, Worker deployment state and latest Actions.
5. Verify Current Phase / Current Batch / Next Action below against GitHub.
6. Read the current-phase operational authority.
7. Only then change code/config/workflows.

## Current authoritative documents

- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` — Gate-E architecture priority authority.
- `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — **current E1a operational sequencing authority**.
- `docs/DEPLOYMENT.md` — current deployment navigation/runbook.
- `docs/governance/PR_10D3D_PRODUCTION_ACTIVATION_GATE_ACCEPTANCE.md` — production activation control-plane design/history.
- `docs/governance/PR_10D3D_B_PRODUCTION_IDENTITY_EVIDENCE_ACCEPTANCE.md` — production identity evidence collector acceptance/history.
- `docs/engineering/GATE_D_REPRODUCIBILITY_AUDIT.md` — Gate-D reproducibility authority.
- `docs/engineering/GATE_C_FINAL_CLOSEOUT.md` — Gate-C closeout authority.
- `docs/governance/risk-register.json` — historical 2026-08-06 baseline; never copy priorities forward without revalidation.

`docs/governance/V5_CURRENT_HANDOFF.md` is retained for the D3D closeout history/navigation but is **not** the primary current execution handoff while Gate E is active.

---

# 2. Primary Goal / Current Batch

## Primary Goal

> **Safely activate the already-merged E1a-A opaque-target compatibility capability in production, prove that compatibility boundary is live, then execute E1a-B so normal public GitHub calculation dispatch no longer carries tenant email.**

## Current Phase

**Gate E / E1a — staged zero-downtime privacy rollout**

## Current Active Batch

**E1a-A0 — production-activation documentation/state re-baseline — PR OPEN / README SCOPE FIX APPLIED / FINAL-HEAD CI PENDING**

Working branch:

`pr-gate-e-e1a-activation-docs-rebaseline`

PR:

**#174 — Gate E E1a-A0: rebaseline production activation docs**

Pre-batch recovery:

`backup-pre-gate-e-e1a-activation-docs-c312408`

### A0 In Scope

- correct stale E1a-A repository/CI state;
- document the D3D production-activation dependency now reopened by a real deployment need;
- correct deployment input semantics (`source_sha`);
- establish the runtime-SHA vs activation-authority-SHA model;
- align current-facing handoff/deployment/governance docs;
- preserve historical append-only evidence unchanged.

### A0 Out of Scope

- no production workflow dispatch;
- no Cloudflare mutation;
- no Worker/runtime code change;
- no D1/config activation change;
- no E1a-B implementation;
- no E1b/E1c/E1d implementation;
- no Schema 3.

---

# 3. Current Stable State

Repository: `chihung1024/sheet-trading-journal`

Verified protected-main baseline before this documentation branch:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

This is PR #173 — Gate E E1a-A merge commit.

Runtime contracts at that baseline:

- Worker deployment entry: `worker-entry.js`;
- canonical Worker source: `worker.js`;
- Worker release: **4.07**;
- Worker API: **2.60**;
- D1 schema: **2**;
- canonical D1 binding: `DB`.

## Program state

| Gate / Batch | State |
|---|---|
| Gate A | **DONE** |
| Gate B | **DONE** |
| Gate C | **DONE / CLOSED / POST-MAIN VERIFIED** |
| Gate D D1a–D1e | **DONE / CLOSED / POST-MAIN VERIFIED** |
| Gate E / E0 | **DONE / POST-MAIN VERIFIED** |
| Gate E / E1a | **ACTIVE — staged zero-downtime rollout** |
| E1a-A repository implementation | **DONE — merged / post-main CI / recovery complete** |
| E1a-A production activation/deploy | **ACTIVE DEPENDENCY — not yet deployable** |
| E1a-B privacy cutover | **BLOCKED until A deploy + compatibility proof** |
| E1b | **PLANNED** |
| E1c | **PLANNED** |
| E1d | **PLANNED** |
| E2-pre | **CONDITIONAL after E1** |
| Schema 3 / E2 implementation | **NOT IMPLEMENTED / CONDITIONALLY AUTHORIZED ONLY** |

---

# 4. E1a-A Repository Completion Evidence

PR:

**#173 — Gate E E1a-A: pre-cutover Worker opaque-target compatibility**

Base before A:

`87b5949a588bb6f655387ded554cb0a69d8a6f95`

Test-first head:

`a155eafce20938a5cfb5707e767e9696193e890a`

Implementation commit:

`7e4423e7033a6cacb9f2f84298f743d3537e8d9e`

Final PR head:

`ca3fa1f86d21fe660226588063ada98d749d01b6`

Merge:

`c312408fec7a27a7b713ad5da79bf93bce62481f`

Verification:

- CI #557: intentional test-first Worker failure only;
- CI #558 / run `31344979114`: PASS;
- independent implementation review: PASS / no code-level BLOCKER;
- final-head CI #559 / run `31345137509`: PASS across Python / Frontend / Worker-D1;
- exact-head merge completed;
- post-main CI #560 / run `31345293209`: PASS across Python / Frontend / Worker-D1;
- changed files: `worker-entry.js`, `tests/worker_opaque_target_compat.test.mjs`, `to_do_update_list.md`;
- recovery: `backup-post-gate-e-e1a-a-c312408` -> exact merge `c312408...`.

## A compatibility implementation

Temporary `worker-entry.js` shim:

- matches only `GET /api/calculation-jobs/job_<opaque-id>`;
- only handles requests with constant-time-valid `X-API-KEY` against `env.API_SECRET`;
- queries by opaque `public_id`, never caller-supplied tenant;
- system response is narrow: `id`, `target_user_id`, `benchmark`, `status`;
- invalid/malformed DB state fails closed;
- explicit configured origin policy is checked before compatibility lookup;
- owner value is not logged;
- existing normal email dispatch/workflow/runner remains intentionally unchanged during A;
- no D1 migration, financial logic, CRUD or canonical Worker route redesign occurred in A.

The shim is temporary and must be removed in E1a-B after canonical `worker.js` owns the system route.

---

# 5. Production Activation State — Current BLOCKER

The previous handoff stated that the next action was to dispatch `Deploy Worker`. Deeper revalidation found that this is incomplete.

## Verified current deployment state

- `.github/workflows/deploy-worker.yml`: **0 workflow runs** at re-baseline.
- `.github/workflows/production-identity-evidence.yml`: **0 `workflow_dispatch` runs** at re-baseline.
- E1a-A is therefore merged but not activated through the canonical production Worker workflow.

## Runtime precondition gate

`config/deployment-environments.json` currently has:

- production D1 identity status: **`unverified`**;
- production D1 database name: **`null`**;
- production D1 UUID SHA-256 fingerprint: **`null`**.

`tools/verify_production_runtime_preconditions.mjs` requires all three to be reviewed/verified before deployment can proceed.

## Activation authority gate

`config/production-activation-authority.json` currently has:

- status: **`blocked`**;
- authorized source SHA: **`null`**;
- `production_frontend_explicit_environment`: pending;
- `production_frontend_live_contract`: pending;
- `production_d1_identity`: pending.

`tools/verify_production_activation_authority.mjs` requires `ready`, exact authorized runtime SHA, passed checks and controlled evidence.

### Conclusion

**Do not dispatch `Deploy Worker` yet.**

The workflow is correctly designed to reject the current state before production reviewer approval.

This is not a newly introduced E1a defect. D3D deliberately left activation fail-closed until a real production deployment was required. E1a-A now satisfies that historical reopen condition.

Classification:

**Level 3 High Impact / NOW dependency** — narrow production-activation completion required to finish the current Gate-E batch.

---

# 6. Important Deployment Semantics

## Actual input name

Current `.github/workflows/deploy-worker.yml` input:

`source_sha`

Do not use the stale name `expected_main_sha`.

## Runtime source does not have to equal latest main after authority merge

Deployment requires:

- requested runtime source = exact 40-character SHA;
- runtime source remains reachable from `main`;
- runtime source itself passes production runtime prerequisites;
- **latest protected-main control plane** explicitly authorizes that requested runtime SHA.

Define:

- `R` = immutable deployable runtime source;
- `A` = later protected-main activation-authority commit.

Expected final relation:

`A` is newer than `R`, while `Deploy Worker` runs with `source_sha = R`.

This separation is intentional and must not be simplified back into “deploy current main”.

---

# 7. Gate-E Master Plan — Revised and Converged

| Batch | Objective | Status | Schema impact |
|---|---|---|---|
| E0 | Post-D architecture re-baseline | DONE | none |
| E1a-A repo | Compatibility shim + tests + merge/post-main/recovery | DONE | none |
| **E1a-A0** | Current docs/state re-baseline | **ACTIVE — PR #174 / final-head CI pending** | none |
| **E1a-A1** | Fresh GET-only production identity evidence | NEXT | none |
| **E1a-A2** | Evidence-backed production D1 runtime identity pinning; produce runtime SHA `R` | BLOCKED on A1 PASS | none |
| **E1a-A3** | Exact-runtime production identity re-audit on `R` | BLOCKED on A2 | none |
| **E1a-A4** | Protected-main activation evidence + authority authorizing `R`; produce authority SHA `A` | BLOCKED on A3 PASS | none |
| **E1a-A5** | Canonical `Deploy Worker` with `source_sha = R` | BLOCKED on A4 | Schema stays 2 |
| **E1a-A6** | Deployment + compatibility-specific production verification | BLOCKED on A5 | none |
| **E1a-A7** | E1a-A deployment closeout + recovery/handoff | BLOCKED on A6 | none |
| **E1a-B** | Remove tenant email from normal public calculation dispatch | BLOCKED until A7 | none |
| E1b | Immutable EOD + explicit realtime valuation | PLANNED after E1a | none |
| E1c | Active-job idempotency/recovery lifetime alignment | PLANNED | none unless evidence proves unavoidable |
| E1d | Separate cursor-signing secret from system API auth | PLANNED | none |
| E2-pre | D1 atomicity / Schema-3 pre-migration audit | CONDITIONAL after E1 | audit only |
| E2a–E2f | Narrow ledger-revision protocol | CONDITIONAL | additive Schema 3 only |

Formal operational detail:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

---

# 8. E1a-A Activation Execution Contract

## A1 — Production Identity Evidence

Use:

`.github/workflows/production-identity-evidence.yml`

Input:

`source_sha = <exact current protected-main HEAD>`

This is GET-only and reviewer-protected. It must obtain authoritative Cloudflare D1/Worker/Pages/live-CSP evidence without production mutation.

Before dispatch, ensure the Pages production deployment for that exact current-main SHA has propagated; otherwise the collector is expected to fail its exact canonical-deployment check and the result must not be mistaken for a D1 identity defect.

If A1 fails, stop and classify before changing anything:

- Pages source SHA not yet current -> deployment-propagation condition; revalidate after the existing Pages deployment reaches the exact audited SHA;
- missing/incorrect explicit production Pages variables or live CSP -> separate narrowly scoped production-configuration remediation with fresh evidence afterward;
- D1/active-Worker binding mismatch -> High Impact/Critical investigation; do not pin identity or deploy;
- credential/permission failure -> control-plane credential RCA; do not weaken evidence requirements;
- malformed/missing artifact -> evidence-pipeline RCA.

No failed A1 may be converted into A2 by guessing production values.

## A2 — Runtime D1 identity pinning

Only after A1 PASS:

- update `config/deployment-environments.json` from the sanitized authoritative evidence;
- set production identity to `verified`;
- pin exact observed D1 database name and UUID SHA-256 fingerprint;
- never commit raw D1 UUID/account/token/secret;
- protected merge/post-main/recovery;
- resulting merge = runtime source `R`.

## A3 — Exact-runtime evidence

After Pages for `R` propagates, rerun Production Identity Evidence with:

`source_sha = R`

A1 discovers/pins identity; A3 binds activation evidence to the exact runtime source.

## A4 — Activation authority

Create controlled evidence under:

`docs/governance/evidence/production-activation/`

Required check names:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

Then update `config/production-activation-authority.json` to `ready`, authorize exact `R`, reference those evidence files, and protected-merge. The resulting latest main is activation control-plane SHA `A`.

The A4 reviewer must compare the controlled evidence summaries back to the reviewed sanitized A3 artifact/run; satisfying the JSON schema alone is not sufficient evidence provenance.

## A5 — Deploy

Run:

`Deploy Worker`

with:

`source_sha = R`

The workflow must pass runtime preconditions from `R` and activation authority from latest protected main `A` before production mutation.

## A6 — Verify E1a-A capability itself

Generic `/api/version`, `/api/health`, auth and CORS checks are necessary but do not directly prove the new E1a-A system lookup boundary.

Before E1a-B, require a read-only compatibility proof using a valid-format nonexistent opaque job id under trusted system authentication:

- new E1a-A Worker expected: **404 NOT_FOUND**;
- old canonical Worker system principal expected: **403 FORBIDDEN**;
- no tenant identity in response;
- no calculation-job mutation.

Also verify the existing pre-cutover calculation path remains usable.

If no automated verifier exists at execution time, add a narrow reviewer-protected audit step rather than relying on inference from health alone.

---

# 9. E1a-B — Privacy Objective and Cutover Contract

Normal user-triggered public GitHub calculation execution must not contain tenant email in workflow dispatch inputs.

PR #172 remains **CLOSED / NOT MERGED / PROTOTYPE EVIDENCE ONLY**.

Final prototype head:

`25b43ed852124799b50cf8a7b27d272334c5ccd0`

Prototype evidence included:

- intentional red test-first run;
- progressive hosted-boundary fixes;
- Python functional suite passing before coverage restoration;
- final full green CI #555/#556;
- user/system privacy regressions;
- no Schema 3 or financial-engine redesign.

The prototype was correctly abandoned as a merge candidate after rollout review found the Worker-deployment ordering outage window.

### Required B implementation from deployed A stable baseline

- canonical `worker.js` authorizes system GET `/api/calculation-jobs/:id` while preserving tenant user GET;
- system projection returns narrow owner target; user projection remains owner-free;
- Worker dispatch sends benchmark + opaque job id, no tenant email;
- normal GitHub-hosted calculation uses `CALCULATION_JOB_ID`, never `TARGET_USER_ID`;
- thin runner resolves owner via system Worker lookup before unchanged financial `main.run_update()`;
- hosted run with no job is explicitly all-user and cannot inherit stale target state;
- local non-GitHub legacy targeting may remain temporarily compatible if still required;
- temporary A shim removed after canonical Worker takes over;
- Gate-C audit-only email path remains isolated and cannot be attached to a calculation job;
- no schema migration.

### Additional integrity hardening for B

The calculation job already stores `benchmark`, while dispatch also carries calculation benchmark configuration. B must prevent silent divergence between stored job benchmark and dispatched benchmark.

Accept either:

- trusted job metadata becomes authoritative for benchmark; or
- runner explicitly validates equality and fails closed.

Do not silently calculate one benchmark while the durable job says another.

### B verification

- test-first contracts recreated from #172, not branch-merged;
- fresh full CI;
- independent privacy/security review including Actions log surfaces;
- exact-head merge/post-main/recovery;
- deploy through current production activation authority model;
- controlled user-triggered production calculation processes exactly one tenant;
- normal public dispatch inputs/log evidence contain no tenant email;
- scheduled all-user run semantics preserved;
- only then mark E1a DONE and activate E1b.

---

# 10. Remaining Gate-E Risk Delta

## P0-A — public GitHub calculation dispatch carries tenant email

**ACTIVE remediation: E1a.**

A = compatibility prerequisite; B = actual privacy cutover.

## P0-B — realtime quote can overwrite last historical EOD row

**OPEN — E1b after E1a closes.**

Current `MarketDataClient.download_data()` can overwrite `hist.index[-1]` with a realtime quote without first proving quote date equals that historical row date. Provenance does not undo the economic contamination.

Required root-level direction: immutable historical EOD + explicit realtime valuation state.

## P0-C — active job idempotency/recovery lifetime shorter than supported workflow duration

**OPEN — E1c.**

Do not fix only by changing 15 minutes to another magic number. Active queued/running dedupe/recovery lifetime should derive from lifecycle state and supported execution/queue semantics.

## P0-D — record mutations lack mutation idempotency / optimistic row revision

**OPEN / STRUCTURAL — conditional E2.**

## P0-E — pagination not bound to one ledger revision

**OPEN / STRUCTURAL — conditional E2.**

## P0-F — calculation jobs do not bind source ledger revision

**OPEN / STRUCTURAL — conditional E2.**

## P0-G — stale calculation can become latest published snapshot

**OPEN / STRUCTURAL — conditional E2 compare-and-publish.**

## P1 — separate later programs

- browser credential persistence / CSP / HttpOnly session migration;
- persistent tenant email identity -> internal durable identity;
- authoritative exchange calendars;
- broader scoped service credentials.

---

# 11. Gate C / Gate D Decisions Still Locked

## Gate C

- Schema-2 source validity order remains deterministic `Date -> record id`.
- Record id is persistence tie-breaker, not broker-time proof.
- Source prefix integrity remains authoritative.
- Calculator `CLAMP` remains downstream defense-in-depth.
- public `Timestamp` / `Sequence` are recognized contracts; `_sequence` is not.
- broker chronology remains deferred until documented reopen condition.

## Gate D

- deterministic identity excludes volatile run metadata;
- source identity excludes user email/id, free-form note and `created_at`;
- effective market/FX numeric identity is separate from provider diagnostics;
- engine identity requires exact full Git SHA;
- ambiguous/non-finite provenance fails closed;
- deterministic replay uses explicit timezone-aware calculation clock/as-of;
- production manifest remains additive across Worker/D1/frontend boundaries.

---

# 12. Decision Log — Gate E

- **E-D-01 LOCKED:** Gate D CLOSED; final recovery `backup-post-gate-d-2332116`.
- **E-D-02 LOCKED:** old risk register is historical evidence, not current roadmap.
- **E-D-03 LOCKED:** broad immediate Schema-3/provider/broker/cash redesign rejected.
- **E-D-04 LOCKED:** Gate E Safety & State Integrity remains the active program.
- **E-D-05 LOCKED:** E1a uses compatibility-first A/B rollout because repository merge and production Worker activation are separate.
- **E-D-06 LOCKED:** E1a-A repository implementation does not remove email dispatch; it only prepares the trusted compatibility boundary.
- **E-D-07 LOCKED:** PR #172 is superseded prototype evidence and must never be merged directly.
- **E-D-08 REVISED:** E1a-A cannot proceed directly from repository merge to Worker deployment; the historical D3D production-activation prerequisites are now a NOW dependency because a real activation is being prepared.
- **E-D-09 LOCKED:** `Deploy Worker` input is `source_sha`; deployable runtime `R` may be older than latest authority main `A` if `A` explicitly authorizes `R`.
- **E-D-10 LOCKED:** production D1 identity must come from external read-only evidence, never guesses or copied staging values.
- **E-D-11 LOCKED:** activation evidence must be bound to exact runtime `R` before authority becomes `ready`.
- **E-D-12 NEXT:** E1a-B starts only after A deployment + compatibility proof.
- **E-D-13 PLANNED:** E1b immutable EOD vs explicit realtime valuation.
- **E-D-14 PLANNED:** E1c lifecycle-derived active-job dedupe/recovery semantics.
- **E-D-15 PLANNED:** E1d cursor-signing secret separation.
- **E-D-16 CONDITIONAL:** Schema 3 only for narrow ledger revision after E1 + E2-pre.

---

# 13. Root-Cause Log

- **RC-E-01 ACTIVE:** normal public GitHub dispatch exposes tenant email -> E1a-B; A is zero-downtime prerequisite.
- **RC-E-01A CONTROLLED:** all-at-once cutover can fail between repository merge and Worker deployment -> compatibility-first A/B rollout.
- **RC-E-01B ACTIVE DEPENDENCY:** D3D intentionally left production activation fail-closed; E1a-A is now a real activation and therefore must complete the deferred evidence/runtime-authority chain before deploy.
- **RC-E-01C DOCUMENTATION ROOT CAUSE:** previous current handoff connected E1a to manual deployment but omitted the older activation preconditions, creating an incorrect “dispatch Deploy Worker next” instruction.
- **RC-E-01D VERIFICATION GAP:** generic production health/source/CORS audit does not directly prove the E1a-A system opaque-job lookup boundary; add/read-only compatibility proof before B.
- **RC-E-01E A0 DOC-EDIT ROOT CAUSE / FIXED:** first README update rebuilt a long file from incomplete/reconstructed context and unintentionally changed unrelated FIFO/FX text. Exact PR patch review caught the scope pollution before merge. Fix `6db8bbfc69aabd664dce5fad361961785ffe1eb6` restored README from exact baseline and retained only deployment navigation. Prevention: long-file edits require exact-baseline patch review; any non-target diff is a BLOCKER and must be removed before final-head CI.
- **RC-E-02 OPEN:** realtime quote can mutate prior EOD row -> E1b.
- **RC-E-03 OPEN:** active job TTL can expire before supported execution/recovery horizon -> E1c.
- **RC-E-04 OPEN:** API auth secret and cursor signing share one trust key -> E1d.
- **RC-E-05 OPEN:** record mutations lack mutation identity/row revision -> E2.
- **RC-E-06 OPEN:** pagination not bound to ledger revision -> E2.
- **RC-E-07 OPEN:** job not bound to requested ledger revision -> E2.
- **RC-E-08 OPEN:** stale calculation can publish latest snapshot -> E2.
- **RC-E-09 CONTROLLED:** broker chronology absent but not immediate migration driver under current Gate-C contract.
- **RC-E-10 DEFERRED:** browser credential/CSP and tenant email persistence require separate security/identity programs.

---

# 14. Recovery Index

Do not delete during normal cleanup.

- Gate A: `backup-post-product-integrity-p6c-f3c55f4`
- Gate B: `backup-post-gate-b-03242d0`
- Gate C final: `backup-post-gate-c-ef9f5a1`
- Gate D final: `backup-post-gate-d-2332116`
- Gate E E0: `backup-post-gate-e-e0-32f272c`
- pre-E1a: `backup-pre-gate-e-e1a-87b5949`
- post-E1a-A repository merge: `backup-post-gate-e-e1a-a-c312408`
- pre-E1a activation-doc re-baseline: `backup-pre-gate-e-e1a-activation-docs-c312408`

Full intermediate Gate-D and historical D3D recovery refs remain in Git history/evidence documents.

---

# 15. Change Log — Current Program

## Gate D terminal

- PR #168: D1e production calculation manifest;
- scheduled production `Update Portfolio Data #3217`: 2 success / 0 failure with reconciliation and upload checks;
- PR #169: Gate-D docs closeout;
- Gate D = DONE / CLOSED / POST-MAIN VERIFIED;
- final recovery `backup-post-gate-d-2332116`.

## Gate E E0

- PR #170: independent Post-Gate-D architecture re-baseline;
- merge `32f272c973459158a18e71c89a63337bbdfd4dfa`;
- post-main CI #543 success;
- recovery `backup-post-gate-e-e0-32f272c`;
- PR #171 closeout merge `87b5949a588bb6f655387ded554cb0a69d8a6f95`;
- E1a activated as the single next batch.

## E1a prototype

- PR #172 implemented most email-free cutover contracts and reached green CI;
- independent rollout review found `new workflow -> old production Worker -> 403` deployment-order BLOCKER;
- PR #172 CLOSED / NOT MERGED;
- retained only as B test-first implementation evidence.

## E1a-A repository stage

- PR #173 compatibility-first Worker entry shim;
- final head `ca3fa1f...`;
- final CI #559 PASS;
- merge `c312408...`;
- post-main CI #560 PASS;
- recovery `backup-post-gate-e-e1a-a-c312408`;
- canonical Worker deployment remains pending.

## E1a-A0 re-baseline

- deeper deployment review found runtime D1 identity still `unverified` and activation authority still `blocked`;
- Production Identity Evidence live dispatch count remains 0;
- Deploy Worker run count remains 0;
- official Cloudflare API contracts were revalidated for D1 Get Database, Workers active deployments/version bindings and Pages project/canonical-deployment surfaces; no architecture correction was required;
- operational plan created to reconnect Gate E with D3D fail-closed activation prerequisites;
- current documentation branch remains docs-only and performs no production action;
- PR #174 opened from exact baseline with exactly six expected documentation files;
- initial PR head `091f3eda243c02c8d204f4a3e18d1f84d3e986bf`;
- CI #561 / run `31348700558`: **SUCCESS** across Python / Frontend / Worker-D1;
- initial changed-file whitelist: **PASS — exactly six documentation files, no runtime/config/workflow/schema files**;
- exact patch review then found unintended README FIFO/FX changes caused by long-file reconstruction; this was classified BLOCKER rather than accepted as cleanup;
- commit `6db8bbfc69aabd664dce5fad361961785ffe1eb6` restored exact baseline README content outside the intended deployment-navigation block;
- README patch after correction is limited to the intended deployment navigation plus an EOF formatting marker;
- this final handoff update records the correction and creates the head that must receive fresh final-head CI before merge review.

---

# 16. Known Issues / Technical Debt / Deferred

## Known Issues — current production relevance

- normal GitHub calculation dispatch still exposes tenant email until E1a-B;
- realtime quote may overwrite prior EOD date/value until E1b;
- job dedupe/browser recovery lifetime mismatch until E1c;
- system API auth and record cursor signing share secret until E1d;
- structural ledger revision/publication concurrency issues remain conditional E2 drivers.

## Technical Debt / BACKLOG

- production Environment currently allows self-review semantics / admin break-glass; harden separately if desired without blocking the current product unless policy changes;
- dedicated least-privilege Cloudflare read-only audit credential;
- longer-lived external evidence archival beyond finite Actions artifacts;
- stale historical governance docs should be clearly labeled rather than silently treated as current.

## Deferred Programs

- HttpOnly/SameSite session + browser credential removal + CSP tightening;
- internal tenant UUID / Google `sub` persistence migration;
- authoritative exchange-calendar service and benchmark-calendar policy;
- first-class broker execution chronology under Gate-C reopen conditions;
- cash/account NAV;
- provider abstraction;
- Decimal/fixed point;
- derivatives.

## REJECT for current Gate-E execution

- broad Schema-3 redesign now;
- tenant UUID bundled into E1a;
- provider/broker/cash/Decimal redesign in E1;
- GitHub Actions replacement;
- reopening PR #172 or PR #130 as merge candidates;
- weakening validation/coverage/recovery/activation gates merely to deploy.

---

# 17. Current Batch Verification Checklist — E1a-A0

Before A0 can be marked DONE:

- [x] current protected-main baseline revalidated before branch creation;
- [x] no pre-existing open PR competing for active implementation;
- [x] recovery branch created from exact baseline;
- [x] docs-only work branch created from exact baseline;
- [x] deployment workflow/control-plane blockers revalidated against current source;
- [x] Cloudflare external API assumptions revalidated against current official documentation;
- [x] new E1a operational authority added;
- [x] current-facing related docs aligned;
- [x] initial changed-file whitelist reviewed — six documentation files only;
- [x] PR #174 opened;
- [x] initial full required CI #561 green on head `091f3eda...`;
- [x] unintended README scope pollution found by exact patch review and corrected before merge;
- [ ] fresh full CI green on the final head created by this handoff evidence update;
- [ ] final changed-file whitelist/main-drift/review-thread review;
- [ ] independent third-party review completed;
- [x] no runtime/config/workflow/schema changes in A0;
- [ ] merge only through normal protected-main process after all blockers above are satisfied;
- [ ] post-main CI/recovery/handoff update after merge.

---

# 18. Immediate Next Actions

## NOW — finish E1a-A0 review gates

1. Verify fresh required CI on the exact final PR head created by this handoff update.
2. Re-check exact six-file whitelist, README target-only patch and protected-main drift.
3. Check PR reviews, review threads and comments.
4. Obtain independent third-party review; classify findings BLOCKER / FOLLOW-UP / BACKLOG / REJECT.
5. Merge only if CI + independent review + scope checks are satisfied.
6. Verify post-main CI, create post-A0 recovery, then update current handoff.

## NEXT — E1a-A1 only

After A0 is safely merged/current:

1. re-read exact current protected main and ensure its Pages production deployment has propagated to that same SHA;
2. manually dispatch `Production Identity Evidence` using that exact current-main `source_sha`;
3. approve the reviewer-protected GET-only production evidence job;
4. inspect sanitized artifact;
5. if PASS, start a new A2 runtime-identity pinning branch;
6. if FAIL, classify/RCA the failed evidence before any remediation — do not bypass or guess values.

## Do not do yet

- do not dispatch `Deploy Worker`;
- do not start E1a-B;
- do not modify Schema 3;
- do not weaken the production activation gates.
