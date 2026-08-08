import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  committedMutationOutcome,
  failedMutationOutcome,
  isMutationAmbiguous,
  isMutationCommitted,
  MUTATION_OUTCOME_STATUS,
} from '../src/services/mutationOutcome.js';
import {
  ApiApplicationError,
  ApiHttpError,
  RequestTimeoutError,
  markRequestOutcome,
} from '../src/services/requestErrors.js';

test('committed mutation remains committed even when the follow-up refresh fails', () => {
  const refreshError = new Error('refresh failed');
  const outcome = committedMutationOutcome({
    response: { success: true },
    refreshed: false,
    refreshError,
  });

  assert.equal(outcome.status, MUTATION_OUTCOME_STATUS.COMMITTED);
  assert.equal(outcome.committed, true);
  assert.equal(outcome.outcomeAmbiguous, false);
  assert.equal(outcome.refreshed, false);
  assert.equal(outcome.refreshError, refreshError);
  assert.equal(isMutationCommitted(outcome), true);
  assert.equal(isMutationAmbiguous(outcome), false);
});

test('explicit server rejection is definite rejection, not ambiguous', () => {
  for (const error of [
    markRequestOutcome(new ApiHttpError('Conflict', { status: 409 }), 'POST'),
    markRequestOutcome(new ApiApplicationError('Denied'), 'PUT'),
  ]) {
    const outcome = failedMutationOutcome(error);
    assert.equal(outcome.status, MUTATION_OUTCOME_STATUS.REJECTED);
    assert.equal(outcome.committed, false);
    assert.equal(outcome.outcomeAmbiguous, false);
    assert.equal(isMutationCommitted(outcome), false);
    assert.equal(isMutationAmbiguous(outcome), false);
  }
});

test('mutation timeout remains ambiguous and must not be treated as rejected or committed', () => {
  const error = markRequestOutcome(new RequestTimeoutError(30_000), 'POST');
  const outcome = failedMutationOutcome(error);

  assert.equal(outcome.status, MUTATION_OUTCOME_STATUS.AMBIGUOUS);
  assert.equal(outcome.committed, false);
  assert.equal(outcome.outcomeAmbiguous, true);
  assert.equal(isMutationCommitted(outcome), false);
  assert.equal(isMutationAmbiguous(outcome), true);
});

test('outcomes are immutable so callers cannot rewrite commit truth', () => {
  const outcome = committedMutationOutcome();
  assert.equal(Object.isFrozen(outcome), true);
  assert.throws(() => {
    outcome.status = MUTATION_OUTCOME_STATUS.REJECTED;
  }, TypeError);
});

test('portfolio store preserves the legacy boolean mutation surface while publishing structured truth', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');

  assert.match(source, /const lastRecordMutationOutcome = ref\(null\)/);
  assert.match(source, /const publishRecordMutationOutcome = \(outcome\) => \{/);
  assert.match(source, /lastRecordMutationOutcome\.value = outcome/);
  assert.match(source, /return isMutationCommitted\(outcome\)/);
  assert.match(source, /lastRecordMutationOutcome,/);
  assert.match(source, /failedMutationOutcome\(error\)/);
  assert.match(source, /committedMutationOutcome\(\{/);
});

test('verified mutation commit is separated from follow-up record refresh failure', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const helperStart = source.indexOf('const refreshRecordsAfterCommittedMutation');
  const helperEnd = source.indexOf('const recordMutationFailure', helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);

  const helper = source.slice(helperStart, helperEnd);
  assert.match(helper, /await fetchRecords\(\)/);
  assert.match(helper, /已提交，但交易紀錄重新載入失敗/);
  assert.match(helper, /return \{ refreshed: false, refreshError \}/);

  for (const mutationName of ['addRecord', 'updateRecord', 'deleteRecord']) {
    const start = source.indexOf(`const ${mutationName} = async`);
    const next = source.indexOf('\n    const ', start + 10);
    const block = source.slice(start, next === -1 ? undefined : next);
    assert.match(block, /publishRecordMutationOutcome\(committedMutationOutcome/);
  }
});

test('ambiguous record POST is one-shot and is never auto-retried by the browser store', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const addRecord = async');
  const end = source.indexOf('\n    const updateRecord = async', start);
  const block = source.slice(start, end);

  assert.equal((block.match(/fetchWithAuth\('\/api\/records'/g) || []).length, 1);
  assert.doesNotMatch(block, /while\s*\(/);
  assert.doesNotMatch(block, /for\s*\(/);
  assert.doesNotMatch(block, /retry/i);
  assert.match(block, /recordMutationFailure\(error/);
});

test('DividendManager preserves ambiguous POST semantics instead of relabeling them as failure', async () => {
  const source = await readFile(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');
  assert.match(source, /import \{ isMutationAmbiguous \} from '\.\.\/services\/mutationOutcome\.js'/);
  assert.match(source, /isMutationAmbiguous\(store\.lastRecordMutationOutcome\)/);
  assert.match(source, /伺服器可能已完成新增/);
  assert.match(source, /勿直接再次提交/);

  const falseBranch = source.indexOf('if (!success) {');
  const genericFailure = source.indexOf("throw new Error('無法新增記錄')", falseBranch);
  const ambiguousReturn = source.indexOf('return;', falseBranch);
  assert.notEqual(falseBranch, -1);
  assert.notEqual(genericFailure, -1);
  assert.notEqual(ambiguousReturn, -1);
  assert.equal(ambiguousReturn < genericFailure, true);
});
