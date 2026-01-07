<script setup>
import { usePortfolioStore } from '../stores/portfolio'
import { storeToRefs } from 'pinia'

const store = usePortfolioStore()
const { flattenedClosedLots } = storeToRefs(store)

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val)
}

const formatPercent = (val) => {
  if (val === undefined || val === null) return '0.0%'
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
}

const getPnlClass = (val) => val >= 0 ? 'text-green-400' : 'text-red-400'
</script>

<template>
  <div class="overflow-x-auto bg-gray-800 rounded-lg shadow border border-gray-700">
    <table class="w-full text-sm text-left text-gray-300">
      <thead class="text-xs text-gray-400 uppercase bg-gray-700/50">
        <tr>
          <th class="px-4 py-3">代碼</th>
          <th class="px-4 py-3 text-right">開倉/平倉日</th>
          <th class="px-4 py-3 text-right">持倉天數</th>
          <th class="px-4 py-3 text-right">股數</th>
          <th class="px-4 py-3 text-right">買入/賣出均價</th>
          <th class="px-4 py-3 text-right">歸因股息</th>
          <th class="px-4 py-3 text-right">淨損益 (含息)</th>
          <th class="px-4 py-3 text-right">報酬率</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(lot, index) in flattenedClosedLots" :key="index" class="border-b border-gray-700 hover:bg-gray-750">
          <td class="px-4 py-3 font-bold text-white">{{ lot.symbol }}</td>
          
          <td class="px-4 py-3 text-right">
            <div class="text-xs text-gray-500">{{ lot.open_date }}</div>
            <div>{{ lot.close_date }}</div>
          </td>
          
          <td class="px-4 py-3 text-right">{{ lot.holding_days }} 天</td>
          <td class="px-4 py-3 text-right">{{ lot.qty.toFixed(2) }}</td>
          
          <td class="px-4 py-3 text-right">
            <div class="text-xs text-gray-500">進: {{ formatCurrency(lot.entry_price) }}</div>
            <div>出: {{ formatCurrency(lot.exit_price) }}</div>
          </td>
          
          <td class="px-4 py-3 text-right">
            <span v-if="lot.dividends_collected > 0" class="text-yellow-400 font-medium">
              +{{ formatCurrency(lot.dividends_collected) }}
            </span>
            <span v-else class="text-gray-600">-</span>
          </td>
          
          <td class="px-4 py-3 text-right font-bold" :class="getPnlClass(lot.realized_pnl)">
            {{ formatCurrency(lot.realized_pnl) }}
          </td>
          
          <td class="px-4 py-3 text-right font-bold" :class="getPnlClass(lot.return_rate)">
            {{ formatPercent(lot.return_rate) }}
          </td>
        </tr>
        
        <tr v-if="flattenedClosedLots.length === 0">
          <td colspan="8" class="px-4 py-8 text-center text-gray-500">
            尚無平倉紀錄
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
