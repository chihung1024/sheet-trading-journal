import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REJECTED_ORIGINS,
  STAGING_ORIGIN,
  validateStagingCorsDeployment,
} from '../tools/verify_staging_cors_deployment.mjs';

const IDENTITY_HEADERS = [
  'X-Deployment-Environment: staging',
  'X-Worker-Service: journal-backend-staging',
].join('\r\n');

function validInput() {
  return {
    allowed: {
      origin: STAGING_ORIGIN,
      status: 204,
      headers: [
        'HTTP/2 204',
        `Access-Control-Allow-Origin: ${STAGING_ORIGIN}`,
        'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS',
        'Vary: Origin',
        IDENTITY_HEADERS,
        '',
      ].join('\r\n'),
      body: '',
    },
    rejected: REJECTED_ORIGINS.map(([, origin]) => ({
      origin,
      status: 403,
      headers: [
        'HTTP/2 403',
        'Content-Type: application/json; charset=utf-8',
        IDENTITY_HEADERS,
        '',
      ].join('\r\n'),
      body: JSON.stringify({
        success: false,
        error: 'Origin not allowed',
        error_meta: { code: 'ORIGIN_FORBIDDEN' },
      }),
    })),
  };
}

test('live staging CORS verifier accepts the exact reviewed origin matrix', () => {
  assert.deepEqual(validateStagingCorsDeployment(validInput()), { ok: true, errors: [] });
});

test('live staging CORS verifier rejects permissive or wrong allowed responses', () => {
  const wildcard = validInput();
  wildcard.allowed.headers = wildcard.allowed.headers.replace(
    `Access-Control-Allow-Origin: ${STAGING_ORIGIN}`,
    'Access-Control-Allow-Origin: *',
  );
  assert.equal(validateStagingCorsDeployment(wildcard).ok, false);

  const wrongStatus = validInput();
  wrongStatus.allowed.status = 200;
  assert.equal(validateStagingCorsDeployment(wrongStatus).ok, false);

  const wrongIdentity = validInput();
  wrongIdentity.allowed.headers = wrongIdentity.allowed.headers.replace(
    'X-Deployment-Environment: staging',
    'X-Deployment-Environment: production',
  );
  assert.equal(validateStagingCorsDeployment(wrongIdentity).ok, false);
});

test('live staging CORS verifier rejects leaked CORS headers and malformed denials', () => {
  const leaked = validInput();
  leaked.rejected[0].headers += `\r\nAccess-Control-Allow-Origin: ${STAGING_ORIGIN}`;
  assert.equal(validateStagingCorsDeployment(leaked).ok, false);

  const wrongCode = validInput();
  wrongCode.rejected[1].body = JSON.stringify({ error_meta: { code: 'OTHER_ERROR' } });
  assert.equal(validateStagingCorsDeployment(wrongCode).ok, false);

  const missingProbe = validInput();
  missingProbe.rejected.pop();
  assert.equal(validateStagingCorsDeployment(missingProbe).ok, false);
});
