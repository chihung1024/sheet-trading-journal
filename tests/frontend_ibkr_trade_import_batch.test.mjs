import assert from 'node:assert/strict';
import test from 'node:test';

import { runIbkrTradeImportBatch } from '../src/services/ibkrTradeImportBatch.js';

const entries = Object.freeze([
  Object.freeze({ idempotencyKey: 'IBKR~ORDER~A', record: Object.freeze({ symbol: 'AAPL' }) }),
  Object.freeze({ idempotencyKey: 'IBKR~ORDER~B', record: Object.freeze({ symbol: 'MSFT' }) }),
]);

const committed = deduplicated => Object.freeze({ committed: true, deduplicated });

const deps = (createRecord, { refreshError = null, updateError = null } = {}) => {
  const calls = { create: 0, refresh: 0, update: 0 };
  return {
    calls,
    options: {
      async createRecord(entry, index) {
        calls.create += 1;
        return createRecord(entry, index);
      },
      async refreshRecords() {
        calls.refresh += 1;
        if (refreshError) throw refreshError;
      },
      async requestUpdate() {
        calls.update += 1;
        if (updateError) throw updateError;
      },
    },
  };
};

test('new and replayed rows are counted while a created batch performs one readback and one update', async () => {
  const fixture = deps(async (_entry, index) => committed(index === 1));
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'committed');
  assert.equal(result.processed, 2);
  assert.equal(result.created, 1);
  assert.equal(result.replayed, 1);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 1 });
});

test('replay-only batch refreshes ledger view but never starts a new portfolio update', async () => {
  const fixture = deps(async () => committed(true));
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'replayed');
  assert.equal(result.created, 0);
  assert.equal(result.replayed, 2);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 0 });
});

test('definite partial failure stops later writes but still syncs a committed prefix exactly once', async () => {
  const failure = Object.assign(new Error('rejected'), { outcomeAmbiguous: false });
  const fixture = deps(async (_entry, index) => {
    if (index === 1) throw failure;
    return committed(false);
  });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'partial_failure');
  assert.equal(result.processed, 1);
  assert.equal(result.created, 1);
  assert.equal(result.failure.index, 1);
  assert.equal(result.failure.outcomeAmbiguous, false);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 1 });
});

test('ambiguous first write is treated as possible ledger mutation and gets one readback plus one update', async () => {
  const failure = Object.assign(new Error('network lost'), { outcomeAmbiguous: true });
  const fixture = deps(async () => { throw failure; });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'partial_failure');
  assert.equal(result.processed, 0);
  assert.equal(result.created, 0);
  assert.equal(result.failure.outcomeAmbiguous, true);
  assert.deepEqual(fixture.calls, { create: 1, refresh: 1, update: 1 });
});

test('definite failure before any possible write does not trigger unnecessary readback or update', async () => {
  const failure = Object.assign(new Error('invalid'), { outcomeAmbiguous: false });
  const fixture = deps(async () => { throw failure; });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'failed');
  assert.deepEqual(fixture.calls, { create: 1, refresh: 0, update: 0 });
});

test('readback failure after confirmed writes does not suppress the one portfolio update or erase commit truth', async () => {
  const readbackError = new Error('readback unavailable');
  const fixture = deps(async () => committed(false), { refreshError: readbackError });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'committed_with_sync_warning');
  assert.equal(result.created, 2);
  assert.equal(result.sync.readbackError, readbackError);
  assert.equal(result.sync.updateError, null);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 1 });
});

test('update failure after confirmed writes is a sync warning rather than a false write failure', async () => {
  const updateError = new Error('update unavailable');
  const fixture = deps(async () => committed(false), { updateError });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'committed_with_sync_warning');
  assert.equal(result.processed, 2);
  assert.equal(result.created, 2);
  assert.equal(result.failure, null);
  assert.equal(result.sync.updateError, updateError);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 1 });
});

test('replay-only readback failure remains replay truth and does not create a calculation job', async () => {
  const fixture = deps(async () => committed(true), { refreshError: new Error('readback unavailable') });
  const result = await runIbkrTradeImportBatch(entries, fixture.options);

  assert.equal(result.status, 'replayed_with_sync_warning');
  assert.equal(result.created, 0);
  assert.equal(result.replayed, 2);
  assert.deepEqual(fixture.calls, { create: 2, refresh: 1, update: 0 });
});
