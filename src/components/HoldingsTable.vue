<script setup>
import { computed } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'

const store = usePortfolioStore()
const holdings = computed(() => store.holdings)

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
    <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
      <h3 class="font-bold text-slate-700">Current Holdings</h3>
      <span class="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{{ holdings.length }} items</span>
    </div>

    <div class="hidden md:grid grid-cols-6 gap-4 p-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
      <div class="col-span-2">Symbol</div>
      <div class="text-right">Qty</div>
      <div class="text-right">Price</div>
      <div class="text-right">Value</div>
      <div class="text-right">Unrealized P/L</div>
    </div>

    <div v-if="holdings.length === 0" class="p-8 text-center text-slate-400">
      No active holdings found.
    </div>

    <div v-for="item in holdings" :key="item.symbol" 
         class="group p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors duration-150 grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-4 items-center">
      
      <div class="col-span-2 flex justify-between md:block">
        <div>
          <span class="font-bold text-slate-800 text-lg md:text-base">{{ item.symbol }}</span>
          <p class="text-xs text-slate-400 hidden md:block">Stock / ETF</p>
        </div>
        <span class="md:hidden text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
           {{ item.qty }} Shares
        </span>
      </div>

      <div class="hidden md:block text-right text-slate-600 font-medium">{{ item.qty }}</div>
      <div class="hidden md:block text-right text-slate-600 font-mono">{{ formatCurrency(item.current_price) }}</div>
      
      <div class="flex justify-between md:block text-right">
          <span class="md:hidden text-sm text-slate-400">Market Value</span>
          <span class="font-medium text-slate-800">{{ formatCurrency(item.market_value) }}</span>
      </div>
      
      <div class="flex justify-between md:block text-right">
         <span class="md:hidden text-sm text-slate-400">Unrealized P/L</span>
         <div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="item.unrealized_pnl >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
              {{ item.unrealized_pnl >= 0 ? '+' : '' }}{{ item.unrealized_return }}%
            </span>
            <div class="text-xs mt-1" :class="item.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'">
               {{ formatCurrency(item.unrealized_pnl) }}
            </div>
         </div>
      </div>

    </div>
  </div>
</template>
