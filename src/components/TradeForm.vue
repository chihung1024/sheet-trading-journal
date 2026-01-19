<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-in">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <h3 class="text-xl font-bold text-gray-800 dark:text-white">新增交易紀錄</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">交易日期</label>
            <input v-model="form.txn_date" type="date" required
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">交易種類</label>
            <select v-model="form.txn_type" required
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="Buy">買入 (Buy)</option>
              <option value="Sell">賣出 (Sell)</option>
              <option value="Dividend">股息 (Dividend)</option>
            </select>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">標的代碼 (例如: AAPL, 2330.TW)</label>
          <input v-model="form.symbol" type="text" placeholder="輸入美股或台股代碼" required
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">數量</label>
            <input v-model.number="form.qty" type="number" step="any" required
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">價格</label>
            <input v-model.number="form.price" type="number" step="any" required
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">分類標籤</label>
            <input v-model="form.tag" type="text" placeholder="Stock / ETF"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-semibold text-gray-600 dark:text-gray-400">備註</label>
            <input v-model="form.note" type="text"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
        </div>

        <div class="pt-4 flex gap-3">
          <button type="button" @click="$emit('close')"
            class="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
            取消
          </button>
          <button type="submit" :disabled="loading"
            class="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
            <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ loading ? '處理中...' : '確認新增' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close']);
const portfolioStore = usePortfolioStore();
const loading = ref(false);

const form = ref({
  txn_date: new Date().toISOString().split('T')[0],
  symbol: '',
  txn_type: 'Buy',
  qty: null,
  price: null,
  fee: 0,
  tax: 0,
  tag: 'Stock',
  note: ''
});

const handleSubmit = async () => {
  if (loading.value) return;
  loading.value = true;
  
  try {
    // ✅ 呼叫 Store 封裝的新增邏輯
    // 此方法已整合：API 請求、紀錄重新獲取、0->1 自動觸發檢查與輪詢啟動
    const success = await portfolioStore.addRecord(form.value);
    
    if (success) {
      resetForm();
      emit('close');
    }
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '',
    txn_type: 'Buy',
    qty: null,
    price: null,
    fee: 0,
    tax: 0,
    tag: 'Stock',
    note: ''
  };
};

onMounted(() => {
  resetForm();
});
</script>
