<template>
  <div class="app-container" :class="{ 'dark': isDarkMode }">
    <LoginOverlay v-if="!authStore.isAuthenticated" />

    <div v-else class="dashboard-layout">
      <HeaderBar @open-trade="showTradeForm = true" />

      <main class="main-content">
        
        <section class="section-stats">
          <StatsGrid />
        </section>

        <section class="section-charts">
          <div class="chart-col main-chart">
            <div class="card h-full">
              <PerformanceChart />
            </div>
          </div>
          <div class="chart-col side-chart">
            <PieChart />
          </div>
        </section>

        <section class="section-middle">
          <div class="col-left">
            <HoldingsTable />
          </div>
          <div class="col-right">
             <DividendManager />
             <div class="mt-4">
                <GroupManager />
             </div>
          </div>
        </section>

        <section class="section-bottom">
          <RecordList @edit="handleEditTrade" />
        </section>
      </main>

      <button class="fab-btn" @click="showTradeForm = true" title="新增交易">
        +
      </button>

      <div v-if="showTradeForm" class="modal-overlay" @click.self="showTradeForm = false">
        <TradeForm 
          :initial-data="editingTradeData" 
          @close="closeTradeForm" 
          @submit-success="handleTradeSuccess"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useDarkMode } from './composables/useDarkMode';

// 引入所有 Phase 2 元件
import LoginOverlay from './components/LoginOverlay.vue';
import HeaderBar from './components/HeaderBar.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';
import DividendManager from './components/DividendManager.vue';
import GroupManager from './components/GroupManager.vue';
import TradeForm from './components/TradeForm.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { isDarkMode } = useDarkMode();

const showTradeForm = ref(false);
const editingTradeData = ref(null);

// 初始化：載入所有數據
onMounted(async () => {
  if (authStore.isAuthenticated) {
    await portfolioStore.fetchAll();
  }
});

// 處理編輯交易
const handleEditTrade = (trade) => {
  editingTradeData.value = { ...trade };
  showTradeForm.value = true;
};

// 關閉表單
const closeTradeForm = () => {
  showTradeForm.value = false;
  editingTradeData.value = null;
};

// 交易成功後的回呼
const handleTradeSuccess = async () => {
  // 觸發後端計算與更新
  await portfolioStore.triggerUpdate();
};
</script>

<style>
/* 全域變數定義 (配合 Phase 2 的深色主題) */
:root {
  --primary: #3B82F6;
  --primary-hover: #2563EB;
  --success: #10B981;
  --danger: #EF4444;
  --warning: #F59E0B;
  
  --bg-main: #121214;
  --bg-secondary: #1e1e23;
  --bg-card: #25252b;
  
  --text-main: #E4E4E7;
  --text-sub: #A1A1AA;
  
  --border-color: #3F3F46;
  
  --radius: 12px;
  --radius-sm: 8px;
  
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-card: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.15);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.4);
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-main);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

/* 捲軸美化 */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: var(--bg-main);
}
::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 5px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-sub);
}
</style>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dashboard-layout {
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 區塊通用樣式 */
section {
  width: 100%;
}

/* Chart Section Layout */
.section-charts {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  min-height: 350px;
}

.h-full { height: 100%; }

/* Middle Section Layout (Holdings + Tools) */
.section-middle {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

.col-right {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.mt-4 { margin-top: 24px; }

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* FAB Button (Mobile) */
.fab-btn {
  display: none; /* Desktop hidden */
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  font-size: 2rem;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
  cursor: pointer;
  z-index: 900;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.fab-btn:active {
  transform: scale(0.95);
}

/* 響應式設計 (RWD) */
@media (max-width: 1200px) {
  .section-charts {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  
  .side-chart {
    min-height: 300px;
  }
  
  .section-middle {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-layout {
    padding: 12px;
  }
  
  .main-content {
    gap: 16px;
  }
  
  .section-charts, .section-middle {
    gap: 16px;
  }
  
  .fab-btn {
    display: flex; /* Show on mobile */
  }
}
</style>
