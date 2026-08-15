import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildDividendWorkflowSections,
  sortDividendRowsRecentFirst,
} from '../src/services/dividendWorkflowPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIVIDEND_MANAGER_PATH = path.join(ROOT, 'src', 'components', 'DividendManager.vue');
const readDividendManager = () => fs.readFileSync(DIVIDEND_MANAGER_PATH, 'utf8');

const row = (symbol, exDate) => ({ symbol, ex_date: exDate });

test('dividend workflow partitions pending, awaiting readback, and authoritative confirmed rows', () => {
  const rows = [
    row('OLD', '2026-01-02'),
    row('NEW', '2026-08-14'),
    row('SYNC', '2026-08-13'),
    row('DONE', '2026-08-12'),
  ];
  const confirmed = new Set(['DONE_2026-08-12']);
  const awaiting = new Set(['SYNC_2026-08-13']);

  const sections = buildDividendWorkflowSections(rows, confirmed, awaiting);

  assert.deepEqual(sections.pending.map(item => item.symbol), ['NEW', 'OLD']);
  assert.deepEqual(sections.awaiting.map(item => item.symbol), ['SYNC']);
  assert.deepEqual(sections.active.map(item => item.symbol), ['NEW', 'OLD', 'SYNC']);
  assert.deepEqual(sections.confirmed.map(item => item.symbol), ['DONE']);
});

test('workflow presentation is recent-first without mutating engine order', () => {
  const rows = [
    row('A', '2025-01-01'),
    row('C', '2026-08-15'),
    row('B', '2026-08-15'),
  ];
  const original = rows.map(item => item.symbol);

  const sorted = sortDividendRowsRecentFirst(rows);

  assert.deepEqual(sorted.map(item => item.symbol), ['B', 'C', 'A']);
  assert.deepEqual(rows.map(item => item.symbol), original);
});

test('invalid collections fail closed to an empty workflow projection', () => {
  assert.deepEqual(sortDividendRowsRecentFirst(null), []);
  assert.deepEqual(
    buildDividendWorkflowSections(null),
    { pending: [], awaiting: [], active: [], confirmed: [] },
  );
});

test('DividendManager renders the active queue separately from collapsed confirmed history', () => {
  const source = readDividendManager();

  assert.match(source, /buildDividendWorkflowSections/);
  assert.match(source, /const showConfirmedHistory = ref\(false\)/);
  assert.match(source, /v-for="div in activeDividendRows"/);
  assert.match(source, /v-for="div in confirmedDividendRows"/);
  assert.match(source, /已入帳歷史/);
  assert.match(source, /:aria-expanded="showConfirmedHistory"/);
  assert.match(source, /實際 DIV 金額與備註請以交易紀錄中的權威交易為準/);
  assert.doesNotMatch(source, /v-for="div in localDividends"/);
});

test('Phase 10.2B preserves the established deterministic DIV write contract', () => {
  const source = readDividendManager();

  assert.match(source, /buildDividendEventIdempotencyKey\(\{\s*symbol: div\.symbol,\s*date: div\.ex_date,/s);
  assert.match(source, /txn_date: div\.ex_date/);
  assert.match(source, /txn_type: 'DIV'/);
  assert.match(source, /qty: 1/);
  assert.match(source, /price: netAmount/);
  assert.match(source, /fee: 0/);
  assert.match(source, /tax: 0/);
  assert.match(source, /tag: 'Auto-Dividend'/);
  assert.match(source, /store\.addRecord\(record, \{ returnOutcome: true \}\)/);
  assert.match(source, /DIVIDEND_EVENT_CONFLICT/);
});
