import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getEventSourceLabel,
  getRecordDisplayCurrency,
  getStoredRecordCurrency,
  hasRecordEventMetadata,
} from '../src/services/recordHistoryPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('RecordList exposes one page-memory read-only detail expansion on desktop and mobile', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /import RecordDetailPanel from '\.\/RecordDetailPanel\.vue'/);
  assert.match(source, /const expandedRecordId = ref\(null\)/);
  assert.match(source, /const toggleRecordDetails = \(id\) =>/);
  assert.match(source, /:aria-expanded="isRecordExpanded\(r\.id\)"/);
  assert.match(source, /:aria-controls="getRecordDetailId\(r\.id\)"/);
  assert.match(source, /:aria-label="isRecordExpanded\(r\.id\) \? '收合完整交易明細' : '查看完整交易明細'"/);
  assert.match(source, /<td colspan="7">\s*<RecordDetailPanel/s);
  assert.match(source, /<RecordDetailPanel\s+v-if="isRecordExpanded\(r\.id\)"/s);
  assert.match(source, /查看完整交易明細/);
  assert.match(source, /查看明細/);
  assert.doesNotMatch(source, /localStorage.*expanded|expanded.*localStorage/i);
});

test('view, edit, and delete intents remain explicitly separate', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /@click="toggleRecordDetails\(r\.id\)"/);
  assert.match(source, /const editRecord = \(record\) => \{\s*collapseRecordDetails\(\);\s*editingId\.value = record\.id;\s*emit\('edit', record\);/s);
  assert.match(source, /const deleteRecord = async \(id\) => \{[\s\S]*await store\.deleteRecord\(id\);/);
  assert.doesNotMatch(source, /toggleRecordDetails\([^)]*\)[\s\S]{0,120}emit\('edit'/);
});

