import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildImportReconciliationReceipt } from '../src/services/importReconciliationReceipt.js';
import { runRecordImportBatch } from '../src/services/recordImportBatch.js';

const batchSource = fs.readFileSync(new URL('../src/services/recordImportBatch.js', import.meta.url), 'utf8');
const receiptSource = fs.readFileSync(new URL('../src/services/importReconciliationReceipt.js', import.meta.url), 'utf8');

const entries = [
  { rowNumber: 2, idempotencyKey: 'secret-key-a', record: { symbol: 'AAPL', note: 'private-a' } },
  { sourceRecordNumber: 2, idempotencyKey: 'secret-key-b', record: { symbol: 'MSFT', note: 'private-b' } },
  { idempotencyKey: 'secret-key-c', record: { symbol: 'NVDA', note: 'private-c' } },
];

const run = async (createRecord, { readbackError = null, updateError = null } = {}) => runRecordImportBatch(entries, {
  createRecord,
  async refreshRecords() { if (readbackError) throw readbackError; },
  async requestUpdate() { if (updateError) throw updateError; },
});

test('successful batch retains one non-financial immutable receipt item for every attempted entry', async () => {
  const result = await run(async (_entry, index) => ({
    committed: true,
    deduplicated: index === 1,
    metadataUpdated: index === 2,
  }));

  assert.equal(result.status, 'committed');
  assert.equal(result.total, 3);
  assert.equal(result.attempted, 3);
  assert.equal(result.unattempted, 0);
  assert.deepEqual(result.items.map(item => item.status), ['created', 'replayed', 'created']);
  assert.deepEqual(result.items.map(item => item.sourceReference), [
    { kind: 'source_row', value: 2 },
    { kind: 'source_record', value: 2 },
    { kind: 'import_index', value: 3 },
  ]);
  assert.equal(result.items[2].metadataUpdated, true);
  assert.ok(Object.isFrozen(result.items));
  assert.ok(result.items.every(Object.isFrozen));

  const serialized = JSON.stringify(result.items);
  assert.doesNotMatch(serialized, /secret-key|AAPL|MSFT|NVDA|private-/);
});

test('explicit partial failure records the rejected attempt and fabricates no suffix outcomes', async () => {
  const rejection = Object.assign(new Error('server rejected'), { outcomeAmbiguous: false });
  const result = await run(async (_entry, index) => {
    if (index === 1) throw rejection;
    return { committed: true, deduplicated: false };
  });

  assert.equal(result.status, 'partial_failure');
  assert.equal(result.processed, 1);
  assert.equal(result.attempted, 2);
  assert.equal(result.unattempted, 1);
  assert.deepEqual(result.items.map(item => item.status), ['created', 'rejected']);
  assert.equal(result.items[1].committed, false);
  assert.equal(result.items[1].outcomeAmbiguous, false);
});

test('ambiguous first response is visibly distinct and preserves unattempted suffix', async () => {
  const ambiguous = Object.assign(new Error('connection lost'), { outcomeAmbiguous: true });
  const result = await run(async () => { throw ambiguous; });

  assert.equal(result.status, 'partial_failure');
  assert.equal(result.processed, 0);
  assert.equal(result.attempted, 1);
  assert.equal(result.unattempted, 2);
  assert.equal(result.items[0].status, 'ambiguous');
  assert.equal(result.items[0].outcomeAmbiguous, true);
  assert.equal(result.sync.readbackAttempted, true);
  assert.equal(result.sync.updateAttempted, true);
});

test('receipt presentation exposes statuses and sync warnings without errors, entries, keys, or financial payloads', async () => {
  const result = await run(
    async (_entry, index) => ({
      committed: true,
      deduplicated: index === 1,
      recoveryStateError: index === 2 ? new Error('local cleanup') : null,
    }),
    { readbackError: new Error('readback unavailable') },
  );

  assert.equal(result.sync.readbackError?.message, 'readback unavailable');
  const receipt = buildImportReconciliationReceipt(result);
  assert.equal(receipt.receipt_version, 1);
  assert.deepEqual(receipt.rows.map(row => row.label), [
    '已新增',
    '已存在（安全重播）',
    '已新增',
  ]);
  assert.deepEqual(receipt.rows.map(row => row.reference), [
    'CSV 第 2 列',
    '來源資料第 2 筆',
    '匯入第 3 筆',
  ]);
  assert.equal(receipt.has_sync_warning, true);
  assert.ok(receipt.sync_messages.some(message => message.includes('權威交易紀錄重新載入尚未完成')));
  assert.ok(receipt.sync_messages.some(message => message.includes('本機恢復狀態清理需留意')));

  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(serialized, /secret-key|AAPL|MSFT|NVDA|private-|readback unavailable|local cleanup/);
});

test('receipt code remains memory-only presentation with no persistence or API path', () => {
  for (const source of [batchSource, receiptSource]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|\/api\//);
  }
  assert.doesNotMatch(receiptSource, /idempotencyKey|\.record\b|\.entry\b|\.error\b/);
});
