import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { __test } from '../worker-entry.js';

const STAGING_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';
const PRODUCTION_ORIGIN = 'https://sheet-trading-journal.pages.dev';
const GITHUB_PAGES_ORIGIN = 'https://chihung1024.github.io';
const LOCAL_ORIGIN = 'http://localhost:5173';
const ARBITRARY_PAGES_ORIGIN = 'https://feature-123.sheet-trading-journal.pages.dev';

function explicitEnv(value) {
  return { ALLOWED_ORIGINS: value };
}

function preflight(origin, method = 'GET', headers = '') {
  const requestHeaders = {
    Origin: origin,
    'Access-Control-Request-Method': method,
  };
  if (headers) requestHeaders['Access-Control-Request-Headers'] = headers;
  return new Request('https://worker.invalid/api/version', {
    method: 'OPTIONS',
    headers: requestHeaders,
  });
}

const ctx = { waitUntil() {} };

test('absent ALLOWED_ORIGINS preserves current reviewed production and local defaults', () => {
  const allowed = __test.getAllowedOrigins({});
  assert.equal(allowed.has(PRODUCTION_ORIGIN), true);
  assert.equal(allowed.has(GITHUB_PAGES_ORIGIN), true);
  assert.equal(allowed.has(LOCAL_ORIGIN), true);

  assert.equal(__test.isOriginAllowed(PRODUCTION_ORIGIN, {}), true);
  assert.equal(__test.isOriginAllowed(GITHUB_PAGES_ORIGIN, {}), true);
  assert.equal(__test.isOriginAllowed(LOCAL_ORIGIN, {}), true);
  assert.equal(__test.isOriginAllowed(ARBITRARY_PAGES_ORIGIN, {}), true);
  assert.equal(__test.isOriginAllowed('http://feature.sheet-trading-journal.pages.dev', {}), false);
});

test('explicit ALLOWED_ORIGINS becomes the complete authoritative allowlist', () => {
  const env = explicitEnv(STAGING_ORIGIN);
  assert.deepEqual([...__test.getAllowedOrigins(env)], [STAGING_ORIGIN]);
  assert.equal(__test.isOriginAllowed(STAGING_ORIGIN, env), true);

  for (const origin of [
    PRODUCTION_ORIGIN,
    GITHUB_PAGES_ORIGIN,
    LOCAL_ORIGIN,
    ARBITRARY_PAGES_ORIGIN,
  ]) {
    assert.equal(__test.isOriginAllowed(origin, env), false, origin);
  }
});

test('explicit multiple origins accept only exact valid HTTP or HTTPS origins', () => {
  const second = 'https://admin-staging.example.com';
  const local = 'http://127.0.0.1:4173';
  const env = explicitEnv([
    ` ${STAGING_ORIGIN} `,
    second,
    local,
    '*',
    'https://invalid.example.com/path',
    'https://invalid.example.com/',
    'https://user:password@invalid.example.com',
    'ftp://invalid.example.com',
    'not-a-url',
    STAGING_ORIGIN,
  ].join(','));

  assert.deepEqual(
    [...__test.getAllowedOrigins(env)],
    [STAGING_ORIGIN, second, local],
  );
  assert.equal(__test.isOriginAllowed(second, env), true);
  assert.equal(__test.isOriginAllowed(local, env), true);
  assert.equal(__test.isOriginAllowed('https://invalid.example.com', env), false);
});

test('explicit empty and wildcard-only values fail closed', () => {
  for (const value of ['', '   ', '*', ' *, * ']) {
    const env = explicitEnv(value);
    assert.deepEqual([...__test.getAllowedOrigins(env)], [], value);
    assert.equal(__test.isOriginAllowed(PRODUCTION_ORIGIN, env), false, value);
    assert.equal(__test.isOriginAllowed(STAGING_ORIGIN, env), false, value);
    assert.equal(__test.isOriginAllowed(ARBITRARY_PAGES_ORIGIN, env), false, value);
  }
});

test('authoritative explicit allowlist governs preflight rejection and response headers', async () => {
  const env = explicitEnv(STAGING_ORIGIN);
  const allowed = await worker.fetch(preflight(STAGING_ORIGIN), env, ctx);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), STAGING_ORIGIN);
  assert.match(allowed.headers.get('Access-Control-Allow-Methods') || '', /GET/);
  assert.equal(allowed.headers.get('Vary'), 'Origin');

  for (const origin of [PRODUCTION_ORIGIN, LOCAL_ORIGIN, ARBITRARY_PAGES_ORIGIN]) {
    const rejected = await worker.fetch(preflight(origin), env, ctx);
    assert.equal(rejected.status, 403, origin);
    assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null, origin);
    const body = await rejected.json();
    assert.equal(body.error_meta.code, 'ORIGIN_FORBIDDEN', origin);
  }
});

test('explicit allowlist still enforces allowed preflight method and headers', async () => {
  const env = explicitEnv(STAGING_ORIGIN);

  const badMethod = await worker.fetch(preflight(STAGING_ORIGIN, 'PATCH'), env, ctx);
  assert.equal(badMethod.status, 403);
  assert.equal((await badMethod.json()).error_meta.code, 'CORS_METHOD_FORBIDDEN');

  const badHeader = await worker.fetch(
    preflight(STAGING_ORIGIN, 'GET', 'X-Forbidden-Header'),
    env,
    ctx,
  );
  assert.equal(badHeader.status, 403);
  assert.equal((await badHeader.json()).error_meta.code, 'CORS_HEADER_FORBIDDEN');
});

test('normal public responses echo only an explicitly allowed origin', async () => {
  const env = explicitEnv(STAGING_ORIGIN);
  const allowed = await worker.fetch(
    new Request('https://worker.invalid/api/version', {
      headers: { Origin: STAGING_ORIGIN },
    }),
    env,
    ctx,
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), STAGING_ORIGIN);

  const rejected = await worker.fetch(
    new Request('https://worker.invalid/api/version', {
      headers: { Origin: PRODUCTION_ORIGIN },
    }),
    env,
    ctx,
  );
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
});
