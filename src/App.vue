<script setup>
import { onMounted, ref } from 'vue'
import { usePortfolioStore } from './stores/portfolio'
import HeaderBar from './components/HeaderBar.vue'
import PerformanceChart from './components/PerformanceChart.vue'
import StatsGrid from './components/StatsGrid.vue'
import PieChart from './components/PieChart.vue'
import HoldingsTable from './components/HoldingsTable.vue'
import RecordList from './components/RecordList.vue'
import TradeForm from './components/TradeForm.vue'
import LoginOverlay from './components/LoginOverlay.vue'
// [新增] 引入新元件
import ClosedPositionsTable from './components/ClosedPositionsTable.vue'

const store = usePortfolioStore()
// [新增] 控制當前分頁 ('holdings' | 'closed' | 'records')
const activeTab = ref('holdings')

onMounted(() => {
  store.fetchSnapshot()
})
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 font-sans">
    <LoginOverlay />
    <HeaderBar />

    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <StatsGrid />

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
          <h2 class="text-lg font-semibold mb-4 text-white">績效走勢 (TWR)</h2>
          <div class="h-64">
            <PerformanceChart />
          </div>
        </div>
        <div class="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
          <h2 class="text-lg font-semibold mb-4 text-white">資產配置</h2>
          <div class="h-64 flex items-center justify-center">
            <PieChart />
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex space-x-2 border-b border-gray-700 pb-1">
          <button 
            @click="activeTab = 'holdings'"
            class="px-4 py-2 rounded-t-lg transition-colors font-medium"
            :class="activeTab === 'holdings' ? 'bg-gray-800 text-blue-400 border-t border-x border-gray-700' : 'text-gray-500 hover:text-gray-300'"
          >
            當前持倉 (Holdings)
          </button>
          <button 
            @click="activeTab = 'closed'"
            class="px-4 py-2 rounded-t-lg transition-colors font-medium"
            :class="activeTab === 'closed' ? 'bg-gray-800 text-purple-400 border-t border-x border-gray-700' : 'text-gray-500 hover:text-gray-300'"
          >
            已平倉損益 (Realized)
          </button>
          <button 
            @click="activeTab = 'records'"
            class="px-4 py-2 rounded-t-lg transition-colors font-medium"
            :class="activeTab === 'records' ? 'bg-gray-800 text-green-400 border-t border-x border-gray-700' : 'text-gray-500 hover:text-gray-300'"
          >
            交易流水帳 (Journal)
          </button>
        </div>

        <div v-if="activeTab === 'holdings'">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2">
              <HoldingsTable />
            </div>
            <div>
              <TradeForm />
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'closed'">
           <div class="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
             <div class="flex justify-between items-center mb-4">
               <h2 class="text-lg font-semibold text-white">歷史平倉紀錄 (含股息歸因)</h2>
               <div v-if="store.closedStats" class="text-sm space-x-4">
                 <span class="text-gray-400">總交易: <span class="text-white">{{ store.closedStats.count }}</span></span>
                 <span class="text-gray-400">勝率: <span class="text-white">{{ store.closedStats.winRate.toFixed(1) }}%</span></span>
                 <span class="text-gray-400">總歸因股息: <span class="text-yellow-400">+NT${{ store.closedStats.totalDivs.toLocaleString() }}</span></span>
               </div>
             </div>
             <ClosedPositionsTable />
           </div>
        </div>

        <div v-if="activeTab === 'records'">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2">
              <RecordList />
            </div>
            <div>
              <TradeForm />
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>
