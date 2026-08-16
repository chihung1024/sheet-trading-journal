import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildDividendAttention } from '../src/services/dividendAttention.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('dividend attention excludes candidates already confirmed by authoritative DIV records', () => {
  const result = buildDividendAttention({
    pendingDividends: [
      { symbol: 'AAA', ex_date: '2026-08-15' },
      { symbol: 'BBB', ex_date: '2026-08-14' },
    ],
    records: [
      { txn_type: 'DIV', symbol: 'AAA', txn_date: '2026-08-15' },
    ],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.count, 1);
  assert.equal(result.next.symbol, 'BBB');
  assert.deepEqual(result.candidates.map(row => row.symbol), ['BBB']);
});

test('dividend attention is recent-first and ignores malformed candidate identity', () => {
  const result = buildDividendAttention({
    pendingDividends: [
      { symbol: 'OLD', ex_date: '2026-08-01' },
      { symbol: '', ex_date: '2026-08-16' },
      { symbol: 'NEW', ex_date: '2026-08-16' },
    ],
    records: [],
  });

  assert.equal(result.count, 2);
  assert.deepEqual(result.candidates.map(row => row.symbol), ['NEW', 'OLD']);
});

test('navigation badge and overview projection share the same records-authoritative attention service', () => {
  const app = read('src/App.vue');
  const projection = read('src/services/overviewProjection.js');

  assert.match(app, /buildDividendAttention/);
  assert.match(app, /pendingDividends:\s*portfolioStore\.pending_dividends/);
  assert.match(app, /records:\s*portfolioStore\.records/);
  assert.doesNotMatch(app, /pending_dividends\?\.length|pending_dividends\.length/);
  assert.match(projection, /buildDividendAttention/);
});
