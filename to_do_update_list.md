# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before acting. Historical detail belongs in dedicated evidence/closeout records and Git history. Remote truth overrides stale prose.

Last updated: **2026-08-11**

---

## 1. Current Stable Runtime / Repository State

Repository: `chihung1024/sheet-trading-journal`

Protected-main baseline immediately before this E1a-B closeout batch:

`f6cf1769955dc18a093733a2e29b129b2443ddf0`

Current production Worker runtime remains intentionally pinned to the E1a-B runtime source:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Production activation authority used for E1a-B deployment:

`A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`

Important:

> Protected-main HEAD and deployed Worker runtime SHA are intentionally allowed to differ. Do not redeploy merely because `main` is newer than `R_B`.

Runtime contract remains Worker `4.07` / API `2.60` / D1 Schema `2` unless a later explicit runtime change says otherwise.

---

## 2. Current Phase

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a-A compatibility activation: `CLOSED / PRODUCTION VERIFIED`.
- E1a-B email-free privacy cutover: **`CLOSED / PRODUCTION VERIFIED`**.
- **E1b market-data historical/realtime separation: `ACTIVE / NEXT IMPLEMENTATION BATCH`.**
- E1c active-job lifecycle/idempotency: `PLANNED`.
- E1d cursor-signing secret separation: `PLANNED`.
- Schema 3 / E2: `DEFERRED` until E1 + E2-pre conditions.

E1a closeout authority:

`docs/engineering/GATE_E_E1A_B_CLOSEOUT_2026-08-10.md`

Final sanitized privacy-smoke evidence:

`docs/governance/evidence/GATE_E_E1A_B_FINAL_PRIVACY_SMOKE_2026-08-10.json`

---

## 3. Governance Baseline

`AI_PROJECT_PLAYBOOK.md` V3.0 remains the locked governance constitution.

```text
GOVERNANCE BASELINE LOCKED
Governance Architecture: FROZEN
```

Use risk-proportional governance. Do not reopen completed E1a activation/audit loops merely to restate already-proven production state. Reopen only for a new evidence-backed regression, production/runtime identity change affecting the contract, security/privacy incident, or explicit requirement change.

### Execution-convergence rule

For completed batches:

1. reuse valid fresh evidence when it already proves the required condition;
2. do not request a new manual GitHub Action solely because the previous conversational checkpoint was missed;
3. distinguish implementation verification from documentation closeout;
4. once a gate is closed, advance to the next planned batch instead of recursively re-auditing the prior gate.

---

## 4. E1a Production Evidence Summary

### E1a-A

E1a-A established the temporary compatibility capability and safely activated it through the production identity/authority/deployment chain.

Key production evidence:

- Production Identity Evidence #11 / `31364597982`: PASS;
- production D1 identity pinned;
- runtime `R = 2d1fc1cd7190651c64b764c58f58d67826d408e8`;
- Production Identity Evidence #12 / `31366644577`: PASS against exact `R`;
- activation authority `A = 0d4896d3161eebfea3dd9bec16b57b6e061cbf04`;
- Deploy Worker #1 / `31368153511`: deploy succeeded; final verifier race later root-caused/fixed;
- Production Contract Audit #40 / `31386148724`: PASS;
- authenticated legacy-path smoke #3222 / `31386988867`: PASS;
- PR #185 closed E1a-A.

### E1a-B implementation

PR #186 removed tenant email from the normal GitHub calculation dispatch and made durable opaque-job owner + benchmark context authoritative/fail-closed.

Merged runtime:

`R_B = 0e2ea514bfa1f0640f620db35490d2a1f728ec7e`

Production activation chain:

- Production Identity Evidence #13 / `31413549090`: PASS against exact `R_B`;
- PR #187 authorized exact `R_B`;
- authority `A_B = fddbf65b18ae11b8b166c1f82346bc44431d057a`;
- Deploy Worker #2 / `31415404201`: **SUCCESS**;
- Production Contract Audit #41 / `31415865919`: **SUCCESS** against exact `R_B`, including trusted-system opaque-job `404 NOT_FOUND` proof with no tenant identity.

