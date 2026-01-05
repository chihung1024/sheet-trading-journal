<template>
  <div class="container">
    <LoginOverlay v-if="!authStore.token" />
    
    <div v-else>
      <HeaderBar />
      
      <div v-if="portfolioStore.loading" class="loading">
        Loading Data...
      </div>
      
      <div v-else>
        <StatsGrid />
        
        <div class="grid-layout">
          <div class="card">
            <PerformanceChart />
          </div>
          <div class="card">
            <h3 style="margin-bottom:10px">資產配置</h3>
             <PerformanceChart type="pie" />
          </div>
        </div>

        <TradeForm />
        <HoldingsTable />
        <RecordList />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';

// Components
import LoginOverlay from './components/LoginOverlay.vue';
import HeaderBar from './components/HeaderBar.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();

onMounted(() => {
  // 嘗試從 LocalStorage 恢復登入
  authStore.initAuth();
});
</script>

<style>
:root { --primary: #2979ff; --bg: #101014; --card: #1e1e24; --text: #e0e0e0; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.loading { text-align: center; padding: 50px; color: #666; }
.grid-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px; }
@media(max-width: 900px) { .grid-layout { grid-template-columns: 1fr; } }

.card { background: var(--card); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
h3 { margin-top:0; color: white; }
button { cursor: pointer; }
</style>
