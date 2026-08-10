# V5 D3D Handoff — Historical Closeout, Activation Dependency Reopened by Gate E

Status: **HISTORICAL D3D HANDOFF / CURRENT ACTIVATION RATIONALE — NOT THE PRIMARY GATE-E EXECUTION HANDOFF**  
Original closeout: `2026-08-07T17:55:00+08:00`  
Gate-E reclassification: **2026-08-10**  
Original D3D closeout baseline: `main@0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`  
Observed Gate-E E1a-A baseline at reclassification: `main@c312408fec7a27a7b713ad5da79bf93bce62481f`  
Runtime contract: Worker `4.07` / API `2.60` / D1 Schema `2`

---

## Read this first

This file originally closed/paused the long D3D production-governance stream so routine product work would not be trapped in endless governance expansion.

That decision remains valid.

However, Gate E / E1a-A now requires a **real production Worker activation**. The explicit historical D3D reopen condition has therefore been met for one narrow purpose: complete the production identity + activation authority prerequisites required to deploy E1a-A safely.

Current execution authorities are now:

1. `to_do_update_list.md` — current program/batch state;
2. `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` — current E1a production-activation sequencing;
3. `docs/DEPLOYMENT.md` — current deployment runbook.

This file remains the historical rationale for why production activation is fail closed and what D3D intentionally deferred.

Do **not** restart the entire D3D audit or treat every old open item as NOW work.

---

## 1. What D3D achieved

D3D-A established fail-closed production deployment governance:

- explicit environment-aware production Worker configuration;
- exact source/service/release/API/schema deployment identity checks;
- production-contract checks inside protected CI;
- machine-enforced Recovery Evidence Gate for any future Schema 3+ migration;
- production D1 identity must be independently verified rather than guessed;
- production activation authority is separate from runtime source;
- reviewer gate occurs only after non-secret machine preflight;
- protected-main authority is re-read near mutation boundaries to reduce TOCTOU risk;
- recovery branches, acceptance records, machine evidence and CI history are preserved.

D3D-B1 added the canonical GET-only production identity evidence collector through PR `#129`, merged to protected `main` at:

`0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`

PR #129 final head:

`d4d83a1ff0dfd30dabbaa989b13b084f695be244`

Repository verification at that time:

- CI `31165097984` / CI #315: PASS;
- Production Identity Evidence PR run `31165100768` / run #9: PASS;
- protected merge; no production runtime/data/schema mutation;
- post-merge main CI `31165272521` / CI #316: PASS;
- post-merge Pages `31165270021` / Pages #1419: PASS.

Important distinction:

> Those PR/unit runs proved the collector implementation. They did **not** collect the live production activation artifact, because the workflow was intentionally not dispatched under `workflow_dispatch` at D3D closeout.

---

## 2. Why D3D was closed with production activation still blocked

The D3D stream had already delivered the important fail-closed controls. Continuing to create overlapping verifier/evidence mechanisms without a real deployment need would have produced low marginal product value and more maintenance ambiguity.

The closeout therefore deliberately chose:

- routine product/data correctness work returns to priority;
- production activation remains blocked;
- production identity evidence is collected only when a real activation is being prepared;
- old evidence remains historical context, never perpetual authority.

This was a convergence decision, not an incomplete accidental rollout.

---

## 3. 2026-08-10 reopen condition: Gate E / E1a-A

Gate E / E1a-A introduced a backward-compatible system-only opaque calculation-job owner lookup as the first half of a zero-downtime privacy cutover.

Repository stage:

- PR #173 merged;
- merge `c312408fec7a27a7b713ad5da79bf93bce62481f`;
- final-head CI #559 PASS;
- post-main CI #560 PASS;
- recovery `backup-post-gate-e-e1a-a-c312408` exists;
- production Worker has not been activated through the canonical deployment workflow.

The current Gate-E handoff originally simplified the next action to a Worker deployment. Revalidation found two D3D gates are intentionally still closed:

### Runtime source gate

`config/deployment-environments.json` still has:

- production D1 identity `unverified`;
- production database name `null`;
- production database UUID fingerprint `null`.

`verify_production_runtime_preconditions.mjs` therefore rejects the current source as deployable production runtime.

### Protected-main activation authority gate

`config/production-activation-authority.json` still has:

- `status = blocked`;
- no authorized runtime SHA;
- all required production checks pending.

`verify_production_activation_authority.mjs` therefore rejects production activation.

This is exactly what D3D intended until a real activation need existed.

Classification for Gate E:

> **Level 3 High Impact / NOW dependency, narrowly scoped to E1a-A activation.**

It does not reopen unrelated D3D backlog.

---

## 4. Current canonical continuation

Do not execute activation from this historical file alone.

Use:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

The converged sequence is:

1. current-document/state re-baseline;
2. fresh GET-only Production Identity Evidence;
3. evidence-backed runtime D1 identity pinning -> immutable runtime SHA `R`;
4. exact-runtime evidence re-audit on `R`;
5. controlled production activation evidence + latest-main authority explicitly authorizing `R` -> authority main SHA `A`;
6. `Deploy Worker` with `source_sha = R`;
7. generic deployment verification + E1a-A compatibility-specific read-only proof;
8. E1a-A closeout;
9. only then E1a-B email-free privacy cutover.

The two-SHA model is intentional:

- `R` = deployable runtime source;
- `A` = later protected-main control-plane commit authorizing `R`.

Do not simplify this into “deploy latest main”.

---

## 5. Production state remains safe, not complete

As of the Gate-E reclassification:

