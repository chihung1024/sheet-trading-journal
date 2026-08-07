# 2026-08-07 Production Activation Deep Audit Supplement — N67

Status: **APPEND-ONLY / REMEDIATION IN PROGRESS**  
Parent audit: `docs/audits/2026-08-07-production-activation-deep-audit.md`

## N67 — HIGH — production activation authority could become stale between approval and mutation

The reviewer-protected job originally fetched protected `main` near job start, then performed dependency installation, tests, configuration rendering, and D1 read-only checks before mutation. If protected main changed during that interval and revoked or replaced production activation authority, the already-fetched remote-tracking ref could remain stale.

### Remediation

The workflow now fetches protected `main` again every time activation authority is evaluated and introduces explicit authority checkpoints:

1. preflight before the reviewer gate;
2. after reviewer approval, before reading/using deployment secrets;
3. immediately before the first production mutation boundary (`d1 migrations apply --remote`);
4. immediately after additive migration and before Worker deploy.

Each checkpoint uses a fresh detached worktree of the newly fetched protected-main control plane and re-validates the same immutable requested runtime SHA.

This does not make protected main globally immutable during deployment; instead it minimizes the TOCTOU window and guarantees that a revocation observed before either mutation boundary stops the workflow. D1 migrations remain additive/backwards-compatible by policy, so a revocation that occurs during the migration command can still stop Worker cutover without requiring destructive rollback.

### Runtime impact

None. No production/staging deployment or D1 mutation was executed while adding these checks.

### Status

**IMPLEMENTED ON WORK BRANCH / NEW CI REQUIRED**
