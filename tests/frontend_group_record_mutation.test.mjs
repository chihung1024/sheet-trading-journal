import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildRecordTagUpdatePayload,
  PartialRecordTagBatchError,
  RECORD_TAG_UPDATE_FIELDS,
  RecordTagUpdateError,
  updateOneRecordTag,
  updateRecordTagsSequentially,
} from '../src/services/groupRecordMutation.js';
import { RequestTimeoutError } from '../src/services/requestErrors.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUP_MANAGER_PATH = path.join(ROOT, 'src', 'components', 'GroupManager.vue');

function sourceRecord(id = 1) {
  return {
    id,
    user_id: 'must-not-leave-browser',
    owner: 'must-not-leave-browser',
    email: 'must-not-leave-browser',
    txn_date: '2026-08-06',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 1.25,
    price: 100,
    fee: 1,
    tax: 2,
    tag: 'Old',
    note: 'kept',
    created_at: 'server-only',
    total_amount: 128,
  };
}

function response({ ok = true, status = 200, body = { success: true } } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test('record tag payload is an exact Worker allowlist and drops owner fields', () => {
  const payload = buildRecordTagUpdatePayload(sourceRecord(), 'New');
  assert.deepEqual(Object.keys(payload), [...RECORD_TAG_UPDATE_FIELDS]);
  assert.deepEqual(payload, {
    id: 1,
    txn_date: '2026-08-06',
    symbol: 'NVDA',
    txn_type: 'BUY',
    qty: 1.25,
    price: 100,
    fee: 1,
    tax: 2,
    tag: 'New',
    note: 'kept',
  });
  for (const forbidden of ['user_id', 'owner', 'email', 'created_at', 'total_amount']) {
    assert.equal(Object.hasOwn(payload, forbidden), false);
  }
});

test('one update requires both HTTP and application success', async () => {
  let captured = null;
  const result = await updateOneRecordTag({
    apiBaseUrl: 'https://example.invalid/',
    token: 'token',
    record: sourceRecord(),
    tag: 'New',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return response();
    },
  });

  assert.equal(captured.url, 'https://example.invalid/api/records');
  assert.equal(captured.init.method, 'PUT');
  assert.equal(captured.init.headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(captured.init.body), result.payload);

  await assert.rejects(
    updateOneRecordTag({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      record: sourceRecord(),
      tag: 'New',
      fetchImpl: async () => response({
        ok: false,
        status: 403,
        body: { success: false, error: 'Forbidden', error_meta: { code: 'FORBIDDEN' } },
      }),
    }),
    error => error instanceof RecordTagUpdateError
      && error.status === 403
      && error.code === 'FORBIDDEN'
      && error.outcomeAmbiguous === false,
  );

  await assert.rejects(
    updateOneRecordTag({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      record: sourceRecord(),
      tag: 'New',
      fetchImpl: async () => response({ body: { success: false, error: 'Rejected' } }),
    }),
    error => error instanceof RecordTagUpdateError
      && error.code === 'APPLICATION_ERROR'
      && error.outcomeAmbiguous === false,
  );
});

test('PUT timeout is preserved as an ambiguous mutation outcome', async () => {
  await assert.rejects(
    updateOneRecordTag({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      record: sourceRecord(9),
      tag: 'New',
      fetchImpl: async () => { throw new RequestTimeoutError(30_000); },
    }),
    error => error instanceof RecordTagUpdateError
      && error.recordId === 9
      && error.code === 'REQUEST_TIMEOUT'
      && error.outcomeAmbiguous === true,
  );
});

test('sequential batch increments success only after a verified PUT', async () => {
  const calls = [];
  const result = await updateRecordTagsSequentially({
    apiBaseUrl: 'https://example.invalid',
    token: 'token',
    updates: [
      { record: sourceRecord(1), tag: 'A' },
      { record: sourceRecord(2), tag: 'B' },
    ],
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).id);
      return response();
    },
  });

  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(result, { succeeded: 2, total: 2 });
});

