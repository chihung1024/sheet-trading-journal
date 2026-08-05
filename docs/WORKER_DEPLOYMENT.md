# Cloudflare Worker reproducible deployment

`worker.js` is the only production Worker source. Files under `cloudflare worker/`
are retained as historical reference and must not be deployed.

## Version model

- Release version: `4.05`
- API version: `2.57`
- D1 schema version: `1`
- Cloudflare runtime version: exposed through `CF_VERSION_METADATA`
- Git source commit: injected into `SOURCE_COMMIT` by the deployment workflow

Every response includes `X-Release-Version`, `X-API-Version`,
`X-Schema-Version`, and `X-Source-Commit`. When available it also includes
`X-Worker-Version-Id`.

Public operational endpoints:

- `GET /api/version`: source, API, schema, and Cloudflare Worker version metadata.
- `GET /api/health`: D1 binding, core table, and schema-version readiness.

Neither endpoint returns secrets, user identifiers, record counts, or database IDs.

## Required protected GitHub secrets

- `CLOUDFLARE_API_TOKEN`: Worker Scripts edit and D1 edit permission.
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`

The tracked `wrangler.toml` contains an all-zero local-only D1 UUID. Production
rendering rejects that sentinel and writes `.wrangler/deploy.toml`, which is not
committed.

## Local verification

```bash
npm ci --no-audit --no-fund
npm run test:worker
npm run worker:config:check
npm run worker:schema:test
```

## Production deployment order

1. Supply an exact 40-character commit SHA that is already reachable from `main`.
2. Checkout that exact commit and verify it is an ancestor of `origin/main`.
3. Run Worker tests and configuration consistency checks.
4. Render `.wrangler/deploy.toml` from protected values.
5. Apply pending D1 migrations remotely.
6. Deploy `worker.js` through Wrangler.
7. Verify `/api/version` reports the exact Git source commit.
8. Verify `/api/health` returns HTTP 200 and schema version `1`.

Use the `Deploy Worker` GitHub Actions workflow for this sequence. Manual
Quick Edit deployment is no longer the supported production path.

## Rollback

Worker source rollback and D1 rollback are separate operations. D1 migrations
in PR-05 are additive and are not automatically reversed.

To roll back Worker code, deploy a known backup branch or release commit using
the same workflow. Confirm `/api/version` and `/api/health` after rollback.
