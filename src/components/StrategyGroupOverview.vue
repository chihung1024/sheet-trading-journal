<template>
  <section class="strategy-overview-card" aria-labelledby="strategy-overview-title">
    <div class="overview-header">
      <div>
        <p class="eyebrow">Strategy Analytics</p>
        <h3 id="strategy-overview-title">策略群組概覽</h3>
        <p v-if="overview.updatedAt" class="snapshot-time">快照更新：{{ overview.updatedAt }}</p>
      </div>
      <span v-if="overview.status === 'ready'" class="group-count">
        {{ overview.groups.length }} 個策略群組
      </span>
    </div>

    <div class="comparability-note" role="note">
      各策略群組的歷史資料範圍可能不同，而且同一筆交易可能同時屬於多個標籤群組；此處是同一已發布快照的並列概覽，不是同期間績效排名，群組金額也不可直接相加。
    </div>

    <div v-if="overview.status === 'unavailable'" class="empty-state">
      目前快照沒有可安全比較的群組資料。
    </div>

    <div v-else-if="overview.status === 'empty'" class="empty-state">
      尚未建立獨立策略群組；建立 Tag 後可在這裡並列查看。
    </div>

    <div v-else class="strategy-grid">
      <article
        v-for="group in overview.groups"
        :key="group.name"
        class="strategy-card"
        :class="{ current: store.currentGroup === group.name }"
      >
        <div class="strategy-card-header">
          <div class="strategy-name-wrap">
            <strong class="strategy-name">{{ group.name }}</strong>
            <span v-if="store.currentGroup === group.name" class="current-badge">目前群組</span>
          </div>
          <button
            v-if="store.currentGroup !== group.name"
            type="button"
            class="select-group-btn"
            @click="store.setGroup(group.name)"
          >
            設為目前群組
          </button>
        </div>

        <div class="history-range">
          <span>歷史資料範圍</span>
          <strong>{{ formatHistoryRange(group.historyRange) }}</strong>
        </div>

        <dl class="metric-grid">
          <div class="metric-item">
            <dt>總資產淨值</dt>
            <dd>{{ formatTwd(group.totalValueTwd) }}</dd>
          </div>
          <div class="metric-item">
            <dt>投入資本</dt>
            <dd>{{ formatTwd(group.investedCapitalTwd) }}</dd>
          </div>
          <div class="metric-item">
            <dt>總損益</dt>
            <dd :class="pnlClass(group.totalPnlTwd)">{{ formatSignedTwd(group.totalPnlTwd) }}</dd>
          </div>
          <div class="metric-item">
            <dt>TWR</dt>
            <dd :class="metricClass(group.twr)">{{ formatPerformance(group.twr) }}</dd>
            <small v-if="group.twr.status !== 'ok'">{{ metricStatusLabel(group.twr) }}</small>
          </div>
          <div class="metric-item">
            <dt>XIRR</dt>
            <dd :class="metricClass(group.xirr)">{{ formatPerformance(group.xirr) }}</dd>
            <small v-if="group.xirr.status !== 'ok'">{{ metricStatusLabel(group.xirr) }}</small>
          </div>
          <div class="metric-item">
            <dt>持倉數</dt>
            <dd>{{ formatCount(group.holdingsCount) }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { buildStrategyGroupOverview } from '../services/strategyGroupOverview.js';

const store = usePortfolioStore();
const overview = computed(() => buildStrategyGroupOverview(store.rawData));

const formatHistoryRange = (range) => {
  if (!range?.startDate || !range?.endDate) return '資料不足';
  return `${range.startDate} → ${range.endDate}`;
};

const formatTwd = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('zh-TW')} TWD`;
};

const formatSignedTwd = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value).toLocaleString('zh-TW');
  return `${value >= 0 ? '+' : ''}${rounded} TWD`;
};

const formatPerformance = (metric) => {
  if (metric?.status !== 'ok' || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
    return '—';
  }
  return `${metric.value >= 0 ? '+' : ''}${metric.value.toFixed(2)}%`;
};

const formatCount = (value) => (
  Number.isInteger(value) && value >= 0 ? `${value} 檔` : '—'
);

const metricStatusLabel = (metric) => {
  if (metric?.status === 'not_applicable') return '尚不適用';
  if (metric?.status === 'undefined') return '無法可靠計算';
  return '資料不可用';
};

const pnlClass = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'text-green' : 'text-red';
};

const metricClass = (metric) => (
  metric?.status === 'ok' ? pnlClass(metric.value) : 'metric-unavailable'
);
</script>

<style scoped>
.strategy-overview-card {
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--text-sub);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.overview-header h3 {
  margin: 0;
  color: var(--text-main);
}

.snapshot-time {
  margin: 5px 0 0;
  color: var(--text-sub);
  font-size: 0.78rem;
}

.group-count {
  flex: none;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: 0.75rem;
  font-weight: 700;
}

.comparability-note {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(217, 119, 6, 0.35);
  border-radius: 10px;
  background: rgba(217, 119, 6, 0.07);
  color: var(--text-sub);
  font-size: 0.8rem;
  line-height: 1.55;
}

.empty-state {
  padding: 26px 12px;
  text-align: center;
  color: var(--text-sub);
}

.strategy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.strategy-card {
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.strategy-card.current {
  border-color: var(--primary);
}

.strategy-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.strategy-name-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}

.strategy-name {
  color: var(--text-main);
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.current-badge {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--primary);
  font-size: 0.68rem;
  font-weight: 700;
}

.select-group-btn {
  flex: none;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-main);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
}

.select-group-btn:hover {
  border-color: var(--primary);
}

.select-group-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.history-range {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-sub);
  font-size: 0.75rem;
}

.history-range strong {
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  text-align: right;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 12px 0 0;
}

.metric-item {
  min-width: 0;
}

.metric-item dt {
  margin-bottom: 4px;
  color: var(--text-sub);
  font-size: 0.72rem;
}

.metric-item dd {
  margin: 0;
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.84rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.metric-item small {
  display: block;
  margin-top: 3px;
  color: var(--text-sub);
  font-size: 0.67rem;
}

.metric-unavailable {
  color: var(--text-sub) !important;
}

.text-green { color: var(--success) !important; }
.text-red { color: var(--danger) !important; }

@media (max-width: 900px) {
  .strategy-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .strategy-overview-card {
    padding: 14px;
  }

  .overview-header,
  .strategy-card-header,
  .history-range {
    align-items: flex-start;
    flex-direction: column;
  }

  .group-count {
    align-self: flex-start;
  }

  .select-group-btn {
    width: 100%;
  }

  .history-range strong {
    text-align: left;
  }
}
</style>