Initial post-deploy smoke #3226 / `31416468298` was functionally successful but exposed masked tenant email material in application logs. That was correctly treated as a privacy blocker.

PR #188 fixed the verified opaque-job logging boundary without changing Worker runtime/authorization/financial behavior. Final merge:

`f6cf1769955dc18a093733a2e29b129b2443ddf0`

Post-main:

- CI #604: PASS;
- Pages #1474 / `31417821783`: SUCCESS;
- recovery `backup-post-e1a-b-log-privacy-f6cf176`.

Final post-hotfix normal production smoke already existed:

- Update Portfolio Data #3228 / `31433418502`;
- exact source `f6cf1769955dc18a093733a2e29b129b2443ddf0`;
- normal opaque calculation-job path;
- no tenant email dispatch input;
- application tenant label only `opaque-job-user`;
- running -> durable context -> calculation/upload -> reconciliation -> snapshot upload -> succeeded callback;
- conclusion: **SUCCESS**.

Therefore no additional manual smoke is required for E1a-B closeout.

---

## 5. Current Primary Batch — E1b

### Problem

Current market-data handling can overwrite the latest historical EOD `Close` / adjusted close observation with a realtime quote without proving that the realtime quote belongs to the same trading date.

This risks mixing two different semantic data products:

- immutable historical EOD series;
- current/realtime valuation.

### Locked direction

Implement the narrow correction:

1. keep historical EOD observations immutable;
2. store/use realtime/current valuation separately;
3. carry explicit source/provenance/as-of semantics;
4. only substitute/merge values when date equivalence is explicitly proven;
5. preserve existing financial behavior where semantics are already correct;
6. do not expand into broad provider abstraction, cash ledger, Decimal migration, tenant UUID migration, derivatives, or Schema 3.

### Required E1b execution order

```text
remote-truth re-baseline
-> map current market-data mutation path and consumers
-> root-cause/specify historical-vs-realtime contract
-> narrow implementation + regression tests
-> risk-proportional exact-head CI/review
-> expected-head merge
-> post-main verification
-> update this handoff
-> E1c ACTIVE
```

No production Worker deployment should be added merely because E1b code merges. Deployment need must be determined from the actual changed runtime boundary.

---

## 6. Later Locked Findings

### E1c

Do not solve active-job correctness by merely increasing a fixed TTL. Queued/running lifecycle must remain active independently of age, with explicit terminal/recovery semantics.

### E1d

Separate cursor-signing secret from system API authentication secret/rotation boundary.

### Schema 3 / E2

Remain deferred. Do not reopen broad ledger/provider/tenant migration work until E1 completes and E2-pre supplies evidence.

---

## 7. Recovery / Evidence References

Preserve at minimum:

- `backup-post-gate-e-e1a-a-c312408`;
- `backup-post-gate-e-a2-2d1fc1c`;
- `backup-post-gate-e-a4-0d4896d`;
- `backup-post-a5-verification-hotfix-4ee0184`;
- `backup-post-a6-compatibility-proof-210e004`;
- E1a-A closeout/recovery refs from PR #185;
- `backup-pre-e1a-b-34a6145`;
- E1a-B runtime/authority evidence from PR #186/#187;
- Deploy Worker #2 / `31415404201`;
- Production Contract Audit #41 / `31415865919`;
- privacy-blocking smoke #3226 / `31416468298`;
- `backup-pre-e1a-b-log-privacy-hotfix-fddbf65`;
- `backup-post-e1a-b-log-privacy-f6cf176`;
- final privacy smoke #3228 / `31433418502`;
- `backup-pre-e1a-b-closeout-f6cf176`.

Failed runs remain forensic evidence; do not erase or reframe them as if they never occurred.

---

## 8. Next Exact Action

**Do not run another E1a smoke/audit/deploy.**

Start E1b from current protected-main remote truth after this closeout batch merges and post-main verifies.

First E1b task:

> map exactly where realtime quotes can overwrite historical EOD `Close` / adjusted values, identify all downstream consumers, and define the smallest provenance-preserving contract before implementation.
