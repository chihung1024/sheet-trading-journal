<template>
  <div class="card">
    <div class="card-header">
        <h3>交易紀錄列表</h3>
        
        <div class="toolbar">
             <div class="search-box">
                <span class="icon">🔍</span>
                <input type="text" v-model="searchQuery" placeholder="搜尋代碼..." class="search-input">
             </div>
             
             <div class="filters">
                 <select v-model="filterType" class="filter-select">
                    <option value="ALL">所有類型</option>
                    <option value="BUY">買入 (Buy)</option>
                    <option value="SELL">賣出 (Sell)</option>
                    <option value="DIV">配息 (Div)</option>
                </select>
                
                <select v-model="filterYear" class="filter-select">
                    <option value="ALL">所有年份</option>
                    <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
                </select>
             </div>
             
             <button class="btn-refresh" @click="store.fetchRecords">↺ 刷新</button>
        </div>
    </div>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('txn_date')" class="sortable">日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span></th>
                    <th @click="sortBy('symbol')" class="sortable">代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span></th>
                    <th @click="sortBy('txn_type')" class="sortable">類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span></th>
                    <th class="text-right">股數</th>
                    <th class="text-right">單價</th>
                    <th @click="sortBy('total_amount')" class="text-right sortable">總金額 (USD) <span class="sort-icon">{{ getSortIcon('total_amount') }}</span></th>
                    <th class="text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">無符合條件的紀錄</td>
                </tr>
                <tr v-for="r in paginatedRecords" :key="r.id">
                    <td>{{ r.txn_date }}</td>
                    <td><strong>{{ r.symbol }}</strong></td>
                    <td>
                        <span class="type-badge" :class="r.txn_type.toLowerCase()">
                            {{ r.txn_type }}
                        </span>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(r.qty) }}</td>
                    <td class="text-right font-num">{{ formatNumber(r.price, 4) }}</td>
                    <td class="text-right font-num font-bold">{{ formatNumber(r.total_amount, 2) }}</td>
                    <td class="text-right actions">
                        <button class="btn-icon" @click="$emit('edit', r)" title="編輯">✎</button>
                        <button class="btn-icon delete" @click="del(r.id)" title="刪除">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">←</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">→</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();
const emit = defineEmits(['edit']);

// 狀態
const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = 10;
const sortKey = ref('txn_date');
const sortOrder = ref('desc');

const formatNumber = (num, d=2) => {
    if (isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// 計算可用年份
const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

// 排序邏輯
const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};
const getSortIcon = (key) => {
    if (sortKey.value !== key) return '↕';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

// 篩選與排序
const processedRecords = computed(() => {
    let result = store.records.filter(r => {
        const matchSearch = r.symbol.toUpperCase().includes(searchQuery.value.toUpperCase());
        const matchType = filterType.value === 'ALL' || r.txn_type === filterType.value;
        const matchYear = filterYear.value === 'ALL' || r.txn_date.startsWith(filterYear.value);
        return matchSearch && matchType && matchYear;
    });

    result.sort((a, b) => {
        let valA = a[sortKey.value];
        let valB = b[sortKey.value];
        
        if (sortKey.value === 'txn_date') {
            return sortOrder.value === 'asc' ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
        }
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    
    return result;
});

// 分頁
const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return processedRecords.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(processedRecords.value.length / itemsPerPage) || 1);
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };

// 當篩選條件改變時，回到第一頁
watch([searchQuery, filterType, filterYear], () => { currentPage.value = 1; });

const del = async (id) => {
    if(!confirm("確定要刪除這筆紀錄嗎?")) return;
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        addToast("刪除成功", "success"); store.fetchRecords();
    } catch(e) { addToast("刪除失敗", "error"); }
};
</script>

<style scoped>
.card-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
.card-header h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); }

.toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); }
.search-box { position: relative; flex: 1; min-width: 200px; }
.search-box .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.9rem; }
.search-input { width: 100%; padding: 8px 8px 8px 32px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; }

.filters { display: flex; gap: 8px; }
.filter-select { padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: white; font-size: 0.9rem; color: var(--text-main); }

.btn-refresh { margin-left: auto; background: white; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; cursor: pointer; color: var(--text-sub); font-size: 0.9rem; transition: 0.2s; }
.btn-refresh:hover { color: var(--primary); border-color: var(--primary); }

.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { 
    text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--border-color); 
    color: var(--text-sub); font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
th:hover { color: var(--primary); }
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }
tr:last-child td { border-bottom: none; }
tr:hover td { background-color: #f8fafc; }

.type-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
.type-badge.buy { background: #eff6ff; color: var(--primary); }
.type-badge.sell { background: #ecfdf5; color: var(--success); }
.type-badge.div { background: #fff7ed; color: #d97706; }

.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-icon { border: none; background: none; cursor: pointer; color: var(--text-sub); font-size: 1rem; padding: 4px; transition: 0.2s; }
.btn-icon:hover { color: var(--primary); background: #f1f5f9; border-radius: 4px; }
.btn-icon.delete:hover { color: var(--danger); }

.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 20px; }
.page-btn { width: 32px; height: 32px; border: 1px solid var(--border-color); background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-sub); }
.page-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.9rem; color: var(--text-sub); font-family: monospace; }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); font-style: italic; }

@media (max-width: 768px) {
    .card-header { align-items: flex-start; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .filters { overflow-x: auto; padding-bottom: 4px; }
    .btn-refresh { margin-left: 0; width: 100%; }
}
</style>
