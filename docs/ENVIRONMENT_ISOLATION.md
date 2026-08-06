# Environment isolation

## Scope

This document governs B03 frontend and Worker environment separation.

- PR-10D1 prevents unconfigured non-main Pages builds from silently using production services.
- PR-10D2 adds a fail-closed staging Worker/D1 deployment contract.
- Neither batch claims that the external staging resources already exist.

The machine-readable source of truth is `config/deployment-environments.json`.

## Reviewed environments

| Environment | Pages branch/origin | Worker | D1 | OAuth |
|---|---|---|---|---|
| Production | `main` / `https://sheet-trading-journal.pages.dev` | `journal-backend` | Production D1 | Production web client |
| Staging | `staging` / `https://staging.sheet-trading-journal.pages.dev` | `journal-backend-staging` | `trading-journal-staging` | Dedicated staging web client |
| Development/test | Local or CI | Local/test | Local/test | Local/test client as needed |

Arbitrary pull-request and feature-branch Pages deployments remain disabled. A fixed hostname is required so the Google web OAuth client and Worker CORS policy can use an exact reviewed origin.

## Frontend build-time policy

The same policy runs through:

1. `npm run build` → `prebuild` → `tools/check_frontend_environment.mjs`.
2. `vite.config.js`, including direct `vite build` calls.

The fixed `staging` Pages branch requires all of these:

```text
VITE_DEPLOY_ENV=staging
VITE_API_URL=https://journal-backend-staging.chired.workers.dev
VITE_GOOGLE_CLIENT_ID=<dedicated-staging-google-web-client-id>
```

The API must be the exact reviewed HTTPS origin. The OAuth client must be syntactically valid and different from production. Missing values, production values, localhost, another Worker, URL paths, trailing slashes, queries, fragments, credentials, unsupported environments, and arbitrary Pages branches fail the build.

Use `.env.staging.example` as the shape reference. `.env.preview.example` documents that arbitrary previews are intentionally disabled.

## Staging Worker runtime boundary

`staging-worker.js` wraps the canonical `worker.js`. Before delegation it requires:

- `DEPLOYMENT_ENVIRONMENT=staging`;
- exactly one allowed origin: `https://staging.sheet-trading-journal.pages.dev`;
- a dedicated non-production Google OAuth client;
- an `API_SECRET` between 32 and 4096 characters;
- no `GITHUB_TOKEN` binding.

The wrapper rejects production, GitHub Pages, localhost, and arbitrary `*.pages.dev` origins even though the production Worker retains its compatibility defaults during the rollout. All delegated responses carry:

```text
X-Deployment-Environment: staging
X-Worker-Service: journal-backend-staging
```

A staging Worker cannot dispatch the production calculation workflow. A separate staging compute path is required before calculation testing is enabled.

## External prerequisites

Create these outside the repository before running the staging workflow:

1. Cloudflare D1 database named `trading-journal-staging`, containing no production tenant data.
2. Dedicated Google web OAuth client with authorized JavaScript origin:
   `https://staging.sheet-trading-journal.pages.dev`.
3. GitHub environment named `staging`, preferably with required reviewer protection.
4. Environment-scoped values:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
   - `CLOUDFLARE_D1_DATABASE_NAME=trading-journal-staging`
   - `STAGING_API_SECRET`
   - `STAGING_GOOGLE_CLIENT_ID`
5. Cloudflare Pages branch-specific variables for the `staging` branch using `.env.staging.example`.
6. A staging test account with synthetic records only.

Do not copy production D1 data, production API secrets, production OAuth credentials, or production dispatch tokens into staging.

## Protected staging deployment workflow

`.github/workflows/deploy-worker-staging.yml` is manual only. It requires:

- an exact 40-character source SHA reachable from `main`;
- `confirm_environment=staging`;
- GitHub environment `staging`;
- read-only repository permissions;
- SHA-pinned actions and disabled checkout credential persistence;
- fixed staging resource identities;
- automatic Cloudflare resource provisioning disabled.

The workflow:

1. Verifies confirmation and source ancestry.
2. Runs Worker, config, migration, and supply-chain gates.
3. Renders `.wrangler/staging.toml` from the sentinel template.
4. Dry-runs the exact staging bundle.
5. Applies migrations only to the configured staging D1 binding.
6. Installs the dedicated staging `API_SECRET`.
7. Deploys `journal-backend-staging`.
8. Polls `/api/version` and `/api/health` until exact source, release, API, schema, Worker version, staging environment header, and staging service header all match.

The workflow is not run by PR CI and must not be triggered until the external prerequisites are independently verified.

## Deterministic repository verification

```bash
npm run test:frontend
npm run test:worker
npm run worker:config:check
npm run build
```

To simulate the reviewed staging frontend:

```bash
CF_PAGES=1 \
CF_PAGES_BRANCH=staging \
VITE_DEPLOY_ENV=staging \
VITE_API_URL=https://journal-backend-staging.chired.workers.dev \
VITE_GOOGLE_CLIENT_ID=123456789012-stagingclient.apps.googleusercontent.com \
npm run environment:check
```

To verify fail-closed behavior, change the branch, API, or OAuth client to a production value. The command must exit non-zero.

## Staging smoke test after provisioning

Use synthetic data only:

1. Confirm the staging Pages build uses no production Worker URL.
2. Log in with the staging OAuth client.
3. Verify `/api/version` and `/api/health` staging identity headers.
4. Create, update, list, and delete a synthetic record.
5. Confirm only staging D1 changed.
6. Confirm `/api/trigger-update` returns unavailable because no staging dispatch token exists.
7. Confirm production and arbitrary preview origins receive CORS rejection from staging.
8. Confirm production Worker and D1 were unchanged.

## Production compatibility window

Production Pages may continue using the existing reviewed fallback when production Vite variables are absent. Production Worker CORS defaults are also unchanged in PR-10D2.

Remaining B03 work:

- create and smoke-test the external staging resources;
- set exact Pages `staging` branch variables;
- make production frontend values explicit;
- restrict production CORS/OAuth origins after verified staging cutover;
- add a separate staging compute path only if calculation testing is required.

## Rollback

Revert the B03 repository merges. If the staging workflow has never been invoked, no cloud or data rollback is needed. If it has been invoked, delete only the staging Worker/D1/OAuth resources after preserving any required synthetic test evidence; never alter production resources as part of staging rollback.
