# Gate E / E1a Production Activation & Zero-Downtime Cutover Plan

Status: **ACTIVE OPERATIONAL AUTHORITY — E1a-A REPOSITORY MERGED; PRODUCTION ACTIVATION DEPENDENCY OPEN**  
Re-baseline date: **2026-08-10**  
Repository: `chihung1024/sheet-trading-journal`  
Observed protected-main baseline at re-baseline: `c312408fec7a27a7b713ad5da79bf93bce62481f`  
Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`

---

## 1. Purpose

This document is the **current operational authority for Gate E / E1a rollout**.

It does not replace the architectural decisions in:

- `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md`;
- `docs/governance/PR_10D3D_PRODUCTION_ACTIVATION_GATE_ACCEPTANCE.md`;
- historical append-only D3D evidence.

It connects those decisions into one executable path because Gate E / E1a-A is the first current batch that actually requires the previously fail-closed production Worker activation path to be reopened.

The single Primary Goal is:

> **Safely activate the already-merged E1a-A compatibility capability in production, prove that compatibility boundary is live, then perform the E1a-B email-free privacy cutover without an outage window.**

This is a dependency-resolution plan, not a reopening of broad D3D governance work.

---

## 2. Verified current state

### Repository state

- protected `main`: `c312408fec7a27a7b713ad5da79bf93bce62481f`;
- PR `#173` merged;
- PR #173 final head: `ca3fa1f86d21fe660226588063ada98d749d01b6`;
- final-head CI `#559`: PASS;
- post-main CI `#560`: PASS across Python / Frontend / Worker-D1;
- post-E1a-A recovery: `backup-post-gate-e-e1a-a-c312408`;
- E1a-A compatibility code is present in `worker-entry.js` on `main`;
- the legacy email-bearing calculation dispatch remains intentionally unchanged until E1a-B.

### Production deployment state

- `.github/workflows/deploy-worker.yml` has **zero workflow runs** as of this re-baseline;
- production Worker deployment of E1a-A is therefore **NOT VERIFIED / NOT PERFORMED through the canonical workflow**;
- `.github/workflows/production-identity-evidence.yml` has **zero `workflow_dispatch` runs** as of this re-baseline;
- no current live production identity artifact has been collected through the canonical B1 workflow.

### Fail-closed control-plane state

`config/deployment-environments.json` currently has:

- `production.d1_identity_status = "unverified"`;
- `production.d1_database_name = null`;
- `production.d1_database_id_sha256 = null`.

`config/production-activation-authority.json` currently has:

- `status = "blocked"`;
- `authorized_source_sha = null`;
- all three required production checks still `pending`.

Therefore the production deployment workflow is correctly expected to fail its non-secret preflight before the `production` Environment reviewer gate if it is dispatched now.

---

## 3. Root-cause analysis

### Symptom

E1a-A is merged and CI-green but cannot yet be activated in production.

### Failure point

The canonical `Deploy Worker` workflow performs two independent preflight checks before deployment:

1. `verify_production_runtime_preconditions.mjs` rejects an unverified production D1 identity;
2. `verify_production_activation_authority.mjs` rejects a `blocked` activation authority.

### Contributing factor

The original E1a-A handoff correctly identified that Worker deployment is manual, but it simplified the next step to “dispatch Deploy Worker” and did not reconnect Gate E to the older D3D production-activation prerequisites.

### Root cause

D3D deliberately stopped in a safe fail-closed state because no production activation was being prepared at that time. Its documented reopen condition was a real production activation need. E1a-A now meets that condition.

### Systemic cause

Current execution documentation had three individually reasonable but incompletely connected sources of truth:

- Gate-E roadmap and handoff;
- D3D production activation governance;
- current deployment runbook/workflows.

No current document previously modeled their combined state transition from “merged runtime change” to “authorized production source”.

### Impact

- **No current production outage is implied.** Existing production behavior remains serving.
- **Privacy remediation is incomplete.** Normal public GitHub dispatch still carries tenant email until E1a-B.
- **E1a-B must remain blocked.** Starting the cutover before a compatible Worker is live would recreate the `new workflow -> old Worker -> 403` outage window.
- The safe state is to complete the narrow production-activation dependency chain first.

