import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildStrategyGroupOverview } from '../src/services/strategyGroupOverview.js';

const approx = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

const summary = (twr = 0) => ({
  total_value: 100_000,
  invested_capital: 80_000,
  total_pnl: 20_000,
  twr,
  twr_status: 'ok',
  twr_reason: null,
  xirr: 10,
  xirr_status: 'ok',
  xirr_reason: null,
});

const group = (history, twr = 0) => ({
  summary: summary(twr),
  holdings: [],
  history,
});

test('common-period TWR uses the first and last exact shared reliable dates and existing linked-TWR rebasing', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Alpha: group([
        { date: '2026-01-01', twr: 0, twr_status: 'not_applicable' },
        { date: '2026-01-02', twr: 10, twr_status: 'ok' },
        { date: '2026-01-03', twr: 21, twr_status: 'ok' },
        { date: '2026-01-05', twr: 33.1, twr_status: 'ok' },
      ], 33.1),
      Core: group([
        { date: '2025-12-31', twr: 0, twr_status: 'not_applicable' },
        { date: '2026-01-02', twr: 5, twr_status: 'ok' },
        { date: '2026-01-04', twr: 15, twr_status: 'ok' },
        { date: '2026-01-05', twr: 26, twr_status: 'ok' },
      ], 26),
    },
  });

  assert.equal(overview.commonPeriodTwr.status, 'ready');
  assert.equal(overview.commonPeriodTwr.startDate, '2026-01-02');
  assert.equal(overview.commonPeriodTwr.endDate, '2026-01-05');

  const alpha = overview.groups.find(item => item.name === 'Alpha');
  const core = overview.groups.find(item => item.name === 'Core');
  approx(alpha.commonPeriodTwr.value, ((1.331 / 1.10) - 1) * 100);
  approx(core.commonPeriodTwr.value, ((1.26 / 1.05) - 1) * 100);
  assert.equal(alpha.commonPeriodTwr.status, 'ok');
  assert.equal(core.commonPeriodTwr.status, 'ok');
});

test('common-period TWR is exact-date only and never invents nearest-date alignment', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Alpha: group([
        { date: '2026-01-02', twr: 1, twr_status: 'ok' },
        { date: '2026-01-05', twr: 5, twr_status: 'ok' },
      ]),
      Core: group([
        { date: '2026-01-03', twr: 2, twr_status: 'ok' },
        { date: '2026-01-05', twr: 6, twr_status: 'ok' },
      ]),
    },
  });

  assert.equal(overview.commonPeriodTwr.status, 'unavailable');
  assert.equal(overview.commonPeriodTwr.reason, 'insufficient_common_reliable_dates');
  assert.equal(overview.commonPeriodTwr.startDate, null);
  assert.equal(overview.commonPeriodTwr.endDate, null);
  assert.equal(overview.groups.every(item => item.commonPeriodTwr.value === null), true);
});

test('unreliable TWR points cannot become a common-period endpoint', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Alpha: group([
        { date: '2026-01-02', twr: 1, twr_status: 'ok' },
        { date: '2026-01-05', twr: 5, twr_status: 'ok' },
      ]),
      Core: group([
        { date: '2026-01-02', twr: 2, twr_status: 'ok' },
        {
          date: '2026-01-05',
          twr: 6,
          twr_status: 'undefined',
          twr_invalid_since: '2026-01-05',
        },
      ]),
    },
  });

  assert.equal(overview.commonPeriodTwr.status, 'unavailable');
  assert.equal(overview.commonPeriodTwr.reason, 'insufficient_common_reliable_dates');
});

test('duplicate history dates fail the common-period comparison closed instead of picking one row', () => {
  const overview = buildStrategyGroupOverview({
    groups: {
      Alpha: group([
        { date: '2026-01-02', twr: 1, twr_status: 'ok' },
        { date: '2026-01-02', twr: 2, twr_status: 'ok' },
        { date: '2026-01-05', twr: 5, twr_status: 'ok' },
      ]),
      Core: group([
        { date: '2026-01-02', twr: 2, twr_status: 'ok' },
        { date: '2026-01-05', twr: 6, twr_status: 'ok' },
      ]),
    },
  });

  assert.equal(overview.commonPeriodTwr.status, 'unavailable');
  assert.equal(overview.commonPeriodTwr.reason, 'duplicate_history_date');
});

test('common-period strategy UI reuses TWR authority and does not become a ranking/accounting engine', async () => {
  const serviceSource = await readFile(new URL('../src/services/strategyGroupOverview.js', import.meta.url), 'utf8');
  const componentSource = await readFile(new URL('../src/components/StrategyGroupOverview.vue', import.meta.url), 'utf8');

  assert.match(serviceSource, /import \{ isTwrPointReliable, relativeTwrValue \} from '\.\/twrState\.js'/);
  assert.match(serviceSource, /relativeTwrValue\(rows\.get\(endDate\), rows\.get\(startDate\)\)/);
  assert.doesNotMatch(serviceSource, /ModifiedDietz|cashflow|benchmark_twr|nearest|asof/i);

  assert.match(componentSource, /共同期間 TWR/);
  assert.match(componentSource, /完全相同日期/);
  assert.match(componentSource, /不做近似日期或補值/);
  assert.match(componentSource, /不依績效排序/);
  assert.match(componentSource, /完整歷史 TWR/);
  assert.doesNotMatch(componentSource, /best|winner|排名第|Sharpe|Sortino|MDD/i);
  assert.doesNotMatch(componentSource, /fetch\(|\/api\//);
});