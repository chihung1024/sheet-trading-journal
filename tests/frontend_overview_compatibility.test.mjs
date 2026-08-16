import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOverviewProjection } from '../src/services/overviewProjection.js';

const readyDaily = {
  status: 'ready',
  publishedTotalTwd: 25,
  rows: [],
};

test('overview preserves the legacy daily return fallback when the explicit percentage is absent', () => {
  const projection = buildOverviewProjection({
    stats: {
      total_value: 1000,
      invested_capital: 800,
      total_pnl: 200,
      realized_pnl: 0,
      daily_pnl_base_value: 500,
    },
    dailyExplanation: readyDaily,
  });

  assert.equal(projection.headline.daily.pnlTwd, 25);
  assert.equal(projection.headline.daily.returnPercent, 5);
});

test('overview prefers the published daily return percentage when available', () => {
  const projection = buildOverviewProjection({
    stats: {
      total_value: 1000,
      invested_capital: 800,
      total_pnl: 200,
      realized_pnl: 0,
      daily_pnl_roi_percent: 1.75,
      daily_pnl_base_value: 500,
    },
    dailyExplanation: readyDaily,
  });

  assert.equal(projection.headline.daily.returnPercent, 1.75);
});