---

## 4. Scope governance

### In scope

- current-state documentation correction;
- read-only production identity evidence collection;
- evidence-backed production D1 identity pinning;
- exact-runtime evidence revalidation;
- protected-main production activation authority;
- canonical E1a-A Worker deployment;
- E1a-A deployment verification and compatibility proof;
- E1a-A closeout;
- then E1a-B privacy cutover.

### Out of scope

- Schema 3;
- tenant UUID migration;
- HttpOnly session migration;
- cursor-secret separation beyond existing E1d plan;
- E1b realtime/EOD implementation;
- E1c job-lifetime implementation;
- provider abstraction;
- cash/account ledger;
- Decimal/fixed-point migration;
- derivatives;
- broad D3D governance redesign;
- unrelated issue/PR cleanup.

### Allowed investigation

Investigation may follow evidence needed to answer:

- why a production activation gate fails;
- whether collected evidence is authoritative and sanitized;
- whether runtime source and activation authority bind the same intended deployable SHA;
- whether E1a-A compatibility is actually live after deployment;
- whether any step would create a production outage or data-integrity risk.

### Expansion trigger

Stop and re-plan in an independent batch if evidence shows:

- production D1 identity mismatch;
- mixed active Worker versions binding different D1 databases;
- production Pages points at unexpected branch/API/OAuth configuration;
- production CSP does not match reviewed contract;
- production source metadata cannot identify the exact deployed commit;
- required secrets or environment protection are materially different from reviewed assumptions;
- Schema 3+ would be applied;
- data corruption/loss or auth bypass risk is discovered.

---

## 5. Important correction: deployment input and two-SHA model

### Actual workflow input

The current `Deploy Worker` workflow input is:

`source_sha`

It is **not** `expected_main_sha`.

### Reachable-from-main is not the same as current-main equality

The requested runtime source must be an exact 40-character SHA and must remain reachable from protected `main`. The workflow also loads the **latest protected-main control plane** and requires that control plane to authorize the requested runtime source.

The intended final model therefore has two SHAs:

- **R — runtime source SHA:** immutable commit whose own production runtime prerequisites pass and which contains E1a-A compatibility;
- **A — activation-authority main SHA:** later protected-main commit containing reviewed activation evidence that explicitly authorizes `R`.

It is valid and expected that:

`A` is newer than `R`, while `source_sha = R` is deployed.

This separation is a deliberate D3D TOCTOU/control-plane design and must not be collapsed back into “deploy whatever main currently points to”.

---

## 6. Master execution plan

### E1a-A0 — Documentation and state re-baseline

**Objective:** make every current-facing handoff/runbook agree with the actual repository and deployment state.

Required outcomes:

- record PR #173 merge / CI #559 / post-main CI #560 / recovery as completed;
- record deployment as pending;
- record production D1 identity and activation authority as fail-closed blockers;
- correct `Deploy Worker` input name to `source_sha`;
- introduce this operational authority;
- demote historical D3D handoff from current execution authority;
- preserve all append-only evidence unchanged.

Verification:

- docs-only changed-file review;
- link/path consistency;
- CI remains green;
- no runtime/config/workflow/schema change.

Rollback:

- revert docs-only PR;
- pre-batch recovery ref must remain available.

---

### E1a-A1 — Authoritative read-only production identity evidence

**Objective:** obtain fresh external evidence without mutating production.

Use:

`.github/workflows/production-identity-evidence.yml`

Input:

`source_sha = <exact current protected-main HEAD at dispatch time>`

The workflow itself requires that this SHA still equals current protected-main HEAD.

Required evidence:

