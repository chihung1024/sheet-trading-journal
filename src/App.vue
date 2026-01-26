<template>
  <div class="min-h-screen font-sans antialiased transition-colors duration-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    
    <div 
      v-if="portfolioStore.loading"
      class="fixed top-0 left-0 right-0 h-0.5 bg-blue-500 z-[100] animate-pulse"
    ></div>

    <HeaderBar />

    <main class="container mx-auto px-4 py-4 md:py-8 lg:px-8">
      <div class="max-w-[1600px] mx-auto space-y-6">
        
        <section aria-label="Key Performance Indicators">
          <StatsGrid />
        </section>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          <div class="xl:col-span-8 space-y-6 order-2 xl:order-1">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">資產回測曲線</h3>
                  <div class="h-2 w-2 rounded-full bg-blue-500"></div>
                </div>
                <PerformanceChart />
              </div>
              
              <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">持倉分佈權重</h3>
                  <div class="h-2 w-2 rounded-full bg-indigo-500"></div>
                </div>
                <PieChart />
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <h2 class="font-bold text-lg flex items-center gap-2">
                  <span>當前持倉明細</span>
                  <span class="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">REAL-TIME</span>
                </h2>
              </div>
              <HoldingsTable />
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 class="font-bold text-lg">交易歷史日誌</h2>
              </div>
              <RecordList />
            </div>
          </div>

          <aside class="xl:col-span-4 space-y-6 order-1 xl:order-2 lg:sticky lg:top-24">
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl shadow-blue-500/5 border border-blue-100 dark:border-blue-900/20 relative overflow-hidden">
              <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12"></div>
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h2 class="font-bold text-lg leading-none">新增交易紀錄</h2>
                  <p class="text-xs text-slate-400 mt-1">Record your trade activity</p>
                </div>
              </div>
              <TradeForm />
            </div>

            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-900/30">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-emerald-800 dark:text-emerald-400">股息與非交易收入</h3>
                <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Income</span>
              </div>
              <DividendManager />
            </div>
          </aside>

        </div>
      </div>
    </main>

    <footer class="container mx-auto px-8 py-8 text-center text-slate-400 dark:text-slate-600 text-xs">
      <p>© 2026 Sheet Trading Journal v2.0 - Professional Trading Data Engine</p>
    </footer>

    <LoginOverlay />
    <ToastContainer />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePortfolioStore } from './stores/portfolio'
import { useAuthStore } from './stores/auth'

// 組件導入 (保留所有原始組件引用)
import HeaderBar from './components/HeaderBar.vue'
import StatsGrid from './components/StatsGrid.vue'
import PerformanceChart from './components/PerformanceChart.vue'
import PieChart from './components/PieChart.vue'
import HoldingsTable from './components/HoldingsTable.vue'
import RecordList from './components/RecordList.vue'
import TradeForm from './components/TradeForm.vue'
import DividendManager from './components/DividendManager.vue'
import LoginOverlay from './components/LoginOverlay.vue'
import ToastContainer from './components/ToastContainer.vue'

// 初始化 Store
const portfolioStore = usePortfolioStore()
const authStore = useAuthStore()

// 生命週期邏輯 (確保原本的數據初始化功能不變)
onMounted(async () => {
  // 商業化初始化流程：1. 驗證權限 2. 拉取數據
  if (authStore.checkAuth()) {
    try {
      await portfolioStore.fetchData()
    } catch (error) {
      console.error('[App] Failed to fetch initial data:', error)
    }
  }
})
</script>

<style>
/* 商業化捲軸美化：細膩、不佔空間 */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 20px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #334155;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 全域過渡動畫 */
.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 專業金融字體細節優化 */
body {
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 禁止移動端選取干擾操作體驗 */
.btn-no-select {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
</style>
