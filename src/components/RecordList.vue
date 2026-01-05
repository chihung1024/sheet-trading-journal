<template>
  <div class="card">
    <div class="flex-row header-row">
        <h3>交易紀錄 (API)</h3>
        <button class="btn btn-outline btn-sm" @click="store.fetchRecords">重新整理</button>
    </div>

    <div class="ledger-toolbar">
        <input type="text" v-model="searchQuery" placeholder="🔍 搜尋代碼/標籤" class="search-input">
        
        <select v-model="filterType" class="filter-select">
            <option value="ALL">全部類型</option>
            <option value="BUY">買入 (Buy)</option>
            <option value="SELL">賣出 (Sell)</option>
            <option value="DIV">配息 (Div)</option>
        </select>
        
        <select v-model="filterYear" class="filter-select">
            <option value="ALL">全部年份</option>
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
    </div>

    <div class="ledger-summary-bar">
        <div class="summary-item">
            <span class="summary-label">篩選筆數:</span>
            <span class="summary-val">{{ filteredRecords.length }}</span>
        </div>
        <div class="summary-item" v-if="filteredRecords.length > 0">
            <span class="summary-label">淨現金流 (Est. USD):</span>
            <span :class="filteredCashFlow >= 0 ? 'text-blue' : 'text-green'" class="summary-val">
                {{ filteredCashFlow >= 0 ? '+' : '' }}{{ formatNumber(filteredCashFlow, 2) }}
            </span>
        </div>
    </div>

    <div class="table-responsive">
        <table v-if="store.records.length > 0">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>代碼</th>
                    <th>類型</th>
                    <th>標籤</th>
                    <th>股數</th>
                    <th>價格 (USD)</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="r in paginatedRecords" :key="r.id">
                    <td class="text-muted">{{ r.txn_date }}</td>
                    <td><strong>{{ r.symbol }}</strong></td>
                    <td>
                        <span :class="getTypeBadgeClass(r.txn_type)" class="type-badge">
                            {{ r.txn_type }}
                        </span>
                    </td>
                    <td><span class="tag-strategy" v-if="r.tag">{{ r.tag }}</span></td>
                    <td>{{ r.qty > 0 ? r.qty : '-' }}</td>
                    <td>{{ formatNumber(r.price, 2) }}</td>
                    <td>
                        <button class="btn btn-outline btn-sm" @click="$emit('edit', r)">修</button>
                        <button class="btn btn-danger btn-sm" @click="del(r.id)" style="margin-left:5px">刪</button>
                    </td>
                </tr>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty">無符合條件的紀錄</td>
                </tr>
            </tbody>
        </table>
        <div v-else class="empty">尚無任何交易紀錄</div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">上一頁</button>
        <span class="page-info">第 {{ currentPage }} 頁 / 共 {{ totalPages }} 頁</span>
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">下一頁</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const emit = defineEmits(['edit']);

// --- 狀態與設定 ---
const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = 10;

// --- 格式化工具 ---
const formatNumber = (num, d=0) => Number(num||0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const getTypeBadgeClass = (t) => {
    if (t === 'BUY') return 'badge-buy';
    if (t === 'SELL') return 'badge-sell';
    if (t === 'DIV') return 'badge-div';
    return 'badge-default';
};

// --- 計算屬性 ---

// 1. 取得所有可用年份
const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

// 2. 篩選邏輯
const filteredRecords = computed(() => {
    return store.records.filter(r => {
        // 關鍵字搜尋 (代碼 或 標籤)
        const content = (r.symbol + (r.tag || '')).toLowerCase();
        if (searchQuery.value && !content.includes(searchQuery.value.toLowerCase())) return false;
        
        // 類型篩選
        if (filterType.value !== 'ALL' && r.txn_type !== filterType.value) return false;
        
        // 年份篩選
        if (filterYear.value !== 'ALL' && !r.txn_date.startsWith(filterYear.value)) return false;
        
        return true;
    // 預設依日期降序排列 (新到舊)
    }).sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

// 3. 分頁邏輯
const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredRecords.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredRecords.value.length / itemsPerPage) || 1);

// 4. 現金流估算 (USD)
const filteredCashFlow = computed(() => {
    return filteredRecords.value.reduce((sum, r) => {
        const amt = r.price * r.qty; // 簡易估算 (未含手續費)
        if (r.txn_type === 'BUY') return sum - amt;
        if (r.txn_type === 'SELL') return sum + amt;
        if (r.txn_type === 'DIV') return sum + r.price; // 配息通常 Price 為總額
        return sum;
    }, 0);
});

// --- 事件處理 ---
watch([searchQuery, filterType, filterYear], () => { currentPage.value = 1; }); // 篩選條件改變時回第一頁

const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };

const del = async (id) => {
    if(!confirm("確定要刪除此紀錄嗎?")) return;
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        store.fetchRecords();
    } catch(e) { alert("刪除失敗"); }
};
</script>

<style scoped>
/* 佈局與通用 */
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #2d2d30; }
.empty { text-align: center; padding: 30px; color: #666; font-style: italic; }
.text-muted { color: #888; font-size: 0.9rem; }
.text-green { color: #4caf50; }
.text-blue { color: #40a9ff; }

/* 表格樣式優化 */
.table-responsive { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 0.95rem; }
th, td { text-align: right; padding: 10px 8px; border-bottom: 1px solid #2d2d30; }
th:first-child, td:first-child { text-align: left; }
th { color: #888; font-weight: 500; font-size: 0.85rem; }
tr:hover { background: #1f1f23; }

/* 標籤與徽章 */
.type-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; min-width: 50px; display: inline-block; text-align: center; }
.badge-buy { background: rgba(255, 82, 82, 0.15); color: #ff5252; }
.badge-sell { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
.badge-div { background: rgba(64, 169, 255, 0.15); color: #40a9ff; }
.tag-strategy { background: #333; color: #ccc; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid #444; }

/* 工具列 (Toolbar) */
.ledger-toolbar { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
.search-input, .filter-select { 
    background: #2d2d30; border: 1px solid #333; color: #ccc; 
    padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; outline: none; 
}
.search-input { width: 150px; }
.search-input:focus, .filter-select:focus { border-color: #40a9ff; }

/* 統計條 (Summary Bar) */
.ledger-summary-bar {
    background: #1f1f23; border: 1px solid #333; border-radius: 6px;
    padding: 8px 15px; margin-bottom: 15px;
    display: flex; gap: 20px; align-items: center; justify-content: flex-end;
    font-size: 0.9rem;
}
.summary-item { display: flex; align-items: center; gap: 6px; }
.summary-label { color: #888; }
.summary-val { font-weight: bold; font-family: monospace; }

/* 分頁 (Pagination) */
.pagination { display: flex; justify-content: center; gap: 10px; margin-top: 20px; align-items: center; }
.page-btn { background: #2d2d30; border: 1px solid #333; color: #ccc; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: 0.2s; }
.page-btn:hover:not(:disabled) { background: #333; border-color: #555; }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: #666; }

@media (max-width: 600px) {
    .ledger-toolbar { flex-direction: column; }
    .search-input, .filter-select { width: 100%; }
    .ledger-summary-bar { justify-content: space-between; }
}
</style>