- Cloudflare production D1 database name;
- SHA-256 fingerprint of the production D1 UUID, never raw UUID in the artifact;
- all active traffic-bearing Worker versions bind canonical D1 binding `DB` to that protected D1;
- Pages production branch is `main`;
- Pages production `VITE_DEPLOY_ENV`, `VITE_API_URL`, and `VITE_GOOGLE_CLIENT_ID` are explicit and reviewed;
- canonical Pages deployment equals the audited SHA and is successful;
- live production frontend is HTTP 200;
- header and meta CSP allow production API and reject staging API.

Stop conditions:

- any check fails;
- evidence artifact is missing or malformed;
- observed D1 identity conflicts with existing reviewed staging identity;
- current `main` moves before the workflow proves exact-current-main.

No deployment or D1 mutation is permitted in this batch.

---

### E1a-A2 — Evidence-backed runtime D1 identity pinning

**Objective:** create the first deployable runtime descendant containing E1a-A compatibility plus externally verified production D1 identity.

Create a fresh protected PR from then-current main.

Allowed runtime-contract change:

`config/deployment-environments.json` production fields only, using values derived from the successful A1 artifact:

- `d1_identity_status -> "verified"`;
- `d1_database_name -> <observed authoritative production name>`;
- `d1_database_id_sha256 -> <observed authoritative SHA-256 fingerprint>`.

Do not copy raw account ID, D1 UUID, API token, or secret values into the repository.

After protected merge and post-main CI, define the exact merge SHA as:

`R = <runtime source SHA>`

`R` must still contain the E1a-A `worker-entry.js` compatibility shim.

Required recovery:

- pre-A2 recovery;
- post-A2 runtime recovery pinned to `R`.

---

### E1a-A3 — Exact-runtime re-audit

**Objective:** bind activation evidence to the exact runtime source `R`, not to an earlier documentation or evidence-collection commit.

Preconditions:

- `R` is protected-main reachable;
- Pages production deployment for `R` has propagated and is successful;
- CI for `R` is green.

Run `Production Identity Evidence` again with:

`source_sha = R`

This second run is required because the collector verifies that the canonical Pages production deployment commit equals the audited source SHA. A1 evidence is discovery/pinning evidence; A3 evidence is the exact-runtime activation evidence.

Acceptance:

- status `passed`;
- D1 name/fingerprint match the runtime contract at `R`;
- every traffic-bearing Worker version still binds the same protected production D1;
- Pages and live CSP checks pass against `R`.

---

### E1a-A4 — Protected-main activation authority

**Objective:** authorize exactly `R` from the latest protected-main control plane.

Create a separate docs/control-plane PR after A3 passes.

Required machine-readable evidence directory:

`docs/governance/evidence/production-activation/`

Required evidence files:

1. `production_frontend_explicit_environment.json`;
2. `production_frontend_live_contract.json`;
3. `production_d1_identity.json`.

Each file must satisfy `validateProductionActivationEvidence()`:

- `schema_version = 1`;
- `check_name` exactly matches the authority key;
- `status = "passed"`;
- valid ISO `observed_at`;
- `source_sha = R`;
- `proof.result = "pass"`;
- non-empty `proof.summary`;
- non-empty `proof.artifact_reference` pointing to the reviewed sanitized A3 artifact/run.

Suggested mapping from A3 artifact:

- `production_frontend_explicit_environment`: Pages explicit production variables, branch and reviewed identity checks;
- `production_frontend_live_contract`: canonical deployment exact `R`, success, HTTP 200 and CSP checks;
- `production_d1_identity`: D1 GET identity plus all active Worker `DB` binding parity.

Then update `config/production-activation-authority.json`:

- `status -> "ready"`;
- `authorized_source_sha -> R`;
- `approved_at -> reviewed ISO timestamp not earlier than evidence observation`;
- all required checks -> `passed`;
- evidence map -> the three controlled JSON files above.

After this PR merges, call the new protected-main SHA:

`A = <activation-authority main SHA>`

The deploy workflow must read authority from `A` while deploying runtime `R`.

---

### E1a-A5 — Canonical Worker deployment

**Objective:** deploy runtime `R` only after both independent gates pass.

Run:

`.github/workflows/deploy-worker.yml`

Input:

`source_sha = R`

