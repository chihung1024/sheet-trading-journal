import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildPortfolioAllocationDonutModel } from '../src/services/portfolioAllocationPresentation.js';

const holdingsSource = fs.readFileSync(new URL('../src/components/HoldingsTable.vue', import.meta.url), 'utf8');
const donutSource = fs.readFileSync(new URL('../src/components/PortfolioAllocationDonut.vue', import.meta.url), 'utf8');

const concentration = weights => ({
  status: 'ok',
  weightsBySymbol: Object.freeze({ ...weights }),
  top3Weight: Object.values(weights)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((sum, value) => sum + value, 0),
});

test('allocation donut reuses reconciled concentration weights and preserves ordering', () => {
  const model = buildPortfolioAllocationDonutModel(concentration({ A: 40, B: 30, C: 20, D: 10 }));

  assert.equal(model.status, 'ready');
  assert.deepEqual(model.segments.map(segment => segment.label), ['A', 'B', 'C', 'D']);
  assert.deepEqual(model.segments.map(segment => segment.offset), [0, 40, 70, 90]);
  assert.equal(model.positionCount, 4);
  assert.equal(model.top3Weight, 90);
  assert.equal(model.segments.reduce((sum, segment) => sum + segment.weight, 0), 100);
});

test('allocation donut collapses smaller holdings into one explicit other segment', () => {
  const model = buildPortfolioAllocationDonutModel(concentration({
    A: 25,
    B: 20,
    C: 15,
    D: 12,
    E: 10,
    F: 8,
    G: 5,
    H: 3,
    I: 2,
  }));

  assert.equal(model.status, 'ready');
  assert.equal(model.segments.length, 8);
  const other = model.segments.at(-1);
  assert.equal(other.label, '其他');
  assert.equal(other.otherCount, 2);
  assert.equal(other.weight, 5);
  assert.equal(model.segments.reduce((sum, segment) => sum + segment.weight, 0), 100);
});

test('allocation donut fails closed when concentration is not reconciled or weights do not total 100', () => {
  assert.equal(
    buildPortfolioAllocationDonutModel({ status: 'unavailable' }).status,
    'unavailable',
  );

  const mismatch = buildPortfolioAllocationDonutModel({
    status: 'ok',
    weightsBySymbol: { A: 50, B: 40 },
    top3Weight: 90,
  });
  assert.equal(mismatch.status, 'unavailable');
  assert.equal(mismatch.reason, 'WEIGHT_TOTAL_MISMATCH');
});

test('HoldingsTable renders the donut from the existing concentration projection', () => {
  assert.match(holdingsSource, /import PortfolioAllocationDonut from '\.\/PortfolioAllocationDonut\.vue'/);
  assert.match(holdingsSource, /<PortfolioAllocationDonut :snapshot="concentration" \/>/);
  assert.doesNotMatch(holdingsSource, /sector|industry|sub[_-]?industry/i);
});

test('donut is accessible and has no store, API, or mutation dependency', () => {
  assert.match(donutSource, /role="img"/);
  assert.match(donutSource, /:aria-label=/);
  assert.match(donutSource, /buildPortfolioAllocationDonutModel/);
  assert.doesNotMatch(donutSource, /usePortfolioStore|fetch\(|axios|localStorage|\/api\//);
});
