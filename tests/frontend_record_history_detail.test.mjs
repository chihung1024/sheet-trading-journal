import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('RecordList exposes one page-memory read-only detail expansion on desktop and mobile', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /import RecordDetailPanel from '\.\/RecordDetailPanel\.vue'/);
  assert.match(source, /const expandedRecordId = ref\(null\)/);
  assert.match(source, /const toggleRecordDetails = \(id\) =>/);
  assert.match(source, /:aria-expanded="isRecordExpanded\(r\.id\)"/);
  assert.match(source, /:aria-controls="getRecordDetailId\(r\.id\)"/);
  assert.match(source, /<td colspan="8">\s*<RecordDetailPanel/s);
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

test('RecordDetailPanel presents stored journal facts without becoming a financial or mutation authority', () => {
  const source = read('src/components/RecordDetailPanel.vue');

  assert.match(source, /已儲存交易欄位/);
  assert.match(source, /交易日期/);
  assert.match(source, /紀錄數量/);
  assert.match(source, /DIV 入帳金額/);
  assert.match(source, /手續費/);
  assert.match(source, /稅費/);
  assert.match(source, /策略標籤/);
  assert.match(source, /交易備註 \/ 投資理由/);
  assert.match(source, /{{ record\.note }}/);
  assert.match(source, /getRecordTags\(props\.record\)/);
  assert.match(source, /績效與 TWD 估值仍以系統既有計算與已驗證快照為準/);
  assert.doesNotMatch(source, /usePortfolioStore|resolveTransactionValuation|resolveSettlementAmountNative|fetch\(|fetchWithAuth|addRecord|updateRecord|deleteRecord|localStorage/);
});

test('main history summaries stay compact now that full details are explicit', () => {
  const source = read('src/components/RecordList.vue');

  assert.match(source, /class="note-preview">{{ r\.note }}/);
  assert.match(source, /class="m-note m-note-preview">{{ r\.note }}/);
  assert.match(source, /-webkit-line-clamp: 2/);
  assert.doesNotMatch(source, /class="note-preview" :title="r\.note"/);
});
