# Staging Worker contract

## Status

PR-10D2A defines a backend-only staging deployment contract. The external staging Worker and D1 resources were subsequently provisioned and the first exact-SHA staging deployment completed successfully through the protected workflow.

The workflow remains manual and must be run only after every external prerequisite below is independently provisioned and reviewed.

## Fixed staging identities

| Resource | Required identity |
|---|---|
| Cloudflare Worker service | `journal-backend-staging` |
| Worker endpoint | `https://journal-backend-staging.chired.workers.dev` |
| D1 database name | `trading-journal-staging` |
| Frontend origin | `https://staging.sheet-trading-journal.pages.dev` |
| GitHub environment | `staging` |

The production Worker, production D1 database, production OAuth client, production secrets, records, snapshots, calculation jobs, and financial methodology are outside this contract.

The fixed `workers.dev` service endpoint is enabled for the reviewed staging identity. Cloudflare Worker version preview URLs are explicitly disabled so no additional version-specific public endpoint is created outside that identity.

## Repository layout

- `ops/staging/staging-worker.js`: strict runtime wrapper around the canonical Worker.
- `ops/staging/wrangler.toml`: tracked sentinel template. It is intentionally non-deployable until rendered with reviewed external identities.
- `tools/render_staging_wrangler_config.mjs`: validates reviewed staging identities, fixed endpoint policy, disabled preview URLs, and writes only to ignored `.wrangler/` output.
- `tools/verify_staging_secret_inventory.mjs`: requires `API_SECRET` and forbids `GITHUB_TOKEN`.
- `tools/verify_staging_worker_deployment.mjs`: verifies exact source, version, schema, staging environment, and service identity.
- `tools/verify_staging_cors_deployment.mjs`: verifies the live deployed browser-origin acceptance and rejection matrix.
- `.github/workflows/deploy-worker-staging.yml`: manual, environment-protected, exact-main-reachable deployment path.

No staging Wrangler configuration is stored at repository root. The Cloudflare Pages frontend build path remains unchanged.

## Runtime boundaries

The staging wrapper refuses service when any condition is not met:

1. `DEPLOYMENT_ENVIRONMENT` equals `staging`.
2. `ALLOWED_ORIGINS` contains only `https://staging.sheet-trading-journal.pages.dev`.
3. `GOOGLE_CLIENT_ID` is a valid dedicated Google web OAuth client and is not the production client.
4. `API_SECRET` is present and has an acceptable length.
5. `GITHUB_TOKEN` is absent.

The wrapper rejects production, arbitrary preview, GitHub Pages, and localhost browser origins before calling the canonical Worker. Successful responses are marked with `X-Deployment-Environment: staging` and `X-Worker-Service: journal-backend-staging`.

## External prerequisites

Provision these outside the repository before enabling or running the workflow:

1. A Cloudflare Worker service named `journal-backend-staging`.
2. A new D1 database named `trading-journal-staging`, containing no production records.
3. A dedicated Google OAuth web client whose authorized JavaScript origin includes only the fixed staging frontend origin required for this application.
4. A strong `API_SECRET` installed directly on the staging Worker.
5. A GitHub environment named `staging` with these environment-scoped secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
   - `CLOUDFLARE_D1_DATABASE_NAME=trading-journal-staging`
   - `STAGING_GOOGLE_CLIENT_ID`
6. A Cloudflare API token restricted to the minimum staging Worker and staging D1 permissions practical for deployment.

Do not copy production D1 data, production API secrets, production OAuth credentials, or the production GitHub dispatch token into staging.

## Deployment workflow behavior

The workflow:

- requires an exact 40-character commit SHA reachable from `main`;
- requires the operator to type `staging` as an explicit confirmation;
- runs under the protected GitHub `staging` environment;
- keeps Cloudflare and staging identity secrets out of checkout and setup actions;
- renders `.wrangler/staging.toml` from the sentinel template;
- retains only the fixed staging `workers.dev` endpoint and disables Worker version preview URLs;
- disables Wrangler automatic provisioning and resource creation;
- verifies the pre-provisioned Worker has `API_SECRET` and does not have `GITHUB_TOKEN`;
- applies migrations only through the rendered staging D1 binding;
- deploys only the fixed staging service;
- verifies exact source, release, API, schema, environment, and service headers;
- sends live browser preflight requests after readiness;
- requires the exact staging Pages origin to return HTTP 204 with an exact `Access-Control-Allow-Origin` value;
- requires production Pages, arbitrary branch preview, GitHub Pages, and localhost origins to return HTTP 403 with `ORIGIN_FORBIDDEN` and no `Access-Control-Allow-Origin` header.

The readiness requests omit `Origin`, preserving operational endpoint access for non-browser health and version checks. The live CORS probes are read-only `OPTIONS` requests and do not write application or D1 data.

Staging calculation dispatch is deliberately unavailable because the staging Worker must not contain `GITHUB_TOKEN`. A separately isolated computation path requires a later design and review.

## Deterministic validation

The normal CI suite automatically runs:

```text
npm run test:worker
npm run worker:config:check
npm run worker:schema:test
```

The staging tests cover runtime isolation, renderer rejection cases, Wrangler dry-run, disabled preview URLs, secret inventory, readiness identity, live CORS evidence parsing, workflow structure, YAML parsing, and action pinning.

## Rollback

Revert the staging contract change and redeploy the last reviewed staging commit. Production resources and application data are not modified by this contract. Disabling preview URLs removes only ungoverned version-specific staging endpoints; the fixed staging service endpoint remains available.
