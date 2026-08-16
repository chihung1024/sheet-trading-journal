import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildOverviewProjection } from '../src/services/overviewProjection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const dailyExplanation = {
  status: 'ready',
  publishedTotalTwd: 20,
  rows: [
    { symbol: 'AAA', currency: 'USD', totalPnlTwd: 30 },
    { symbol: 'BBB', currency: 'USD', totalPnlTwd: -10 },
  ],
};

const concentration = {
  status: 'ok',
  largest: { symbol: 'AAA', weight: 60 },
  top3Weight: 90,
  positionCount: 4,
};

test('overview projection composes reviewed facts without becoming a second accounting engine', () => {
  const projection = buildOverviewProjection({
    stats: {
      total_value: 1000,
      invested_capital: 800,
      total_pnl: 250,
      realized_pnl: 50,
      daily_pnl_roi_percent: 1.25,
      twr: 10,
      twr_status: 'ok',
      xirr: 15,
      xirr_status: 'ok',
    },
    dailyExplanation,
    concentration,
    pendingDividends: [],
    records: [],
  });

  assert.equal(projection.headline.marketValue, 1000);
  assert.equal(projection.headline.holdingCost, 800);
  assert.equal(projection.headline.totalPnl, 250);
  assert.equal(projection.headline.unrealizedPnl, 200);
  assert.equal(projection.headline.unrealizedReturnPercent, 25);
  assert.equal(projection.headline.daily.pnlTwd, 20);
  assert.equal(projection.headline.daily.returnPercent, 1.25);
  assert.equal(projection.context.daily.contributor.symbol, 'AAA');
  assert.equal(projection.context.daily.detractor.symbol, 'BBB');
  assert.equal(projection.context.concentration.top3Weight, 90);
});

test('overview projection fails closed for unreviewed daily or concentration facts', () => {
  const projection = buildOverviewProjection({
    stats: { total_value: 1000, invested_capital: 0, total_pnl: 10, realized_pnl: 0 },
    dailyExplanation: { status: 'unavailable', rows: [{ symbol: 'BAD', totalPnlTwd: 999 }] },
    concentration: { status: 'unavailable', largest: { symbol: 'BAD', weight: 100 } },
  });

  assert.equal(projection.headline.daily.status, 'unavailable');
  assert.equal(projection.headline.daily.pnlTwd, null);
  assert.equal(projection.headline.unrealizedReturnPercent, null);
  assert.equal(projection.context.daily.contributor, null);
  assert.equal(projection.context.concentration.status, 'unavailable');
});

test('OverviewPage remains the single page-level owner of reviewed daily PnL and concentration projections', () => {
  const app = read('src/App.vue');
  const overview = read('src/components/OverviewPage.vue');
  const headline = read('src/components/OverviewHeadline.vue');
  const context = read('src/components/OverviewContext.vue');
  const projection = read('src/services/overviewProjection.js');

  assert.match(app, /<OverviewPage/);
  assert.doesNotMatch(app, /<OverviewHeadline|<OverviewContext/);

  assert.equal((overview.match(/buildDailyPnlExplanation/g) || []).length, 2, 'one import and one call expected');
  assert.equal((overview.match(/buildPortfolioConcentrationSnapshot/g) || []).length, 2, 'one import and one call expected');
  assert.equal((overview.match(/buildOverviewProjection/g) || []).length, 2, 'one import and one call expected');
  assert.match(overview, /<OverviewHeadline/);
  assert.match(overview, /<OverviewContext/);
  assert.match(overview, /<PerformanceChart/);
  assert.doesNotMatch(overview, /<DailyCommandCenter|<StatsGrid/);

  assert.doesNotMatch(headline, /usePortfolioStore|buildDailyPnlExplanation|buildPortfolioConcentrationSnapshot/);
  assert.doesNotMatch(context, /usePortfolioStore|buildDailyPnlExplanation|buildPortfolioConcentrationSnapshot/);
  assert.doesNotMatch(projection, /usePortfolioStore|fetch\(|localStorage|addRecord|updateRecord|deleteRecord/);
});

test('overview information ownership gives each headline fact one primary numeral owner', () => {
  const headline = read('src/components/OverviewHeadline.vue');
  const context = read('src/components/OverviewContext.vue');
  const detail = read('src/components/DailyPnlExplanation.vue');

  assert.match(headline, />今日損益</);
  assert.match(headline, />持倉市值</);
  assert.match(headline, />累計損益</);

  assert.match(context, />損益驅動</);
  assert.doesNotMatch(context, />今日損益</);
  assert.doesNotMatch(context, /publishedTotalTwd/);

  assert.match(detail, /當日損益來源/);
  assert.doesNotMatch(detail, /published-total/);
  assert.doesNotMatch(detail, /explanation\.publishedTotalTwd/);
});

test('attention is exception-driven and Overview context does not create a persistent attention authority', () => {
  const context = read('src/components/OverviewContext.vue');
  const projection = read('src/services/overviewProjection.js');

  assert.match(context, /v-if="attention\.dividends\.count > 0"/);
  assert.match(context, /配息等待核對/);
  assert.match(projection, /buildDividendAttention/);
  assert.doesNotMatch(`${context}\n${projection}`, /localStorage|sessionStorage|attentionState|markAsRead/i);
});
