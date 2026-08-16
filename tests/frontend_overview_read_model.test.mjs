import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Overview has one page-level owner for reviewed daily PnL and concentration projections', () => {
  const app = read('src/App.vue');
  const overview = read('src/components/OverviewPage.vue');
  const stats = read('src/components/StatsGrid.vue');
  const command = read('src/components/DailyCommandCenter.vue');

  assert.match(app, /<OverviewPage/);
  assert.doesNotMatch(app, /<DailyCommandCenter|<StatsGrid/);

  assert.equal((overview.match(/buildDailyPnlExplanation/g) || []).length, 2, 'one import and one call expected');
  assert.equal((overview.match(/buildPortfolioConcentrationSnapshot/g) || []).length, 2, 'one import and one call expected');
  assert.doesNotMatch(stats, /from '..\/services\/dailyPnlExplainability|buildDailyPnlExplanation|selectCurrentGroupDayLedger/);
  assert.doesNotMatch(command, /from '..\/services\/dailyPnlExplainability|buildDailyPnlExplanation|buildPortfolioConcentrationSnapshot/);
});

test('Overview child surfaces receive reviewed facts as props instead of rebuilding them', () => {
  const overview = read('src/components/OverviewPage.vue');
  const stats = read('src/components/StatsGrid.vue');
  const command = read('src/components/DailyCommandCenter.vue');

  assert.match(overview, /:daily-pnl-explanation="dailyPnlExplanation"/);
  assert.match(overview, /:daily-explanation="dailyPnlExplanation"/);
  assert.match(overview, /:concentration="concentration"/);
  assert.match(stats, /dailyPnlExplanation:\s*\{\s*type:\s*Object,\s*required:\s*true/);
  assert.match(command, /dailyExplanation:\s*\{\s*type:\s*Object,\s*required:\s*true/);
  assert.match(command, /concentration:\s*\{\s*type:\s*Object,\s*required:\s*true/);
});