test('partial batch stops at first definite failure and exposes verified committed progress', async () => {
  const calls = [];
  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      updates: [
        { record: sourceRecord(1), tag: 'A' },
        { record: sourceRecord(2), tag: 'B' },
        { record: sourceRecord(3), tag: 'C' },
      ],
      fetchImpl: async (_url, init) => {
        const id = JSON.parse(init.body).id;
        calls.push(id);
        return id === 2
          ? response({ ok: false, status: 500, body: { success: false } })
          : response();
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 1
      && error.total === 3
      && error.failedRecordId === 2
      && error.outcomeAmbiguous === false,
  );
  assert.deepEqual(calls, [1, 2]);
});

test('partial batch preserves ambiguity of the failed row and never continues blindly', async () => {
  const calls = [];
  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      updates: [
        { record: sourceRecord(1), tag: 'A' },
        { record: sourceRecord(2), tag: 'B' },
        { record: sourceRecord(3), tag: 'C' },
      ],
      fetchImpl: async (_url, init) => {
        const id = JSON.parse(init.body).id;
        calls.push(id);
        if (id === 2) throw new RequestTimeoutError(30_000);
        return response();
      },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 1
      && error.total === 3
      && error.failedRecordId === 2
      && error.outcomeAmbiguous === true
      && error.cause?.outcomeAmbiguous === true,
  );
  assert.deepEqual(calls, [1, 2]);
});

test('network and missing-token failures preserve ambiguity truth at zero verified progress', async () => {
  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: 'token',
      updates: [{ record: sourceRecord(7), tag: 'A' }],
      fetchImpl: async () => { throw new Error('offline'); },
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 0
      && error.failedRecordId === 7
      && error.cause.code === 'NETWORK_ERROR'
      && error.outcomeAmbiguous === true,
  );

  await assert.rejects(
    updateRecordTagsSequentially({
      apiBaseUrl: 'https://example.invalid',
      token: '',
      updates: [{ record: sourceRecord(8), tag: 'A' }],
      fetchImpl: async () => response(),
    }),
    error => error instanceof PartialRecordTagBatchError
      && error.succeeded === 0
      && error.failedRecordId === 8
      && error.cause.code === 'AUTH_TOKEN_MISSING'
      && error.outcomeAmbiguous === false,
  );
});

test('GroupManager preserves partial mutation truth, authoritative readback truth, and required recalculation', () => {
  const source = fs.readFileSync(GROUP_MANAGER_PATH, 'utf8');
  assert.match(source, /updateRecordTagsSequentially/);
  assert.match(source, /summarizeGroupBatchFailure/);
  assert.match(source, /formatGroupBatchFailureMessage/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{\s*\.\.\.(?:r|record)/);
  assert.match(source, /const isSaving = ref\(false\);/);
  assert.match(source, /:disabled="isSaving \|\| changedCount === 0"/);

  const refreshStart = source.indexOf('const refreshRecordsAfterMutation');
  const refreshEnd = source.indexOf('const triggerRecalculationAfterMutation', refreshStart);
  assert.notEqual(refreshStart, -1);
  assert.notEqual(refreshEnd, -1);
  const refreshBlock = source.slice(refreshStart, refreshEnd);
  assert.match(refreshBlock, /warnOnFailure = true/);
  assert.match(refreshBlock, /await portfolioStore\.fetchRecords\(\)/);
  assert.match(refreshBlock, /return true/);
  assert.match(refreshBlock, /return false/);

  const batchBlock = source.match(/const runTagUpdateBatch = async[\s\S]*?\n\};\n\nconst renameGroup/)?.[0] || '';
  assert.match(batchBlock, /await updateRecordTagsSequentially/);
  assert.match(batchBlock, /await refreshRecordsAfterMutation\(\);/);
  assert.match(batchBlock, /await triggerRecalculationAfterMutation\(\);/);
  assert.match(batchBlock, /refreshRecordsAfterMutation\(\{ warnOnFailure: false \}\)/);
  assert.match(batchBlock, /summarizeGroupBatchFailure\(error, \{ refreshed \}\)/);
  assert.match(batchBlock, /formatGroupBatchFailureMessage\(summary\)/);
  assert.match(batchBlock, /summary\.failedOutcomeAmbiguous \? 'warning' : 'error'/);
  assert.match(batchBlock, /if \(summary\.shouldRecalculate\)/);
  assert.doesNotMatch(batchBlock, /批次未完成：已更新 .*已重新載入目前狀態/);
});
