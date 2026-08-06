import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { verifyProductionContract } from '../tools/verify_production_contract.mjs';

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

const response = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const healthyHandler = (req, res) => {
  if (req.url === '/api/version') return response(res, 200, {
    success: true, status: 'ok', source_commit: 'abc1234', release_version: '4.07', api_version: '2.60', schema_version: 2,
  });
  if (req.url === '/api/health') return response(res, 200, {
    success: true, status: 'ok', source_commit: 'abc1234', observed_schema_version: 2, checks: { database: 'ok', schema: 'ok' },
  });
  if (req.url === '/api/records?limit=1') {
    if (req.headers['x-api-key'] === 'secret') return response(res, 200, { success: true, data: [], page: { limit: 1, count: 0, has_more: false, next_cursor: null } });
    return response(res, 401, { success: false });
  }
  if (req.url === '/api/user-settings' && req.headers['x-api-key'] === 'secret') return response(res, 400, { success: false });
  return response(res, 404, { success: false });
};

test('verifies public and system fail-closed contracts without recording secrets', async () => {
  await withServer(healthyHandler, async (baseUrl) => {
    const evidence = await verifyProductionContract({
      baseUrl,
      expectedSha: 'abc1234',
      expectedRelease: '4.07',
      expectedApi: '2.60',
      expectedSchema: '2',
      apiKey: 'secret',
    });
    assert.equal(evidence.system_checks, 'executed');
    assert.equal(evidence.system_records_status, 200);
    assert.equal(evidence.system_settings_without_tenant_status, 400);
    assert.equal(JSON.stringify(evidence).includes('secret'), false);
  });
});

test('fails closed on exact source mismatch', async () => {
  await withServer(healthyHandler, async (baseUrl) => {
    await assert.rejects(
      verifyProductionContract({
        baseUrl,
        expectedSha: 'different',
        expectedRelease: '4.07',
        expectedApi: '2.60',
        expectedSchema: '2',
      }),
      /source_commit mismatch/,
    );
  });
});

test('fails closed when anonymous records are exposed', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/records?limit=1') return response(res, 200, { success: true, data: [] });
    return healthyHandler(req, res);
  }, async (baseUrl) => {
    await assert.rejects(
      verifyProductionContract({
        baseUrl,
        expectedSha: 'abc1234',
        expectedRelease: '4.07',
        expectedApi: '2.60',
        expectedSchema: '2',
      }),
      /anonymous records status=200/,
    );
  });
});
