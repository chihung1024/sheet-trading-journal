# 2026-08-07 Production Activation Deep Audit Supplement — N63

Status: **APPEND-ONLY / REMEDIATION IN PROGRESS**  
Parent audit: `docs/audits/2026-08-07-production-activation-deep-audit.md`  
Baseline: `main@74fe12010ee3138e07a079a3d45271fddb80b536`

## N63 — CRITICAL — Recovery Evidence Gate accepted unverified evidence references

### Discovery context

N63 was found during the independent second-pass diff/security review of PR-10D3D-A **after** CI run `31161039300` had reached success on head `8af258f64157985c0cee45fe055d2790c61364c7`.

That successful run is retained as valid evidence for the code it tested, but it is not sufficient for merge because the review found a deeper invariant gap. The branch was therefore changed again and must receive a new full CI result before merge.

### Root cause

The first machine implementation of Recovery Evidence Gate correctly blocked Schema 3+ while the gate status was `blocked`, but the `passed` path only required six evidence map values to be non-empty strings.

A future change could therefore populate all six keys with nonexistent, uncontrolled, or misleading paths and set the gate to `passed`. The structural CI gate would then treat the references as evidence even though no recovery proof had actually been archived.

This is a control-plane authenticity failure, not a documentation problem. It would weaken the central invariant that Schema 3 cannot begin before a real recovery drill is proven.

### Authoritative remediation

PR-10D3D-A now requires the Schema-3+ gate to verify all of the following before it can pass:

1. `baseline_sha` is an exact 40-character commit SHA;
2. `evidence_root` is the controlled repository path `docs/governance/evidence/recovery`;
3. every required evidence reference stays under that root, has a `.json` suffix, and contains no path traversal;
4. every referenced evidence JSON actually exists and parses;
5. `evidence_type` exactly matches the required evidence key;
6. evidence `status` is `passed`;
7. evidence `executed_at` is valid and is not later than gate `passed_at`;
8. every evidence document uses the same exact `baseline_sha` as the gate;
9. every proof has a non-empty verification method;
10. `proof.result` is exactly `pass`;
11. every proof carries an artifact reference;
12. every proof carries a 64-character SHA-256 digest for that artifact;
13. every proof carries a non-empty summary.

The verifier reads the referenced files from the repository during required CI and deployment execution. Merely filling strings in the gate JSON is no longer sufficient.

### Deliberate limitation

Machine validation can prove that structured proof records exist, are internally consistent, and are cryptographically traceable to archived artifacts. It cannot by itself prove that a restore drill was operationally honest. Protected review and the eventual Recovery Evidence Gate closeout remain required human/governance layers.

The current repository remains Schema 2 with the gate status `blocked`; no recovery evidence is fabricated simply to make the future path green.

### Runtime impact

None.

- no production deployment;
- no staging deployment;
- no D1 migration;
- no record mutation;
- no financial calculation change;
- Schema 2 remains allowed by the gate.

### Status

**IMPLEMENTED ON WORK BRANCH / NEW CI REQUIRED / NOT CLOSED YET**
