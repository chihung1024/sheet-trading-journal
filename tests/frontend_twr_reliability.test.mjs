import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  firstTwrInvalidDate,
  isTwrSummaryAvailable,
  relativeTwrValue,
} from '../src/services/twrState.js';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('legacy and ok TWR summaries remain display-compatible while unavailable new states fail closed', () => {
  assert.equal(isTwrSummaryAvailable(undefined), true);
  assert.equal(isTwrSummaryAvailable(null), true);
  assert.equal(isTwrSummaryAvailable('ok'), true);
  assert.equal(isTwrSummaryAvailable('not_applicable'), false);
  assert.equal(isTwrSummaryAvailable('undefined'), false);
});

test('relative TWR preserves legacy/ok math and returns null for unreliable strategy points', () => {
  assert.equal(relativeTwrValue({ twr: 10 }, { twr: 0 }), 10.000000000000009);
  assert.equal(
    relativeTwrValue(
      { twr: 10, twr_status: 'ok' },
      { twr: 0, twr_status: 'not_applicable' },
    ),
    10.000000000000009,
  );
  assert.equal(
    relativeTwrValue(
      { twr: 37.5, twr_status: 'undefined' },
      { twr: 0, twr_status: 'ok' },
    ),
    null,
  );
  assert.equal(
    relativeTwrValue(
      { twr: 12, twr_status: 'ok' },
      { twr: 5, twr_status: 'undefined' },
    ),
    null,
  );
});

test('first invalid TWR date follows sticky provenance rather than the displayed compatibility number', () => {
  const history = [
    { date: '2026-01-01', twr: 0, twr_status: 'not_applicable' },
    { date: '2026-01-02', twr: 5, twr_status: 'ok' },
    {
      date: '2026-01-05',
      twr: 5,
      twr_status: 'undefined',
      twr_invalid_since: '2026-01-05',
    },
    {
      date: '2026-01-06',
      twr: 7,
      twr_status: 'undefined',
      twr_invalid_since: '2026-01-05',
    },
  ];

  assert.equal(firstTwrInvalidDate(history), '2026-01-05');
});

test('StatsGrid and PerformanceChart must consume the shared TWR reliability contract', async () => {
  const stats = await read('src/components/StatsGrid.vue');
  const chart = await read('src/components/PerformanceChart.vue');

  assert.match(stats, /isTwrSummaryAvailable/);
  assert.match(stats, /twrAvailable/);
  assert.match(stats, /TWR 無法可靠計算/);

  assert.match(chart, /relativeTwrValue/);
  assert.match(chart, /firstTwrInvalidDate/);
  assert.match(chart, /策略 TWR 自/);
});
