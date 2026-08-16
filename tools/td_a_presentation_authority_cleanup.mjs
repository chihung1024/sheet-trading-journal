import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const write = (relative, content) => fs.writeFileSync(path.join(ROOT, relative), content);

function replaceExact(relative, before, after) {
  const source = read(relative);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${relative}: expected exact snippet once, found ${count}`);
  write(relative, source.replace(before, after));
}

function replacePattern(relative, pattern, after, label) {
  const source = read(relative);
  const matches = source.match(pattern);
  if (!matches) throw new Error(`${relative}: missing ${label}`);
  const replaced = source.replace(pattern, after);
  if (replaced === source) throw new Error(`${relative}: ${label} replacement made no change`);
  write(relative, replaced);
}

function createNew(relative, content) {
  const full = path.join(ROOT, relative);
  if (fs.existsSync(full)) throw new Error(`${relative}: already exists`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  write(relative, content);
}

createNew('src/services/dividendAttention.js', `import {
  buildConfirmedDividendKeySet,
  getPendingDividendEventKey,
} from './dividendConfirmation.js';
import { sortDividendRowsRecentFirst } from './dividendWorkflowPresentation.js';

export const buildDividendAttention = ({
  pendingDividends = [],
  records = [],
} = {}) => {
  const confirmedKeys = buildConfirmedDividendKeySet(records);
  const candidates = sortDividendRowsRecentFirst(
    Array.isArray(pendingDividends)
      ? pendingDividends.filter(dividend => {
        const key = getPendingDividendEventKey(dividend);
        return Boolean(key && !confirmedKeys.has(key));
      })
      : [],
  );

  return Object.freeze({
    status: 'ready',
    count: candidates.length,
    next: candidates[0] || null,
    candidates: Object.freeze(candidates),
  });
};
`);

replaceExact(
  'src/services/dailyCommandCenter.js',
`import {
  buildConfirmedDividendKeySet,
  getPendingDividendEventKey,
} from './dividendConfirmation.js';
import { sortDividendRowsRecentFirst } from './dividendWorkflowPresentation.js';
import { recordMatchesHistoryFilters } from './recordHistoryPresentation.js';`,
`import { buildDividendAttention } from './dividendAttention.js';
import { recordMatchesHistoryFilters } from './recordHistoryPresentation.js';`,
);

replacePattern(
  'src/services/dailyCommandCenter.js',
  /  const confirmedKeys = buildConfirmedDividendKeySet\(records\);[\s\S]*?  const recentRecord = Array\.isArray\(records\)/,
`  const dividendAttention = buildDividendAttention({ pendingDividends, records });

  const recentRecord = Array.isArray(records)`,
  'inline dividend confirmation projection',
);

replaceExact(
  'src/services/dailyCommandCenter.js',
`    dividends: Object.freeze({
      status: 'ready',
      count: dividendCandidates.length,
      next: dividendCandidates[0] || null,
    }),`,
`    dividends: Object.freeze({
      status: dividendAttention.status,
      count: dividendAttention.count,
      next: dividendAttention.next,
    }),`,
);

createNew('src/components/OverviewPage.vue', `<template>
  <section class="section-overview">
    <DailyCommandCenter
      v-if="!store.loading"
      :daily-explanation="dailyPnlExplanation"
      :concentration="concentration"
      @navigate="emit('navigate', $event)"
    />

    <div class="section-stats">
      <StatsGrid
        v-if="!store.loading"
        :daily-pnl-explanation="dailyPnlExplanation"
      />
      <StatsGridSkeleton v-else />
    </div>

    <div class="section-charts">
      <div class="chart-wrapper chart-full">
        <PerformanceChart v-if="!store.loading" />
        <ChartSkeleton v-else />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import DailyCommandCenter from './DailyCommandCenter.vue';
import StatsGrid from './StatsGrid.vue';
import PerformanceChart from './PerformanceChart.vue';
import StatsGridSkeleton from './skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './skeletons/ChartSkeleton.vue';

const emit = defineEmits(['navigate']);
const store = usePortfolioStore();

const currentDayLedger = computed(() => selectCurrentGroupDayLedger({
  rawData: store.rawData,
  currentGroup: store.currentGroup,
}));

const dailyPnlExplanation = computed(() => buildDailyPnlExplanation({
  dayLedger: currentDayLedger.value,
  summary: store.stats,
}));

const concentration = computed(() => buildPortfolioConcentrationSnapshot(
  store.holdings,
  store.stats.total_value,
));
</script>

<style scoped>
.section-overview {
  display: flex;
  flex-direction: column;
  gap: var(--ui-page-gap);
}
</style>
`);

replacePattern(
  'src/App.vue',
  /          <!-- 總覽：Stats \+ 圖表 -->[\s\S]*?          <!-- 圖表 -->/,
`          <!-- 總覽 -->
          <OverviewPage
            v-if="activeView === 'overview'"
            @navigate="activeView = $event"
          />

          <!-- 圖表 -->`,
  'inline overview composition',
);

replaceExact(
  'src/App.vue',
`import { buildDataSyncPresentation } from './services/dataSyncPresentation.js';
import { isSnapshotVerificationCurrent } from './services/snapshotVerification.js';`,
`import { buildDataSyncPresentation } from './services/dataSyncPresentation.js';
import { buildDividendAttention } from './services/dividendAttention.js';
import { isSnapshotVerificationCurrent } from './services/snapshotVerification.js';`,
);

replaceExact(
  'src/App.vue',
`import DataReliabilityBanner from './components/DataReliabilityBanner.vue';
import DailyCommandCenter from './components/DailyCommandCenter.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';`,
`import DataReliabilityBanner from './components/DataReliabilityBanner.vue';
import OverviewPage from './components/OverviewPage.vue';
import PerformanceChart from './components/PerformanceChart.vue';`,
);

replaceExact(
  'src/App.vue',
`import StatsGridSkeleton from './components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';`,
`import ChartSkeleton from './components/skeletons/ChartSkeleton.vue';`,
);

replaceExact(
  'src/App.vue',
`const hasPendingDividends = computed(() => portfolioStore.pending_dividends?.length > 0);
const pendingDividendsCount = computed(() => portfolioStore.pending_dividends ? portfolioStore.pending_dividends.length : 0);`,
`const dividendAttention = computed(() => buildDividendAttention({
  pendingDividends: portfolioStore.pending_dividends,
  records: portfolioStore.records,
}));
const hasPendingDividends = computed(() => dividendAttention.value.count > 0);
const pendingDividendsCount = computed(() => dividendAttention.value.count);`,
);

replaceExact(
  'src/App.vue',
`.main-column { display: flex; flex-direction: column; gap: var(--space-desktop); min-width: 0; overflow-x: hidden; }
.section-overview { display: flex; flex-direction: column; gap: var(--space-desktop); }
.side-column { min-width: 0; }`,
`.main-column { display: flex; flex-direction: column; gap: var(--space-desktop); min-width: 0; overflow-x: hidden; }
.side-column { min-width: 0; }`,
);

replaceExact(
  'src/components/DailyCommandCenter.vue',
`import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import { buildDailyCommandSnapshot } from '../services/dailyCommandCenter.js';

const emit = defineEmits(['navigate']);
const store = usePortfolioStore();
const isExpanded = ref(false);`,
`import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { buildDailyCommandSnapshot } from '../services/dailyCommandCenter.js';

const props = defineProps({
  dailyExplanation: { type: Object, required: true },
  concentration: { type: Object, required: true },
});
const emit = defineEmits(['navigate']);
const store = usePortfolioStore();
const isExpanded = ref(false);`,
);

replacePattern(
  'src/components/DailyCommandCenter.vue',
  /const dailyExplanation = computed\(\(\) => buildDailyPnlExplanation\([\s\S]*?const concentration = computed\(\(\) => buildPortfolioConcentrationSnapshot\([\s\S]*?\)\);\n\n/,
  '',
  'duplicate daily/concentration derivation',
);

replaceExact(
  'src/components/DailyCommandCenter.vue',
`  dailyExplanation: dailyExplanation.value,
  concentration: concentration.value,`,
`  dailyExplanation: props.dailyExplanation,
  concentration: props.concentration,`,
);

replaceExact(
  'src/components/StatsGrid.vue',
`import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { isTwrSummaryAvailable } from '../services/twrState.js';`,
`import { isTwrSummaryAvailable } from '../services/twrState.js';`,
);

replaceExact(
  'src/components/StatsGrid.vue',
`const store = usePortfolioStore();

const stats = computed(() => store.stats || {});`,
`const store = usePortfolioStore();
const props = defineProps({
  dailyPnlExplanation: { type: Object, required: true },
});

const stats = computed(() => store.stats || {});`,
);

replacePattern(
  'src/components/StatsGrid.vue',
  /const currentDayLedger = computed\(\(\) => selectCurrentGroupDayLedger\([\s\S]*?const dailyPnlExplanation = computed\(\(\) => buildDailyPnlExplanation\([\s\S]*?\)\);/,
`const dailyPnlExplanation = computed(() => props.dailyPnlExplanation);`,
  'duplicate daily PnL derivation',
);

replacePattern(
  'tests/frontend_daily_pnl_explainability.test.mjs',
  /test\('StatsGrid delegates group selection and exposes a mobile-accessible explanation control',[\s\S]*?\n\}\);\s*$/,
`test('OverviewPage owns group selection while StatsGrid only presents the reviewed explanation', async () => {
  const overviewSource = await readFile(new URL('../src/components/OverviewPage.vue', import.meta.url), 'utf8');
  const statsSource = await readFile(new URL('../src/components/StatsGrid.vue', import.meta.url), 'utf8');
  const detailSource = await readFile(new URL('../src/components/DailyPnlExplanation.vue', import.meta.url), 'utf8');

  assert.match(overviewSource, /selectCurrentGroupDayLedger\\(\\{/);
  assert.match(overviewSource, /rawData:\\s*store\\.rawData/);
  assert.match(overviewSource, /currentGroup:\\s*store\\.currentGroup/);
  assert.match(overviewSource, /buildDailyPnlExplanation/);
  assert.match(overviewSource, /:daily-pnl-explanation="dailyPnlExplanation"/);

  assert.doesNotMatch(statsSource, /selectCurrentGroupDayLedger|buildDailyPnlExplanation/);
  assert.match(statsSource, /dailyPnlExplanation:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
  assert.match(statsSource, /:aria-expanded="isDailyExplanationOpen"/);
  assert.match(statsSource, /aria-controls="daily-pnl-explanation"/);
  assert.match(statsSource, /查看損益來源/);
  assert.match(statsSource, /<DailyPnlExplanation/);
  assert.doesNotMatch(statsSource, /store\\.rawData\\.groups|rawData\\.groups/);

  assert.match(detailSource, /id="daily-pnl-explanation"/);
  assert.match(detailSource, /計算引擎已對帳的逐檔 day ledger/);
  assert.match(detailSource, /四捨五入至 TWD 整數/);
  assert.doesNotMatch(detailSource, /fetch\\(|\\/api\\//);
});
`,
  'StatsGrid explainability ownership test',
);

replaceExact(
  'tests/frontend_daily_command_center.test.mjs',
`  const service = read('src/services/dailyCommandCenter.js');
  const component = read('src/components/DailyCommandCenter.vue');
  const combined = \`${'${service}'}\\n${'${component}'}\`;`,
`  const service = read('src/services/dailyCommandCenter.js');
  const attention = read('src/services/dividendAttention.js');
  const component = read('src/components/DailyCommandCenter.vue');
  const combined = \`${'${service}'}\\n${'${attention}'}\\n${'${component}'}\`;`,
);

replaceExact(
  'tests/frontend_daily_command_center.test.mjs',
`  assert.match(component, /buildDailyPnlExplanation/);
  assert.match(component, /buildPortfolioConcentrationSnapshot/);
  assert.match(service, /buildConfirmedDividendKeySet/);`,
`  assert.doesNotMatch(component, /buildDailyPnlExplanation|buildPortfolioConcentrationSnapshot/);
  assert.match(component, /dailyExplanation:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
  assert.match(component, /concentration:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
  assert.match(service, /buildDividendAttention/);
  assert.match(attention, /buildConfirmedDividendKeySet/);`,
);

replacePattern(
  'tests/frontend_daily_command_center.test.mjs',
  /test\('Overview mounts the command center and routes its navigation through existing activeView state',[\s\S]*?\n\}\);\s*$/,
`test('OverviewPage owns command-center composition and App only mounts the page controller', () => {
  const app = read('src/App.vue');
  const overview = read('src/components/OverviewPage.vue');
  assert.match(app, /import OverviewPage from '\\.\\/components\\/OverviewPage\\.vue';/);
  assert.match(app, /<OverviewPage[\\s\\S]*@navigate="activeView = \\$event"/);
  assert.doesNotMatch(app, /import DailyCommandCenter|import StatsGrid/);
  assert.match(overview, /<DailyCommandCenter/);
  assert.match(overview, /:daily-explanation="dailyPnlExplanation"/);
  assert.match(overview, /:concentration="concentration"/);
});
`,
  'Overview command-center ownership test',
);

createNew('tests/frontend_dividend_attention.test.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildDividendAttention } from '../src/services/dividendAttention.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('dividend attention excludes candidates already confirmed by authoritative DIV records', () => {
  const result = buildDividendAttention({
    pendingDividends: [
      { symbol: 'AAA', ex_date: '2026-08-15' },
      { symbol: 'BBB', ex_date: '2026-08-14' },
    ],
    records: [
      { txn_type: 'DIV', symbol: 'AAA', txn_date: '2026-08-15' },
    ],
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.count, 1);
  assert.equal(result.next.symbol, 'BBB');
  assert.deepEqual(result.candidates.map(row => row.symbol), ['BBB']);
});

test('dividend attention is recent-first and ignores malformed candidate identity', () => {
  const result = buildDividendAttention({
    pendingDividends: [
      { symbol: 'OLD', ex_date: '2026-08-01' },
      { symbol: '', ex_date: '2026-08-16' },
      { symbol: 'NEW', ex_date: '2026-08-16' },
    ],
    records: [],
  });

  assert.equal(result.count, 2);
  assert.deepEqual(result.candidates.map(row => row.symbol), ['NEW', 'OLD']);
});

test('navigation badge and command snapshot share the same records-authoritative attention service', () => {
  const app = read('src/App.vue');
  const service = read('src/services/dailyCommandCenter.js');

  assert.match(app, /buildDividendAttention/);
  assert.match(app, /pendingDividends:\\s*portfolioStore\\.pending_dividends/);
  assert.match(app, /records:\\s*portfolioStore\\.records/);
  assert.doesNotMatch(app, /pending_dividends\\?\\.length|pending_dividends\\.length/);
  assert.match(service, /buildDividendAttention/);
});
`);

createNew('tests/frontend_overview_read_model.test.mjs', `import assert from 'node:assert/strict';
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
  assert.doesNotMatch(stats, /from '..\\/services\\/dailyPnlExplainability|buildDailyPnlExplanation|selectCurrentGroupDayLedger/);
  assert.doesNotMatch(command, /from '..\\/services\\/dailyPnlExplainability|buildDailyPnlExplanation|buildPortfolioConcentrationSnapshot/);
});

test('Overview child surfaces receive reviewed facts as props instead of rebuilding them', () => {
  const overview = read('src/components/OverviewPage.vue');
  const stats = read('src/components/StatsGrid.vue');
  const command = read('src/components/DailyCommandCenter.vue');

  assert.match(overview, /:daily-pnl-explanation="dailyPnlExplanation"/);
  assert.match(overview, /:daily-explanation="dailyPnlExplanation"/);
  assert.match(overview, /:concentration="concentration"/);
  assert.match(stats, /dailyPnlExplanation:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
  assert.match(command, /dailyExplanation:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
  assert.match(command, /concentration:\\s*\\{\\s*type:\\s*Object,\\s*required:\\s*true/);
});
`);

console.log('TD-A presentation authority cleanup applied');