Expected control flow:

1. exact SHA syntax;
2. runtime source checkout;
3. main reachability;
4. Recovery Evidence Gate;
5. runtime production preconditions from `R`;
6. latest-main activation authority authorizes `R`;
7. `production` Environment reviewer gate;
8. repeat source/authority verification after approval;
9. protected production config render;
10. live D1 control-plane identity parity;
11. additive/no-op Schema-2 migrations only;
12. final authority check before remote D1 mutation;
13. final authority check before Worker deploy;
14. Worker deploy;
15. propagated `/api/version` and `/api/health` identity verification;
16. post-deploy public auth/CORS verification;
17. sanitized deployment artifact.

Immediate stop/rollback trigger:

- unexpected migration beyond allowed Schema 2 policy;
- D1 identity mismatch;
- authority drift;
- wrong source metadata;
- health/schema degradation;
- public auth/CORS regression.

Do not proceed to E1a-B on a partially successful deployment.

---

### E1a-A6 — Compatibility-specific production verification

**Objective:** prove the E1a-A capability itself is live, not merely that the Worker is healthy.

Current generic deployment audit verifies source/service/release/API/schema, health, anonymous auth and CORS. It does **not** directly prove the new system-only opaque calculation-job GET behavior.

Required compatibility proof before E1a-B:

- perform a trusted-system GET using a syntactically valid but intentionally nonexistent opaque job id;
- expected response on the E1a-A compatibility Worker: **404 NOT_FOUND**;
- old canonical Worker behavior for a correctly authenticated system principal would be **403 FORBIDDEN** because system GET authorization was absent;
- response must not contain tenant identity;
- request must be read-only and must not create/update/delete a production job.

This can be implemented as a narrow reviewer-protected system audit or an explicit secure deployment-verification step. Do not expose `API_KEY` to client/browser logs.

Also verify the existing pre-cutover user-triggered calculation path remains functional because E1a-A intentionally did not change dispatch/workflow/runner targeting.

If a full calculation smoke is not required for A, at minimum retain evidence that the legacy path was not changed and that the compatibility route is live.

---

### E1a-A7 — Closeout

E1a-A can be marked `DONE / DEPLOYED / VERIFIED` only when all are recorded:

- repository merge evidence;
- post-main CI;
- runtime source `R`;
- successful activation evidence;
- activation authority `A` authorizing `R`;
- Deploy Worker success;
- deployed `/api/version` and `/api/health` source identity = `R`;
- production schema remains 2;
- compatibility-specific proof;
- pre-cutover existing calculation path remains usable;
- post-deploy recovery reference;
- updated `to_do_update_list.md`.

Then and only then activate E1a-B.

---

## 7. E1a-B — Privacy cutover after deployed compatibility baseline

Create a fresh branch from the then-current stable main. Do not merge superseded PR #172.

Reapply the reviewed prototype contracts from #172:

- canonical `worker.js` authorizes user + trusted system GET `/api/calculation-jobs/:id`;
- user projection remains owner-free;
- system projection exposes only narrow owner target metadata;
- normal Worker dispatch sends `custom_benchmark` + opaque `calculation_job_id`, never tenant email;
- normal hosted calculation uses `CALCULATION_JOB_ID`, never `TARGET_USER_ID`;
- runner resolves owner through the trusted Worker boundary before unchanged financial `main.run_update()`;
- hosted run with no job is explicitly all-user and cannot inherit stale target state;
- local non-GitHub legacy targeting may remain temporarily compatible if still required;
- A compatibility shim is removed once canonical `worker.js` owns the system route;
- Gate-C audit-only explicit email targeting stays isolated and cannot be combined with a calculation job;
- no D1 migration.

Additional B integrity contract:

> The calculation job's stored benchmark and the dispatched calculation configuration must not silently diverge. Either make the trusted job metadata authoritative for benchmark or explicitly validate equality and fail closed.

Required B production smoke:

