# PR-10D3D-B Production Identity Evidence Acceptance

Status: **B1 COLLECTOR MERGED / REPOSITORY VERIFIED — LIVE PRODUCTION EVIDENCE DISPATCH DEFERRED AT D3D CLOSEOUT AND NOW REOPENED FOR GATE E E1a-A**

Original B1 baseline: `3024dde0ea148a3997782614da5ca8100462d010`  
Synchronized main baseline used during B1: `6bf0f4002ac6ed7fead64d49084ac31c1d33fb39`  
B1 final head: `d4d83a1ff0dfd30dabbaa989b13b084f695be244`  
B1 merge: `0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`  
Pre-change recovery: `backup-pre-10d3d-b-3024dde` and later B1 recovery refs recorded in evidence history  
Worker/API/Schema: `4.07 / 2.60 / 2`

Gate-E operational authority after 2026-08-10 re-baseline:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

---

## 1. Purpose

D3D-B was designed to replace guessed/self-referential production identity assumptions with authoritative read-only external evidence before production activation can be unlocked.

The work intentionally has two conceptually separate stages:

1. **B1 — evidence collector implementation:** merge a GET-only, reviewer-protected production identity collector. No production runtime, D1, Pages, OAuth or data mutation.
2. **Activation evidence/pinning:** only when a real production activation is being prepared, run the merged B1 collector, review the sanitized PASS artifact, pin verified runtime identity, then create protected-main activation evidence/authority for an exact runtime source.

B1 implementation is complete. The live production activation exercise was intentionally deferred at D3D closeout and therefore was never completed merely by merging PR #129.

---

## 2. B1 repository completion evidence

PR:

`#129 — PR-10D3D-B1: collect authoritative production identity evidence read-only`

Final head:

`d4d83a1ff0dfd30dabbaa989b13b084f695be244`

Merge:

`0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`

Verification at completion:

- required CI `31165097984` / CI #315: **SUCCESS**;
- Production Identity Evidence PR workflow `31165100768` / run #9: **SUCCESS**;
- normal protected merge;
- post-merge main CI `31165272521` / CI #316: **SUCCESS**;
- post-merge Pages `31165270021` / Pages #1419: **SUCCESS**;
- no production Worker deployment;
- no D1/schema/data mutation;
- no Pages/OAuth production mutation.

Important semantic distinction:

> PR/CI success proves the collector implementation and contracts. It does not prove current live production identity because the reviewer-protected `workflow_dispatch` job must be run against a fresh exact current-main source when production activation is actually being prepared.

---

## 3. B1 evidence requirements

### Production D1 identity — three-way authority check

A protected D1 UUID alone must never prove itself. B1 requires independent observations to agree:

1. the protected production D1 UUID is used only as a lookup key;
2. Cloudflare D1 control plane returns that UUID and its database name;
3. every traffic-bearing Worker version in the latest active deployment binds canonical Worker D1 binding `DB` to that same UUID.

Requirements:

- Cloudflare D1 request is GET-only;
- Worker deployments request is GET-only;
- each active Worker version detail request is GET-only;
- database name authority comes from Cloudflare response, never `CLOUDFLARE_D1_DATABASE_NAME`;
- observed production database name must differ from reviewed staging D1 name;
- mixed gradual deployment fails closed if any traffic-bearing version binds another D1;
- artifact stores database name + SHA-256(UUID), not raw UUID/account/token/version IDs.

### Cloudflare Pages explicit production environment

Collector verifies:

- reviewed production Pages project/subdomain;
- production branch = protected `main`;
- explicit production variables:
  - `VITE_DEPLOY_ENV=production`;
  - exact reviewed `VITE_API_URL`;
  - exact reviewed `VITE_GOOGLE_CLIENT_ID`.

Missing or fallback-only configuration is not evidence.

### Canonical deployment and live CSP

Collector verifies:

- canonical Pages deployment environment = production;
- canonical deployment branch = `main`;
- canonical commit hash equals the exact audited source SHA;
- latest deployment stage = success;
- primary live Pages origin returns HTTP 200 without silent cross-origin redirect;
- both response-header and meta CSP are present;
- both CSP surfaces allow reviewed production API and reject staging API.

---

## 4. Security / no-mutation invariant

The B1 live evidence workflow:

- uses `permissions: contents: read`;
- accesses production credentials only behind the existing GitHub `production` Environment reviewer gate;
- accepts only an exact SHA that still equals current protected-main HEAD;
- performs no Worker deployment;
- performs no D1 query/migration/export/import/restore mutation;
- performs no Pages update/purge/deploy;
- performs no POST/PATCH/PUT/DELETE Cloudflare control-plane request;
- does not request/output `CLOUDFLARE_D1_DATABASE_NAME` as authority;
- uploads a sanitized JSON artifact only.

The Cloudflare bearer token is sent only to fixed Cloudflare API GET endpoints. The live Pages request carries no Cloudflare authorization header.

---

## 5. Failure-history evidence preserved

B1 deliberately retained failed candidate runs rather than rerunning them into apparent success.

Machine history:

`docs/governance/evidence/PR_10D3D_B1_FAILURE_HISTORY_2026-08-07.json`

Recorded root causes include:

- initial JavaScript parser error;
- missing registration in fail-closed GitHub Actions supply-chain inventory;
- CSP parser bug caused by treating any quote as closing delimiter instead of matching the opening quote.

Each repair produced a new source head and new CI/evidence run.

This history must remain append-only.

---

## 6. Final B1 acceptance matrix

