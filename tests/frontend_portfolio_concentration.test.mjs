import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildPortfolioConcentrationSnapshot,
  getHoldingWeight,
} from '../src/services/portfolioConcentration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const holdings = [
  { symbol: 'AAA', market_value_twd: 600 },
  { symbol: 'BBB', market_value_twd: 300 },
  { symbol: 'CCC', market_value_twd: 100 },
  { symbol: 'ZERO', market_value_twd: 0 },
];

test('concentration snapshot derives factual weights from reconciled published holding values', () => {
  const snapshot = buildPortfolioConcentrationSnapshot(holdings, 1000);

  assert.equal(snapshot.status, 'ok');
  assert.equal(snapshot.totalMarketValueTwd, 1000);
  assert.equal(snapshot.positionCount, 3);
  assert.equal(snapshot.largest.symbol, 'AAA');
  assert.equal(snapshot.largest.weight, 60);
  assert.equal(snapshot.top3Weight, 100);
  assert.deepEqual(snapshot.topPositions.map(position => position.symbol), ['AAA', 'BBB', 'CCC']);
  assert.equal(getHoldingWeight(snapshot, ' aaa '), 60);
  assert.equal(getHoldingWeight(snapshot, 'ZERO'), 0);
});

test('concentration fails closed when holdings cannot reconcile to authoritative summary total', () => {
  const mismatch = buildPortfolioConcentrationSnapshot(holdings, 900);
  assert.equal(mismatch.status, 'unavailable');
  assert.equal(mismatch.reason, 'TOTAL_MISMATCH');
  assert.equal(getHoldingWeight(mismatch, 'AAA'), null);

  const duplicate = buildPortfolioConcentrationSnapshot([
    { symbol: 'aaa', market_value_twd: 500 },
    { symbol: 'AAA', market_value_twd: 500 },
  ], 1000);
  assert.equal(duplicate.status, 'unavailable');
  assert.equal(duplicate.reason, 'DUPLICATE_SYMBOL');

  const invalid = buildPortfolioConcentrationSnapshot([
    { symbol: 'AAA', market_value_twd: -1 },
  ], 0);
  assert.equal(invalid.status, 'unavailable');
  assert.equal(invalid.reason, 'INVALID_MARKET_VALUE');
});

test('no positive holdings is not applicable only when authoritative total is also zero', () => {
  assert.equal(
    buildPortfolioConcentrationSnapshot([{ symbol: 'AAA', market_value_twd: 0 }], 0).status,
    'not_applicable',
  );
  assert.equal(
    buildPortfolioConcentrationSnapshot([{ symbol: 'AAA', market_value_twd: 0 }], 100).reason,
    'TOTAL_MISMATCH',
  );
});

test('HoldingsTable exposes concentration facts and sortable per-holding weights on desktop and mobile', () => {
  const source = read('src/components/HoldingsTable.vue');

  assert.match(source, /buildPortfolioConcentrationSnapshot/);
  assert.match(source, /store\.holdings,\s*store\.stats\.total_value/s);
  assert.match(source, /持倉集中度/);
  assert.match(source, /最大持倉/);
  assert.match(source, /前 3 大合計/);
  assert.match(source, /不含現金/);
  assert.match(source, /不是風險評級、目標配置或買賣建議/);
  assert.match(source, /持倉市值與摘要總值目前無法一致對帳，系統不猜測權重/);
  assert.match(source, /@click="sortBy\('weight'\)"/);
  assert.match(source, /class="text-right font-num weight-cell">{{ formatHoldingWeight\(h\) }}/);
  assert.match(source, /class="weight-badge">{{ formatHoldingWeight\(h\) }}/);
  assert.match(source, /colspan="10"/);
});

test('Phase 10.4A remains presentation-only and introduces no portfolio scoring or recommendation engine', () => {
  const service = read('src/services/portfolioConcentration.js');
  const view = read('src/components/HoldingsTable.vue');
  const combined = `${service}\n${view}`;

  assert.doesNotMatch(combined, /riskScore|risk_score|targetWeight|target_weight|rebalance|forecast|expectedReturn|sharpe|sortino/i);
  assert.doesNotMatch(service, /fetch\(|usePortfolioStore|localStorage|addRecord|updateRecord|deleteRecord/);
});
