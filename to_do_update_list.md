# TO-DO / UPDATE LIST — Current Execution Handoff

> **FIRST-READ CURRENT STATE.** Read `AI_PROJECT_PLAYBOOK.md`, `README.md`, this file, then re-check GitHub remote truth before acting. Historical detail belongs in dedicated evidence/PR/Git history; this file remains current-state-first.

Last updated: **2026-08-10**

---

## 1. Current Remote Baseline

Repository: `chihung1024/sheet-trading-journal`

Protected `main` at start of the current hygiene batch:

`ca7c8649664b12c9bd4dda530c3b072354767ce8`

That SHA is PR #175's merge and has:

- CI #566 / run `31360140807`: PASS;
- Pages deployment on the same SHA: PASS.

Runtime contract remains:

- Worker `4.07`;
- API `2.60`;
- D1 Schema `2`.

Important distinction:

> repository/main state is not production Worker deployment state.

Canonical `Deploy Worker` still has no runs. E1a-A compatibility is therefore **not yet production-activated through the canonical workflow**.

---

## 2. Current Phase / Batch

### Gate E

- E0 architecture re-baseline: `CLOSED`.
- E1a privacy remediation: `ACTIVE`.
- E1a-A compatibility code: `MERGED`, production activation still pending.
- E1a-B email-free cutover: `BLOCKED` until E1a-A production activation/verification closes.
- E1b/E1c/E1d: `PLANNED`.
- Schema 3 / E2: `DEFERRED` until E1 + E2-pre conditions.

### Primary Active Batch

**Repository Governance / Docs / Actions Hygiene — R2**

Objective:

1. restore the complete V3 governance constitution after PR #175 accidentally replaced it with only the Final Patch;
2. make current-facing docs agree with remote/machine truth;
3. remove only proven obsolete/no-value root documents;
4. keep historical audit/evidence that still has forensic or contract value;
5. verify the repository's actual Actions inventory is minimal and machine-enforced;
6. close/supersede duplicate documentation PR #174 after equivalent current content is present;
7. return immediately to Gate E / E1a-A1.

Working branch:

`chore-repo-docs-actions-hygiene`

Pre-batch recovery:

`backup-pre-docs-actions-hygiene-ca7c864`

---

## 3. Root Cause — PR #175 Governance Replacement Incident

### Symptom

`AI_PROJECT_PLAYBOOK.md` on protected main contained only the V3 Final Hardening patch instead of the complete V3 constitution.

### Failure point

PR #175 replaced the whole file rather than integrating the Final Patch into the complete V3 document.

### Evidence

PR #175 changed only `AI_PROJECT_PLAYBOOK.md` but with approximately `+160 / -2563`, reducing the file to a small amendment-only document.

### Root cause

A long governance document was edited as a complete-file replacement without a structural completeness regression guard.

### Impact

- production runtime/data were not changed;
- CI remained green because existing tests did not validate governance-document completeness;
- future AI sessions could lose core governance rules and make incorrect review/risk decisions.

### Corrective action

- restore complete V3 + all approved Final Hardening rules;
- add `tests/test_repository_governance.py` to assert durable V3 semantic anchors and minimum completeness;
- use exact diff/structural review for future long-file governance changes.

---

## 4. Current Hygiene Decisions

### NOW

- restore complete `AI_PROJECT_PLAYBOOK.md` V3.0 governance baseline;
- add governance completeness regression test;
- add `docs/README.md` source-of-truth map;
- make `docs/DEPLOYMENT.md` current and fail closed;
- add `docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md` as E1a operational authority;
- reclassify `docs/governance/V5_CURRENT_HANDOFF.md` as historical D3D closeout, not current handoff;
- correct stale B1 acceptance status without inventing live production evidence;
- remove root `AUDIT_TRADING_CALC_REVIEW.md` and `TRADING_CALC_OPTIMIZATION_PLAN.md` because later Gate-C/Gate-D/Post-D records supersede them and no current repository reference depends on them;
- keep current workflow files unchanged.

### KEEP

- `DEPLOYMENT_FINAL.md`: explicit tombstone warning against obsolete manual Worker deployment; retained because its warning and historical references still prevent misuse.
- `docs/audits/**`: independent audit archive.
- `docs/governance/evidence/**`: machine/append-only evidence.
- Gate-C/Gate-D engineering audits/closeouts: still explain financial-integrity/reproducibility contracts.
- historical acceptance documents with unique traceability.
- `cloudflare worker/`: legacy source archive explicitly distinguished from the canonical deployment source by manifest/tests.

### REJECT

- deleting audit/evidence merely to reduce file count;
- recreating deleted one-off Actions workflows to make the Actions UI look cleaner;
- deleting any of the current seven tracked workflows;
- unrelated runtime/financial/frontend refactors inside this hygiene batch.

---

## 5. GitHub Actions Hygiene

Current repository workflow inventory is already intentionally minimal and fail-closed.

Tracked workflows:

1. `.github/workflows/ci.yml`
2. `.github/workflows/deploy-worker-staging.yml`
3. `.github/workflows/deploy-worker.yml`
4. `.github/workflows/production-contract-audit.yml`
5. `.github/workflows/production-identity-evidence.yml`
6. `.github/workflows/staging-browser-smoke.yml`
7. `.github/workflows/update.yml`

