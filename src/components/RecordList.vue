<template>
  <div class="card">
    <div class="card-header">
      <div class="header-left">
        <h3>交易紀錄</h3>
        <div class="record-count" v-if="filteredRecords.length > 0">
          共 <strong>{{ filteredRecords.length }}</strong> 筆紀錄
        </div>
      </div>
      
      <div class="header-controls">
        <div class="filter-group">
          <select v-model="filterType" class="filter-select">
            <option value="all">所有類型</option>
            <option value="BUY">買入</option>
            <option value="SELL">賣出</option>
            <option value="DIV">配息</option>
          </select>
        </div>
        
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜尋代碼..."
            class="search-input"
          >
        </div>
      </div>
    </div>

    <div class="table-container" ref="tableContainer">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>代碼</th>
            <th>類型</th>
            <th class="text-right">數量</th>
            <th class="text-right">價格</th>
            <th class="text-right">總金額</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!visibleRecords || visibleRecords.length === 0">
            <td colspan="7" class="empty-state">
              <div class="empty-icon">📅</div>
              <div>{{ searchQuery || filterType !== 'all' ? '找不到符合條件的紀錄' : '目前尚無交易紀錄' }}</div>
            </td>
          </tr>

          <tr v-else v-for="r in visibleRecords" :key="r.id" class="record-row">
            <td class="col-date">{{ formatDate(r.txn_date) }}</td>
            <td class="col-symbol">
              <span class="symbol-tag">{{ r.symbol }}</span>
            </td>
            <td class="col-type">
              <span class="type-badge" :class="r.txn_type.toLowerCase()">
                {{ translateType(r.txn_type) }}
              </span>
            </td>
            <td class="text-right font-num">{{ formatNum(r.qty) }}</td>
            <td class="text-right font-num">{{ formatNum(r.price, 2) }}</td>
            <td class="text-right font-num font-bold">
              {{ formatNum(Math.abs(r.qty * r.price), 0) }}
            </td>
            <td class="text-center">
              <div class="action-btns">
                <button class="btn-icon edit" @click="$emit('edit', r)" title="編輯">✎</button>
                <button class="btn-icon delete" @click="handleDelete(r.id)" title="刪除">✕</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="scroll-hint" v-if="filteredRecords.length > displayLimit">
      顯示最新 {{ visibleRecords.length }} / {{ filteredRecords.length }} 筆
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';

const store = usePortfolioStore();
const emit = defineEmits(['edit']);
const tableContainer = ref(null);

const searchQuery = ref('');
const filterType = ref('all');
const displayLimit = ref(50);

// 基礎格式化函數
const formatNum = (num, d = 2) => {
  const val = Number(num);
  if (isNaN(val)) return '0';
  return val.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return dateStr.split('T')[0];
};

const translateType = (type) => {
  const map = { 'BUY': '買入', 'SELL': '賣出', 'DIV': '配息' };
  return map[type] || type;
};

/**
 * 核心過濾邏輯
 * 增加對 store.records 為空的極致防禦
 */
const filteredRecords = computed(() => {
  const allRecords = store.records || [];
  let result = [...allRecords];

  if (filterType.value !== 'all') {
    result = result.filter(r => r.txn_type === filterType.value);
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(r => r.symbol && r.symbol.toLowerCase().includes(q));
  }

  return result;
});

const visibleRecords = computed(() => {
  return filteredRecords.value.slice(0, displayLimit.value);
});

/**
 * 修改後的刪除處理：
 * 調用 Store 的 deleteRecord，該函式在刪除最後一筆時會執行 resetData() 並回傳特定訊息
 */
const handleDelete = async (id) => {
  if (!confirm('確定要刪除此筆紀錄嗎？這可能會影響投資組合的計算結果。')) return;
  
  const success = await store.deleteRecord(id);
  if (success) {
    // 若刪除後列表空了，重置顯示限制
    if (store.records.length === 0) {
      displayLimit.value = 50;
    }
  }
};

const handleScroll = () => {
  if (!tableContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = tableContainer.value;
  if (scrollHeight - scrollTop - clientHeight < 50 && displayLimit.value < filteredRecords.value.length) {
    displayLimit.value += 30;
  }
};

onMounted(() => {
  tableContainer.value?.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  tableContainer.value?.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.record-count { font-size: 0.9rem; color: var(--text-sub); }
.header-controls { display: flex; gap: 12px; }
.search-input, .filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-main); font-size: 0.95rem; }

.table-container { overflow-x: auto; max-height: 500px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px; background: var(--bg-secondary); color: var(--text-sub); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; position: sticky; top: 0; z-index: 5; }
td { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }

.col-date { color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.symbol-tag { background: var(--bg-secondary); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

.type-badge { padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
.type-badge.buy { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.type-badge.sell { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
.type-badge.div { background: rgba(59, 130, 246, 0.1); color: var(--primary); }

.action-btns { display: flex; gap: 8px; justify-content: center; }
.btn-icon { background: none; border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; cursor: pointer; transition: all 0.2s; color: var(--text-sub); }
.btn-icon.edit:hover { border-color: var(--primary); color: var(--primary); }
.btn-icon.delete:hover { border-color: var(--danger); color: var(--danger); }

.empty-state { text-align: center; padding: 60px 0; color: var(--text-sub); }
.empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.3; }
.scroll-hint { text-align: center; padding: 12px; color: var(--text-sub); font-size: 0.85rem; background: var(--bg-secondary); }

.text-right { text-align: right; }
.text-center { text-align: center; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }

@media (max-width: 640px) {
  .header-controls { width: 100%; }
  .search-input { flex: 1; }
  th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5) { display: none; }
}
</style>