- one controlled user-triggered targeted calculation;
- exactly one tenant processed;
- public GitHub dispatch inputs/log evidence contain no tenant email;
- system lookup succeeds;
- result callback and snapshot upload succeed;
- no regression to scheduled all-user runs;
- post-B recovery created.

Only then mark E1a complete and activate E1b.

---

## 8. Verification matrix

| Gate | Evidence | Must be true before advancing |
|---|---|---|
| A0 docs | diff + CI | current state and source-of-truth hierarchy consistent |
| A1 discovery | Production Identity Evidence artifact | fresh PASS, GET-only, exact current main |
| A2 runtime pin | PR + CI + recovery | runtime D1 identity verified from external evidence |
| A3 exact-runtime | Production Identity Evidence artifact | PASS bound to exact `R` |
| A4 authority | three evidence JSONs + authority PR | latest main `A` explicitly authorizes `R` |
| A5 deploy | Deploy Worker run + artifact | deployed source/health/schema = `R` |
| A6 compatibility | trusted read-only route proof | E1a-A system lookup behavior is live |
| A7 closeout | handoff + recovery | A fully deployed/verified; B may start |
| B cutover | CI + privacy review + production smoke | normal dispatch is email-free end-to-end |

---

## 9. Rollback model

### Before Worker deployment

All changes are repository/config/control-plane changes. Roll back by normal protected revert to the last known good main; no production Worker rollback is required because runtime has not changed.

### During/after E1a-A deployment

If deployment or post-deploy verification fails:

1. stop E1a-B;
2. identify the last known good production Worker source/version from deployment evidence;
3. prefer restoration to the last known good runtime through the canonical controlled path;
4. do not alter D1 identity or secrets ad hoc to make health checks pass;
5. preserve failed run/evidence for RCA;
6. only retry after root cause is repaired and a new exact-source verification is available.

E1a-A does not require Schema 3 and must not change financial data semantics.

---

## 10. Convergence classification

### NOW

- A0 current-document re-baseline;
- A1 fresh production identity evidence;
- A2 evidence-backed runtime D1 pinning;
- A3 exact-runtime evidence;
- A4 activation authority;
- A5 E1a-A deploy;
- A6 compatibility proof;
- A7 closeout;
- E1a-B afterward.

### NEXT

- E1b immutable EOD + explicit realtime valuation;
- E1c active calculation-job lifetime/idempotency alignment;
- E1d cursor signing secret separation.

### BACKLOG

- production Environment `prevent_self_review=false` / admin break-glass hardening;
- dedicated least-privilege Cloudflare audit credential;
- long-term Actions artifact retention;
- broader session/tenant identity programs.

### REJECT for current program

- broad Schema-3 redesign now;
- tenant UUID migration now;
- broker execution/cash ledger now;
- provider abstraction now;
- Decimal migration now;
- derivatives work now;
- reopening superseded PR #172 or #130 as merge candidates.

---

## 11. Source-of-truth hierarchy for this rollout

When statements conflict, use this order:

1. live GitHub repository / current protected `main` / current Actions state;
2. machine-readable deployment contracts, current workflows, policy tools and tests;
3. `to_do_update_list.md` for current execution state;
4. **this document** for Gate E / E1a operational sequencing;
5. `docs/DEPLOYMENT.md` for deployment navigation;
6. `docs/engineering/POST_GATE_D_ARCHITECTURE_REVIEW.md` for Gate-E architecture priorities;
7. D3D acceptance/audit/evidence documents for historical rationale and exact prior evidence;
8. older superseded handoffs only as forensic context.

Historical append-only evidence must not be rewritten to look current.

---

## 12. Definition of DONE for E1a

E1a is not DONE merely because code is merged or because a deployment workflow is green.

E1a is DONE only when:

- E1a-A compatibility runtime is deployed and directly proven live;
- E1a-B normal calculation dispatch is email-free;
- targeted production calculation smoke succeeds end-to-end;
- no public dispatch/log evidence contains normal tenant email targeting;
- scheduled all-user calculation remains functional;
- schema remains 2;
- CI, production verification, recovery and handoff evidence are complete;
- E1b is the single next active batch.
