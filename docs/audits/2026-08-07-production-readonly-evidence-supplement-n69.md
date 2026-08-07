# 2026-08-07 Production Read-Only Evidence Audit Supplement — N69

Status: **APPEND-ONLY / MITIGATED FOR D3D-B / LEAST-PRIVILEGE HARDENING OPEN**  
Baseline: `main@6bf0f4002ac6ed7fead64d49084ac31c1d33fb39`

## N69 — MEDIUM — production Cloudflare credential capability is not independently proven least privilege

### Finding

D3D-B requires authenticated Cloudflare control-plane reads after protected-main merge. The repository already has a production Environment `CLOUDFLARE_API_TOKEN` used by deployment workflows, but the repository does not contain authoritative machine evidence that the token itself is limited to read-only permissions.

Calling that credential a "read-only token" would therefore promote an assumption into authority.

### D3D-B mitigation

D3D-B does not claim least-privilege token capability. Instead it proves the execution path is read-only:

- PR job receives no production Environment secrets;
- authenticated job is main-only and reviewer-protected;
- workflow contract rejects `POST`, `PUT`, `PATCH`, `DELETE`, explicit mutation requests, Wrangler deploy, D1 migrations, secret mutation and GitHub API write methods;
- Cloudflare calls are GET/read endpoints only;
- D1 UUID is derived from the live Worker resource binding rather than a protected D1 identity secret;
- raw Cloudflare responses are never uploaded and are deleted in an `always()` cleanup step;
- no production deployment, D1 migration or synthetic application write is permitted by the one-shot request.

This materially limits the executable blast radius even if the credential has broader Cloudflare permissions than the evidence job needs.

### Remaining hardening

A separate governance/security batch should replace or supplement the deployment-capable token with a dedicated production audit token whose Cloudflare permissions are independently documented and limited to the exact Workers Scripts / Pages / D1 read operations required by evidence workflows.

That future token migration must use add-new -> verify -> switch -> remove-old sequencing and must not break the canonical production deployment credential.

### D3D-B decision

N69 does **not** justify bypassing the production Environment reviewer gate, creating a new token ad hoc, or changing production secrets inside D3D-B. The current batch may proceed because its executable path is statically and dynamically constrained to reads.

### Status

**MITIGATED FOR D3D-B EXECUTION / DEDICATED LEAST-PRIVILEGE AUDIT TOKEN REMAINS OPEN**
