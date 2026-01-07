<template>
  <div class="dashboard-wrapper">
    <div class="bg-glow"></div>
    
    <div class="container">
      <LoginOverlay v-if="!authStore.token" />
      
      <div v-else class="main-content">
        <HeaderBar />
        
        <div v-if="portfolioStore.loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>正在載入投資數據...</p>
        </div>
        
        <div v-else class="fade-in">
          <StatsGrid />
          
          <div class="chart-section">
             <div class="glass-card"><PerformanceChart /></div>
             <div class="glass-card"><PieChart /></div>
          </div>

          <div class="glass-card"><HoldingsTable /></div>

          <div id="trade-form-anchor" class="glass-card">
            <TradeForm ref="tradeFormRef" />
          </div>
          
          <div class="glass-card"><RecordList @edit="handleEditRecord" /></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { usePortfolioStore } from './stores/portfolio';
import LoginOverlay from './components/LoginOverlay.vue';
import HeaderBar from './components/HeaderBar.vue';
import StatsGrid from './components/StatsGrid.vue';
import PerformanceChart from './components/PerformanceChart.vue';
import PieChart from './components/PieChart.vue';
import TradeForm from './components/TradeForm.vue';
import HoldingsTable from './components/HoldingsTable.vue';
import RecordList from './components/RecordList.vue';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const tradeFormRef = ref(null);

const handleEditRecord = (record) => {
  if (tradeFormRef.value) {
    tradeFormRef.value.setupForm(record);
    document.getElementById('trade-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

onMounted(() => { authStore.initAuth(); });
</script>

<style>
:root { 
    --bg: #0a0a0c; 
    --glass-bg: rgba(28, 28, 32, 0.65);
    --border: rgba(255, 255, 255, 0.08); 
    --primary: #40a9ff; 
    --primary-glow: rgba(64, 169, 255, 0.3);
    --text: #f0f0f0; 
    --green: #4ade80; 
    --red: #f87171; 
}

body { 
    background-color: var(--bg); 
    color: var(--text); 
    font-family: 'Inter', -apple-system, sans-serif; 
    margin: 0; padding: 0;
    overflow-x: hidden;
}

.dashboard-wrapper { position: relative; min-height: 100vh; padding: 20px; }

/* 背景發光效果 */
.bg-glow {
    position: fixed; top: -10%; left: -10%; width: 40%; height: 40%;
    background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
    z-index: -1; filter: blur(80px);
}

.container { max-width: 1300px; margin: 0 auto; }

.glass-card { 
    background: var(--glass-bg); 
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    transition: transform 0.3s ease;
}

.chart-section { 
    display: grid; 
    grid-template-columns: 1.8fr 1fr; 
    gap: 24px; 
}

@media (max-width: 1024px) { .chart-section { grid-template-columns: 1fr; } }

.fade-in { animation: fadeIn 0.6s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 自定義捲軸 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
</style>
