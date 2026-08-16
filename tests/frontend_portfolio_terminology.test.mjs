import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const CURRENT_UI = [
  'src/components/StatsGrid.vue',
  'src/components/StrategyGroupOverview.vue',
  'src/components/PerformanceChart.vue',
];

test('current portfolio UI names securities values according to the actual calculator semantics', () => {
  const stats = read('src/components/StatsGrid.vue');
  const strategy = read('src/components/StrategyGroupOverview.vue');
  const chart = read('src/components/PerformanceChart.vue');

  assert.match(stats, /持倉市值/);
  assert.match(stats, /持倉成本/);
  assert.match(stats, /未實現報酬率:/);
  assert.match(strategy, /持倉市值/);
  assert.match(strategy, /持倉成本/);
  assert.match(chart, />持倉市值<\/button>/);
  assert.match(chart, /label:\s*'持倉市值'/);
});

test('misleading cash-inclusive or generic ROI labels cannot re-enter current portfolio surfaces', () => {
  const combined = CURRENT_UI.map(read).join('\n');
  assert.doesNotMatch(combined, /總資產淨值/);
  assert.doesNotMatch(combined, />總資產<\/button>/);
  assert.doesNotMatch(combined, /label:\s*'總資產'/);
  assert.doesNotMatch(combined, /ROI:\s*\{\{/);
});

test('documentation states that current total_value is holdings market value rather than cash-inclusive NAV', () => {
  const readme = read('README.md');
  const models = read('journal_engine/models.py');
  assert.match(readme, /持倉市值（Securities Market Value；目前不含未建模的現金部位）/);
  assert.match(readme, /未實現報酬率（Unrealized Return；未實現損益 ÷ 目前持倉成本）/);
  assert.match(models, /securities-holdings market value in TWD/);
  assert.match(models, /current positive holdings, not lifetime account deposits/);
});
