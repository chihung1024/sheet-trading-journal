import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatGroupBatchFailureMessage,
  summarizeGroupBatchFailure,
} from '../src/services/groupMutationOrchestration.js';

test('verified partial commits require recalculation', () => {
  const summary = summarizeGroupBatchFailure({
    succeeded: 2,
    total: 4,
    failedRecordId: 3,
    failedOutcomeAmbiguous: false,
  }, { refreshed: true });

  assert.deepEqual(summary, {
    succeeded: 2,
    total: 4,
    failedRecordId: 3,
    failedOutcomeAmbiguous: false,
    refreshed: true,
    mutationMayHaveCommitted: true,
    shouldRecalculate: true,
  });
  assert.equal(Object.isFrozen(summary), true);
  assert.match(formatGroupBatchFailureMessage(summary), /已更新 2\/4 筆/);
  assert.match(formatGroupBatchFailureMessage(summary), /已重新載入目前狀態/);
});

test('ambiguous failed row requires recalculation even with zero verified prefix', () => {
  const summary = summarizeGroupBatchFailure({
    succeeded: 0,
    total: 3,
    failedRecordId: 1,
    failedOutcomeAmbiguous: true,
  }, { refreshed: false });

  assert.equal(summary.mutationMayHaveCommitted, true);
  assert.equal(summary.shouldRecalculate, true);
  assert.equal(summary.refreshed, false);
  const message = formatGroupBatchFailureMessage(summary);
  assert.match(message, /結果不確定/);
  assert.match(message, /可能已由伺服器完成/);
  assert.match(message, /畫面未能重新載入/);
  assert.match(message, /請勿直接重送整批/);
});

test('definite zero-progress rejection does not require recalculation', () => {
  const summary = summarizeGroupBatchFailure({
    succeeded: 0,
    total: 3,
    failedRecordId: 1,
    failedOutcomeAmbiguous: false,
  }, { refreshed: true });

  assert.equal(summary.mutationMayHaveCommitted, false);
  assert.equal(summary.shouldRecalculate, false);
  const message = formatGroupBatchFailureMessage(summary);
  assert.match(message, /更新失敗/);
  assert.match(message, /已重新載入目前狀態/);
  assert.doesNotMatch(message, /結果不確定/);
});
