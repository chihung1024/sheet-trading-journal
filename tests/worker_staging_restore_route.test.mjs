import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatStagingResponseDiagnostic,
  validateStagingRestoreRoute,
} from '../tools/verify_staging_restore_route.mjs';

const SOURCE_SHA = '6380e9f7cd12cb863e14b1d8e7e37d8af5ca88e2';
const VALID_HEADERS = [
  'HTTP/2 405',
  'x-deployment-environment: staging',
  'x-worker-service: journal-backend-staging',
  `x-source-commit: ${SOURCE_SHA}`,
  '',
].join('\r\n');

test('staging restore route probe requires exact source and non-mutating 405 semantics', () => {
  const result = validateStagingRestoreRoute({
    status: '405',
    headers: VALID_HEADERS,
    body: JSON.stringify({ error: 'Method not allowed' }),
    expectedSha: SOURCE_SHA,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.sourceCommit, SOURCE_SHA);
});

test('staging restore route probe rejects stale source, missing identity, wrong status, and wrong body', () => {
  const stale = validateStagingRestoreRoute({
    status: 404,
    headers: [
      'HTTP/2 404',
      'x-deployment-environment: staging',
      'x-worker-service: journal-backend-staging',
      'x-source-commit: 1111111111111111111111111111111111111111',
      '',
    ].join('\r\n'),
    body: JSON.stringify({ error: 'Not found' }),
    expectedSha: SOURCE_SHA,
  });

  assert.equal(stale.ok, false);
  assert.ok(stale.errors.some(error => error.includes('HTTP 404')));
  assert.ok(stale.errors.some(error => error.includes('different source commit')));
  assert.ok(stale.errors.some(error => error.includes('method rejection')));

  const missingIdentity = validateStagingRestoreRoute({
    status: 405,
    headers: 'HTTP/2 405\r\n',
    body: JSON.stringify({ error: 'Method not allowed' }),
    expectedSha: SOURCE_SHA,
  });
  assert.equal(missingIdentity.ok, false);
  assert.ok(missingIdentity.errors.some(error => error.includes('identified as staging')));
  assert.ok(missingIdentity.errors.some(error => error.includes('service identity')));
});

test('staging response diagnostics are bounded to safe public runtime identity and error fields', () => {
  const headers = new Headers({
    'X-Source-Commit': SOURCE_SHA,
    'X-Deployment-Environment': 'staging',
    'X-Worker-Service': 'journal-backend-staging',
    Authorization: 'Bearer must-not-appear',
  });
  const diagnostic = formatStagingResponseDiagnostic({
    status: 409,
    headers,
    payload: {
      error: 'Destination is not empty\nmalformed-log-line',
      error_meta: { code: 'RESTORE_DESTINATION_NOT_EMPTY' },
      tenant: 'must-not-appear',
      token: 'must-not-appear',
    },
  });

  assert.match(diagnostic, /^HTTP 409 /);
  assert.match(diagnostic, new RegExp(`source=${SOURCE_SHA}`));
  assert.match(diagnostic, /environment=staging/);
  assert.match(diagnostic, /worker=journal-backend-staging/);
  assert.match(diagnostic, /code=RESTORE_DESTINATION_NOT_EMPTY/);
  assert.match(diagnostic, /Destination is not empty\?malformed-log-line/);
  assert.doesNotMatch(diagnostic, /Bearer/);
  assert.doesNotMatch(diagnostic, /tenant/);
  assert.doesNotMatch(diagnostic, /token/);
});
