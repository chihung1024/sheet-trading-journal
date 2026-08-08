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

const mutationBlock = (source, name, nextName) => {
  const start = source.indexOf(`const ${name} = async`);
  const end = source.indexOf(`\n    const ${nextName}`, start);
  assert.notEqual(start, -1, `${name} source block missing`);
  assert.notEqual(end, -1, `${name} end boundary missing`);
  return source.slice(start, end);
};

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

test('outcomes are immutable and independent so callers cannot rewrite or race commit truth', () => {
  const first = committedMutationOutcome({ response: { id: 1 } });
  const second = failedMutationOutcome(markRequestOutcome(new RequestTimeoutError(30_000), 'POST'));

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(second), true);
  assert.equal(first.status, MUTATION_OUTCOME_STATUS.COMMITTED);
  assert.equal(second.status, MUTATION_OUTCOME_STATUS.AMBIGUOUS);
  assert.notStrictEqual(first, second);
  assert.throws(() => {
    first.status = MUTATION_OUTCOME_STATUS.REJECTED;
  }, TypeError);
});

test('portfolio store preserves legacy booleans while allowing call-local structured outcomes', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');

  assert.match(source, /const resolveRecordMutationOutcome = \(outcome, \{ returnOutcome = false \} = \{\}\) => \(/);
  assert.match(source, /returnOutcome \? outcome : isMutationCommitted\(outcome\)/);
  assert.match(source, /const addRecord = async \(formData, options = \{\}\) =>/);
  assert.match(source, /const updateRecord = async \(formData, options = \{\}\) =>/);
  assert.match(source, /const deleteRecord = async \(id, options = \{\}\) =>/);
  assert.match(source, /failedMutationOutcome\(error\)/);
  assert.match(source, /committedMutationOutcome\(\{/);
  assert.doesNotMatch(source, /lastRecordMutationOutcome/);
  assert.doesNotMatch(source, /publishRecordMutationOutcome/);
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

  const addBlock = mutationBlock(source, 'addRecord', 'updateRecord = async');
  const updateBlock = mutationBlock(source, 'updateRecord', 'deleteRecord = async');
  const deleteBlock = mutationBlock(source, 'deleteRecord', 'availableGroups = computed');
  for (const block of [addBlock, updateBlock, deleteBlock]) {
    assert.match(block, /return resolveRecordMutationOutcome\(committedMutationOutcome\(\{/);
    assert.match(block, /refreshed: refresh\.refreshed|refreshed: true/);
  }
});

test('ambiguous mutation feedback is warning-level while definite rejection remains error-level', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const recordMutationFailure');
  const end = source.indexOf('const addRecord = async', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);

  assert.match(block, /const outcome = failedMutationOutcome\(error\)/);
  assert.match(block, /outcome\.outcomeAmbiguous \? 'warning' : 'error'/);
  assert.match(block, /return resolveRecordMutationOutcome\(outcome, options\)/);
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

test('DividendManager consumes its own call-local outcome and preserves ambiguous POST semantics', async () => {
  const source = await readFile(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');
  assert.match(source, /isMutationAmbiguous/);
  assert.match(source, /isMutationCommitted/);
  assert.match(source, /store\.addRecord\(record, \{ returnOutcome: true \}\)/);
  assert.match(source, /if \(!isMutationCommitted\(outcome\)\) \{/);
  assert.match(source, /if \(isMutationAmbiguous\(outcome\)\) \{/);
  assert.doesNotMatch(source, /lastRecordMutationOutcome/);
  assert.match(source, /伺服器可能已完成新增/);
  assert.match(source, /勿直接再次提交/);

  const committedCheck = source.indexOf('if (!isMutationCommitted(outcome)) {');
  const ambiguousCheck = source.indexOf('if (isMutationAmbiguous(outcome)) {', committedCheck);
  const genericFailure = source.indexOf("throw new Error('無法新增記錄')", committedCheck);
  const ambiguousReturn = source.indexOf('return;', ambiguousCheck);
  assert.notEqual(committedCheck, -1);
  assert.notEqual(ambiguousCheck, -1);
  assert.notEqual(genericFailure, -1);
  assert.notEqual(ambiguousReturn, -1);
  assert.equal(ambiguousCheck < genericFailure, true);
  assert.equal(ambiguousReturn < genericFailure, true);
});
