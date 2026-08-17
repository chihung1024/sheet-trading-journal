<template>
  <section class="section-overview">
    <AccountValuePreview
      v-if="!store.loading"
      :model="accountValuePreview"
      :daily-account-pnl-ready="accountDailyPnl.status === 'ready'"
    />

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
      :scope="accountDailyPnl.status === 'ready' ? 'account' : 'securities'"
      :prev-date="effectiveDailyStats.daily_pnl_prev_date || ''"
      :as-of-date="effectiveDailyStats.daily_pnl_asof_date || ''"
    />

    <div class="chart-wrapper chart-full">
      <PerformanceChart v-if="!store.loading" />
      <ChartSkeleton v-else />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { buildAccountValuePreviewPresentation } from '../services/accountValuePreviewPresentation.js';
import { buildAccountDailyPnlPresentation } from '../services/accountDailyPnlPresentation.js';
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import { buildOverviewProjection } from '../services/overviewProjection.js';
import AccountValuePreview from './AccountValuePreview.vue';
import OverviewHeadline from './OverviewHeadline.vue';
import OverviewContext from './OverviewContext.vue';
import DailyPnlExplanation from './DailyPnlExplanation.vue';
import PerformanceChart from './PerformanceChart.vue';
import OverviewHeadlineSkeleton from './skeletons/OverviewHeadlineSkeleton.vue';
import ChartSkeleton from './skeletons/ChartSkeleton.vue';

const emit = defineEmits(['navigate']);
const store = usePortfolioStore();
const isDailyExplanationOpen = ref(false);

const accountValuePreview = computed(() => buildAccountValuePreviewPresentation({
  preview: store.rawData?.account_value_preview,
  currentGroup: store.currentGroup,
}));

const accountDailyPnl = computed(() => buildAccountDailyPnlPresentation({
  preview: store.rawData?.account_daily_pnl_preview,
  currentGroup: store.currentGroup,
}));

const effectiveDailyStats = computed(() => (
  accountDailyPnl.value.status === 'ready'
    ? { ...store.stats, ...accountDailyPnl.value.statsOverrides }
    : store.stats
));

const currentDayLedger = computed(() => (
  accountDailyPnl.value.status === 'ready'
    ? accountDailyPnl.value.dayLedger
    : selectCurrentGroupDayLedger({
      rawData: store.rawData,
      currentGroup: store.currentGroup,
    })
));

const dailyPnlExplanation = computed(() => buildDailyPnlExplanation({
  dayLedger: currentDayLedger.value,
  summary: effectiveDailyStats.value,
}));

const concentration = computed(() => buildPortfolioConcentrationSnapshot(
  store.holdings,
  store.stats.total_value,
));

const overview = computed(() => buildOverviewProjection({
  stats: effectiveDailyStats.value,
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

@media (min-width: 1025px) {
  .chart-wrapper.chart-full {
    height: clamp(360px, 44vh, 450px);
  }
}

@media (min-width: 1600px) {
  .section-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    align-items: start;
  }

  .section-overview > :deep(.account-value-preview),
  .section-overview > :deep(.daily-pnl-explanation),
  .section-overview > :deep(.headline-skeleton),
  .section-overview > .chart-wrapper {
    grid-column: 1 / -1;
  }

  .section-overview > :deep(.overview-headline) {
    grid-column: 1;
  }

  .section-overview > :deep(.overview-context) {
    grid-column: 2;
  }
}
</style>
