# Deployment

This document is the current deployment navigation point for the repository.
Historical runbooks and acceptance records are retained only for forensic context and
must not override current machine-readable contracts or current workflows.

## Runtime identity

The canonical runtime identity is defined by `worker-manifest.json`:

- deployment entry: `worker-entry.js`
- canonical Worker source: `worker.js`
- Worker release: `4.07`
- API version: `2.60`
- D1 schema version: `2`

If these values change, follow the current manifest and code rather than copying version
numbers from old audit, acceptance, or recovery documents.

## Production state

Production activation is intentionally fail-closed. The current operational handoff is:

`docs/governance/V5_CURRENT_HANDOFF.md`

Do not deploy production merely to clear a deferred governance status. Before any future
production activation, re-read the current protected `main`, the current deployment
contracts, GitHub Environment controls, and fresh Cloudflare identity evidence.

Schema 3 and later remain blocked until the machine Recovery Evidence Gate has genuine
structured recovery/export/restore evidence and explicitly passes.

## Production Worker deployment

Use the GitHub Actions workflow:

`.github/workflows/deploy-worker.yml`

The workflow accepts an exact lowercase 40-character source SHA reachable from `main`.
Its current sequence includes:

1. preflight Recovery Evidence Gate and production-runtime prerequisite checks;
2. production activation-authority verification against protected `main`;
3. the reviewer-protected `production` Environment;
4. re-verification after approval;
5. protected Wrangler configuration rendering;
6. exact production D1 control-plane identity verification;
7. allowed D1 migration execution;
8. strict Wrangler deployment through `worker-entry.js`;
9. propagated source/service/release/API/schema verification;
10. post-deploy public auth/CORS contract verification.

Routine Cloudflare dashboard Quick Edit or source copy/paste is not a supported production
deployment path.

Production credentials, API secrets, and authoritative D1 identifiers must remain in the
protected control plane; do not commit them into documentation.

## Production read-only evidence

When preparing for a future production activation, use these manual workflows as needed:

- `.github/workflows/production-identity-evidence.yml`
- `.github/workflows/production-contract-audit.yml`

They are manual production operations. Their unit-level implementations are also covered by
the repository's normal `test:worker` CI suite, so they do not run a duplicate unit workflow
for every pull request.

## Staging

Use:

- `.github/workflows/deploy-worker-staging.yml`
- `docs/STAGING_WORKER_CONTRACT.md`
- `docs/STAGING_FRONTEND_CONTRACT.md`

Current fixed staging identities are defined in `config/deployment-environments.json`:

- Pages branch: `staging`
- frontend origin: `https://staging.sheet-trading-journal.pages.dev`
- API origin: `https://journal-backend-staging.chired.workers.dev`
- D1 database name: `trading-journal-staging`

Arbitrary Cloudflare Pages preview branches are intentionally disabled. There is no generic
`.env.preview.example`; non-production deployment must use the fixed staging contract.

## Local frontend verification

`.env.example` is a production-value example, not a staging or preview file. Ordinary local
and CI builds may run without deployment variables according to the current frontend
environment policy.

Typical verification commands:

```bash
npm ci --no-audit --no-fund
npm run check
```

For interactive local frontend development:

```bash
npm run dev
```

## Source-of-truth order

When documents disagree, use current sources in this order:

1. current protected `main`;
2. `worker-manifest.json`, `config/deployment-environments.json`, `wrangler.toml`, and the
   current runtime source;
3. current deployment workflows, policy tools, and tests;
4. `docs/governance/V5_CURRENT_HANDOFF.md` for intentional activation blockers;
5. historical acceptance, audit, recovery, and tombstone documents only for forensic context.

The root `DEPLOYMENT_FINAL.md` is an archived tombstone and is not a current deployment
runbook.
