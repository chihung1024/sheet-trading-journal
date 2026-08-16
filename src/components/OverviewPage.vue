<template>
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
