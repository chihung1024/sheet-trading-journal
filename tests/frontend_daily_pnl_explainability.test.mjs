import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../src/services/dailyPnlExplainability.js';

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

test('current group selection never falls through to another group ledger', () => {
  const allLedger = [row({ symbol: 'ALL' })];
  const coreLedger = [row({ symbol: 'CORE' })];
  const rawData = {
    day_ledger: [row({ symbol: 'LEGACY' })],
    groups: {
      all: { day_ledger: allLedger },
      Core: { day_ledger: coreLedger },
      Empty: { day_ledger: [] },
    },
  };

  assert.equal(selectCurrentGroupDayLedger({ rawData, currentGroup: 'all' }), allLedger);
  assert.equal(selectCurrentGroupDayLedger({ rawData, currentGroup: 'Core' }), coreLedger);
  assert.deepEqual(selectCurrentGroupDayLedger({ rawData, currentGroup: 'Empty' }), []);
  assert.deepEqual(selectCurrentGroupDayLedger({ rawData, currentGroup: 'Missing' }), []);

  const legacyRoot = [row({ symbol: 'ROOT' })];
  assert.equal(
    selectCurrentGroupDayLedger({ rawData: { day_ledger: legacyRoot }, currentGroup: 'all' }),
    legacyRoot,
  );
  assert.deepEqual(
    selectCurrentGroupDayLedger({ rawData: { day_ledger: legacyRoot }, currentGroup: 'Core' }),
    [],
  );
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

test('duplicate symbol evidence fails closed even when totals would otherwise reconcile', () => {
  const duplicate = row({
    price_pnl_twd: 74,
    fx_pnl_twd: 0,
    execution_pnl_twd: 0,
    fee_tax_pnl_twd: 0,
    total_pnl_twd: 74,
  });
  const result = buildDailyPnlExplanation({
    dayLedger: [duplicate, { ...duplicate }],
    summary: { daily_pnl_twd: 148 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'duplicate_symbol');
});

test('ledger and published summary mismatch fails closed', () => {
  const result = buildDailyPnlExplanation({
    dayLedger: [row()],
    summary: { daily_pnl_twd: 999 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'summary_mismatch');
});

test('OverviewPage owns group selection while child surfaces only present reviewed explanation facts', async () => {
  const overviewSource = await readFile(new URL('../src/components/OverviewPage.vue', import.meta.url), 'utf8');
  const headlineSource = await readFile(new URL('../src/components/OverviewHeadline.vue', import.meta.url), 'utf8');
  const contextSource = await readFile(new URL('../src/components/OverviewContext.vue', import.meta.url), 'utf8');
  const detailSource = await readFile(new URL('../src/components/DailyPnlExplanation.vue', import.meta.url), 'utf8');

  assert.match(overviewSource, /selectCurrentGroupDayLedger\(\{/);
  assert.match(overviewSource, /rawData:\s*store\.rawData/);
  assert.match(overviewSource, /currentGroup:\s*store\.currentGroup/);
  assert.match(overviewSource, /buildDailyPnlExplanation/);
  assert.match(overviewSource, /<DailyPnlExplanation/);
  assert.match(overviewSource, /dailyPnlExplanation\.status === 'ready'/);

  assert.doesNotMatch(headlineSource, /selectCurrentGroupDayLedger|buildDailyPnlExplanation/);
  assert.doesNotMatch(contextSource, /selectCurrentGroupDayLedger|buildDailyPnlExplanation/);
  assert.match(contextSource, /aria-controls="daily-pnl-explanation"/);
  assert.match(contextSource, /查看完整來源/);

  assert.match(detailSource, /id="daily-pnl-explanation"/);
  assert.match(detailSource, /計算引擎已對帳的逐檔 day ledger/);
  assert.match(detailSource, /只解釋來源，不重複首頁已顯示的當日總損益/);
  assert.doesNotMatch(detailSource, /explanation\.publishedTotalTwd/);
  assert.doesNotMatch(detailSource, /fetch\(|\/api\//);
});
