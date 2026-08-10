import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker-entry.js';

const JOB_ID = 'job_ABCDEFGHIJKLMNOPQRSTUV';
const OWNER = 'secret@example.com';
const API_SECRET = 'compat-system-secret-0123456789';

function compatDb() {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      assert.match(normalized, /FROM calculation_jobs/);
      assert.match(normalized, /WHERE public_id = \?/);
      assert.doesNotMatch(normalized, /user_id = \?/);
      return {
        bind(publicId) {
          assert.equal(publicId, JOB_ID);
          return {
            async first() {
              return {
                public_id: JOB_ID,
                user_id: OWNER,
                status: 'queued',
                benchmark: 'SPY',
              };
            },
          };
        },
      };
    },
  };
}

const ctx = { waitUntil() {} };

test('pre-cutover entrypoint resolves opaque job owner for trusted system only', async () => {
  const response = await worker.fetch(
    new Request(`https://worker.invalid/api/calculation-jobs/${JOB_ID}`, {
      headers: { 'X-API-KEY': API_SECRET },
    }),
    { API_SECRET, DB: compatDb() },
    ctx,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    job: {
      id: JOB_ID,
      target_user_id: OWNER,
      benchmark: 'SPY',
      status: 'queued',
    },
  });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('invalid system key is not accepted by the compatibility route', async () => {
  const response = await worker.fetch(
    new Request(`https://worker.invalid/api/calculation-jobs/${JOB_ID}`, {
      headers: { 'X-API-KEY': 'wrong-system-secret' },
    }),
    { API_SECRET, DB: compatDb() },
    ctx,
  );

  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error_meta.code, 'UNAUTHORIZED');
  assert.equal(JSON.stringify(payload).includes(OWNER), false);
});

test('explicit origin policy rejects browser origin before compatibility lookup', async () => {
  const response = await worker.fetch(
    new Request(`https://worker.invalid/api/calculation-jobs/${JOB_ID}`, {
      headers: {
        'X-API-KEY': API_SECRET,
        Origin: 'https://forbidden.example.com',
      },
    }),
    {
      API_SECRET,
      DB: compatDb(),
      ALLOWED_ORIGINS: 'https://allowed.example.com',
    },
    ctx,
  );

  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.error_meta.code, 'ORIGIN_FORBIDDEN');
});
