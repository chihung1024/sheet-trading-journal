# Worker CORS environment contract

## Purpose

The Worker deployment entry distinguishes two CORS modes based on whether the `ALLOWED_ORIGINS` binding exists.

This contract changes no production binding in PR-10D2C. Production continues using the legacy compatibility mode until a later reviewed configuration cutover.

## Source model

- `worker-entry.js`: deployment boundary for environment-sensitive CORS policy.
- `worker.js`: single canonical API, authentication, authorization, data, and calculation implementation.
- `worker-manifest.json`: records both `deploymentEntry` and `canonicalSource`.
- `wrangler.toml`: deploys `worker-entry.js`.

The entry module delegates all allowed requests to the canonical Worker. It contains no route, identity, database, portfolio, record, calculation, or financial logic.

## Legacy compatibility mode

When the `ALLOWED_ORIGINS` binding is absent, the entry delegates without changing behavior. The canonical Worker continues to allow the existing reviewed defaults:

- production Cloudflare Pages origin;
- GitHub Pages origin;
- reviewed localhost development origins;
- HTTPS Cloudflare Pages branch hostnames under `.sheet-trading-journal.pages.dev`.

This compatibility mode exists only until production origins are made explicit in a later B03 cutover.

## Authoritative mode

When `ALLOWED_ORIGINS` is present, including an empty string, its valid entries form the complete allowlist.

Rules:

1. Values are comma-separated and trimmed.
2. Only exact `http://` or `https://` origins are retained.
3. Paths, queries, fragments, trailing slashes, URL credentials, non-HTTP schemes, malformed values, and wildcard `*` are rejected.
4. Duplicates collapse to one origin.
5. Production/local defaults are not merged.
6. The Cloudflare Pages hostname suffix fallback is disabled.
7. Empty or wildcard-only explicit values deny every browser origin.
8. Requests without an `Origin` header continue to the canonical Worker because CORS is a browser-origin boundary, not service authentication.

For an explicit allowlist, a request bearing an unapproved `Origin` is rejected before route or database processing with HTTP `403` and error code `ORIGIN_FORBIDDEN`.

Approved requests still pass through the canonical Worker's existing preflight method/header validation and response-header generation.

## Environment rollout

- Staging already requires the exact staging frontend origin through its dedicated wrapper and rendered configuration.
- Production does not receive an `ALLOWED_ORIGINS` value in PR-10D2C.
- A later batch must set and verify an exact production allowlist only after production Pages variables and rollback evidence are confirmed.

## Verification

Deterministic tests cover:

- absent-binding compatibility;
- exact and multiple explicit origins;
- invalid origin filtering;
- empty and wildcard fail-closed behavior;
- production, GitHub Pages, localhost, and arbitrary Pages rejection under explicit staging configuration;
- preflight method/header validation;
- public response CORS headers;
- manifest, deployment entry, renderer path, Wrangler dry-run, and local D1 regression.

## Rollback

Revert PR-10D2C. Because the batch does not deploy the Worker or set external bindings, no cloud-resource or data rollback is expected.
