import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  KNOWN_SYMBOL_SUGGESTION_LIMIT,
  buildKnownSymbolSuggestions,
  normalizeKnownSymbol,
} from '../src/services/symbolSuggestions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRADE_FORM_PATH = path.join(ROOT, 'src', 'components', 'TradeForm.vue');

const records = [
  { symbol: ' nvda ' },
  { symbol: '2330.tw' },
  { symbol: 'NVDA' },
  { symbol: 'NOW' },
  { symbol: 'AVGO' },
  { symbol: '' },
  {},
];

test('known-symbol projection normalizes and preserves recent-first unique record order', () => {
  assert.equal(normalizeKnownSymbol(' 2330.tw '), '2330.TW');
  assert.deepEqual(
    buildKnownSymbolSuggestions(records),
    ['NVDA', '2330.TW', 'NOW', 'AVGO'],
  );
});

test('known-symbol filtering is case-insensitive prefix matching and never guesses suffixes', () => {
  assert.deepEqual(buildKnownSymbolSuggestions(records, 'n'), ['NVDA', 'NOW']);
  assert.deepEqual(buildKnownSymbolSuggestions(records, 'Nv'), ['NVDA']);
  assert.deepEqual(buildKnownSymbolSuggestions(records, '330'), []);
  assert.deepEqual(buildKnownSymbolSuggestions(records, '2330'), ['2330.TW']);
  assert.deepEqual(buildKnownSymbolSuggestions(records, '2330.tw'), ['2330.TW']);
});

test('known-symbol projection is bounded and fails closed on invalid record collections', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ symbol: `S${index}` }));
  assert.equal(buildKnownSymbolSuggestions(many).length, KNOWN_SYMBOL_SUGGESTION_LIMIT);
  assert.deepEqual(buildKnownSymbolSuggestions(many, '', 3), ['S0', 'S1', 'S2']);
  assert.equal(buildKnownSymbolSuggestions(many, '', 999).length, 20);
  assert.deepEqual(buildKnownSymbolSuggestions(null, 'N'), []);
});

test('TradeForm wires suggestions to authoritative loaded records without making selection mandatory', () => {
  const source = fs.readFileSync(TRADE_FORM_PATH, 'utf8');
  assert.match(source, /buildKnownSymbolSuggestions\(store\.records, form\.symbol\)/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /@keydown="handleSymbolKeydown"/);
  assert.match(source, /建議來自你既有的交易紀錄；仍可直接輸入新的 Yahoo Symbol/);
  assert.match(source, /symbol: !form\.symbol \? '請輸入交易標的 Symbol' : ''/);
  assert.doesNotMatch(source, /localStorage.*symbol/i);
  assert.doesNotMatch(source, /fetch\([^\n]*symbol/i);
});

test('TradeForm suggestion interaction does not alter the existing record payload authority', () => {
  const source = fs.readFileSync(TRADE_FORM_PATH, 'utf8');
  const buildStart = source.indexOf('const buildRecordPayload = () => {');
  const buildEnd = source.indexOf('const submit = async () => {', buildStart);
  const buildBlock = source.slice(buildStart, buildEnd);
  assert.ok(buildStart >= 0 && buildEnd > buildStart);
  assert.match(buildBlock, /const payload = \{ \.\.\.form \};/);
  assert.match(buildBlock, /if \(payload\.price <= 0 && payload\.total_amount > 0\)/);
  assert.match(buildBlock, /payload\.price = payload\.total_amount \/ payload\.qty/);
});
