# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before acting. Historical detail belongs in dedicated evidence/PR/Git history; this file remains current-state-first.

Last updated: **2026-08-10**

---

## 1. Current Stable Repository State

Repository: `chihung1024/sheet-trading-journal`

Latest fully verified Gate-E A0 implementation merge:

`b03fed2d0d26807d7d617d51e6ed9f0aab3767a9`

Evidence:

- PR #176 — repository governance/docs/actions hygiene: **MERGED**;
- exact reviewed PR head: `df99da95d6a80f099d33e5cfcf2a7d340bad785b`;
- exact-head CI #567 / run `31361469797`: **PASS**;
- V3 Same-AI Independent Review: **PASS — NO BLOCKER**;
- exact-head merge: `b03fed2d0d26807d7d617d51e6ed9f0aab3767a9`;
- post-main CI #568 / run `31361899913`: **PASS**;
- post-hygiene recovery: `backup-post-docs-actions-hygiene-b03fed2`.

Runtime contract remains:

- Worker `4.07`;
- API `2.60`;
- D1 Schema `2`.

Important:

> Repository merge state is not production Worker deployment state.

Canonical `Deploy Worker` has still never run. E1a-A compatibility is therefore **not yet production-activated/verified**.

---

## 2. Current Phase

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a privacy remediation: `ACTIVE`.
- E1a-A0 repository/docs/actions stabilization: `CLOSED / POST-MAIN VERIFIED`.
- **E1a-A1 Production Identity Evidence: ACTIVE — CURRENT PRIMARY BATCH.**
- E1a-A2 production D1 identity pinning: `PLANNED`, blocked on A1 PASS artifact.
- E1a-A3 exact-runtime evidence: `PLANNED`, blocked on A2 runtime SHA `R` and Pages propagation.
- E1a-A4 activation evidence/authority: `PLANNED`, blocked on A3.
- E1a-A5 canonical Worker deploy: `BLOCKED`, requires A2/A3/A4.
- E1a-A6 compatibility/live verification: `BLOCKED`, requires A5.
- E1a-A7 closeout: `BLOCKED`, requires A6.
- E1a-B email-free privacy cutover: `BLOCKED`, requires A7.
- E1b/E1c/E1d: `PLANNED`.
- Schema 3 / E2: `DEFERRED` until E1 + E2-pre conditions.

Operational authority:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

Canonical deployment runbook:

`docs/DEPLOYMENT.md`

---

## 3. Governance Baseline

`AI_PROJECT_PLAYBOOK.md` V3.0 is restored as the complete locked governance constitution.

Status:

```text
GOVERNANCE BASELINE LOCKED
Governance Architecture: FROZEN
```

The PR #175 whole-file replacement incident is closed. `tests/test_repository_governance.py` now guards against replacing the full V3 constitution with a small amendment-only document and also protects current documentation authority/deletion hygiene.

Do not reopen governance architecture without a documented V3 Reopen Condition plus evidence.

---

## 4. Documentation / Actions Hygiene Closeout

Completed through PR #176:

- added `docs/README.md` source-of-truth map;
- made `docs/DEPLOYMENT.md` current/fail-closed;
- added current Gate-E E1a activation plan;
- made `V5_CURRENT_HANDOFF.md` explicitly historical D3D rationale;
- corrected D3D-B1 acceptance: collector merged/verified, live activation evidence still pending;
- removed obsolete root `AUDIT_TRADING_CALC_REVIEW.md`;
- removed obsolete root `TRADING_CALC_OPTIMIZATION_PLAN.md`;
- retained audit/evidence/acceptance records with unique forensic value;
- retained `DEPLOYMENT_FINAL.md` as an explicit tombstone warning against obsolete manual deployment;
- retained legacy Worker archive because current manifest/tests distinguish it from the canonical path;
- closed superseded PR #174 without merge.

Current repository workflow inventory remains exactly seven tracked workflows and is fail-closed by `docs/governance/github-actions-pins.json` + `tests/test_workflow_supply_chain.py`.

Historical deleted-workflow registrations may still appear in the GitHub Actions UI. They are not current repository workflow files. Do not recreate them merely for UI cleanup.

Detailed closeout:

`docs/engineering/REPOSITORY_DOCS_ACTIONS_HYGIENE_2026-08-10.md`

---

## 5. E1a-A Repository Evidence

