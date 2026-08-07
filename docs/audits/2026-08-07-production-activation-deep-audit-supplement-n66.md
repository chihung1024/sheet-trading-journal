# 2026-08-07 Production Activation Deep Audit Supplement — N66

Status: **APPEND-ONLY / REMEDIATION IN PROGRESS**  
Parent audit: `docs/audits/2026-08-07-production-activation-deep-audit.md`  
Baseline: `main@74fe12010ee3138e07a079a3d45271fddb80b536`

## N66 — CRITICAL — production authority read from runtime source creates a self-reference deadlock

### Root cause

The first N65 implementation correctly moved production activation checks before the reviewer gate, but it still executed `verify_production_activation_authority.mjs` from the exact runtime source SHA being requested for deployment.

A Git commit cannot practically contain a trustworthy authority file that pre-authorizes its own final commit SHA because the authority content contributes to that SHA. A later authority-only commit can authorize an earlier source SHA, but if the workflow reads authority from the earlier source, it still sees the old blocked authority. That creates a control-plane self-reference deadlock.

### Correct architecture

Production activation authority and runtime source are now intentionally separate planes:

- the runtime checkout remains the exact source SHA that may eventually be deployed;
- the workflow fetches the current protected `main` control plane;
- a detached Git worktree at `refs/remotes/origin/main` supplies the activation authority verifier and its evidence;
- protected main may therefore authorize a previously reviewed, immutable runtime SHA without requiring that runtime commit to self-authorize;
- the requested runtime SHA must still be reachable from protected main;
- after the human production Environment approval, the deploy job re-reads the latest protected-main authority in a fresh worktree and re-validates the same requested runtime SHA before any production secrets/migrations/deploy action.

### Consequence for D3D-B/D3D-C

D3D-B can now be executed safely in two logical evidence layers:

1. establish the runtime/config/frontend/D1 proof source and merge it normally;
2. append an authority/evidence closeout on protected main that explicitly authorizes the already-known immutable runtime SHA.

D3D-C then dispatches the production workflow with that authorized runtime SHA. The workflow definition and authority come from protected main, while the deployed runtime remains the exact approved source.

### Runtime impact

None. No production or staging deployment was executed while correcting this architecture.

### Status

**IMPLEMENTED ON WORK BRANCH / NEW CI REQUIRED / PRODUCTION AUTHORITY REMAINS BLOCKED**
