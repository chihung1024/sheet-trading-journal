# Staging frontend contract

## Status

PR-10D2B defines the repository policy for one future Cloudflare Pages staging frontend. It does not create the Pages branch, set Cloudflare variables, create a Google OAuth client, deploy the staging Worker, or mutate application data.

Production behavior remains unchanged: the `main` Pages branch may continue using the current reviewed production fallback while the staged environment is provisioned separately.

## Fixed identity

| Property | Required value |
|---|---|
| Cloudflare Pages branch | `staging` |
| Frontend origin | `https://staging.sheet-trading-journal.pages.dev` |
| Deploy environment | `staging` |
| API origin | `https://journal-backend-staging.chired.workers.dev` |
| Google OAuth client | Dedicated staging web client, different from production |

The machine-readable source of truth is `config/deployment-environments.json`.

## Build policy

A Cloudflare Pages build for the fixed `staging` branch succeeds only when all conditions are met:

1. `VITE_DEPLOY_ENV=staging`.
2. `VITE_API_URL=https://journal-backend-staging.chired.workers.dev` exactly.
3. `VITE_GOOGLE_CLIENT_ID` is a syntactically valid Google web OAuth client ID.
4. The OAuth client ID differs from the production client.
5. The API value is an HTTPS origin with no path, query, fragment, credentials, trailing slash, or localhost host.

Every other non-`main` Pages branch fails closed even if it is given otherwise valid staging values. This prevents temporary pull-request hostnames from becoming OAuth origins or gaining a path to the staging service.

The previous generic `preview` deployment mode is no longer a reviewed deployed environment. Local development and ordinary CI remain unaffected when deployment variables are absent.

## External prerequisites

Before the fixed staging branch can deploy successfully, provision and review:

1. The backend staging contract documented in `docs/STAGING_WORKER_CONTRACT.md`.
2. A Cloudflare Pages branch named `staging`.
3. Preview/staging environment variables on that branch only:
   - `VITE_DEPLOY_ENV=staging`
   - `VITE_API_URL=https://journal-backend-staging.chired.workers.dev`
   - `VITE_GOOGLE_CLIENT_ID=<dedicated staging web client ID>`
4. A separate Google OAuth web client with the exact staging frontend origin authorized.
5. Synthetic staging test data only.

Do not copy production D1 data, production secrets, or the production OAuth client into staging.

## Deterministic verification

The frontend contract tests verify:

- current `main` production fallback compatibility;
- exact fixed staging branch acceptance;
- arbitrary branch rejection even with valid staging values;
- exact staging API enforcement;
- production API and OAuth rejection;
- malformed, local, HTTP, path, query, fragment, credential, and trailing-slash URL rejection;
- disabled `preview` mode;
- shared validation through both npm lifecycle and direct Vite builds.

## Rollback

Revert PR-10D2B. This batch does not create or modify external resources or application data.
