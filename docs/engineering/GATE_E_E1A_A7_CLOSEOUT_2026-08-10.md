# Gate E / E1a-A7 Closeout — Production Activation and Compatibility Evidence

Status: **A7 IN PROGRESS — A1–A6 VERIFIED; LEGACY USER-PATH PROOF PENDING**  
Date: **2026-08-10**  
Repository: `chihung1024/sheet-trading-journal`

## 1. Closeout rule

E1a-A is not CLOSED until all A1–A6 evidence is durable **and** the legacy pre-cutover authenticated user calculation path has been proven usable after the A5 Worker activation.

Do not activate E1a-B from this document while the remaining legacy-path condition is pending.

## 2. Immutable runtime / control-plane identities

- Runtime source `R`: `2d1fc1cd7190651c64b764c58f58d67826d408e8`
- Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`
- Production Worker version observed after deploy/audit: `245eb37c-0d52-4344-9cc3-f82866434f28`
- Activation authority `A`: `0d4896d3161eebfea3dd9bec16b57b6e061cbf04`
- Current protected-main baseline at A7 start: `210e004528b725ed7847ed17fd1aad4a7390df0d`

`R` and `A` are intentionally different SHAs. Runtime deployment remains pinned to `R`; later protected-main commits are control-plane/evidence changes and do not imply a Worker redeploy.

## 3. A1 — Production identity evidence

First reviewer-protected A1 attempt:

- Production Identity Evidence run #10 / `31362511755`
- source: `689761ec3979e4a9e87dc2515bab98e7273f53fb`
- conclusion: **FAIL**
- root cause: production Pages variables did not satisfy explicit production environment/API contracts; failed evidence upload also exposed an evidence-retention workflow defect.

Evidence-pipeline repair:

- PR #178 — `Gate E A1: preserve failed production identity evidence`
- merge: `e5f23fd9c0f599212b7ee5fd7e4939a0e049adda`

Successful A1:

- Production Identity Evidence run #11 / `31364597982`
- source: `e5f23fd9c0f599212b7ee5fd7e4939a0e049adda`
- conclusion: **SUCCESS**

A1 supplied the reviewed production D1 identity/config/live evidence required for A2.

## 4. A2 — Production D1 identity pinning / runtime creation

- PR #181 — pin verified production D1 identity
- merge/runtime `R`: `2d1fc1cd7190651c64b764c58f58d67826d408e8`
- production D1 identity was pinned from A1 evidence rather than guessed
- production activation authority remained blocked until A3/A4

A2 status: **PASS**.

## 5. A3 — Exact-runtime re-audit

- Production Identity Evidence run #12 / `31366644577`
- exact audited source: `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`
- conclusion: **SUCCESS**

A3 bound fresh production identity/config/live evidence to the exact immutable runtime candidate.

A3 status: **PASS**.

## 6. A4 — Activation authority

- PR #182 — authorize exact runtime from A3 evidence
- authority merge `A`: `0d4896d3161eebfea3dd9bec16b57b6e061cbf04`
- `A` explicitly authorized runtime `R`
- provenance was tied to reviewed A3 evidence

A4 status: **PASS**.

## 7. A5 — Canonical Worker deployment and verification incident

Canonical Deploy Worker:

- run #1 / `31368153511`
- workflow control-plane head: `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`
- requested runtime: `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`
- production preflight / reviewer gate / D1 identity / authority checks: PASS
- D1 migration step: no pending migrations
- Worker deploy command: SUCCESS
- deployed Worker version: `245eb37c-0d52-4344-9cc3-f82866434f28`

The run's final conclusion was **FAILURE** because the post-deploy CORS audit immediately followed the first single readiness hit and observed a stale pre-deploy edge that still accepted the staging Pages origin.

RCA:

`single new-edge hit != stable production-contract convergence`

The production CORS contract itself was not weakened and runtime `R` was not rolled back.

Verification-state-machine hotfix:

- PR #183 — require stable production contract after Worker deploy
- exact merge: `4ee018447d3cdbdd2680dd79e88db2dd857eea4a`
- post-main CI #581: PASS
- Pages #1469: SUCCESS
- recovery: `backup-post-a5-verification-hotfix-4ee0184`

The hotfix requires three consecutive full production-contract passes and resets progress on any stale-edge/contract failure.

A5 runtime activation status: **DEPLOYED; post-deploy evidence completed by A6 fresh audit rather than by re-deploying R**.

## 8. A6 — Generic production contract + capability-specific compatibility proof

A6 proof workflow hardening:

- PR #184 — reviewer-protected opaque-job compatibility proof
- merge: `210e004528b725ed7847ed17fd1aad4a7390df0d`
- post-main CI #583: PASS
- Pages #1470: SUCCESS
- recovery: `backup-post-a6-compatibility-proof-210e004`

Reviewer-protected Production Contract Audit:

- run #40 / `31386148724`
- workflow definition head: `210e004528b725ed7847ed17fd1aad4a7390df0d`
- exact audited runtime: `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`
- conclusion: **SUCCESS**

Generic production contract evidence:

- source commit: exact `R`
- service: `trading-journal-api`
- release: `4.07`
- API: `2.60`
- schema: `2`
- `/api/version`: 200
- `/api/health`: 200
- anonymous records: 401
- production origins: 204
- staging Pages origin: 403
- localhost origins: 403
- required system checks: executed

Capability-specific proof:

- trusted-system GET to valid-format intentionally nonexistent opaque job id
- result: `404 NOT_FOUND`
- tenant identity returned: false
- probe id recorded: false

This discriminates E1a-A from the pre-E1a-A canonical system-principal behavior, which would authorize the API key as system but reject the user-only GET route with `403 FORBIDDEN`.

Durable sanitized evidence:

`docs/governance/evidence/GATE_E_E1A_A6_PRODUCTION_AUDIT_2026-08-10.json`

GitHub artifact:

- artifact ID: `9061787899`
- name: `production-contract-audit-2d1fc1cd7190651c64b764c58f58d67826d408e8`
- ZIP SHA-256: `0528665d800c660eb1d2e075b1911c9be51135fef8a6c699a9b733394bbc7156`
- files: `production-contract-audit.json`, `production-e1a-compatibility-proof.json`

A6 compatibility / production-contract status: **PASS**.

## 9. Remaining A7 blocker — legacy authenticated user calculation path

Required evidence:

> A real authenticated production user uses the existing pre-E1a-B calculation/update path after A5 activation, and the resulting durable calculation job / GitHub `update.yml` run completes successfully without evidence of regression caused by E1a-A.

Current remote evidence at A7 start:

- A5 deployment started at `2026-08-10T08:00:02Z`;
- latest `update.yml` workflow run visible before A7 preparation is run #3221 / `31365227747`, created at `2026-08-10T07:16:55Z`;
- therefore no post-A5 user-path run exists yet to satisfy this closeout condition.

Status: **PENDING — HUMAN AUTHENTICATED PRODUCTION SMOKE REQUIRED**.

Do not substitute a manual GitHub dispatch, scheduled run, unit test, or system-only API check for this user-path evidence.

## 10. A7 completion checklist

Already satisfied:

- [x] repository/CI evidence
- [x] runtime `R`
- [x] exact-runtime A3 evidence
- [x] authority `A` authorizing `R`
- [x] canonical Worker deployment performed
- [x] deployed source/version/health/schema identity
- [x] generic production contract proof
- [x] compatibility-specific 404-vs-403 proof
- [x] pre/post A5/A6 recovery references
- [x] sanitized A6 evidence retained in repository

Still required:

- [ ] post-A5 authenticated legacy user calculation path smoke
- [ ] inspect resulting `update.yml` run and job lifecycle evidence
- [ ] update `to_do_update_list.md` to close E1a-A and activate E1a-B
- [ ] final A7 Independent Review / exact-head CI
- [ ] expected-head merge / post-main CI
- [ ] post-A7 recovery

## 11. Next exact action

A maintainer must use the normal production frontend as a real authenticated user and trigger one ordinary portfolio update/calculation through the existing UI.

After that action, do not manually dispatch `update.yml`. The resulting GitHub workflow run must come from the normal application path so it can serve as legacy-path usability evidence.

Once the post-A5 user-path run is verified, update this same A7 closeout batch, close E1a-A, and only then activate E1a-B.