| Check | State |
|---|---|
| Recovery branch from original baseline | PASS |
| Branch synchronized to then-current governance main without history rewrite | PASS |
| B1 collector implemented | PASS |
| D1 secret -> D1 API -> active Worker binding triangulation | PASS unit/contract implementation |
| Exact Pages canonical deployment SHA contract | PASS unit/contract implementation |
| Reviewer-protected GET-only workflow | PASS |
| Tests included in required Worker CI | PASS |
| Supply-chain workflow inventory | PASS |
| Final protected PR CI | PASS |
| Production Identity Evidence PR workflow | PASS |
| Independent exact-head diff/security review | PASS at B1 closeout |
| PR #129 merge | PASS — `0c3d716...` |
| Post-merge main CI/Pages | PASS |
| Live production `workflow_dispatch` evidence run | **NOT RUN AT D3D CLOSEOUT / NOW REQUIRED BY GATE E ACTIVATION** |
| Sanitized live production artifact | **PENDING CURRENT ACTIVATION** |
| Authoritative current production D1 identity | **PENDING CURRENT ACTIVATION** |
| Current explicit Pages/live CSP proof | **PENDING CURRENT ACTIVATION** |
| Evidence-backed runtime identity pinning | **PENDING CURRENT ACTIVATION** |
| Production activation authority `ready` | **PENDING CURRENT ACTIVATION** |
| Production Worker deployment | **PENDING CURRENT ACTIVATION** |

The historical mistake in the prior copy of this document was leaving B1 repository state as “IN PROGRESS” even after #129 merged. That stale state is now corrected without fabricating the still-missing live production evidence.

---

## 7. Why the live dispatch was intentionally deferred

The D3D phase closeout explicitly decided not to run the reviewer-protected production evidence job until a real production activation was being prepared.

Reason:

- the control-plane safety mechanism was already implemented;
- routine product work should not be blocked by open production activation evidence when no deployment was planned;
- old evidence should never become perpetual authority;
- fresh evidence is more useful when bound to the exact source actually being prepared for activation.

This was a controlled stop point, not an accidental omission.

---

## 8. 2026-08-10 Gate-E reactivation

Gate E / E1a-A is now the first current program that needs a real Worker activation after the D3D closeout.

At re-baseline:

- E1a-A merged to `main@c312408fec7a27a7b713ad5da79bf93bce62481f`;
- final-head and post-main CI are green;
- canonical Worker deployment has not run;
- `production.d1_identity_status` remains `unverified`;
- activation authority remains `blocked`;
- B1 live `workflow_dispatch` count remains zero.

Therefore the deferred live-evidence step is now legitimately reopened as a **narrow Gate-E dependency**.

Do not resume old D3D scope broadly.

Current sequence is maintained in:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

---

## 9. Current activation use of the B1 collector

### Discovery run

After the current docs re-baseline is merged, run:

`Production Identity Evidence`

with:

`source_sha = <exact current protected-main HEAD>`

Use the successful artifact to discover/verify the production D1 name/fingerprint and Pages/live contract.

### Runtime pinning

From that evidence only, create a protected PR that pins production D1 identity into `config/deployment-environments.json` and produces an immutable runtime source `R`.

Do not guess values or copy staging identifiers.

### Exact-runtime run

After `R` is main and its Pages production deployment has propagated, run B1 again with:

`source_sha = R`

This second pass is necessary because the collector requires the canonical Pages deployment commit to equal the audited source SHA. The activation authority must be based on evidence bound to the exact runtime source, not an earlier discovery commit.

### Authority evidence mapping

From the exact-runtime PASS artifact, create controlled evidence for:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

Each evidence file must satisfy `validateProductionActivationEvidence()` and reference the reviewed sanitized artifact/run.

Then latest protected main may set production activation authority to `ready` and explicitly authorize `R`.

---

## 10. External API authority model

The design depends on read-only Cloudflare control-plane observations:

- D1 Get Database;
- Workers List Deployments;
- Workers Get Version Detail;
- Pages Get Project;
- unauthenticated GET of the primary live production Pages origin for served CSP.

The repository must not infer live production identity from a secret or from its own desired-state configuration alone.

---

## 11. Explicit carry-forward / non-goals

### N62 staging-audience OAuth rejection

A real short-lived staging-audience Google ID token is still required for a genuine cross-audience rejection proof. Do not fabricate an invalid token to close the item.

This item is not automatically part of the E1a-A activation chain unless a current production acceptance contract explicitly makes it a blocker.

### N69 least-privilege audit token

Separate hardening backlog. Do not replace production deployment credentials inside the current activation batch unless the existing credential is unsafe or unusable.

### Schema 3

Still prohibited until the independent Recovery Evidence Gate and E2-pre conditions are satisfied.

---

## 12. Duplicate path remains superseded

PR #130 remains closed without merge because it duplicated the already-merged canonical #129 path.

Preserved duplicate branch:

`pr-10d3d-b-production-readonly-evidence`

Last duplicate head:

`9f5ca31e496a6af1a4d601a5e6ebc64a41992438`

Do not merge or reactivate it as the canonical evidence mechanism.

---

## 13. Rollback

### Collector implementation

B1 itself introduced no production runtime/data mutation. Repository rollback remains a normal protected revert if ever required.

### Live evidence run

A failed evidence run requires no production rollback because it is GET-only. Preserve the failed artifact/log, perform RCA, fix the correct source/config/control-plane issue, then collect fresh evidence on a new exact source.

### Activation after evidence

Runtime identity pinning and activation authority remain separate protected PRs so each can be reverted before deployment without touching production runtime.
