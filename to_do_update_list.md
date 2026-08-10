# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before acting. Historical detail belongs in dedicated evidence/PR/Git history; this file remains current-state-first.

Last updated: **2026-08-10**

---

## 1. Current Stable Runtime / Repository State

Repository: `chihung1024/sheet-trading-journal`

Current protected-main baseline immediately before the A7 closeout PR:

`210e004528b725ed7847ed17fd1aad4a7390df0d`

Production runtime remains intentionally pinned to:

`R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`

Activation authority used for that deployment:

`A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`

Runtime contract:

- Worker `4.07`;
- API `2.60`;
- D1 Schema `2`;
- deployed Worker version `245eb37c-0d52-4344-9cc3-f82866434f28`.

Important:

> Protected-main HEAD and deployed Worker runtime SHA are intentionally allowed to differ. Do not redeploy merely because `main` is newer than `R`.

---

## 2. Current Phase

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a privacy remediation: `ACTIVE`.
- E1a-A0 repository/docs/actions stabilization: `CLOSED / POST-MAIN VERIFIED`.
- E1a-A1 Production Identity Evidence: `CLOSED / PASS`.
- E1a-A2 production D1 identity pinning: `CLOSED / PASS`.
- E1a-A3 exact-runtime evidence: `CLOSED / PASS`.
- E1a-A4 activation evidence/authority: `CLOSED / PASS`.
- E1a-A5 canonical Worker activation: `DEPLOYED`; original run ended failure only because of a post-deploy stabilization race later root-caused/fixed.
- E1a-A6 generic production contract + compatibility-specific proof: `CLOSED / PASS`.
- **E1a-A7 closeout: FINALIZATION / PR #185.**
- **E1a-B email-free privacy cutover: NEXT ACTIVE BATCH after A7 closeout merges/post-main verifies.**
- E1b/E1c/E1d: `PLANNED`.
- Schema 3 / E2: `DEFERRED` until E1 + E2-pre conditions.

If this file is read from protected `main` after PR #185 merges successfully, treat:

- E1a-A: `CLOSED / PRODUCTION VERIFIED`;
- E1a-B: `ACTIVE`.

Remote truth overrides this transition note if PR #185 did not merge cleanly.

Operational authority:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

Canonical deployment runbook:

`docs/DEPLOYMENT.md`

A7 closeout record:

`docs/engineering/GATE_E_E1A_A7_CLOSEOUT_2026-08-10.md`

---

## 3. Governance Baseline

`AI_PROJECT_PLAYBOOK.md` V3.0 remains the complete locked governance constitution.

```text
GOVERNANCE BASELINE LOCKED
Governance Architecture: FROZEN
```

Do not reopen governance architecture without a documented V3 Reopen Condition plus actual evidence.

Risk remains consequence-based rather than extension/diff-size-based. Operational source-of-truth documents that control production/merge decisions are not automatically R0 merely because they are Markdown.

---

## 4. E1a-A Activation Evidence Summary

### A1

- Production Identity Evidence run #10 / `31362511755`: FAIL; exposed production Pages env/API mismatch and failed-artifact-retention defect.
- PR #178 fixed failed evidence retention.
- Production Identity Evidence run #11 / `31364597982`: **SUCCESS**.

### A2

- PR #181 pinned reviewed production D1 identity.
- merge/runtime `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`.

### A3

- Production Identity Evidence run #12 / `31366644577` against exact `R`: **SUCCESS**.

### A4

- PR #182 created reviewed production activation authority.
- authority SHA `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04` explicitly authorizes `R`.

### A5

Canonical Deploy Worker run #1 / `31368153511`:

- runtime requested: exact `R`;
- authority/D1/preflight/reviewer/migration/deploy: PASS;
- no pending D1 migrations;
- Worker deploy: SUCCESS;
- deployed Worker version: `245eb37c-0d52-4344-9cc3-f82866434f28`;
- final workflow conclusion: FAILURE because a post-deploy CORS request hit a stale old edge immediately after the first single readiness observation.

RCA:

`single new-edge hit != stable production-contract convergence`

PR #183 hardened deployment verification to require three consecutive full-contract passes, resetting on any failure. Runtime `R` was not rolled back or redeployed merely to repair evidence history.

### A6

PR #184 added reviewer-protected capability-specific proof.

Production Contract Audit run #40 / `31386148724`: **SUCCESS** against exact `R`.

Verified:

