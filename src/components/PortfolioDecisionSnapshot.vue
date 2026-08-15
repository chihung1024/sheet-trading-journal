<template>
  <section v-if="snapshot.status !== 'not_applicable'" class="decision-snapshot" aria-label="持倉集中度決策快照">
    <div class="snapshot-header">
      <div>
        <span class="snapshot-eyebrow">Portfolio Decision Support</span>
        <h3>持倉集中度</h3>
      </div>
      <span class="group-scope">{{ groupLabel }}</span>
    </div>

    <div v-if="snapshot.status === 'ok'" class="snapshot-content">
      <div class="metric-grid">
        <div class="metric-card">
          <span class="metric-label">最大持倉</span>
          <strong>{{ snapshot.largest.symbol }}</strong>
          <span class="metric-value">{{ formatPercent(snapshot.largest.weight) }}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">前 3 大合計</span>
          <strong>{{ formatPercent(snapshot.top3Weight) }}</strong>
          <span class="metric-caption">目前群組持倉市值</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">正市值持倉</span>
          <strong>{{ snapshot.positionCount }} 檔</strong>
          <span class="metric-caption">不含零市值列</span>
        </div>
      </div>

      <div class="position-list" aria-label="主要持倉權重">
        <div v-for="position in snapshot.topPositions" :key="position.symbol" class="position-row">
          <div class="position-line">
            <span class="position-symbol">{{ position.symbol }}</span>
            <span class="position-weight">{{ formatPercent(position.weight) }}</span>
          </div>
          <div class="weight-track" aria-hidden="true">
            <div class="weight-fill" :style="{ width: `${Math.min(position.weight, 100)}%` }"></div>
          </div>
        </div>
      </div>

      <p class="snapshot-note">
        僅反映目前群組已發布持倉的 TWD 市值比例，不含現金；這是集中度事實呈現，不是風險評級、目標配置或買賣建議。
      </p>
    </div>

    <div v-else class="snapshot-unavailable" role="status">
      <strong>集中度暫不顯示</strong>
      <span>持倉市值與摘要總值目前無法一致對帳，系統不猜測權重。</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { buildPortfolioConcentrationSnapshot } from '../services/portfolioConcentration.js';

const store = usePortfolioStore();

const snapshot = computed(() => buildPortfolioConcentrationSnapshot(
  store.holdings,
  store.stats.total_value,
));

const groupLabel = computed(() => (
  store.currentGroup === 'all' ? '全部持倉' : `策略：${store.currentGroup}`
));

const formatPercent = value => `${Number(value || 0).toFixed(2)}%`;
</script>

<style scoped>
.decision-snapshot { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); box-shadow: var(--shadow-card); padding: 20px 24px; }
.snapshot-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.snapshot-eyebrow { display: block; margin-bottom: 4px; color: var(--text-sub); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.snapshot-header h3 { margin: 0; color: var(--text-main); font-size: 1.05rem; }
.group-scope { padding: 5px 10px; border-radius: 999px; background: var(--bg-secondary); color: var(--text-sub); font-size: 0.76rem; font-weight: 650; }
.snapshot-content { display: grid; grid-template-columns: minmax(260px, 0.9fr) minmax(300px, 1.1fr); gap: 20px; }
.metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-content: start; }
.metric-card { min-width: 0; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); }
.metric-label, .metric-caption { display: block; color: var(--text-sub); font-size: 0.72rem; }
.metric-card strong { display: block; margin: 5px 0 2px; color: var(--text-main); font-size: 1rem; overflow-wrap: anywhere; }
.metric-value { color: var(--primary); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; font-weight: 700; }
.position-list { display: flex; flex-direction: column; gap: 9px; }
.position-line { display: flex; justify-content: space-between; gap: 12px; font-size: 0.82rem; }
.position-symbol { color: var(--text-main); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.position-weight { color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.weight-track { height: 6px; overflow: hidden; border-radius: 999px; background: var(--bg-secondary); }
.weight-fill { height: 100%; border-radius: inherit; background: var(--primary); }
.snapshot-note { grid-column: 1 / -1; margin: 0; color: var(--text-sub); font-size: 0.76rem; line-height: 1.55; }
.snapshot-unavailable { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px; border-radius: 8px; background: var(--bg-secondary); color: var(--text-sub); font-size: 0.82rem; }
.snapshot-unavailable strong { color: var(--warning); }
@media (max-width: 900px) {
  .snapshot-content { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .decision-snapshot { padding: 16px; }
  .snapshot-header { flex-direction: column; gap: 8px; }
  .metric-grid { grid-template-columns: 1fr; }
}
</style>
