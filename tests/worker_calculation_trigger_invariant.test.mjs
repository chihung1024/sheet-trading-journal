import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { __test as canonicalTest } from '../worker.js';

const JOB_ID = 'job_5gkyrzFJcBUb7sTAjPOBfA';

test('queued web jobs may settle directly from calculation result', () => {
  assert.equal(canonicalTest.canTransitionCalculationJob('queued', 'succeeded'), true);
  assert.equal(canonicalTest.canTransitionCalculationJob('queued', 'failed'), true);
  assert.equal(canonicalTest.canTransitionCalculationJob('queued', 'running'), true);
  assert.equal(canonicalTest.canTransitionCalculationJob('succeeded', 'running'), false);
});

test('GitHub dispatch has no application-imposed five-second abort gate', () => {
  const request = canonicalTest.buildGitHubDispatchRequest({
    token: 'test-token',
    benchmark: 'SPY',
    jobId: JOB_ID,
  });

  assert.equal(request.init.method, 'POST');
  assert.equal(Object.hasOwn(request.init, 'signal'), false);
});

test('all workflow triggers reach calculation before lifecycle reporting', async () => {
  const workflow = await readFile(new URL('../.github/workflows/update.yml', import.meta.url), 'utf8');
  const calculationIndex = workflow.indexOf('- name: Run calculation and upload to API');
  const reportIndex = workflow.indexOf('- name: Report calculation job result');

  assert.ok(calculationIndex >= 0, 'calculation step must exist');
  assert.ok(reportIndex > calculationIndex, 'lifecycle reporting must follow calculation');
  assert.doesNotMatch(workflow, /Mark calculation job running/);
});
