import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildStrategyGroupOverview } from '../src/services/strategyGroupOverview.js';

const summary = (overrides = {}) => ({
  total_value: 100_000,
  invested_capital: 80_000,
  total_pnl: 20_000,
  twr: 12.5,
  twr_status: 'ok',
  twr_reason: null,
  xirr: 18.75,
  xirr_status: 'ok',
  xirr_reason: null,
  ...overrides,
});

const group = (overrides = {}) => ({
  summary: summary(),
  holdings: [{ symbol: 'AAA' }, { symbol: 'BBB' }],
  history: [
    { date: '2026-08-14' },
    { date: '2025-01-02' },
    { date: '2026-01-03' },
  ],
  ...overrides,
});

test('strategy overview excludes all and stays alphabetic instead of ranking by performance', () => {
  const overview = buildStrategyGroupOverview({
    updated_at: '2026-08-15 02:00',
    groups: {
      all: group({ summary: summary({ twr: 999 }) }),
      Zeta: group({ summary: summary({ twr: 500, total_pnl: 9_000_000 }) }),
      Alpha: group({ summary: summary({ twr: -20, total_pnl: -5_000 }) }),
      Core: group({ summary: summary({ twr: 45, total_pnl: 500_000 }) }),
    },
  });

  assert.equal(overview.status, 'ready');
  assert.equal(overview.updatedAt, '2026-08-15 02:00');
  assert.deepEqual(overview.groups.map(item => item.name), ['Alpha', 'Core', 'Zeta']);
  assert.equal(overview.groups.some(item => item.name === 'all'), false);
});

test('history range preserves each groups published history provenance and is not called an inception date', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      LongRunning: group({
        history: [{ date: '2022-12-30' }, { date: '2026-08-14' }],
      }),
      Newer: group({
        history: [{ date: '2026-07-31' }, { date: '2026-08-14' }],
      }),
    },
  });

  const longRunning = overview.groups.find(item => item.name === 'LongRunning');
  const newer = overview.groups.find(item => item.name === 'Newer');
  assert.deepEqual(longRunning.historyRange, {
    startDate: '2022-12-30',
    endDate: '2026-08-14',
  });
  assert.deepEqual(newer.historyRange, {
    startDate: '2026-07-31',
    endDate: '2026-08-14',
  });
  assert.notEqual(longRunning.historyRange.startDate, newer.historyRange.startDate);
});

test('published monetary values require actual finite numbers and never coerce malformed values to zero', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Broken: group({
        summary: summary({
          total_value: '100000',
          invested_capital: Number.NaN,
          total_pnl: null,
        }),
        holdings: null,
      }),
    },
  });

  const broken = overview.groups[0];
  assert.equal(broken.totalValueTwd, null);
  assert.equal(broken.investedCapitalTwd, null);
  assert.equal(broken.totalPnlTwd, null);
  assert.equal(broken.holdingsCount, null);
});

test('TWR and XIRR honor explicit reliability status while legacy snapshots remain display-compatible', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Current: group({
        summary: summary({
          twr: 42,
          twr_status: 'undefined',
          twr_reason: 'invalid_subperiod',
          xirr: 31,
          xirr_status: 'not_applicable',
          xirr_reason: 'no_cashflows',
        }),
      }),
      Legacy: group({
        summary: {
          total_value: 10,
          invested_capital: 8,
          total_pnl: 2,
          twr: 7.5,
          xirr: 9.25,
        },
      }),
    },
  });

  const current = overview.groups.find(item => item.name === 'Current');
  assert.equal(current.twr.status, 'undefined');
  assert.equal(current.twr.reason, 'invalid_subperiod');
  assert.equal(current.twr.value, null);
  assert.equal(current.xirr.status, 'not_applicable');
  assert.equal(current.xirr.value, null);

  const legacy = overview.groups.find(item => item.name === 'Legacy');
  assert.deepEqual(legacy.twr, { status: 'ok', reason: null, value: 7.5, legacy: true });
  assert.deepEqual(legacy.xirr, { status: 'ok', reason: null, value: 9.25, legacy: true });
});

test('missing or invalid group evidence fails closed without synthesizing a strategy comparison', () => {
  assert.equal(buildStrategyGroupOverview().status, 'unavailable');
  assert.equal(buildStrategyGroupOverview({ groups: [] }).status, 'unavailable');
  assert.equal(buildStrategyGroupOverview({ groups: { all: group() } }).status, 'empty');
});

test('strategy overview UI explains non-comparable and overlapping groups, uses published values, and switches through the store', async () => {
  const componentSource = await readFile(new URL('../src/components/StrategyGroupOverview.vue', import.meta.url), 'utf8');
  const managerSource = await readFile(new URL('../src/components/GroupManager.vue', import.meta.url), 'utf8');

  assert.match(componentSource, /歷史資料範圍可能不同/);
  assert.match(componentSource, /同一筆交易可能同時屬於多個標籤群組/);
  assert.match(componentSource, /不是同期間績效排名/);
  assert.match(componentSource, /群組金額也不可直接相加/);
  assert.match(componentSource, /store\.setGroup\(group\.name\)/);
  assert.match(componentSource, /buildStrategyGroupOverview\(store\.rawData\)/);
  assert.match(componentSource, /總資產淨值/);
  assert.match(componentSource, /投入資本/);
  assert.match(componentSource, /總損益/);
  assert.match(componentSource, /TWR/);
  assert.match(componentSource, /XIRR/);
  assert.match(componentSource, /持倉數/);
  assert.doesNotMatch(componentSource, /best|winner|排名第|Sharpe|Sortino|MDD/i);
  assert.doesNotMatch(componentSource, /fetch\(|\/api\//);
  assert.doesNotMatch(componentSource, /daily_pnl|benchmark_twr/);

  assert.match(managerSource, /import StrategyGroupOverview from '\.\/StrategyGroupOverview\.vue'/);
  assert.match(managerSource, /<StrategyGroupOverview\s*\/>/);
  assert.match(managerSource, /<h3 class="gm-title">管理策略群組<\/h3>/);
});
