import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildDailyPnlExplanation } from '../src/services/dailyPnlExplainability.js';

const row = (overrides = {}) => ({
  symbol: 'NVDA',
  currency: 'USD',
  price_pnl_twd: 120,
  fx_pnl_twd: 20,
  dividend_income_twd: 0,
  execution_pnl_twd: 10,
  fee_tax_pnl_twd: -2,
  total_pnl_twd: 148,
  ...overrides,
});

test('reconciled day ledger becomes a sorted explainability view without changing accounting values', () => {
  const result = buildDailyPnlExplanation({
    dayLedger: [
      row(),
      row({
        symbol: '2330.TW',
        currency: 'TWD',
        price_pnl_twd: -300,
        fx_pnl_twd: 0,
        execution_pnl_twd: 0,
        fee_tax_pnl_twd: 0,
        total_pnl_twd: -300,
      }),
    ],
    summary: { daily_pnl_twd: -152 },
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.rawTotalTwd, -152);
  assert.equal(result.publishedTotalTwd, -152);
  assert.deepEqual(result.rows.map(item => item.symbol), ['2330.TW', 'NVDA']);
  assert.deepEqual(
    result.rows[1].components.map(component => [component.key, component.valueTwd]),
    [
      ['price_pnl_twd', 120],
      ['fx_pnl_twd', 20],
      ['execution_pnl_twd', 10],
      ['fee_tax_pnl_twd', -2],
    ],
  );
  assert.deepEqual(
    result.componentTotals.map(component => [component.key, component.valueTwd]),
    [
      ['price_pnl_twd', -180],
      ['fx_pnl_twd', 20],
      ['execution_pnl_twd', 10],
      ['fee_tax_pnl_twd', -2],
    ],
  );
});

test('rounded published total may differ from raw ledger by at most the Python rounding boundary', () => {
  const result = buildDailyPnlExplanation({
    dayLedger: [row({ price_pnl_twd: 100.49, fx_pnl_twd: 0, execution_pnl_twd: 0, fee_tax_pnl_twd: 0, total_pnl_twd: 100.49 })],
    summary: { daily_pnl_twd: 100 },
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.rawTotalTwd, 100.49);
  assert.equal(result.publishedTotalTwd, 100);
});

test('missing legacy ledger fails closed instead of synthesizing attribution from holdings or summary', () => {
  const result = buildDailyPnlExplanation({
    dayLedger: [],
    summary: { daily_pnl_twd: 123 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'missing_day_ledger');
  assert.deepEqual(result.rows, []);
});

test('non-finite, malformed, or internally unreconciled rows fail closed', () => {
  const malformed = buildDailyPnlExplanation({
    dayLedger: [row({ fx_pnl_twd: Number.NaN })],
    summary: { daily_pnl_twd: 148 },
  });
  assert.equal(malformed.status, 'unavailable');
  assert.equal(malformed.reason, 'invalid_day_ledger');

  const mismatched = buildDailyPnlExplanation({
    dayLedger: [row({ total_pnl_twd: 999 })],
    summary: { daily_pnl_twd: 999 },
  });
  assert.equal(mismatched.status, 'unavailable');
  assert.equal(mismatched.reason, 'invalid_day_ledger');
});

test('ledger and published summary mismatch fails closed', () => {
  const result = buildDailyPnlExplanation({
    dayLedger: [row()],
    summary: { daily_pnl_twd: 999 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'summary_mismatch');
});

test('portfolio store exposes only the current group day ledger and StatsGrid uses an explicit mobile-accessible detail control', async () => {
  const storeSource = await readFile(new URL('../src/stores/portfolio.js', import.meta.url), 'utf8');
  const statsSource = await readFile(new URL('../src/components/StatsGrid.vue', import.meta.url), 'utf8');

  assert.match(storeSource, /const dayLedger = computed\(\(\) => currentGroupData\.value\.day_ledger \|\| \[\]\);/);
  assert.match(storeSource, /\bdayLedger,\s*\n/);

  assert.match(statsSource, /buildDailyPnlExplanation/);
  assert.match(statsSource, /store\.dayLedger/);
  assert.match(statsSource, /aria-expanded="isDailyExplanationOpen"/);
  assert.match(statsSource, /查看損益來源/);
  assert.match(statsSource, /daily-pnl-explanation/);
  assert.doesNotMatch(statsSource, /rawData\.groups/);
});
