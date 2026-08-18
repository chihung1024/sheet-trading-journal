import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { CANONICAL_HEADERS, CANONICAL_TRADE_CSV_FORMAT } from '../src/services/brokerNeutralImportPreview.js';
import {
  CANONICAL_TRADE_CSV_TEMPLATE_FILENAME,
  CANONICAL_TRADE_CSV_TEMPLATE_MIME,
  buildCanonicalTradeCsvTemplateText,
  getCanonicalTradeCsvTemplateDescriptor,
} from '../src/services/brokerNeutralCsvTemplate.js';

const serviceSource = fs.readFileSync(
  new URL('../src/services/brokerNeutralCsvTemplate.js', import.meta.url),
  'utf8',
);
const buttonSource = fs.readFileSync(
  new URL('../src/components/BrokerNeutralCsvTemplateButton.vue', import.meta.url),
  'utf8',
);
const actionsSource = fs.readFileSync(
  new URL('../src/components/JournalBackupButton.vue', import.meta.url),
  'utf8',
);

test('canonical CSV template is deterministic, header-only, and exactly matches the reviewed v1 contract', () => {
  const text = buildCanonicalTradeCsvTemplateText();
  const descriptor = getCanonicalTradeCsvTemplateDescriptor();

  assert.equal(text, `${CANONICAL_HEADERS.join(',')}\r\n`);
  assert.equal(text.split(/\r?\n/).filter(Boolean).length, 1);
  assert.equal(descriptor.format, CANONICAL_TRADE_CSV_FORMAT);
  assert.equal(descriptor.filename, CANONICAL_TRADE_CSV_TEMPLATE_FILENAME);
  assert.equal(descriptor.mime, CANONICAL_TRADE_CSV_TEMPLATE_MIME);
  assert.equal(descriptor.text, text);
  assert.equal(descriptor.contains_sample_transactions, false);
  assert.equal(CANONICAL_TRADE_CSV_TEMPLATE_FILENAME, 'sheet-trading-journal-canonical-trades-v1.csv');
});

test('template download remains local-only inside the compact CSV tools entry', () => {
  assert.doesNotMatch(serviceSource, /\bfetch\s*\(|\/api\/|\b(?:POST|PUT|PATCH|DELETE)\b/);
  assert.match(buttonSource, /getCanonicalTradeCsvTemplateDescriptor/);
  assert.match(buttonSource, /new Blob/);
  assert.match(buttonSource, /URL\.createObjectURL/);
  assert.match(buttonSource, /CSV 工具/);
  assert.match(buttonSource, /下載 Canonical CSV 空白範本/);
  assert.match(buttonSource, /BrokerNeutralColumnMapping/);
  assert.doesNotMatch(buttonSource, /authStore|CONFIG\.API_BASE_URL|createRecordFromIntent|確認匯入|執行匯入/);
  assert.match(actionsSource, /<BrokerNeutralImportPreview \/>\s*<BrokerNeutralCsvTemplateButton \/>/);
  assert.match(actionsSource, /aria-label="交易資料匯入、備份與還原"/);
});
