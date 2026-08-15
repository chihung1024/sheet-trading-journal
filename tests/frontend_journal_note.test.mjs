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
  const noteValidation = worker.match(/note:\s*sanitizeText\(body\.note\s*\|\|\s*"",\s*([0-9_]+)\)/);
  assert.ok(noteValidation, 'Worker must validate the note field before persistence');
  assert.equal(Number(noteValidation[1].replaceAll('_', '')), 2000);
  assert.match(worker, /INSERT INTO records \(user_id, txn_date, symbol, txn_type, qty, price, fee, tax, tag, note\)/);
  assert.match(worker, /UPDATE records SET txn_date=\?, symbol=\?, txn_type=\?, qty=\?, price=\?, fee=\?, tax=\?, tag=\?, note=\?/);
  assert.match(worker, /const \{ create_idempotency_hash: _idempotency, create_payload_hash: _payload, \.\.\.record \} = row/);
});

test('TradeForm adds journal metadata without changing the established financial form declaration', () => {
  const source = read('src/components/TradeForm.vue');

  assert.match(source, /v-model="form\.note"/);
  assert.match(source, /maxlength="2000"/);
  assert.match(source, /交易備註 \/ 投資理由/);
  assert.match(source, /const journalDefaults = Object\.freeze\(\{ note: '' \}\);/);
  assert.match(source, /Object\.assign\(form, journalDefaults\);/);
  assert.match(source, /payload\.note\s*=\s*String\(payload\.note\s*\|\|\s*''\)\.slice\(0, 2000\)/);
  assert.match(source, /form\.note\s*=\s*''/);
  assert.match(source, /form\.note\s*=\s*r\.note\s*\|\|\s*''/);

  assert.match(source, /total_amount:\s*'',\s*\n\s*tag:\s*''\s*\n\}\);/);
});

test('RecordList keeps journal searchable and compact while RecordDetailPanel exposes the full note', () => {
  const source = read('src/components/RecordList.vue');
  const detail = read('src/components/RecordDetailPanel.vue');
  const historyPresentation = read('src/services/recordHistoryPresentation.js');

  assert.match(source, /placeholder="搜尋代碼、標籤或備註\.\.\."/);
  assert.match(source, /recordMatchesHistoryFilters\(r, historyFilters\.value\)/);
  assert.match(historyPresentation, /\[record\?\.symbol, record\?\.tag, record\?\.note\]/);
  assert.match(source, /class="record-note-inline">{{ r\.note }}/);
  assert.match(source, /v-if="r\.note" class="m-note m-note-preview">{{ r\.note }}/);
  assert.match(detail, /v-if="record\.note" class="detail-note">{{ record\.note }}/);
  assert.match(detail, /white-space: pre-wrap/);
  assert.match(source, /代碼 \/ 策略 \/ 備註/);
  assert.doesNotMatch(source, /<th>備註<\/th>/);
  assert.match(source, /colspan="7"/);
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

test('Batch 2.1 reuses the existing mutation lifecycle and introduces no note-only bypass', () => {
  const tradeForm = read('src/components/TradeForm.vue');

  assert.match(tradeForm, /success = await store\.updateRecord\(payload\)/);
  assert.match(tradeForm, /success = await store\.addRecord\(payload\)/);
  assert.doesNotMatch(tradeForm, /updateNote|noteOnly|skipRecalculation|\/api\/records\/note/);
});
