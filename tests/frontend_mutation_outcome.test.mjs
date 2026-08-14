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
  const end = source.indexOf('const postRecordCreateIntent', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);

  assert.match(block, /const outcome = failedMutationOutcome\(error\)/);
  assert.match(block, /outcome\.outcomeAmbiguous \? 'warning' : 'error'/);
  assert.match(block, /return resolveRecordMutationOutcome\(outcome, options\)/);
});

test('record create transport uses only rollback-safe idempotent path with exact stored key and body', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const postRecordCreateIntent');
  const end = source.indexOf('const settleRecordCreateIntentFailure', start);
  const block = source.slice(start, end);

  assert.match(block, /fetchWithAuth\('\/api\/records\/idempotent'/);
  assert.match(block, /'Idempotency-Key': intent\.idempotencyKey/);
  assert.match(block, /body: intent\.body/);
  assert.doesNotMatch(block, /fetchWithAuth\('\/api\/records'/);
  assert.doesNotMatch(block, /fallback/i);
});

test('addRecord persists durable intent before its one POST and clears replay eligibility before refresh', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const block = mutationBlock(source, 'addRecord', 'updateRecord = async');

  const persistAt = block.indexOf('beginRecordCreateIntent(');
  const postAt = block.indexOf('postRecordCreateIntent(intent)');
  const completeAt = block.indexOf('completeRecordCreateIntent(');
  const refreshAt = block.indexOf("refreshRecordsAfterCommittedMutation('新增交易'");
  assert.equal(persistAt >= 0, true);
  assert.equal(postAt > persistAt, true);
  assert.equal(completeAt > postAt, true);
  assert.equal(refreshAt > completeAt, true);
  assert.equal((block.match(/postRecordCreateIntent\(intent\)/g) || []).length, 1);
  assert.match(block, /completeRecordCreateIntent\(localStorage, intent\.owner, intent\.idempotencyKey\)/);
  assert.doesNotMatch(block, /while\s*\(/);
  assert.doesNotMatch(block, /for\s*\(/);
});

test('ambiguous record POST remains one-shot and retains the exact durable intent for recovery', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const settleStart = source.indexOf('const settleRecordCreateIntentFailure');
  const settleEnd = source.indexOf('const supersedePendingRecordCreateRecovery', settleStart);
  const settleBlock = source.slice(settleStart, settleEnd);
  assert.match(settleBlock, /error\?\.outcomeAmbiguous === true\) return/);
  assert.match(settleBlock, /intent\.owner/);

  const addBlock = mutationBlock(source, 'addRecord', 'updateRecord = async');
  assert.match(addBlock, /settleRecordCreateIntentFailure\(intent, error\)/);
  assert.match(addBlock, /recordMutationFailure\(error/);
  assert.doesNotMatch(addBlock, /retry/i);
});

test('recovery is bounded once per intent per store lifetime and a later intent remains eligible', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const recoverPendingRecordCreateIntent');
  const end = source.indexOf('const addRecord = async', start);
  const block = source.slice(start, end);

  assert.match(block, /readEligibleRecordCreateIntents\(localStorage, owner\)/);
  assert.match(block, /lastRecordCreateRecoveryKey === intent\.idempotencyKey/);
  assert.match(block, /lastRecordCreateRecoveryKey = intent\.idempotencyKey/);
  assert.match(block, /json = await postRecordCreateIntent\(intent\)/);
  assert.match(block, /completeRecordCreateIntent\(localStorage, intent\.owner, intent\.idempotencyKey\)/);
  assert.doesNotMatch(source, /didAttemptRecordCreateRecovery/);
  assert.doesNotMatch(block, /while\s*\(/);
  assert.doesNotMatch(block, /setTimeout/);
});

test('explicit 4xx including rollback-safe 404 and idempotency 409 become terminal without key rotation or legacy fallback', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const settleStart = source.indexOf('const settleRecordCreateIntentFailure');
  const settleEnd = source.indexOf('const supersedePendingRecordCreateRecovery', settleStart);
  const block = source.slice(settleStart, settleEnd);

  assert.match(block, /markRecordCreateIntentTerminal/);
  assert.match(block, /intent\.owner/);
  assert.match(block, /error\?\.apiCode/);
  assert.match(block, /error\?\.status/);
  assert.doesNotMatch(block, /beginRecordCreateIntent/);
  assert.doesNotMatch(block, /createOpaqueId/);

  const transportStart = source.indexOf('const postRecordCreateIntent');
  const transportEnd = source.indexOf('const settleRecordCreateIntentFailure', transportStart);
  assert.doesNotMatch(source.slice(transportStart, transportEnd), /'\/api\/records'/);
});

test('token refresh recursion reuses the exact endpoint and options object so create key and body are stable', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const fetchWithAuth');
  const end = source.indexOf('const resetData', start);
  const block = source.slice(start, end);

  assert.match(block, /if \(refreshed\) return fetchWithAuth\(endpoint, options, false\)/);
  assert.doesNotMatch(block, /JSON\.stringify\(options/);
});

test('later update and delete supersede an eligible old create before their network mutation', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const updateBlock = mutationBlock(source, 'updateRecord', 'deleteRecord = async');
  const deleteBlock = mutationBlock(source, 'deleteRecord', 'availableGroups = computed');

  for (const [block, method] of [[updateBlock, 'PUT'], [deleteBlock, 'DELETE']]) {
    const barrierAt = block.indexOf('supersedePendingRecordCreateRecovery()');
    const requestAt = block.indexOf("fetchWithAuth('/api/records'");
    assert.equal(barrierAt >= 0, true);
    assert.equal(requestAt > barrierAt, true);
    assert.match(block, new RegExp(`method: '${method}'`));
  }
});

test('fetchAll attempts same-owner record-create recovery before reading records', async () => {
  const source = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const start = source.indexOf('const performFetchAll');
  const end = source.indexOf('const fetchAll = createSingleFlight', start);
  const block = source.slice(start, end);
  assert.equal(block.indexOf('await recoverPendingRecordCreateIntent()') >= 0, true);
  assert.equal(block.indexOf('await fetchRecords()') > block.indexOf('await recoverPendingRecordCreateIntent()'), true);
});

test('DividendManager consumes its own call-local outcome and preserves ambiguous POST semantics', async () => {
  const source = await readFile(new URL('../src/components/DividendManager.vue', import.meta.url), 'utf8');
  assert.match(source, /isMutationAmbiguous/);
  assert.match(source, /isMutationCommitted/);
  assert.match(source, /store\.addRecord\(record, \{ returnOutcome: true \}\)/);
  assert.match(source, /if \(!isMutationCommitted\(outcome\)\) \{/);
  assert.match(source, /if \(isMutationAmbiguous\(outcome\)\) \{/);
  assert.doesNotMatch(source, /lastRecordMutationOutcome/);
  assert.match(source, /系統正在使用原交易識別碼自動確認/);
  assert.match(source, /請勿重複提交/);

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
