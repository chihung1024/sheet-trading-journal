# 2026-08-07 Production Activation Deep Audit Supplement — N64–N65

Status: **APPEND-ONLY / REMEDIATION IN PROGRESS**  
Parent audit: `docs/audits/2026-08-07-production-activation-deep-audit.md`  
Baseline: `main@74fe12010ee3138e07a079a3d45271fddb80b536`

## N64 — CRITICAL — inferred production D1 name was being promoted to authority without external proof

### Discovery

During the second independent control-plane review, repository history was searched for `trading-journal-production`. Before PR-10D3D-A, that value existed only as a negative staging test fixture. No production activation/evidence record proved that it was the live Cloudflare D1 database name.

The first D3D-A implementation had temporarily promoted that inferred name into `config/deployment-environments.json`. Although the resulting renderer was fail-closed and could not mutate data when the protected secret disagreed, retaining the inferred value would still violate the rule that deployment identity must come from authoritative evidence rather than convention or test fixtures.

### Root-cause remediation

- production D1 identity is explicitly `unverified`;
- production database name and ID fingerprint remain `null` rather than guessed;
- staging's already-proven D1 name remains authoritative and production rendering rejects that staging name;
- once D3D-B obtains read-only authoritative Cloudflare D1 identity evidence, the production environment contract can transition to `verified` with the exact database name and SHA-256 fingerprint of its UUID;
- the renderer then enforces both the protected database name and protected database UUID fingerprint against that reviewed authority;
- a separate production activation authority remains `blocked` until the D1 identity evidence is archived.

### Status

**ROOT CAUSE REMEDIATED / EXTERNAL PRODUCTION D1 IDENTITY STILL PENDING D3D-B / PRODUCTION DEPLOY BLOCKED**

## N65 — HIGH — production Environment reviewer gate occurred before non-secret preflight

### Root cause

The canonical production deployment workflow originally attached `environment: production` to the only deployment job. GitHub Environment approval therefore occurred before any job steps ran. A malformed SHA, blocked Recovery Gate, incomplete production activation evidence, or other non-secret preflight failure could ask the maintainer to approve a deployment that was guaranteed to fail afterward.

This violated the execution rule that all machine-verifiable checks must finish before requesting the only unavoidable human gate.

### Root-cause remediation

The workflow is split into two jobs:

1. `preflight` — no production Environment and no production secrets. It validates exact SHA syntax, protected-main reachability, Recovery Evidence Gate, and Production Activation Authority.
2. `deploy` — `needs: preflight` and only then enters `environment: production`. After reviewer approval it repeats the critical source/authority checks before reading secrets or touching Cloudflare.

D3D-A deliberately ships `config/production-activation-authority.json` with status `blocked`. Its required pending checks are:

- `production_frontend_explicit_environment`;
- `production_frontend_live_contract`;
- `production_d1_identity`.

D3D-B must archive structured evidence for all three, bind an exact authorized source SHA, and change the authority to `ready`. Until then, an accidental production workflow dispatch fails before the reviewer gate and cannot run migration/deploy steps.

### Runtime impact

None. The current production Worker, D1, frontend, OAuth configuration, and user data are untouched.

### Status

**IMPLEMENTED ON WORK BRANCH / NEW CI REQUIRED / PRODUCTION ACTIVATION INTENTIONALLY BLOCKED**
