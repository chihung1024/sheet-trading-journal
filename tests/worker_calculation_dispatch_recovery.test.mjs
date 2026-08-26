import test from 'node:test';
import assert from 'node:assert/strict';

import { __test as canonicalTest } from '../worker.js';
import {
  isRecoverableDispatchErrorCode,
  tryRecoverAmbiguousCalculationCallback,
} from '../worker-calculation-dispatch-recovery.js';

const JOB_ID = 'job_5gkyrzFJcBUb7sTAjPOBfA';
const RUN_ID = '32870236779';

function statusRequest({ apiKey = 'test-secret', status = 'running', runId = RUN_ID } = {}) {
  return new Request('https://journal-backend.example/api/calculation-jobs/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      job_id: JOB_ID,
      status,
      github_run_id: runId,
      github_run_attempt: 1,
    }),
  });
}

function createRecoveryDb({
  errorCode = 'GITHUB_DISPATCH_TIMEOUT',
  hasOtherActive = false,
  hasNewerJob = false,
} = {}) {
  const row = {
    id: 10,
    public_id: JOB_ID,
    status: 'failed',
    github_run_id: null,
    github_run_attempt: 0,
    attempt_count: 0,
    error_code: errorCode,
    started_at: null,
    completed_at: '2026-08-25 16:09:30',
  };
  let preparedSql = '';
  let prepareCount = 0;

  const db = {
    prepare(sql) {
      prepareCount += 1;
      preparedSql = String(sql);
      return {
        bind(runId, attemptA, attemptB, jobId) {
          return {
            async run() {
              assert.equal(attemptA, attemptB);
              const eligible = row.public_id === jobId
                && row.status === 'failed'
                && isRecoverableDispatchErrorCode(row.error_code)
                && row.github_run_id === null
                && !hasOtherActive
                && !hasNewerJob;
              if (!eligible) return { meta: { changes: 0 } };

              row.status = 'running';
              row.github_run_id = String(runId);
              row.github_run_attempt = Math.max(row.github_run_attempt, Number(attemptA));
              row.attempt_count += 1;
              row.error_code = null;
              row.started_at ||= '2026-08-25 16:09:31';
              row.completed_at = null;
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };

  return {
    db,
    row,
    get preparedSql() {
      return preparedSql;
    },
    get prepareCount() {
      return prepareCount;
    },
  };
}

test('positive GitHub running callback recovers a timeout-terminalized job', async () => {
  const fixture = createRecoveryDb();
  const recovered = await tryRecoverAmbiguousCalculationCallback(
    statusRequest(),
    { DB: fixture.db, API_SECRET: 'test-secret' },
    { canonicalTest },
  );

  assert.equal(recovered, true);
  assert.equal(fixture.row.status, 'running');
  assert.equal(fixture.row.github_run_id, RUN_ID);
  assert.equal(fixture.row.github_run_attempt, 1);
  assert.equal(fixture.row.attempt_count, 1);
  assert.equal(fixture.row.error_code, null);
  assert.equal(fixture.row.completed_at, null);
  assert.match(fixture.preparedSql, /status = 'failed'/);
  assert.match(fixture.preparedSql, /GITHUB_DISPATCH_TIMEOUT/);
  assert.match(fixture.preparedSql, /GITHUB_DISPATCH_FAILED/);
  assert.match(fixture.preparedSql, /github_run_id IS NULL/);
  assert.match(fixture.preparedSql, /active\.status IN \('queued', 'running'\)/);
  assert.match(fixture.preparedSql, /newer\.id > calculation_jobs\.id/);
});

test('explicit GitHub rejection is not recoverable by a later callback', async () => {
  const fixture = createRecoveryDb({ errorCode: 'GITHUB_DISPATCH_REJECTED' });
  const recovered = await tryRecoverAmbiguousCalculationCallback(
    statusRequest(),
    { DB: fixture.db, API_SECRET: 'test-secret' },
    { canonicalTest },
  );

  assert.equal(recovered, false);
  assert.equal(fixture.row.status, 'failed');
  assert.equal(fixture.row.github_run_id, null);
});

test('late ambiguous callback cannot create a second active calculation', async () => {
  const fixture = createRecoveryDb({ hasOtherActive: true });
  const recovered = await tryRecoverAmbiguousCalculationCallback(
    statusRequest(),
    { DB: fixture.db, API_SECRET: 'test-secret' },
    { canonicalTest },
  );

  assert.equal(recovered, false);
  assert.equal(fixture.row.status, 'failed');
  assert.equal(fixture.row.github_run_id, null);
});

test('a newer same-benchmark intent supersedes the delayed callback', async () => {
  const fixture = createRecoveryDb({ hasNewerJob: true });
  const recovered = await tryRecoverAmbiguousCalculationCallback(
    statusRequest(),
    { DB: fixture.db, API_SECRET: 'test-secret' },
    { canonicalTest },
  );

  assert.equal(recovered, false);
  assert.equal(fixture.row.status, 'failed');
  assert.equal(fixture.row.github_run_id, null);
});

test('recovery mutation requires the trusted system API key', async () => {
  const fixture = createRecoveryDb();
  const recovered = await tryRecoverAmbiguousCalculationCallback(
    statusRequest({ apiKey: 'wrong-secret' }),
    { DB: fixture.db, API_SECRET: 'test-secret' },
    { canonicalTest },
  );

  assert.equal(recovered, false);
  assert.equal(fixture.prepareCount, 0);
  assert.equal(fixture.row.status, 'failed');
});
