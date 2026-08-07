# 2026-08-07 Production Activation Deep Audit Supplement — N68

Status: **APPEND-ONLY / REMEDIATION IMPLEMENTED / FINAL CI PENDING**  
Parent audit: `docs/audits/2026-08-07-production-activation-deep-audit.md`

## N68 — CRITICAL — protected-main activation authority could authorize a runtime source whose own production D1 identity remained unverified

### Root cause

N64 correctly stopped the repository from inventing a production D1 name/UUID and N66 correctly separated protected-main activation authority from the immutable runtime source. That separation exposed a second invariant: a later protected-main control-plane record could theoretically become `ready` and authorize an older runtime SHA whose own `config/deployment-environments.json` still declared production D1 identity as `unverified`.

The deployment renderer can safely render an unverified non-staging D1 value for local/dry-run validation, so control-plane authorization alone was not enough to prove that the runtime source itself had locked the externally verified production D1 identity into its deployment contract.

### Root-cause remediation

`tools/verify_production_runtime_preconditions.mjs` now makes deployable runtime eligibility a distinct invariant. Before production can reach the reviewer gate, the exact requested runtime source must itself contain:

1. `production.d1_identity_status = "verified"`;
2. an explicit reviewed production D1 database name;
3. a 64-character SHA-256 fingerprint of the reviewed production D1 UUID;
4. a staging D1 authority that remains valid and uses a different database name.

The production workflow runs this validator:

- during non-secret preflight, before protected-main activation authority is evaluated;
- again after reviewer approval, before any protected deployment configuration or Cloudflare mutation path.

The current D3D-A source intentionally remains `production.d1_identity_status = "unverified"` with null production D1 name/fingerprint. Therefore D3D-A is deliberately **not deployable**, even if the control-plane activation authority were accidentally changed to `ready`.

### D3D-B implication

D3D-B must first obtain read-only authoritative Cloudflare D1 identity evidence, then merge that verified name + UUID fingerprint into the runtime source through normal protected CI/review. Only a runtime SHA containing that verified identity may later be authorized by the separate protected-main activation authority.

This preserves the N66 architecture: immutable runtime truth and later control-plane authorization are separate, but both must independently agree before the human reviewer gate.

### Runtime impact

None.

- no production deployment;
- no staging deployment;
- no D1 migration/data mutation;
- no financial logic change;
- normal production/staging service remains unchanged;
- only a future production deployment attempt is fail-closed.

### Status

**IMPLEMENTED ON WORK BRANCH / FINAL EXACT-HEAD CI REQUIRED**
