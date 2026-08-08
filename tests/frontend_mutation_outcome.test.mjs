import assert from 'node:assert/strict';
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
