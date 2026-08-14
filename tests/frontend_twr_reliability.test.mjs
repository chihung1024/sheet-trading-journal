import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildComparableTwrComparison,
  firstTwrInvalidDate,
  isTwrSummaryAvailable,
  lastFiniteSeriesIndex,
  relativeTwrValue,
} from '../src/services/twrState.js';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const approx = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('legacy and ok TWR summaries remain display-compatible while unavailable new states fail closed', () => {
  assert.equal(isTwrSummaryAvailable(undefined), true);
  assert.equal(isTwrSummaryAvailable(null), true);
  assert.equal(isTwrSummaryAvailable('ok'), true);
  assert.equal(isTwrSummaryAvailable('not_applicable'), false);
  assert.equal(isTwrSummaryAvailable('undefined'), false);
});

test('relative TWR preserves legacy/ok math and returns null for unreliable or null points', () => {
  approx(relativeTwrValue({ twr: 10 }, { twr: 0 }), 10);
  approx(
    relativeTwrValue(
      { twr: 10, twr_status: 'ok' },
      { twr: 0, twr_status: 'not_applicable' },
    ),
    10,
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
  assert.equal(relativeTwrValue({ twr: null }, { twr: 0 }), null);
  assert.equal(relativeTwrValue({ twr: 10 }, { twr: null }), null);
});

test('TWR comparison starts from the first common reliable strategy/benchmark date and rebases both to zero', () => {
  const comparison = buildComparableTwrComparison([
    { date: '2026-07-30', twr: null, twr_status: 'not_applicable', benchmark_twr: 0 },
    { date: '2026-07-31', twr: null, twr_status: 'not_applicable', benchmark_twr: 2 },
    { date: '2026-08-01', twr: 2, twr_status: 'ok', benchmark_twr: 5 },
    { date: '2026-08-03', twr: 4, twr_status: 'ok', benchmark_twr: 7 },
  ]);

  assert.equal(comparison.anchor.date, '2026-08-01');
  assert.deepEqual(comparison.rows.map(row => row.date), ['2026-08-01', '2026-08-03']);
  approx(comparison.strategy[0], 0);
  approx(comparison.benchmark[0], 0);
  approx(comparison.strategy[1], ((1.04 / 1.02) - 1) * 100);
  approx(comparison.benchmark[1], ((1.07 / 1.05) - 1) * 100);
});

test('benchmark comparison never extends through a strategy TWR reliability gap', () => {
  const comparison = buildComparableTwrComparison([
    { date: '2026-08-01', twr: 1, twr_status: 'ok', benchmark_twr: 3 },
    { date: '2026-08-02', twr: 2, twr_status: 'ok', benchmark_twr: 4 },
    { date: '2026-08-03', twr: 2, twr_status: 'undefined', benchmark_twr: 6 },
  ]);

  assert.equal(comparison.strategy[2], null);
  assert.equal(comparison.benchmark[2], null);
});

test('TWR comparison rejects missing or non-numeric benchmark values instead of coercing them to zero', () => {
  const comparison = buildComparableTwrComparison([
    { date: '2026-08-01', twr: 1, twr_status: 'ok', benchmark_twr: null },
    { date: '2026-08-02', twr: 2, twr_status: 'ok', benchmark_twr: undefined },
    { date: '2026-08-03', twr: 3, twr_status: 'ok', benchmark_twr: 6 },
  ]);

  assert.equal(comparison.anchor.date, '2026-08-03');
  assert.deepEqual(comparison.strategy, [0]);
  assert.deepEqual(comparison.benchmark, [0]);
});

test('TWR comparison fails closed when there is no common reliable anchor', () => {
  const comparison = buildComparableTwrComparison([
    { date: '2026-08-01', twr: null, twr_status: 'not_applicable', benchmark_twr: 3 },
    { date: '2026-08-02', twr: 2, twr_status: 'undefined', benchmark_twr: 4 },
  ]);

  assert.equal(comparison.anchor, null);
  assert.deepEqual(comparison.rows, []);
  assert.deepEqual(comparison.strategy, []);
  assert.deepEqual(comparison.benchmark, []);
});

test('last finite chart point skips null gaps instead of coercing null to numeric zero', () => {
  assert.equal(lastFiniteSeriesIndex([1, 2, null, null]), 1);
  assert.equal(lastFiniteSeriesIndex([1, undefined, Number.NaN]), 0);
  assert.equal(lastFiniteSeriesIndex([null, undefined, Number.NaN]), -1);
  assert.equal(lastFiniteSeriesIndex([1, '2.5']), 1);
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

  assert.match(chart, /buildComparableTwrComparison/);
  assert.match(chart, /firstTwrInvalidDate/);
  assert.match(chart, /lastFiniteSeriesIndex/);
  assert.match(chart, /策略 TWR 自/);
  assert.doesNotMatch(chart, /const baseBenchmark = baselineData\.value\.benchmark_twr/);
});
