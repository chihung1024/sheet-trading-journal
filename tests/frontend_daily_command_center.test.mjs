import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildDailyCommandSnapshot } from '../src/services/dailyCommandCenter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const dailyExplanation = {
  status: 'ready',
  publishedTotalTwd: 125,
  rows: [
    { symbol: 'AAA', currency: 'USD', totalPnlTwd: 200 },
    { symbol: 'BBB', currency: 'USD', totalPnlTwd: -100 },
    { symbol: 'CCC', currency: 'TWD', totalPnlTwd: 25 },
  ],
};

const concentration = {
  status: 'ok',
  largest: { symbol: 'AAA', weight: 55 },
  top3Weight: 88,
  positionCount: 5,
};

const pendingDividends = [
  { symbol: 'AAA', ex_date: '2026-08-15' },
  { symbol: 'BBB', ex_date: '2026-08-14' },
];

const records = [
  { id: 9, txn_date: '2026-08-16', symbol: 'CCC', txn_type: 'BUY', tag: 'Growth' },
  { id: 8, txn_date: '2026-08-15', symbol: 'AAA', txn_type: 'DIV', tag: 'Auto-Dividend' },
  { id: 7, txn_date: '2026-08-13', symbol: 'BBB', txn_type: 'SELL', tag: 'Income' },
];

test('daily command snapshot selects published drivers without recalculating portfolio P&L', () => {
  const snapshot = buildDailyCommandSnapshot({
    dailyExplanation,
    concentration,
    pendingDividends,
    records,
    currentGroup: 'Growth',
  });

  assert.equal(snapshot.daily.status, 'ready');
  assert.equal(snapshot.daily.publishedTotalTwd, 125);
  assert.equal(snapshot.daily.contributor.symbol, 'AAA');
  assert.equal(snapshot.daily.contributor.totalPnlTwd, 200);
  assert.equal(snapshot.daily.detractor.symbol, 'BBB');
  assert.equal(snapshot.daily.detractor.totalPnlTwd, -100);

  assert.equal(snapshot.concentration.status, 'ready');
  assert.equal(snapshot.concentration.largest.symbol, 'AAA');
  assert.equal(snapshot.concentration.top3Weight, 88);
});

test('daily command snapshot fails closed when reviewed daily or concentration facts are unavailable', () => {
  const snapshot = buildDailyCommandSnapshot({
    dailyExplanation: { status: 'unavailable', rows: [{ symbol: 'BAD', totalPnlTwd: 999 }] },
    concentration: { status: 'unavailable', largest: { symbol: 'BAD', weight: 100 } },
    pendingDividends: [],
    records: [],
  });

  assert.equal(snapshot.daily.status, 'unavailable');
  assert.equal(snapshot.daily.publishedTotalTwd, null);
  assert.equal(snapshot.daily.contributor, null);
  assert.equal(snapshot.daily.detractor, null);
  assert.equal(snapshot.concentration.status, 'unavailable');
  assert.equal(snapshot.concentration.largest, null);
  assert.equal(snapshot.concentration.top3Weight, null);
});

test('dividend attention remains records-authoritative and recent transaction respects current group', () => {
  const snapshot = buildDailyCommandSnapshot({
    dailyExplanation,
    concentration,
    pendingDividends,
    records,
    currentGroup: 'Growth',
  });

  assert.equal(snapshot.dividends.count, 1);
  assert.equal(snapshot.dividends.next.symbol, 'BBB');
  assert.equal(snapshot.recentRecord.id, 9);
  assert.equal(snapshot.recentRecord.symbol, 'CCC');

  const income = buildDailyCommandSnapshot({
    dailyExplanation,
    concentration,
    pendingDividends,
    records,
    currentGroup: 'Income',
  });
  assert.equal(income.recentRecord.id, 7);
});

test('DailyCommandCenter stays presentation-only while becoming compact by default', () => {
  const service = read('src/services/dailyCommandCenter.js');
  const component = read('src/components/DailyCommandCenter.vue');
  const combined = `${service}\n${component}`;

  assert.match(component, /const isExpanded = ref\(false\)/);
  assert.match(component, /:aria-expanded="isExpanded"/);
  assert.match(component, /aria-controls="daily-command-details"/);
  assert.match(component, /v-if="isExpanded" id="daily-command-details"/);
  assert.match(component, /class="command-summary"/);
  assert.match(component, /Top 3 集中度/);
  assert.match(component, /待核對配息/);
  assert.match(component, /最近交易/);
  assert.match(component, /buildDailyPnlExplanation/);
  assert.match(component, /buildPortfolioConcentrationSnapshot/);
  assert.match(service, /buildConfirmedDividendKeySet/);
  assert.match(service, /recordMatchesHistoryFilters/);
  assert.match(component, /不在瀏覽器重算投資組合損益/);
  assert.match(component, /不建立風險分數/);
  assert.match(component, /不產生買賣建議/);
  assert.match(component, /emit\('navigate', 'holdings'\)/);
  assert.match(component, /emit\('navigate', 'dividends'\)/);
  assert.match(component, /emit\('navigate', 'records'\)/);

  assert.doesNotMatch(combined, /fetch\(|localStorage|addRecord|updateRecord|deleteRecord|riskScore|targetWeight|rebalance|forecast/i);
});

test('DailyCommandCenter collapses expanded detail when current group changes', () => {
  const component = read('src/components/DailyCommandCenter.vue');
  assert.match(
    component,
    /watch\(\s*\(\) => store\.currentGroup,[\s\S]*isExpanded\.value = false;/,
  );
});

test('Overview mounts the command center and routes its navigation through existing activeView state', () => {
  const app = read('src/App.vue');
  assert.match(app, /import DailyCommandCenter from '\.\/components\/DailyCommandCenter\.vue';/);
  assert.match(app, /<DailyCommandCenter\s+v-if="!portfolioStore\.loading"\s+@navigate="activeView = \$event"\s*\/>/s);
});