`docs/governance/github-actions-pins.json` enumerates exactly these workflows and `tests/test_workflow_supply_chain.py` fails if tracked inventory drifts or action pins/permissions weaken.

GitHub Actions API still exposes historical workflow registrations for many deleted one-off PR/release workflows. Their source files are absent from current `main`, so they are not current repository workflows. The available GitHub connector does not expose a disable/delete-workflow mutation; do not pretend those UI registrations were removed.

---

## 6. E1a-A Repository Evidence

Compatibility-first PR:

`#173 — Gate E E1a-A: pre-cutover Worker opaque-target compatibility`

Evidence:

- final head `ca3fa1f86d21fe660226588063ada98d749d01b6`;
- final-head CI #559: PASS;
- exact merge `c312408fec7a27a7b713ad5da79bf93bce62481f`;
- post-main CI #560: PASS;
- recovery `backup-post-gate-e-e1a-a-c312408`;
- temporary system-only opaque-job compatibility exists in `worker-entry.js`;
- old normal email-bearing dispatch/workflow remains intentionally unchanged until E1a-B.

Production state:

- canonical Worker deployment for E1a-A: `NOT DEPLOYED / NOT VERIFIED`;
- production D1 identity: `unverified`;
- activation authority: `blocked`;
- therefore direct Worker deploy remains prohibited.

---

## 7. E1a Production Activation Sequence

Operational authority:

`docs/engineering/GATE_E_E1A_PRODUCTION_ACTIVATION_PLAN.md`

Required order:

1. **A0** — current repository docs/governance/actions stabilization;
2. **A1** — fresh reviewer-protected GET-only Production Identity Evidence on exact current protected-main HEAD;
3. **A2** — evidence-backed production D1 identity pinning; produce runtime SHA `R`;
4. **A3** — exact-runtime evidence rerun on `R` after Pages propagation;
5. **A4** — controlled activation evidence + latest-main authority explicitly authorizing `R`; produce authority SHA `A`;
6. **A5** — canonical `Deploy Worker` with `source_sha = R`;
7. **A6** — generic deployment evidence + read-only E1a-A 404-vs-403 compatibility proof + legacy path usability;
8. **A7** — closeout/recovery/handoff;
9. only then **E1a-B** email-free privacy cutover.

Two-SHA model:

- `R` = immutable runtime source;
- `A` = later protected-main control-plane authority authorizing `R`;
- `A` may be newer than `R`.

---

## 8. Locked Technical Findings for Later Batches

### E1a-B

Durable calculation-job benchmark must be authoritative, or dispatch benchmark must equality-check fail closed. Do not allow durable job metadata and dispatch inputs to silently disagree.

### E1b

Current market-data logic can overwrite the last historical EOD row with a realtime quote without proving the quote date equals that row. Planned fix remains immutable EOD history plus explicit separate realtime valuation/provenance.

### E1c

Current server idempotency/frontend pending semantics use a fixed age window while supported workflow duration/queueing can exceed it. Planned fix is lifecycle-based queued/running active semantics, not merely increasing a TTL.

### E1d

Record cursor signing currently shares `API_SECRET` with system API authentication. Later batch should split the secret/rotation boundary.

---

## 9. Current Governance

`AI_PROJECT_PLAYBOOK.md` V3.0 is the intended locked governance baseline after this batch.

Key active rules:

- risk-proportional R0/R1/R2/R3 governance;
- docs risk follows the decision/behavior the document controls;
- R2 requires exact-head CI, recovery, independent review, and handoff;
- independent review means fresh evidence + competent independent reasoning, not a different GitHub identity;
- same-AI review requires role separation, fresh evidence reconstruction, adversarial pass, and exact-head discipline;
- governance is frozen unless a documented reopen condition with evidence exists.

This hygiene batch is R2 because it changes governance/current operational authority even though it does not change production runtime.

---

## 10. Verification Plan for Current Batch

Before merge:

- compare exact final branch to the current protected-main base;
- confirm no runtime/config/workflow/schema files changed;
- confirm only intended docs/test deletions/additions/updates;
- run required CI on exact PR head;
- verify governance completeness test passes;
- verify existing workflow-supply-chain inventory test passes;
- perform explicit Same-AI Independent Review Mode from fresh primary evidence unless another competent reviewer is available;
- findings only: `BLOCKER / FOLLOW-UP / BACKLOG / REJECT`;
- material review fix => new exact head + re-validation/re-review;
- exact-head merge only after `BLOCKER = 0`.

After merge:

- verify post-main CI;
- create post-hygiene recovery;
- ensure current handoff remains accurate;
- begin A1.

No production smoke is applicable to this docs/governance hygiene batch.

---

## 11. Next Exact Action

After the current hygiene batch is `CLOSED`:

> Manually dispatch **Production Identity Evidence** with `source_sha = <exact then-current protected-main HEAD>`.

This is A1 and is GET-only/reviewer-protected.

Do **not** dispatch `Deploy Worker` before A2/A3/A4 complete.
