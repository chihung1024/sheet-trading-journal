import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { verifyProductionContract } from '../tools/verify_production_contract.mjs';

const EXPECTED_SHA = '1234567890abcdef1234567890abcdef12345678';
const EXPECTED_SERVICE = 'trading-journal-api';
const ALLOWED_ORIGIN = 'https://sheet-trading-journal.pages.dev';
const REJECTED_ORIGIN = 'https://staging.sheet-trading-journal.pages.dev';

async function withServer(handler, run) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

const response = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(body === null ? '' : JSON.stringify(body));
};

const healthyHandler = (req, res) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    if (origin === ALLOWED_ORIGIN) {
      return response(res, 204, null, { 'access-control-allow-origin': origin, vary: 'Origin' });
    }
    return response(res, 403, { success: false });
  }
  if (req.url === '/api/version') return response(res, 200, {
    success: true,
    status: 'ok',
    service: EXPECTED_SERVICE,
    source_commit: EXPECTED_SHA,
    release_version: '4.07',
    api_version: '2.60',
    schema_version: 2,
    worker_version: { id: 'worker-version-1' },
  });
  if (req.url === '/api/health') return response(res, 200, {
    success: true,
    status: 'ok',
    source_commit: EXPECTED_SHA,
    observed_schema_version: 2,
    checks: { database: 'ok', schema: 'ok' },
  });
  if (req.url === '/api/records?limit=1') {
    if (req.headers['x-api-key'] === 'secret') return response(res, 200, { success: true, data: [], page: { limit: 1, count: 0, has_more: false, next_cursor: null } });
    return response(res, 401, { success: false });
  }
  if (req.url === '/api/user-settings' && req.headers['x-api-key'] === 'secret') return response(res, 400, { success: false });
  return response(res, 404, { success: false });
};

const verify = (baseUrl, overrides = {}) => verifyProductionContract({
  baseUrl,
  expectedSha: EXPECTED_SHA,
  expectedService: EXPECTED_SERVICE,
  expectedRelease: '4.07',
  expectedApi: '2.60',
  expectedSchema: '2',
  apiKey: 'secret',
  requireSystemChecks: true,
  allowedOrigins: [ALLOWED_ORIGIN],
  rejectedOrigins: [REJECTED_ORIGIN],
  ...overrides,
});

test('verifies public, CORS, and system fail-closed contracts without recording secrets', async () => {
  await withServer(healthyHandler, async (baseUrl) => {
    const evidence = await verify(baseUrl);
    assert.equal(evidence.system_checks, 'executed');
    assert.equal(evidence.system_records_status, 200);
    assert.equal(evidence.system_settings_without_tenant_status, 400);
    assert.deepEqual(evidence.cors.allowed, [{ origin: ALLOWED_ORIGIN, status: 204 }]);
    assert.deepEqual(evidence.cors.rejected, [{ origin: REJECTED_ORIGIN, status: 403 }]);
    assert.equal(JSON.stringify(evidence).includes('secret'), false);
  });
});

test('fails closed when required system credential is missing', async () => {
  await withServer(healthyHandler, async (baseUrl) => {
    await assert.rejects(
      verify(baseUrl, { apiKey: '' }),
      /API_KEY is required/,
    );
  });
});

test('fails closed on malformed or mismatched exact source identity', async () => {
  await withServer(healthyHandler, async (baseUrl) => {
    await assert.rejects(
      verify(baseUrl, { expectedSha: 'short-sha' }),
      /exact 40-character/,
    );
    await assert.rejects(
      verify(baseUrl, { expectedSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
      /source_commit mismatch/,
    );
  });
});

test('fails closed when anonymous records are exposed', async () => {
  await withServer((req, res) => {
    if (req.method !== 'OPTIONS' && req.url === '/api/records?limit=1' && !req.headers['x-api-key']) {
      return response(res, 200, { success: true, data: [] });
    }
    return healthyHandler(req, res);
  }, async (baseUrl) => {
    await assert.rejects(
      verify(baseUrl),
      /anonymous records status=200/,
    );
  });
});

test('fails closed when a forbidden staging origin is accepted', async () => {
  await withServer((req, res) => {
    if (req.method === 'OPTIONS' && req.headers.origin === REJECTED_ORIGIN) {
      return response(res, 204, null, { 'access-control-allow-origin': REJECTED_ORIGIN });
    }
    return healthyHandler(req, res);
  }, async (baseUrl) => {
    await assert.rejects(
      verify(baseUrl),
      /rejected CORS origin .* status=204/,
    );
  });
});

test('fails closed when an allowed production origin is not authorized', async () => {
  await withServer((req, res) => {
    if (req.method === 'OPTIONS' && req.headers.origin === ALLOWED_ORIGIN) {
      return response(res, 403, { success: false });
    }
    return healthyHandler(req, res);
  }, async (baseUrl) => {
    await assert.rejects(
      verify(baseUrl),
      /allowed CORS origin .* status=403/,
    );
  });
});

test('reviewer-protected production audit includes read-only E1a-A 404-vs-403 compatibility proof', async () => {
  const workflow = await readFile('.github/workflows/production-contract-audit.yml', 'utf8');
  const start = workflow.indexOf('      - name: Verify E1a-A opaque-job compatibility proof');
  const end = workflow.indexOf('      - name: Upload sanitized audit evidence');
  assert.ok(start >= 0 && end > start, 'compatibility proof must run before evidence upload');

  const compatibility = workflow.slice(start, end);
  assert.match(workflow, /environment: production/);
  assert.match(compatibility, /API_KEY: \$\{\{ secrets\.API_KEY \}\}/);
  assert.match(compatibility, /\/api\/calculation-jobs\/\$job_id/);
  assert.match(compatibility, /X-API-KEY: \$API_KEY/);
  assert.match(compatibility, /\[\[ "\$status" != "404" \]\]/);
  assert.match(compatibility, /NOT_FOUND/);
  assert.match(compatibility, /tenant_identity_returned: false/);
  assert.match(compatibility, /probe_id_recorded: false/);
  assert.match(compatibility, /production-e1a-compatibility-proof\.json/);
  assert.doesNotMatch(compatibility, /--request|-X\s|\bPOST\b|\bPUT\b|\bDELETE\b/);

  const upload = workflow.slice(end);
  assert.match(upload, /production-contract-audit\.json/);
  assert.match(upload, /production-e1a-compatibility-proof\.json/);
});
