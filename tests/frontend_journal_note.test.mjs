import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildSourceRecordsIdentity } from '../src/services/snapshotIntegrity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const apiRecord = Object.freeze({
  id: 17,
  user_id: 'journal@example.com',
  txn_date: '2026-08-14',
  symbol: 'NVDA',
  txn_type: 'BUY',
  qty: 2,
  price: 100,
  fee: 1,
  tax: 0,
  tag: 'Growth',
  note: '原始投資理由',
});

test('current D1 and Worker contracts already persist and return note without a schema change', () => {
  const migration = read('migrations/0001_baseline.sql');
  const worker = read('worker.js');

  assert.match(migration, /\bnote\s+TEXT\b/);
  assert.match(worker, /const MAX_NOTE_LENGTH\s*=\s*2000/);
  assert.match(worker, /note:\s*sanitizeText\(body\.note\s*\|\|\s*"",\s*MAX_NOTE_LENGTH\)/);
  assert.match(worker, /INSERT INTO records \(user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note\)/);
  assert.match(worker, /UPDATE records SET txn_date=\?, symbol=\?, txn_type=\?, qty=\?, price=\?, fee=\?, tax=\?, tag=\?, note=\?/);
  assert.match(worker, /const \{ create_idempotency_hash: _idempotency, create_payload_hash: _payload, \.\.\.record \} = row/);
});

test('TradeForm exposes note in create/edit/reset payload flow with the Worker length bound', () => {
  const source = read('src/components/TradeForm.vue');

  assert.match(source, /v-model="form\.note"/);
  assert.match(source, /maxlength="2000"/);
  assert.match(source, /交易備註 \/ 投資理由/);
  assert.match(source, /note:\s*''/);
  assert.match(source, /payload\.note\s*=\s*String\(payload\.note\s*\|\|\s*''\)\.slice\(0, 2000\)/);
  assert.match(source, /form\.note\s*=\s*''/);
  assert.match(source, /k === 'note' \? \(r\.note \|\| ''\) : r\[k\]/);
});

test('RecordList renders notes and searches symbol, tag, or note on desktop/mobile', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /placeholder="搜尋代碼、標籤或備註\.\.\."/);
  assert.match(source, /\[r\.symbol, r\.tag, r\.note\]/);
  assert.match(source, /class="note-preview"[^>]*>{{ r\.note }}/);
  assert.match(source, /v-if="r\.note" class="m-note">{{ r\.note }}/);
  assert.match(source, /<th>備註<\/th>/);
  assert.match(source, /colspan="8"/);
});

test('changing note alone does not change the financial snapshot source identity', async () => {
  const first = { ...apiRecord, note: '進場：基本面轉折' };
  const second = { ...apiRecord, note: '檢討：進場位置過早，風險設定不變' };

  const firstIdentity = await buildSourceRecordsIdentity([first]);
  const secondIdentity = await buildSourceRecordsIdentity([second]);

  assert.equal(firstIdentity.sha256, secondIdentity.sha256);
  assert.equal(firstIdentity.record_count, secondIdentity.record_count);
  assert.equal(firstIdentity.max_record_id, secondIdentity.max_record_id);
});

test('Batch 2.1 reuses the existing record mutation lifecycle instead of introducing a note-only bypass', () => {
  const tradeForm = read('src/components/TradeForm.vue');
  const portfolio = read('src/stores/portfolio.js');

  assert.match(tradeForm, /success = await store\.updateRecord\(payload\)/);
  assert.match(tradeForm, /success = await store\.addRecord\(payload\)/);
  assert.doesNotMatch(tradeForm, /updateNote|noteOnly|skipRecalculation/);
  assert.match(portfolio, /const updateRecord/);
  assert.match(portfolio, /markSnapshotStale\(\)/);
  assert.match(portfolio, /markCommittedMutationDirtyForAutomaticRecalculation\(\)/);
});
