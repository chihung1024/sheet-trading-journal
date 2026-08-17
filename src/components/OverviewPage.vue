<template>
  <section class="section-overview">
    <AccountValuePreview
      v-if="!store.loading"
      :model="accountValuePreview"
    />

    <JournalBackupButton v-if="!store.loading" />

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
import {
  buildDailyPnlExplanation,
  selectCurrentGroupDayLedger,
} from '../services/dailyPnlExplainability.js';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';
import { buildOverviewProjection } from '../services/overviewProjection.js';
import AccountValuePreview from './AccountValuePreview.vue';
import JournalBackupButton from './JournalBackupButton.vue';
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
</style>
