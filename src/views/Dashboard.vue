<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="page-title">投資總覽</h2>
        <span v-if="lastUpdate" class="last-update">
          最後更新: {{ formatTime(lastUpdate) }}
        </span>
      </div>
      <button 
        @click="handleManualRefresh" 
        class="btn-refresh" 
        :disabled="isGlobalLoading"
        :class="{ 'spinning': isGlobalLoading }"
      >
        <span class="icon">↻</span>
        <span class="text desktop-only">重新整理</span>
      </button>
    </div>

    <section class="section-stats">
      <StatsGridSkeleton v-if="shouldShowSkeleton('stats')" />
      <StatsGrid v-else :stats="stats" />
    </section>

    <section class="section-charts">
      <div class="chart-card main-chart">
        <div class="card-header">
          <h3>資產淨值走勢</h3>
        </div>
        <div class="card-body">
          <ChartSkeleton v-if="shouldShowSkeleton('history')" />
          <PerformanceChart v-else :history="history" />
        </div>
      </div>

      <div class="chart-card sub-chart">
        <div class="card-header">
          <h3>資產配置</h3>
        </div>
        <div class="card-body">
          <div v-if="shouldShowSkeleton('holdings')" class="pie-skeleton"></div>
          <PieChart v-else :holdings="holdings" />
        </div>
      </div>
    </section>

    <section class="section-holdings">
      <div class="section-header">
        <h3>持倉明細</h3>
      </div>
      <TableSkeleton v-if="shouldShowSkeleton('holdings')" />
      <HoldingsTable v-else :holdings="holdings" />
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { timeAgo } from '../utils/formatting';

// Components
import StatsGrid from '../components/StatsGrid.vue';
import PerformanceChart from '../components/PerformanceChart.vue';
import PieChart from '../components/PieChart.vue';
import HoldingsTable from '../components/HoldingsTable.vue';

// Skeletons
import StatsGridSkeleton from '../components/skeletons/StatsGridSkeleton.vue';
import ChartSkeleton from '../components/skeletons/ChartSkeleton.vue';
import TableSkeleton from '../components/skeletons/TableSkeleton.vue';

const store = usePortfolioStore();
const { addToast } = useToast();

// [關鍵優化] 本地初始載入狀態，防止 onMounted 前的畫面閃爍
const initLoading = ref(true);

// Computed State
const storeLoading = computed(() => store.loading);
const stats = computed(() => store.stats || {}); // 確保不為 null
const holdings = computed(() => store.holdings || []);
const history = computed(() => store.history || []);
const lastUpdate = computed(() => store.last_update);

// 合併 Loading 狀態：Store 正在載入 OR 初始檢查尚未完成
const isGlobalLoading = computed(() => storeLoading.value || initLoading.value);

// [關鍵優化] 智慧判斷是否顯示骨架屏
// 邏輯：(正在載入 且 無數據) -> 顯示骨架
// 這樣可以達成 "Optimistic UI"：重新整理時若已有數據，不會閃回骨架屏，而是保留舊數據直到新數據更新
const shouldShowSkeleton = (dataType) => {
  if (!isGlobalLoading.value) return false; // 載入完成 -> 顯示真實數據

  // 若正在載入，檢查是否有舊數據
  if (dataType === 'stats') return !stats.value.total_assets;
  if (dataType === 'history') return !history.value.length;
  if (dataType === 'holdings') return !holdings.value.length;
  
  return true;
};

// Methods
const formatTime = (date) => timeAgo(date);

const refreshData = async () => {
  try {
    await store.fetchAll();
  } catch (e) {
    console.error("Fetch failed", e);
    // 錯誤由 store 或全域 handler 處理，這裡僅確保 loading 狀態解除
  }
};

const handleManualRefresh = async () => {
  await refreshData();
  addToast('數據已更新', 'success');
};

// Lifecycle
onMounted(async () => {
  // 判斷是否需要自動更新：無數據 或 數據過期 (> 5分鐘)
  const shouldFetch = !stats.value.total_assets || 
    (new Date() - new Date(store.last_update || 0) > 5 * 60 * 1000);

  if (shouldFetch) {
    await refreshData();
  }
  
  // 只有在第一次檢查與請求都完成後，才解除 initLoading
  // 這確保了使用者第一眼看到的一定是骨架屏(若需載入)或真實數據，絕不會是空狀態
  initLoading.value = false;
});
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fade-in 0.5s ease-out;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 8px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.last-update {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-left: 12px;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
  font-weight: 500;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-refresh.spinning .icon {
  animation: spin 1s linear infinite;
}

/* Chart Section Grid */
.section-charts {
  display: grid;
  grid-template-columns: 2fr 1fr; /* 2:1 比例 */
  gap: 24px;
}

.chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-chart {
  min-height: 400px;
}

.sub-chart {
  min-height: 400px;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.card-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.card-body {
  flex: 1;
  padding: 20px;
  position: relative;
}

/* Pie Skeleton */
.pie-skeleton {
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: linear-gradient(90deg, var(--bg-secondary), var(--border-color), var(--bg-secondary));
  background-size: 200% 100%;
  margin: auto;
  opacity: 0.6;
  animation: shimmer 1.5s infinite linear;
}

/* Holdings Section */
.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

/* Animations */
@keyframes spin { 100% { transform: rotate(360deg); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* RWD */
@media (max-width: 1024px) {
  .section-charts {
    grid-template-columns: 1fr;
  }
  
  .sub-chart {
    min-height: 350px;
  }
}

@media (max-width: 640px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .last-update {
    margin-left: 0;
    font-size: 0.8rem;
  }
  
  .btn-refresh {
    width: 100%;
    justify-content: center;
  }
  
  .card-body {
    padding: 12px;
  }
  
  .main-chart {
    min-height: 300px;
  }
}
</style>
