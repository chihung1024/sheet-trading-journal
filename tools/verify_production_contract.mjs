#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const SHA_RE = /^[0-9a-f]{40}$/;

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const json = async (response, label) => {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label} returned non-JSON`);
  }
  return body;
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const originLabel = (origin) => new URL(origin).host;

export async function verifyProductionContract({
  baseUrl,
  expectedSha,
  expectedService,
  expectedRelease,
  expectedApi,
  expectedSchema,
  apiKey = '',
  requireSystemChecks = false,
  allowedOrigins = [],
  rejectedOrigins = [],
  fetchImpl = fetch,
}) {
  const base = baseUrl.replace(/\/$/, '');
  const normalizedSha = String(expectedSha || '').trim().toLowerCase();
  expect(SHA_RE.test(normalizedSha), 'expected source SHA must be an exact 40-character Git commit SHA');
  expect(String(expectedService || '').trim().length > 0, 'expected runtime service is required');
  expect(String(expectedRelease || '').trim().length > 0, 'expected release version is required');
  expect(String(expectedApi || '').trim().length > 0, 'expected API version is required');
  expect(Number.isInteger(Number(expectedSchema)), 'expected schema version must be an integer');
  if (requireSystemChecks) expect(String(apiKey || '').trim().length > 0, 'API_KEY is required for production system checks');

  const request = async (path, init = {}) => fetchImpl(`${base}${path}`, {
    redirect: 'error',
    cache: 'no-store',
    ...init,
  });

  const versionResponse = await request('/api/version');
  expect(versionResponse.status === 200, `version status=${versionResponse.status}`);
  const version = await json(versionResponse, 'version');
  expect(version.success === true && version.status === 'ok', 'version payload is not healthy');
  expect(version.service === expectedService, 'runtime service mismatch');
  expect(version.source_commit === normalizedSha, 'version source_commit mismatch');
  expect(version.release_version === expectedRelease, 'release version mismatch');
  expect(version.api_version === expectedApi, 'API version mismatch');
  expect(String(version.schema_version) === String(expectedSchema), 'schema version mismatch');
  expect(typeof version.worker_version?.id === 'string' && version.worker_version.id.length > 0, 'Worker version ID is missing');

  const healthResponse = await request('/api/health');
  expect(healthResponse.status === 200, `health status=${healthResponse.status}`);
  const health = await json(healthResponse, 'health');
  expect(health.success === true && health.status === 'ok', 'health payload is not healthy');
  expect(health.source_commit === normalizedSha, 'health source_commit mismatch');
  expect(health.checks?.database === 'ok', 'database health is not ok');
  expect(health.checks?.schema === 'ok', 'schema health is not ok');
  expect(String(health.observed_schema_version) === String(expectedSchema), 'observed schema mismatch');

  const anonymous = await request('/api/records?limit=1');
  expect(anonymous.status === 401, `anonymous records status=${anonymous.status}`);

  const cors = { allowed: [], rejected: [] };
  for (const origin of allowedOrigins) {
    const response = await request('/api/records?limit=1', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(response.status === 204, `allowed CORS origin ${originLabel(origin)} status=${response.status}`);
    expect(response.headers.get('access-control-allow-origin') === origin, `allowed CORS origin ${originLabel(origin)} was not echoed exactly`);
    cors.allowed.push({ origin, status: response.status });
  }
  for (const origin of rejectedOrigins) {
    const response = await request('/api/records?limit=1', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(response.status === 403, `rejected CORS origin ${originLabel(origin)} status=${response.status}`);
    expect(!response.headers.get('access-control-allow-origin'), `rejected CORS origin ${originLabel(origin)} received an allow-origin header`);
    cors.rejected.push({ origin, status: response.status });
  }

  const evidence = {
    audited_at: new Date().toISOString(),
    source_commit: normalizedSha,
    runtime_service: expectedService,
    worker_version_id: version.worker_version.id,
    release_version: expectedRelease,
    api_version: expectedApi,
    schema_version: Number(expectedSchema),
    version_status: versionResponse.status,
    health_status: healthResponse.status,
    anonymous_records_status: anonymous.status,
    cors,
    system_checks: apiKey ? 'executed' : 'skipped',
  };

  if (apiKey) {
    const headers = { 'X-API-KEY': apiKey };
    const recordsResponse = await request('/api/records?limit=1', { headers });
    expect(recordsResponse.status === 200, `system records status=${recordsResponse.status}`);
    const records = await json(recordsResponse, 'system records');
    expect(records.success === true && Array.isArray(records.data), 'system records payload invalid');

    const settingsResponse = await request('/api/user-settings', { headers });
    expect(settingsResponse.status === 400, `system settings without tenant status=${settingsResponse.status}`);

    evidence.system_records_status = recordsResponse.status;
    evidence.system_settings_without_tenant_status = settingsResponse.status;
  }

  return evidence;
}

async function loadEnvironmentContract() {
  const raw = await readFile(new URL('../config/deployment-environments.json', import.meta.url), 'utf8');
  const contract = JSON.parse(raw);
  const allowedOrigins = contract?.production?.frontend_origins;
  const stagingOrigin = contract?.staging?.frontend_origin;
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0 || !stagingOrigin) {
    throw new Error('deployment environment contract is incomplete');
  }
  return {
    allowedOrigins,
    rejectedOrigins: [stagingOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  };
}

async function main() {
  const environment = await loadEnvironmentContract();
  const evidence = await verifyProductionContract({
    baseUrl: required('WORKER_BASE_URL'),
    expectedSha: required('EXPECTED_SHA'),
    expectedService: required('EXPECTED_RUNTIME_SERVICE'),
    expectedRelease: required('EXPECTED_RELEASE_VERSION'),
    expectedApi: required('EXPECTED_API_VERSION'),
    expectedSchema: required('EXPECTED_SCHEMA_VERSION'),
    apiKey: String(process.env.API_KEY || '').trim(),
    requireSystemChecks: String(process.env.REQUIRE_SYSTEM_CHECKS || '') === '1',
    allowedOrigins: environment.allowedOrigins,
    rejectedOrigins: environment.rejectedOrigins,
  });
  const output = String(process.env.AUDIT_OUTPUT || '').trim();
  if (output) await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(`Production contract audit passed: source=${evidence.source_commit} service=${evidence.runtime_service} release=${evidence.release_version} api=${evidence.api_version} schema=${evidence.schema_version} system_checks=${evidence.system_checks}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Production contract audit failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
