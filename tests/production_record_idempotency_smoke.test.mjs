import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runProductionRecordIdempotencySmoke } from '../tools/run_production_record_idempotency_smoke.mjs';
import { mintProductionE2eIdToken } from '../tools/mint_production_e2e_id_token.mjs';

const SOURCE_SHA = '1234567890abcdef1234567890abcdef12345678';
const TOKEN = 'test-google-id-token-that-is-long-enough-to-be-accepted';
const PRODUCTION_CLIENT_ID = '951186116587-0ehsmkvlu3uivduc7kjn1jpp9ga7810i.apps.googleusercontent.com';
const PRIOR_BROWSER_RECORD = {
  id: 1,
  txn_date: '2026-08-13',
  symbol: 'AAPL',
  txn_type: 'BUY',
  qty: 1,
  price: 1,
  fee: 0,
  tax: 0,
  tag: 'NOW1A-IDEMPOTENCY-TEST-20260813',
  note: '',
};
const ORPHANED_SMOKE_RECORD = {
  id: 2,
  txn_date: '2026-08-13',
  symbol: 'AAPL',
  txn_type: 'BUY',
  qty: 0.0001,
  price: 1,
  fee: 0,
  tax: 0,
  tag: 'NOW1A_API_SMOKE_12345_00112233445566778899aabb_legacy',
  note: 'automated production idempotency legacy compatibility smoke',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createApi({ initialRecords = [], failConflict = false } = {}) {
  const records = initialRecords.map((record) => ({ ...record }));
  const keyed = new Map();
  const requests = [];
  let nextId = records.reduce((max, record) => Math.max(max, Number(record.id) || 0), 0) + 1;

  const handler = async (req, res) => {
    requests.push({ method: req.method, url: req.url, headers: { ...req.headers } });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { success: false });

    if (req.method === 'GET' && req.url === '/api/records?limit=1000') {
      return json(res, 200, {
        success: true,
        data: records.map((record) => ({ ...record })),
        page: { limit: 1000, count: records.length, has_more: false, next_cursor: null },
      });
    }

    if (req.method === 'DELETE' && req.url === '/api/records') {
      const body = await readJson(req);
      const index = records.findIndex((record) => Number(record.id) === Number(body.id));
      if (index < 0) return json(res, 404, { success: false });
      records.splice(index, 1);
      return json(res, 200, { success: true, deleted: 1 });
    }

    if (req.method === 'POST' && req.url === '/api/records') {
      const body = await readJson(req);
      const key = req.headers['idempotency-key'];
      if (!key) {
        records.push({ id: nextId++, ...body });
        return json(res, 200, { success: true, deduplicated: false, record_id: null });
      }
      const canonical = JSON.stringify(body);
      if (keyed.has(key)) {
        const previous = keyed.get(key);
        if (previous.canonical !== canonical) {
          if (failConflict) return json(res, 500, { success: false });
          return json(res, 409, { success: false, error_meta: { code: 'IDEMPOTENCY_CONFLICT' } });
        }
        return json(res, 200, { success: true, deduplicated: true, record_id: previous.id });
      }
      const record = { id: nextId++, ...body };
      records.push(record);
      keyed.set(key, { canonical, id: record.id });
      return json(res, 200, { success: true, deduplicated: false, record_id: record.id });
    }

    return json(res, 404, { success: false });
  };

  return { handler, records, requests };
}

