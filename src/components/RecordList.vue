<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  ArrowUpDown,
  Calendar,
  Tag as TagIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  AlertCircle
} from 'lucide-vue-next';
import { format } from 'date-fns';

const portfolioStore = usePortfolioStore();

// --- 狀態管理 ---
const searchQuery = ref('');
const filterType = ref('all');
const sortBy = ref('txn_date');
const sortOrder = ref('desc');
const currentPage = ref(1);
const itemsPerPage = 10;

// --- 邏輯計算 ---

// 格式化日期顯示
const formatDate = (dateStr) => {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd');
  } catch (e) {
    return dateStr;
  }
};

// 格式化數字 (金額/價格)
const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(num || 0);
};

// 取得類別標籤樣式
const getTypeClass = (type) => {
  switch (type) {
    case 'BUY': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'SELL': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'DIVIDEND': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

// 篩選與排序邏輯
const filteredRecords = computed(() => {
  let result = [...portfolioStore.records];

  // 1. 關鍵字搜尋 (代號/標籤/備註)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(r => 
      r.symbol.toLowerCase().includes(q) || 
      (r.tag && r.tag.toLowerCase().includes(q)) ||
      (r.note && r.note.toLowerCase().includes(q))
    );
  }

  // 2. 交易類別過濾
  if (filterType.value !== 'all') {
    result = result.filter(r => r.txn_type === filterType.value);
  }

  // 3. 排序
  result.sort((a, b) => {
    let valA = a[sortBy.value];
    let valB = b[sortBy.value];
    
    if (sortBy.value === 'txn_date') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }

    if (valA < valB) return sortOrder.value === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder.value === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
});

// 分頁處理
const totalPages = computed(() => Math.ceil(filteredRecords.value.length / itemsPerPage) || 1);
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredRecords.value.slice(start, start + itemsPerPage);
});

// --- 操作方法 ---

const toggleSort = (field) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortOrder.value = 'desc';
  }
};

// 修正後的刪除方法：直接呼叫 Store 處理連鎖反應
const handleDelete = async (id) => {
  if (window.confirm('確定要刪除此筆交易紀錄嗎？若這是最後一筆紀錄，系統將清空所有分析數據。')) {
    const success = await portfolioStore.deleteRecord(id);
    if (success) {
      // 檢查分頁：如果刪除後該頁空了且不是第一頁，則往前跳一頁
      if (paginatedRecords.value.length === 0 && currentPage.value > 1) {
        currentPage.value--;
      }
    }
  }
};

// 編輯事件
const emit = defineEmits(['edit']);
const handleEdit = (record) => {
  emit('edit', record);
};
</script>

<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 justify-between items-center">
      <div class="relative w-full md:w-80">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜尋標的、標籤或備註..." 
          class="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"
        />
      </div>

      <div class="flex gap-2 w-full md:w-auto">
        <select 
          v-model="filterType"
          class="flex-1 md:w-32 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-emerald-500 dark:text-white"
        >
          <option value="all">所有類別</option>
          <option value="BUY">買入 (BUY)</option>
          <option value="SELL">賣出 (SELL)</option>
          <option value="DIVIDEND">股息 (DIV)</option>
        </select>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
          <tr>
            <th class="px-4 py-3 cursor-pointer hover:text-emerald-600 transition-colors" @click="toggleSort('txn_date')">
              <div class="flex items-center gap-1">日期 <ArrowUpDown class="w-3 h-3" /></div>
            </th>
            <th class="px-4 py-3 cursor-pointer hover:text-emerald-600 transition-colors" @click="toggleSort('symbol')">
              <div class="flex items-center gap-1">標的 <ArrowUpDown class="w-3 h-3" /></div>
            </th>
            <th class="px-4 py-3">類別</th>
            <th class="px-4 py-3 text-right">數量</th>
            <th class="px-4 py-3 text-right">成交價</th>
            <th class="px-4 py-3 hidden md:table-cell">標籤</th>
            <th class="px-4 py-3 text-center">操作</th>
          </tr>
        </thead>
        
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-if="portfolioStore.records.length === 0">
            <td colspan="7" class="py-12 text-center">
              <div class="flex flex-col items-center">
                <div class="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                  <Search class="w-6 h-6 text-gray-400" />
                </div>
                <p class="text-gray-500 dark:text-gray-400">目前沒有任何交易紀錄</p>
              </div>
            </td>
          </tr>

          <tr 
            v-for="record in paginatedRecords" 
            :key="record.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group"
          >
            <td class="px-4 py-4 text-sm dark:text-gray-300">
              <div class="flex items-center gap-2">
                <Calendar class="w-3 h-3 text-gray-400" />
                {{ formatDate(record.txn_date) }}
              </div>
            </td>
            <td class="px-4 py-4">
              <span class="font-bold text-gray-900 dark:text-white">{{ record.symbol }}</span>
            </td>
            <td class="px-4 py-4">
              <span :class="['px-2 py-1 rounded-md text-[10px] font-bold uppercase', getTypeClass(record.txn_type)]">
                {{ record.txn_type }}
              </span>
            </td>
            <td class="px-4 py-4 text-sm text-right font-mono dark:text-gray-300">
              {{ record.qty }}
            </td>
            <td class="px-4 py-4 text-sm text-right font-mono dark:text-gray-300">
              ${{ formatNumber(record.price) }}
            </td>
            <td class="px-4 py-4 hidden md:table-cell">
              <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <TagIcon class="w-3 h-3" />
                {{ record.tag || 'Stock' }}
              </div>
            </td>
            <td class="px-4 py-4">
              <div class="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  @click="handleEdit(record)"
                  class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  title="編輯"
                >
                  <Edit class="w-4 h-4" />
                </button>
                <button 
                  @click="handleDelete(record.id)"
                  class="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                  title="刪除"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
              <div class="md:hidden flex justify-center opacity-100 group-hover:opacity-0">
                 <MoreVertical class="w-4 h-4 text-gray-300" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="px-4 py-3 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        顯示第 {{ (currentPage - 1) * itemsPerPage + 1 }} 至 {{ Math.min(currentPage * itemsPerPage, filteredRecords.length) }} 筆，共 {{ filteredRecords.length }} 筆
      </p>
      <div class="flex gap-1">
        <button 
          @click="currentPage--" 
          :disabled="currentPage === 1"
          class="p-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 dark:text-white"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button 
          @click="currentPage++" 
          :disabled="currentPage === totalPages"
          class="p-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 dark:text-white"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 針對 Webkit 瀏覽器優化捲軸樣式 */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background: #334155;
}
</style>