test('detail expansion is cleared when retrieval context or pagination changes', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /const collapseRecordDetails = \(\) => \{ expandedRecordId\.value = null; \}/);
  assert.match(source, /const prevPage = \(\) => \{[\s\S]*collapseRecordDetails\(\)/);
  assert.match(source, /const nextPage = \(\) => \{[\s\S]*collapseRecordDetails\(\)/);
  assert.match(source, /const goToPage = \(page\) => \{[\s\S]*collapseRecordDetails\(\)/);
  assert.match(source, /watch\(\[searchQuery, filterType, dateFrom, dateTo, itemsPerPage\],[\s\S]*collapseRecordDetails\(\)/);
  assert.match(source, /watch\(\(\) => store\.currentGroup,[\s\S]*collapseRecordDetails\(\)/);
});

test('record event metadata presentation prefers stored quote unit with legacy fallback', () => {
  assert.equal(getStoredRecordCurrency({ symbol: 'NVDA', currency: 'EUR' }), 'EUR');
  assert.equal(getRecordDisplayCurrency({ symbol: 'NVDA', currency: 'EUR' }), 'EUR');
  assert.equal(getStoredRecordCurrency({ symbol: 'VOD.L', currency: 'GBp' }), 'GBp');
  assert.equal(getRecordDisplayCurrency({ symbol: 'VOD.L', currency: 'GBp' }), 'GBp');
  assert.equal(getStoredRecordCurrency({ symbol: '7203.T', currency: null }), '');
  assert.equal(getRecordDisplayCurrency({ symbol: '7203.T', currency: null }), 'JPY');
  assert.equal(getStoredRecordCurrency({ symbol: '7203.T', currency: 'jpy' }), '');
  assert.equal(getRecordDisplayCurrency({ symbol: '7203.T', currency: 'jpy' }), 'JPY');
});

test('record event source labels are privacy-safe and metadata presence stays optional', () => {
  assert.equal(getEventSourceLabel('MANUAL'), '手動記錄');
  assert.equal(getEventSourceLabel('ibkr'), 'IBKR');
  assert.equal(getEventSourceLabel('IMPORT'), '檔案匯入');
  assert.equal(getEventSourceLabel('SYSTEM'), '系統產生');
  assert.equal(getEventSourceLabel('account-123-secret'), '未識別來源');
  assert.equal(getEventSourceLabel(null), '');

  assert.equal(hasRecordEventMetadata({ symbol: 'NVDA' }), false);
  assert.equal(hasRecordEventMetadata({ symbol: 'NVDA', currency: null, executed_at: null, execution_sequence: null, event_source: null }), false);
  assert.equal(hasRecordEventMetadata({ symbol: 'NVDA', executed_at: '2026-08-12T10:31:27+08:00' }), true);
  assert.equal(hasRecordEventMetadata({ symbol: 'NVDA', execution_sequence: 'order:487287953' }), true);
});

test('RecordDetailPanel presents stored journal and event facts without becoming a financial, ordering, or mutation authority', () => {
  const source = read('src/components/RecordDetailPanel.vue');

  assert.match(source, /已儲存交易欄位/);
  assert.match(source, /交易日期/);
  assert.match(source, /紀錄數量/);
  assert.match(source, /DIV 入帳金額/);
  assert.match(source, /手續費/);
  assert.match(source, /稅費/);
  assert.match(source, /成交來源資訊/);
  assert.match(source, /報價單位（已儲存）/);
  assert.match(source, /成交時間（含來源時區）/);
  assert.match(source, /來源序列/);
  assert.match(source, /來源類型/);
  assert.match(source, /getRecordDisplayCurrency\(props\.record\)/);
  assert.match(source, /getStoredRecordCurrency\(props\.record\)/);
  assert.match(source, /hasRecordEventMetadata\(props\.record\)/);
  assert.match(source, /getEventSourceLabel\(props\.record\?\.event_source\)/);
  assert.match(source, /「交易日期」不等於成交時間/);
  assert.match(source, /來源序列也不代表系統已依此排序/);
  assert.match(source, /策略標籤/);
  assert.match(source, /交易備註 \/ 投資理由/);
  assert.match(source, /{{ record\.note }}/);
  assert.match(source, /getRecordTags\(props\.record\)/);
  assert.match(source, /績效與 TWD 估值仍以系統既有計算與已驗證快照為準/);
  assert.doesNotMatch(source, /record\.created_at/);
  assert.doesNotMatch(source, /usePortfolioStore|resolveTransactionValuation|resolveSettlementAmountNative|fetch\(|fetchWithAuth|addRecord|updateRecord|deleteRecord|localStorage|sort\(/);
});

test('R2.2C detail presentation does not activate execution metadata sorting in RecordList', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /const sortKey = ref\('txn_date'\)/);
  assert.doesNotMatch(source, /sortBy\('executed_at'\)/);
  assert.doesNotMatch(source, /sortBy\('execution_sequence'\)/);
  assert.doesNotMatch(source, /sortKey\.value === 'executed_at'/);
  assert.doesNotMatch(source, /sortKey\.value === 'execution_sequence'/);
});

test('desktop journal summary is integrated with symbol and strategy instead of reserving an empty Note column', () => {
  const source = read('src/components/RecordList.vue');
  const inlineJournalSummaries = source.match(/class="record-note-inline">{{ r\.note }}<\/span>/g) || [];

  assert.match(source, /代碼 \/ 策略 \/ 備註/);
  assert.equal(inlineJournalSummaries.length, 1, 'desktop journal summary must render exactly once');
  assert.doesNotMatch(source, /<th>備註<\/th>/);
  assert.doesNotMatch(source, /class="note-cell"/);
  assert.doesNotMatch(source, /class="note-preview">{{ r\.note }}/);
  assert.match(source, /record-note-inline[^}]*white-space:\s*nowrap/s);
});

test('mobile journal summary remains compact while full note stays available in detail panel', () => {
  const source = read('src/components/RecordList.vue');
  assert.match(source, /class="m-note m-note-preview">{{ r\.note }}/);
  assert.match(source, /\.m-note-preview[^}]*-webkit-line-clamp:\s*2/s);
  assert.doesNotMatch(source, /class="m-note m-note-preview" :title="r\.note"/);
});