- source/service/release/API/schema identity;
- `/version` and `/health`;
- anonymous auth rejection;
- production CORS allowed;
- staging/localhost CORS rejected;
- system checks;
- trusted-system valid nonexistent opaque job => `404 NOT_FOUND`;
- no tenant identity in compatibility proof.

Durable evidence:

`docs/governance/evidence/GATE_E_E1A_A6_PRODUCTION_AUDIT_2026-08-10.json`

### A7 user-path smoke

Authenticated production user triggered the normal pre-E1a-B update path after A5.

Resulting `Update Portfolio Data` run #3222 / `31386988867`:

- created `2026-08-10T12:13:06Z`;
- source `210e004528b725ed7847ed17fd1aad4a7390df0d`;
- calculation-job `running` callback: PASS;
- calculation/upload: PASS;
- snapshot upload: PASS;
- transaction prefix integrity: PASS;
- canonical Daily PnL reconciliation: PASS;
- split-adjusted ledger parity: PASS;
- terminal calculation-job callback: `succeeded`;
- workflow conclusion: **SUCCESS**.

Durable sanitized evidence:

`docs/governance/evidence/GATE_E_E1A_A7_LEGACY_USER_SMOKE_2026-08-10.json`

No API key, tenant identifier, calculation job id, or raw transaction data is copied into that repository evidence.

---

## 5. Current Primary Batch — A7 Closeout Transition

PR #185 is the current transition batch.

Required before merge:

- current authority docs agree with A1–A7 remote truth;
- exact changed-file scope remains documentation/evidence only;
- exact-head CI PASS;
- final Risk Class remains R2;
- Same-AI Independent Review follows V3 role separation and fresh evidence reconstruction;
- BLOCKER = 0;
- expected-head merge only.

Required after merge:

- post-main CI PASS;
- Pages deployment PASS;
- create post-A7 recovery ref;
- re-read protected-main remote truth;
- then E1a-B becomes the single current implementation batch.

No production Worker deployment is required for A7 itself.

---

## 6. E1a-B — Email-Free Privacy Cutover

After A7 closes, create a fresh branch from then-current stable protected main. Do **not** merge superseded prototype PR #172.

Required contract:

- canonical Worker owns trusted-system opaque job lookup;
- normal calculation dispatch sends opaque calculation job id plus required non-tenant parameters, **never tenant email**;
- workflow/runner resolves tenant ownership through the trusted Worker boundary before unchanged financial calculation;
- temporary E1a-A compatibility shim is removed only when canonical Worker owns the route safely;
- audit-only targeting remains separately scoped;
- no schema migration.

Benchmark invariant:

> Durable calculation-job benchmark is authoritative, or any dispatch benchmark must exact-equality validate and fail closed on mismatch.

Privacy verification must prove the normal user-triggered end-to-end path contains no tenant email in dispatch inputs/log evidence while preserving functional behavior.

---

## 7. Locked Later Findings

### E1b

Do not overwrite immutable historical EOD data with a realtime quote without date equivalence. Direction remains immutable EOD history + explicit realtime valuation/provenance.

### E1c

Do not solve active-job lifecycle correctness by merely increasing a fixed TTL. Queued/running lifecycle must remain active independently of age with explicit terminal/recovery behavior.

### E1d

Separate cursor-signing secret from system API authentication secret/rotation boundary.

### Schema 3 / E2

Remains deferred. Do not reopen broad ledger/provider/tenant migration work until E1 completes and E2-pre supplies evidence.

---

## 8. Recovery / Evidence References

Preserve at minimum:

- `backup-post-gate-e-e1a-a-c312408`;
- `backup-post-gate-e-a2-2d1fc1c`;
- `backup-post-gate-e-a4-0d4896d`;
- `backup-post-a5-verification-hotfix-4ee0184`;
- `backup-post-a6-compatibility-proof-210e004`;
- `backup-pre-e1a-a7-closeout-210e004`;
- A1/A3 reviewer-protected workflow runs;
- A5 deployment run and failure log;
- A6 production audit artifact/run;
- A7 legacy-user smoke run/evidence;
- PR #183/#184/#185 review and CI history.

Failed runs are forensic evidence; do not erase/reframe them as if they never occurred.

---

## 9. Next Exact Action

Finish PR #185 under V3 R2 controls:

```text
final candidate
-> exact-head CI
-> Same-AI Independent Review
-> BLOCKER=0
-> expected-head merge
-> post-main CI + Pages
-> post-A7 recovery
-> re-read remote truth
-> start E1a-B from fresh protected main
```

Do **not** redeploy runtime `R` during this documentation/evidence closeout.
