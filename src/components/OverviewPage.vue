<template>
  <section class="section-overview">
    <OverviewHeadline
      v-if="!store.loading"
      :model="overview.headline"
    />
    <OverviewHeadlineSkeleton v-else />

    <OverviewContext
      v-if="!store.loading"
      :model="overview.context"
      :attention="overview.attention"
      :explanation-open="isDailyExplanationOpen"
      :daily-explanation-ready="dailyPnlExplanation.status === 'ready'"
      @toggle-explanation="isDailyExplanationOpen = !isDailyExplanationOpen"
      @navigate="emit('navigate', $event)"
    />

    <DailyPnlExplanation
      v-if="!store.loading && isDailyExplanationOpen && dailyPnlExplanation.status === 'ready'"
      :explanation="dailyPnlExplanation"
      :group-name="store.currentGroup"
      :prev-date="store.stats.daily_pnl_prev_date || ''"
      :as-of-date="store.stats.daily_pnl_asof_date || ''"
    />

    <section class="trend-section" aria-labelledby="overview-trend-title">
      <div class="trend-heading">
        <div>
          <span class="trend-eyebrow">長期</span>
          <h2 id="overview-trend-title">績效與趨勢</h2>
        </div>
        <p>數字看現在，圖表只負責回答時間序列。</p>
      </div>
      <div class="chart-wrapper chart-full">
        <PerformanceChart v-if="!store.loading" />
        <ChartSkeleton v-else />
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import { buildOverviewProjection } from '../services/overviewProjection.js';
import OverviewHeadline from './OverviewHeadline.vue';
import OverviewContext from './OverviewContext.vue';
import DailyPnlExplanation from './DailyPnlExplanation.vue';
import PerformanceChart from './PerformanceChart.vue';
import OverviewHeadlineSkeleton from './skeletons/OverviewHeadlineSkeleton.vue';
import ChartSkeleton from './skeletons/ChartSkeleton.vue';

const emit = defineEmits(['navigate']);
const store = usePortfolioStore();
const isDailyExplanationOpen = ref(false);

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

const overview = computed(() => buildOverviewProjection({
  stats: store.stats,
  dailyExplanation: dailyPnlExplanation.value,
  concentration: concentration.value,
  pendingDividends: store.pending_dividends,
  records: store.records,
}));

watch(
  () => store.currentGroup,
  () => {
    isDailyExplanationOpen.value = false;
  },
);

watch(
  () => dailyPnlExplanation.value.status,
  status => {
    if (status !== 'ready') isDailyExplanationOpen.value = false;
  },
);
</script>

<style scoped>
.section-overview {
  display: flex;
  flex-direction: column;
  gap: var(--ui-page-gap);
}

.trend-section {
  padding: 18px 20px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.trend-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.trend-eyebrow {
  display: block;
  margin-bottom: 3px;
  color: var(--text-sub);
  font-size: var(--type-caption);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.trend-heading h2 {
  margin: 0;
  font-size: var(--type-section);
}

.trend-heading p {
  max-width: 440px;
  margin: 2px 0 0;
  color: var(--text-sub);
  font-size: var(--type-label);
  text-align: right;
}

@media (max-width: 768px) {
  .trend-section { padding: 14px; }
  .trend-heading { display: block; }
  .trend-heading p { margin-top: 4px; max-width: none; text-align: left; }
}
</style>