async function withApi(options, run) {
  const api = createApi(options);
  const server = http.createServer((req, res) => {
    api.handler(req, res).catch((error) => json(res, 500, { success: false, error: error.message }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run({ api, baseUrl: `http://127.0.0.1:${port}` });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

const runSmoke = (baseUrl) => runProductionRecordIdempotencySmoke({
  baseUrl,
  token: TOKEN,
  sourceSha: SOURCE_SHA,
  testRunId: '12345',
  randomUUID: () => '00112233445566778899aabbccddeeff',
  allowInsecureLocal: true,
});

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', kid: 'test' })}.${encode(payload)}.signature`;
}

test('performs legacy, replay, conflict, residual-browser cleanup, and final tenant cleanup', async () => {
  await withApi({ initialRecords: [PRIOR_BROWSER_RECORD] }, async ({ api, baseUrl }) => {
    const evidence = await runSmoke(baseUrl);
    assert.equal(evidence.status, 'passed');
    assert.equal(evidence.preflight.tenant_was_empty, false);
    assert.equal(evidence.preflight.prior_browser_test_record_deleted, true);
    assert.equal(evidence.preflight.orphaned_prior_smoke_records_deleted, 0);
    assert.deepEqual(evidence.assertions.legacy_without_idempotency_key, {
      http_status: 200,
      deduplicated: false,
      persisted_records: 1,
    });
    assert.deepEqual(evidence.assertions.same_key_same_payload_replay, {
      http_status: 200,
      deduplicated: true,
      persisted_records: 1,
    });
    assert.deepEqual(evidence.assertions.same_key_different_payload_conflict, {
      http_status: 409,
      error_code: 'IDEMPOTENCY_CONFLICT',
      persisted_records: 1,
    });
    assert.deepEqual(evidence.cleanup, { removedCurrentSmokeRecords: 2, tenantRecordsRemaining: 0 });
    assert.deepEqual(api.records, []);
    assert.equal(JSON.stringify(evidence).includes(TOKEN), false);
    assert.equal(JSON.stringify(evidence).includes('"record_id"'), false);

    const posts = api.requests.filter((request) => request.method === 'POST');
    assert.equal(posts.length, 4);
    assert.equal(posts[0].headers['idempotency-key'], undefined);
    assert.ok(posts.slice(1).every((request) => typeof request.headers['idempotency-key'] === 'string'));
    assert.equal(posts[1].headers['idempotency-key'], posts[2].headers['idempotency-key']);
    assert.equal(posts[2].headers['idempotency-key'], posts[3].headers['idempotency-key']);
  });
});

test('recovers only fully identified abandoned smoke rows before a fresh run', async () => {
  await withApi({ initialRecords: [ORPHANED_SMOKE_RECORD] }, async ({ api, baseUrl }) => {
    const evidence = await runSmoke(baseUrl);
    assert.equal(evidence.preflight.tenant_was_empty, false);
    assert.equal(evidence.preflight.prior_browser_test_record_deleted, false);
    assert.equal(evidence.preflight.orphaned_prior_smoke_records_deleted, 1);
    assert.deepEqual(api.records, []);
  });
});

test('fails closed before any mutation when the dedicated tenant contains an unrecognized record', async () => {
  const unrelated = { ...PRIOR_BROWSER_RECORD, id: 8, tag: 'DO-NOT-DELETE' };
  await withApi({ initialRecords: [unrelated] }, async ({ api, baseUrl }) => {
    await assert.rejects(runSmoke(baseUrl), /Dedicated production test tenant is not empty/);
    assert.deepEqual(api.records, [unrelated]);
    assert.equal(api.requests.some((request) => request.method === 'POST' || request.method === 'DELETE'), false);
  });
});

test('fails closed before any mutation when a smoke-looking row does not match the exact owned payload', async () => {
  const forged = { ...ORPHANED_SMOKE_RECORD, id: 9, qty: 99 };
  await withApi({ initialRecords: [forged] }, async ({ api, baseUrl }) => {
    await assert.rejects(runSmoke(baseUrl), /Dedicated production test tenant is not empty/);
    assert.deepEqual(api.records, [forged]);
    assert.equal(api.requests.some((request) => request.method === 'POST' || request.method === 'DELETE'), false);
  });
});

test('fails closed before any mutation when a smoke-looking row has the wrong note for its tag kind', async () => {
  const forged = {
    ...ORPHANED_SMOKE_RECORD,
    id: 10,
    note: 'automated production idempotency keyed replay smoke',
  };
  await withApi({ initialRecords: [forged] }, async ({ api, baseUrl }) => {
    await assert.rejects(runSmoke(baseUrl), /Dedicated production test tenant is not empty/);
    assert.deepEqual(api.records, [forged]);
    assert.equal(api.requests.some((request) => request.method === 'POST' || request.method === 'DELETE'), false);
  });
});

test('cleans only its own created records when the conflict assertion fails', async () => {
  await withApi({ failConflict: true }, async ({ api, baseUrl }) => {
    await assert.rejects(runSmoke(baseUrl), /Same key \+ different payload returned HTTP 500/);
    assert.deepEqual(api.records, []);
  });
});

test('requires HTTPS unless an explicit loopback-only test override is supplied', async () => {
  await assert.rejects(
    runProductionRecordIdempotencySmoke({
      baseUrl: 'http://127.0.0.1:8787',
      token: TOKEN,
      sourceSha: SOURCE_SHA,
    }),
    /Production API origin must use HTTPS/,
  );
  await assert.rejects(
    runProductionRecordIdempotencySmoke({
      baseUrl: 'http://example.test',
      token: TOKEN,
      sourceSha: SOURCE_SHA,
      allowInsecureLocal: true,
    }),
    /Production API origin must use HTTPS/,
  );
});

test('requires the exact lowercase deployed source SHA', async () => {
  await assert.rejects(
    runProductionRecordIdempotencySmoke({
      baseUrl: 'https://api.example.test',
      token: TOKEN,
      sourceSha: SOURCE_SHA.toUpperCase(),
    }),
    /exact lowercase 40-character Git commit SHA/,
  );
});

test('production workflow is protected, pins its source contract, and never uploads the token file', async () => {
  const workflow = await readFile('.github/workflows/production-record-idempotency-smoke.yml', 'utf8');
  const production = workflow.slice(workflow.indexOf('  production:'));
  assert.match(production, /environment: production/);
  assert.match(production, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /expected_sha:/);
  assert.match(production, /actions\/checkout@[\s\S]*?fetch-depth: 0/);
  assert.match(workflow, /git merge-base --is-ancestor "\$REQUESTED_SHA" origin\/main/);
  assert.match(workflow, /PRODUCTION_E2E_GOOGLE_CLIENT_SECRET: \$\{\{ secrets\.PRODUCTION_E2E_GOOGLE_CLIENT_SECRET \}\}/);
  assert.match(workflow, /PRODUCTION_E2E_GOOGLE_REFRESH_TOKEN: \$\{\{ secrets\.PRODUCTION_E2E_GOOGLE_REFRESH_TOKEN \}\}/);
  assert.match(workflow, /PRODUCTION_E2E_EXPECTED_GOOGLE_SUB: \$\{\{ secrets\.PRODUCTION_E2E_EXPECTED_GOOGLE_SUB \}\}/);
  assert.match(workflow, /PRODUCTION_E2E_ID_TOKEN_FILE: \$\{\{ runner\.temp \}\}\/production-record-id-token/);
  assert.match(workflow, /rm -f "\$PRODUCTION_E2E_ID_TOKEN_FILE"/);
  assert.match(workflow, /production-record-idempotency-contract\.json/);
  assert.match(workflow, /production-record-idempotency-smoke\.json/);
  const upload = workflow.slice(workflow.indexOf('- name: Upload sanitized production idempotency evidence'));
  assert.doesNotMatch(upload, /production-record-id-token/);
  assert.doesNotMatch(upload, /PRODUCTION_E2E_GOOGLE_REFRESH_TOKEN/);
});

test('production token mint keeps the credential in a mode-0600 temporary file and validates the production identity contract', async () => {
  const helper = await readFile('tools/mint_production_e2e_id_token.mjs', 'utf8');
  assert.match(helper, /PRODUCTION_E2E_GOOGLE_CLIENT_SECRET/);
  assert.match(helper, /PRODUCTION_E2E_GOOGLE_REFRESH_TOKEN/);
  assert.match(helper, /PRODUCTION_E2E_EXPECTED_GOOGLE_SUB/);
  assert.match(helper, /productionClientIds/);
  assert.match(helper, /mode: 0o600/);
  assert.match(helper, /chmod\(normalizedTokenFile, 0o600\)/);
  assert.match(helper, /AbortSignal\.timeout\(15_000\)/);
  assert.match(helper, /Fresh production Google ID token validated/);
  assert.doesNotMatch(helper, /console\.log\([^\n]*idToken/);
});

test('mints only an expected dedicated production identity into a mode-0600 temporary file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'production-e2e-token-'));
  const tokenFile = join(directory, 'token');
  const now = 1_700_000_000;
  const idToken = jwt({
    iss: 'https://accounts.google.com',
    aud: PRODUCTION_CLIENT_ID,
    sub: 'dedicated-production-test-subject',
    email: 'dedicated-production-test@example.test',
    exp: now + 3600,
  });
  let requestBody = '';
  try {
    const result = await mintProductionE2eIdToken({
      clientId: PRODUCTION_CLIENT_ID,
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      expectedSub: 'dedicated-production-test-subject',
      expectedEmail: 'dedicated-production-test@example.test',
      tokenFile,
      nowSeconds: () => now,
      fetchImpl: async (_url, init) => {
        requestBody = String(init.body);
        return new Response(JSON.stringify({ id_token: idToken }), { status: 200 });
      },
    });
    assert.equal(result.expiresInSeconds, 3600);
    assert.equal(await readFile(tokenFile, 'utf8'), `${idToken}\n`);
    assert.equal((await stat(tokenFile)).mode & 0o777, 0o600);
    assert.match(requestBody, /grant_type=refresh_token/);
    assert.match(requestBody, /client_id=/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('refuses non-production audience and mismatched dedicated identity before persisting a token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'production-e2e-token-reject-'));
  const tokenFile = join(directory, 'token');
  const now = 1_700_000_000;
  try {
    await assert.rejects(
      mintProductionE2eIdToken({
        clientId: '123456789012-stagingclient.apps.googleusercontent.com',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        expectedSub: 'dedicated-production-test-subject',
        tokenFile,
        nowSeconds: () => now,
        fetchImpl: async () => { throw new Error('fetch must not be called'); },
      }),
      /not an allowed production OAuth client/,
    );

    await assert.rejects(
      mintProductionE2eIdToken({
        clientId: PRODUCTION_CLIENT_ID,
        clientSecret: 'client-secret',
        refreshToken: '',
        expectedSub: 'dedicated-production-test-subject',
        tokenFile,
        nowSeconds: () => now,
        fetchImpl: async () => { throw new Error('fetch must not be called'); },
      }),
      /inputs are incomplete/,
    );

    await assert.rejects(
      mintProductionE2eIdToken({
        clientId: PRODUCTION_CLIENT_ID,
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        expectedSub: 'dedicated-production-test-subject',
        tokenFile,
        nowSeconds: () => now,
        fetchImpl: async () => new Response(JSON.stringify({
          id_token: jwt({
            iss: 'https://accounts.google.com',
            aud: PRODUCTION_CLIENT_ID,
            sub: 'wrong-subject',
            exp: now + 3600,
          }),
        }), { status: 200 }),
      }),
      /subject is not the dedicated production test account/,
    );
    await assert.rejects(readFile(tokenFile, 'utf8'), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