- existing production Worker continues serving its current version;
- there is no evidence of a Gate-E-caused production outage;
- normal public calculation dispatch still includes tenant email until E1a-B;
- canonical Deploy Worker run count for E1a-A remains zero;
- live Production Identity Evidence `workflow_dispatch` run count remains zero;
- production activation remains intentionally fail closed.

Do **not** infer that GitHub release `4.07.4` is Worker runtime `4.07.4`.

`4.07.4` is a governance/evidence checkpoint at:

`3024dde0ea148a3997782614da5ca8100462d010`

Worker runtime contract remains `4.07` / API `2.60` / Schema `2` until the manifest/runtime is intentionally changed.

---

## 6. Duplicate path remains archived

PR `#130` duplicated the already-merged PR #129 approach and remains intentionally closed **without merge**:

`[SUPERSEDED — DO NOT MERGE] PR-10D3D-B duplicate production predeploy evidence path`

Preserved duplicate branch/head:

- branch `pr-10d3d-b-production-readonly-evidence`;
- head `9f5ca31e496a6af1a4d601a5e6ebc64a41992438`.

Do not reopen/merge it unless a future explicit architecture decision supersedes the canonical #129 evidence mechanism.

---

## 7. Historical deferred items — current classification

| Item | Historical state | Gate-E classification now |
|---|---|---|
| Production identity evidence dispatch | Deferred until real activation | **NOW for E1a-A activation only** |
| N58 — explicit production Pages environment / legacy fallback | Open/fail-closed | **NOW only to the extent required by activation evidence; no broad frontend redesign** |
| N61 — live production CSP proof | Collector available | **NOW as A1/A3 evidence** |
| N64 — production D1 identity pinning | Open/fail-closed | **NOW for A1/A2** |
| N62 — staging-audience OAuth rejection | Open | BACKLOG / separate evidence unless a current activation verifier explicitly requires it |
| N69 — dedicated least-privilege Cloudflare audit credential | Hardening backlog | BACKLOG |
| N59/N60 — GitHub review/admin-bypass hardening | Governance backlog | BACKLOG |
| RISK-032 — finite artifact retention | Backlog | BACKLOG |
| Recovery Evidence Gate / Schema 3 | BLOCKED | remains BLOCKED / conditional E2 only |

The reopen is intentionally narrow: only evidence and control-plane work necessary to activate the current E1a-A runtime enters NOW.

---

## 8. GitHub governance state noted during Gate-E revalidation

Current repository ruleset evidence shows protected default-branch policy with:

- merge PR required;
- merge commits as the allowed merge method;
- strict required status checks;
- required checks: Python tests, Worker security and deployment tests, Frontend contracts and build;
- no ruleset bypass actor.

Current `production` Environment still has a required reviewer but also retains looser self-review/admin-break-glass characteristics from the earlier single-maintainer governance model.

Those environment-hardening items are not allowed to silently expand the current activation batch unless policy/evidence shows they block safe execution.

---

## 9. Historical recovery and evidence references

Preserve:

- `backup-pre-10d3d-74fe120`;
- `backup-post-10d3d-4dda2da`;
- `backup-d3d-a-closed-3024dde`;
- D3D-B-specific recovery refs recorded in PR #129 evidence;
- `backup-pre-d3d-closeout-0c3d716`;
- GitHub governance checkpoint `4.07.4` at `3024dde0ea148a3997782614da5ca8100462d010`;
- canonical D3D-B1 PR #129 merge `0c3d7162de96b569abbd7c679e09dc29bb9fd2fe`;
- superseded PR #130 branch/history;
- Gate-E E1a-A recovery `backup-post-gate-e-e1a-a-c312408`.

Historical detailed sources:

- `docs/governance/PR_10D3D_PRODUCTION_ACTIVATION_GATE_ACCEPTANCE.md`;
- `docs/governance/PR_10D3D_B_PRODUCTION_IDENTITY_EVIDENCE_ACCEPTANCE.md`;
- `docs/governance/evidence/V5_EXECUTION_HISTORY_ENTRY_011_PR_10D3D_B1.md`;
- `docs/governance/evidence/PR_10D3D_B1_PREAUDIT_2026-08-07.json`;
- `docs/governance/evidence/PR_10D3D_B1_FAILURE_HISTORY_2026-08-07.json`;
- `docs/governance/evidence/PR_10D3D_CLOSEOUT_2026-08-07.json`;
- `docs/governance/evidence/V5_EXECUTION_HISTORY_ENTRY_012_D3D_PHASE_CLOSEOUT.md`;
- GitHub PR/release/workflow history.

Append-only evidence files must remain historical and must not be rewritten merely to reflect current state.

---

## 10. Instructions to future AI / maintainers

1. Start with `AI_PROJECT_PLAYBOOK.md`, `README.md`, then `to_do_update_list.md`.
2. Treat this file as historical D3D rationale, not the current active-batch tracker.
3. When Gate E requires production activation, follow `GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` and current workflows/contracts.
4. Do not bypass fail-closed activation because the application currently works or because a runtime PR already merged.
5. Do not infer production D1 identity from staging, secret names or old evidence.
6. Do not reuse old production evidence as perpetual authority; collect fresh evidence for the exact source being activated.
7. Do not reopen PR #130 or merge PR #172 directly.
8. Keep Schema 3 blocked until its separate Recovery Evidence Gate and E2-pre conditions are met.
9. Preserve failed production evidence/deployment runs as RCA evidence rather than rerunning them away.
10. Once E1a-A is deployed/verified and E1a-B closes privacy targeting, return to the Gate-E sequence instead of continuing D3D governance indefinitely.