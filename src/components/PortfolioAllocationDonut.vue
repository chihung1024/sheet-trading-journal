<template>
  <div v-if="model.status === 'ready'" class="allocation-visual" aria-label="持倉比例圓環圖">
    <div class="allocation-heading">
      <div>
        <span class="allocation-label">持倉配置</span>
        <strong>TWD 市值比例</strong>
      </div>
      <span class="allocation-count">{{ model.positionCount }} 檔</span>
    </div>

    <div class="allocation-body">
      <div
        class="donut-wrap"
        role="img"
        :aria-label="`持倉配置圓環圖，共 ${model.positionCount} 檔，前 3 大合計 ${formatPercent(model.top3Weight)}`"
      >
        <svg class="donut" viewBox="0 0 42 42" aria-hidden="true">
          <circle class="donut-track" cx="21" cy="21" r="15.9155" fill="transparent" stroke-width="7" />
          <circle
            v-for="segment in model.segments"
            :key="segment.key"
            class="donut-segment"
            cx="21"
            cy="21"
            r="15.9155"
            fill="transparent"
            stroke-width="7"
            pathLength="100"
            :stroke="segmentColor(segment.paletteIndex)"
            :stroke-dasharray="`${segment.weight} ${100 - segment.weight}`"
            :stroke-dashoffset="-segment.offset"
          />
        </svg>
        <div class="donut-center">
          <strong>{{ formatPercent(model.top3Weight) }}</strong>
          <span>Top 3</span>
        </div>
      </div>

      <div class="allocation-legend" aria-label="持倉比例圖例">
        <div v-for="segment in model.segments" :key="`legend-${segment.key}`" class="legend-row">
          <span class="legend-swatch" :style="{ background: segmentColor(segment.paletteIndex) }"></span>
          <span class="legend-symbol">
            {{ segment.label }}<template v-if="segment.otherCount">（{{ segment.otherCount }} 檔）</template>
          </span>
          <strong>{{ formatPercent(segment.weight) }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { buildPortfolioAllocationDonutModel } from '../services/portfolioAllocationPresentation.js';

const props = defineProps({
  snapshot: {
    type: Object,
    required: true,
  },
});

const model = computed(() => buildPortfolioAllocationDonutModel(props.snapshot));

const palette = [
  'var(--allocation-1)',
  'var(--allocation-2)',
  'var(--allocation-3)',
  'var(--allocation-4)',
  'var(--allocation-5)',
  'var(--allocation-6)',
  'var(--allocation-7)',
  'var(--allocation-other)',
];

const segmentColor = index => palette[index % palette.length];
const formatPercent = value => `${Number(value || 0).toFixed(2)}%`;
</script>

<style scoped>
.allocation-visual {
  --allocation-1: #2563eb;
  --allocation-2: #0ea5e9;
  --allocation-3: #14b8a6;
  --allocation-4: #22c55e;
  --allocation-5: #84cc16;
  --allocation-6: #f59e0b;
  --allocation-7: #f97316;
  --allocation-other: #94a3b8;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
}

.allocation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.allocation-heading > div { min-width: 0; }
.allocation-label { display: block; color: var(--text-sub); font-size: 0.68rem; margin-bottom: 2px; }
.allocation-heading strong { color: var(--text-main); font-size: 0.88rem; }
.allocation-count { flex: none; color: var(--text-sub); font-size: 0.68rem; }

.allocation-body {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.donut-wrap {
  width: 112px;
  aspect-ratio: 1;
  position: relative;
  margin: 0 auto;
}

.donut { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }
.donut-track { stroke: var(--bg-secondary); }
.donut-segment { transition: opacity 0.18s ease; }
.donut-wrap:hover .donut-segment { opacity: 0.88; }

.donut-center {
  position: absolute;
  inset: 27%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-card);
  text-align: center;
}
.donut-center strong { font-family: 'JetBrains Mono', monospace; color: var(--text-main); font-size: 0.78rem; }
.donut-center span { color: var(--text-sub); font-size: 0.62rem; }

.allocation-legend { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.legend-row { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; gap: 6px; align-items: center; min-width: 0; font-size: 0.68rem; }
.legend-swatch { width: 8px; height: 8px; border-radius: 50%; }
.legend-symbol { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.legend-row strong { color: var(--text-main); font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; }

@media (max-width: 1200px) {
  .allocation-body { grid-template-columns: 105px minmax(0, 1fr); }
  .donut-wrap { width: 100px; }
}

@media (max-width: 768px) {
  .allocation-body { grid-template-columns: 120px minmax(0, 1fr); }
  .donut-wrap { width: 112px; }
}

@media (max-width: 460px) {
  .allocation-body { grid-template-columns: 1fr; }
  .donut-wrap { width: 132px; }
}
</style>