Compatibility-first PR #173:

- final head `ca3fa1f86d21fe660226588063ada98d749d01b6`;
- final-head CI #559: PASS;
- exact merge `c312408fec7a27a7b713ad5da79bf93bce62481f`;
- post-main CI #560: PASS;
- recovery `backup-post-gate-e-e1a-a-c312408`;
- temporary system-only opaque-job compatibility exists in `worker-entry.js`;
- normal email-bearing dispatch/workflow remains intentionally unchanged until E1a-B.

Current production activation blockers are deliberate:

- `config/deployment-environments.json`: production D1 identity `unverified`, name/fingerprint null;
- `config/production-activation-authority.json`: `blocked`, no authorized runtime SHA;
- canonical Deploy Worker: no run.

Therefore direct Worker deploy remains prohibited.

---

## 6. Current Primary Batch — E1a-A1 Production Identity Evidence

### Objective

Obtain fresh authoritative, reviewer-protected, GET-only production identity/config/live evidence against the **exact current protected-main HEAD** before any production identity pinning or Worker deployment.

### Workflow

`.github/workflows/production-identity-evidence.yml`

Required input:

`source_sha = <exact current protected-main HEAD at dispatch>`

The workflow itself fails closed unless that SHA still equals current protected-main HEAD.

### Required PASS observations

- authoritative production D1 database name;
- SHA-256 fingerprint of production D1 UUID, never raw UUID in artifact;
- all traffic-bearing Worker versions bind canonical `DB` to the same authoritative D1;
- explicit Pages production branch/environment/API/OAuth values;
- canonical Pages deployment equals the audited source SHA and is successful;
- live production frontend HTTP 200;
- response-header and meta CSP allow production API and reject staging API.

### A1 failure classification

- canonical Pages deployment has not yet propagated to exact source SHA → readiness/propagation issue; wait for successful current-main Pages deployment, then rerun;
- explicit Pages env or CSP mismatch → narrow production configuration RCA/remediation; no deployment;
- production D1 / active Worker binding mismatch → **CRITICAL STOP**; do not pin identity or deploy;
- credential/permission failure → control-plane credential RCA; do not weaken evidence;
- malformed/missing artifact → evidence-pipeline RCA;
- never guess production D1 identity from staging, repository names, secret names, or old evidence.

A1 is GET-only, so a failed evidence run requires no production rollback. Preserve the failed run/artifact as RCA evidence.

---

## 7. Remaining E1a Sequence

Required order:

1. **A1** — fresh Production Identity Evidence on exact current main;
2. **A2** — evidence-backed production D1 identity pinning; produce immutable runtime SHA `R`;
3. **A3** — exact-runtime Production Identity Evidence on `R` after Pages propagation;
4. **A4** — controlled activation evidence + latest-main authority explicitly authorizing `R`; produce authority SHA `A`;
5. **A5** — canonical `Deploy Worker` with `source_sha = R`;
6. **A6** — generic deployment verification + read-only 404-vs-403 E1a-A capability proof + legacy user path usability;
7. **A7** — recovery/handoff closeout;
8. only then **E1a-B** email-free privacy cutover.

Two-SHA contract:

- `R` = immutable runtime source with verified runtime prerequisites;
- `A` = later protected-main control-plane authority explicitly authorizing `R`;
- `A` may be newer than `R`.

---

## 8. Locked Later Findings

### E1a-B

Durable job benchmark must be authoritative, or dispatch benchmark must equality-check fail closed. No silent durable-job/dispatch benchmark divergence.

### E1b

Do not overwrite an immutable historical EOD row with a realtime quote without date equivalence. Planned direction: immutable EOD history + separate explicit realtime valuation/provenance.

### E1c

Do not solve active-job lifecycle correctness by merely increasing a fixed TTL. Planned direction: queued/running lifecycle semantics remain active independently of age, with explicit terminal/recovery behavior.

### E1d

Separate cursor-signing secret from system API authentication secret/rotation boundary.

---

## 9. Next Exact Action

Before any production action, re-read current protected-main SHA and confirm its Pages deployment has propagated successfully.

Then manually dispatch:

> **Actions → Production Identity Evidence → Run workflow**

with:

`source_sha = <that exact protected-main SHA>`

Approve the `production` Environment reviewer gate when prompted.

Do **not** run `Deploy Worker` yet.
