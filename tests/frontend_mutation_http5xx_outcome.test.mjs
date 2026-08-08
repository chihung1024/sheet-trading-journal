import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiApplicationError,
  ApiHttpError,
  formatRequestError,
  isExplicitServerRejection,
  markRequestOutcome,
} from '../src/services/requestErrors.js';

for (const method of ['POST', 'PUT', 'DELETE']) {
  test(`${method} 5xx is ambiguous because HTTP failure does not prove rollback`, () => {
    const error = markRequestOutcome(
      new ApiHttpError('Internal server error', { status: 500, apiCode: 'INTERNAL_ERROR' }),
      method,
    );

    assert.equal(error.outcomeAmbiguous, true);
    assert.equal(isExplicitServerRejection(error), false);
    assert.match(
      formatRequestError(error, { action: '交易操作', method }),
      /結果不確定.*伺服器可能已完成操作.*重新整理確認結果/,
    );
  });
}

test('4xx HTTP and application-level rejection remain definite', () => {
  for (const error of [
    markRequestOutcome(new ApiHttpError('Conflict', { status: 409 }), 'DELETE'),
    markRequestOutcome(new ApiHttpError('Forbidden', { status: 403 }), 'PUT'),
    markRequestOutcome(new ApiApplicationError('Denied'), 'POST'),
  ]) {
    assert.equal(error.outcomeAmbiguous, false);
    assert.equal(isExplicitServerRejection(error), true);
  }
});

test('GET 5xx remains a read failure, not a mutation-outcome ambiguity', () => {
  const error = markRequestOutcome(new ApiHttpError('Unavailable', { status: 503 }), 'GET');
  assert.equal(error.outcomeAmbiguous, false);
  assert.equal(isExplicitServerRejection(error), false);
  assert.equal(formatRequestError(error, { action: '載入資料', method: 'GET' }), 'Unavailable');
});
