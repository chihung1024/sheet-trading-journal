<script setup>
import { computed } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'

const store = usePortfolioStore()
const stats = computed(() => store.stats)

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    
    <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500 hover:shadow-md transition-shadow duration-300">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Net Worth</p>
          <h3 class="text-2xl font-bold text-slate-800">{{ formatCurrency(stats.total_net_worth) }}</h3>
        </div>
        <div class="p-2 bg-indigo-50 rounded-lg text-indigo-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 hover:shadow-md transition-shadow duration-300" 
         :class="stats.unrealized_pnl >= 0 ? 'border-emerald-500' : 'border-rose-500'">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unrealized P/L</p>
          <div class="flex items-baseline">
            <h3 class="text-2xl font-bold mr-2" 
                :class="stats.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'">
              {{ formatCurrency(stats.unrealized_pnl) }}
            </h3>
            <span class="text-sm font-medium px-2 py-0.5 rounded-full"
                  :class="stats.unrealized_pnl >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
              {{ stats.unrealized_return }}%
            </span>
          </div>
        </div>
        <div class="p-2 rounded-lg" :class="stats.unrealized_pnl >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
           </svg>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-slate-300 hover:shadow-md transition-shadow duration-300">
       <div class="flex justify-between items-start">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Realized P/L</p>
          <h3 class="text-2xl font-bold text-slate-700"
              :class="stats.realized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'">
              {{ formatCurrency(stats.realized_pnl) }}
          </h3>
        </div>
        <div class="p-2 bg-slate-100 rounded-lg text-slate-500">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
           </svg>
        </div>
      </div>
    </div>
    
     <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-slate-300 hover:shadow-md transition-shadow duration-300">
       <div class="flex justify-between items-start">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Invested Capital</p>
          <h3 class="text-2xl font-bold text-slate-700">{{ formatCurrency(stats.total_cost) }}</h3>
        </div>
         <div class="p-2 bg-slate-100 rounded-lg text-slate-500">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
           </svg>
        </div>
      </div>
    </div>

  </div>
</template>
