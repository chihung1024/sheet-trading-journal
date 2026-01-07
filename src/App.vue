<template>
  <div class="app-layout">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else class="main-wrapper">
      <header class="top-nav">
        <div class="nav-brand">
            <span class="logo-icon">📊</span>
            <h1>Trading Journal <span class="badge">PRO</span></h1>
        </div>
        <div class="nav-status">
            <div v-if="portfolioStore.loading" class="status-indicator loading">
                <span class="dot"></span> 更新數據中...
            </div>
            <div v-else class="status-indicator ready">
                <span class="dot"></span> 系統連線正常
            </div>
        </div>
      </header>

      <div class="content-container">
        <main class="main-column">
            <section class="section-stats">
                <StatsGrid />
            </section>
            
            <section class="section-charts">
                <div class="chart-container main-chart">
                    <PerformanceChart />
                </div>
                <div class="chart-container sub-chart">
                    <PieChart />
                </div>
            </section>

            <section class="section-holdings">
                <HoldingsTable />
            </section>

            <section class="section-records">
                <RecordList @edit="handleEditRecord" />
            </section>
        </main>

        <aside class="side-column">
            <div class="sticky-panel">
                <TradeForm ref="tradeFormRef" />
            </div>
        </aside>
      </div>
    </div>

    <div class="toast-container">
      <TransitionGroup name="toast-slide">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="removeToast(t.id)">
          <div class="toast-icon">{{ t.type === 'success' ? '✓' : '!' }}</div>
          <div class="toast-body">
             <div class="toast-msg">{{ t.message }}</div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import { useToast } from './composables/useToast';

import LoginOverlay from './components/LoginOverlay.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);
const { toasts, removeToast } = useToast();

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    // 滾動到右側表單
    document.querySelector('.side-column').scrollIntoView({ behavior: 'smooth' });
  }
};

onMounted(() => {
  authStore.initAuth();
});
</script>

<style>
/* CSS 保持不變，或沿用上一版的設定 */
/* ... (與上一版相同) ... */
</style>
