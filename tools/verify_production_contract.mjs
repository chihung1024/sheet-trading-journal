#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

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

export async function verifyProductionContract({
  baseUrl,
  expectedSha,
  expectedRelease,
  expectedApi,
  expectedSchema,
  apiKey = '',
  fetchImpl = fetch,
}) {
  const base = baseUrl.replace(/\/$/, '');
  const request = async (path, init = {}) => fetchImpl(`${base}${path}`, {
    redirect: 'error',
    cache: 'no-store',
    ...init,
  });

  const versionResponse = await request('/api/version');
  expect(versionResponse.status === 200, `version status=${versionResponse.status}`);
  const version = await json(versionResponse, 'version');
  expect(version.success === true && version.status === 'ok', 'version payload is not healthy');
  expect(version.source_commit === expectedSha, 'version source_commit mismatch');
  expect(version.release_version === expectedRelease, 'release version mismatch');
  expect(version.api_version === expectedApi, 'API version mismatch');
  expect(String(version.schema_version) === String(expectedSchema), 'schema version mismatch');

  const healthResponse = await request('/api/health');
  expect(healthResponse.status === 200, `health status=${healthResponse.status}`);
  const health = await json(healthResponse, 'health');
  expect(health.success === true && health.status === 'ok', 'health payload is not healthy');
  expect(health.source_commit === expectedSha, 'health source_commit mismatch');
  expect(health.checks?.database === 'ok', 'database health is not ok');
  expect(health.checks?.schema === 'ok', 'schema health is not ok');
  expect(String(health.observed_schema_version) === String(expectedSchema), 'observed schema mismatch');

  const anonymous = await request('/api/records?limit=1');
  expect(anonymous.status === 401, `anonymous records status=${anonymous.status}`);

  const evidence = {
    audited_at: new Date().toISOString(),
    source_commit: expectedSha,
    release_version: expectedRelease,
    api_version: expectedApi,
    schema_version: Number(expectedSchema),
    version_status: versionResponse.status,
    health_status: healthResponse.status,
    anonymous_records_status: anonymous.status,
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

async function main() {
  const evidence = await verifyProductionContract({
    baseUrl: required('WORKER_BASE_URL'),
    expectedSha: required('EXPECTED_SHA'),
    expectedRelease: required('EXPECTED_RELEASE_VERSION'),
    expectedApi: required('EXPECTED_API_VERSION'),
    expectedSchema: required('EXPECTED_SCHEMA_VERSION'),
    apiKey: String(process.env.API_KEY || '').trim(),
  });
  const output = String(process.env.AUDIT_OUTPUT || '').trim();
  if (output) await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(`Production contract audit passed: source=${evidence.source_commit} release=${evidence.release_version} api=${evidence.api_version} schema=${evidence.schema_version} system_checks=${evidence.system_checks}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Production contract audit failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
