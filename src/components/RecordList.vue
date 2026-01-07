<template>
  <div class="card">
    <div class="header-row">
        <h3>📄 交易紀錄 <span class="badge">{{ filteredRecords.length }}</span></h3>
        <button class="btn btn-outline btn-sm" @click="store.fetchRecords" :disabled="isRefreshing">
          {{ isRefreshing ? '更新中...' : '↻ 重新整理' }}
        </button>
    </div>

    <div class="ledger-toolbar">
        <div class="search-wrapper">
            <span class="icon">🔍</span>
            <input type="text" v-model="searchQuery" placeholder="搜尋代碼..." class="search-input">
        </div>
        
        <select v-model="filterType" class="filter-select">
            <option value="ALL">全部類型</option>
            <option value="BUY">買入</option>
            <option value="SELL">賣出</option>
            <option value="DIV">配息</option>
        </select>
        
        <select v-model="filterYear" class="filter-select">
            <option value="ALL">全部年份</option>
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
    </div>

    <div class="table-container">
        <div class="table-header desktop-only">
            <div class="col date">日期</div>
            <div class="col symbol">代碼</div>
            <div class="col type">類型</div>
            <div class="col tag">策略標籤</div>
            <div class="col num">股數</div>
            <div class="col num">價格 (USD)</div>
            <div class="col action">操作</div>
        </div>

        <div v-if="filteredRecords.length === 0" class="empty-state">
            無符合條件的紀錄
        </div>

        <TransitionGroup name="list" tag="div" class="list-wrapper">
            <div v-for="r in paginatedRecords" :key="r.id" class="list-item">
                <div class="col date" data-label="日期">{{ r.txn_date }}</div>
                <div class="col symbol" data-label="代碼">
                    <strong>{{ r.symbol }}</strong>
                </div>
                <div class="col type" data-label="類型">
                    <span :class="getTypeBadgeClass(r.txn_type)" class="type-badge">
                        {{ r.txn_type }}
                    </span>
                </div>
                <div class="col tag" data-label="標籤">
                    <span class="tag-pill" v-if="r.tag">{{ r.tag }}</span>
                    <span class="text-muted" v-else>-</span>
                </div>
                <div class="col num" data-label="股數">{{ r.qty > 0 ? r.qty : '-' }}</div>
                <div class="col num" data-label="價格">{{ formatNumber(r.price, 2) }}</div>
                <div class="col action" data-label="操作">
                    <button class="btn-icon edit" @click="$emit('edit', r)">✏️</button>
                    <button class="btn-icon delete" @click="del(r.id)">🗑️</button>
                </div>
            </div>
        </TransitionGroup>
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

const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = 10;
const isRefreshing = ref(false);

const formatNumber = (num, d=0) => Number(num||0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const getTypeBadgeClass = (t) => {
    if (t === 'BUY') return 'badge-buy';
    if (t === 'SELL') return 'badge-sell';
    if (t === 'DIV') return 'badge-div';
    return '';
};

const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

const filteredRecords = computed(() => {
    return store.records.filter(r => {
        const content = (r.symbol + (r.tag || '')).toLowerCase();
        if (searchQuery.value && !content.includes(searchQuery.value.toLowerCase())) return false;
        if (filterType.value !== 'ALL' && r.txn_type !== filterType.value) return false;
        if (filterYear.value !== 'ALL' && !r.txn_date.startsWith(filterYear.value)) return false;
        return true;
    }).sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredRecords.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredRecords.value.length / itemsPerPage) || 1);

watch([searchQuery, filterType, filterYear], () => { currentPage.value = 1; });

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
        addToast("刪除成功", "success");
        store.fetchRecords();
    } catch(e) { addToast("刪除失敗", "error"); }
};
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.badge { background: #333; font-size: 0.8rem; padding: 2px 8px; border-radius: 10px; color: #888; margin-left: 8px; vertical-align: middle; }

/* 工具列 */
.ledger-toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.search-wrapper { position: relative; flex-grow: 1; max-width: 300px; }
.search-wrapper .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 0.9rem; }
.search-input, .filter-select { 
    background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); color: #ccc; 
    padding: 10px 12px; border-radius: 8px; font-size: 0.9rem; outline: none; transition: 0.2s;
    width: 100%; box-sizing: border-box;
}
.search-input { padding-left: 32px; }
.search-input:focus, .filter-select:focus { border-color: var(--primary); background: rgba(0,0,0,0.4); }

/* 模擬表格佈局 (Flexbox) */
.table-header { display: flex; padding: 0 16px 10px 16px; border-bottom: 1px solid var(--card-border); color: var(--text-muted); font-size: 0.85rem; font-weight: 600; }
.list-item { 
    display: flex; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); 
    align-items: center; transition: background 0.2s; 
}
.list-item:hover { background: rgba(255,255,255,0.02); }

.col { flex: 1; }
.col.date { flex: 0 0 110px; color: #888; font-size: 0.9rem; }
.col.symbol { flex: 0 0 90px; }
.col.type { flex: 0 0 80px; }
.col.tag { flex: 1.2; }
.col.num { flex: 1; text-align: right; font-family: 'JetBrains Mono', monospace; }
.col.action { flex: 0 0 80px; display: flex; justify-content: flex-end; gap: 8px; }

/* 標籤樣式 */
.type-badge { padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
.badge-buy { background: rgba(255, 82, 82, 0.1); color: #ff7875; }
.badge-sell { background: rgba(76, 175, 80, 0.1); color: #52c41a; }
.badge-div { background: rgba(64, 169, 255, 0.1); color: #40a9ff; }
.tag-pill { background: #262626; color: #a0a0a0; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid #333; }

.btn-icon { background: none; border: none; font-size: 1rem; opacity: 0.6; padding: 4px; transition: 0.2s; }
.btn-icon:hover { opacity: 1; transform: scale(1.1); background: rgba(255,255,255,0.1); border-radius: 4px; }
.btn-icon.delete:hover { color: #ff4d4f; }

/* 分頁 */
.pagination { display: flex; justify-content: center; gap: 15px; margin-top: 20px; align-items: center; }
.page-btn { background: rgba(255,255,255,0.05); border: none; color: #ccc; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.page-btn:hover:not(:disabled) { background: var(--primary); color: white; }
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.page-info { font-size: 0.9rem; color: var(--text-muted); font-family: monospace; }

.empty-state { padding: 40px; text-align: center; color: var(--text-muted); font-style: italic; }

/* List Animation */
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-10px); }

/* --- Mobile RWD: Card View Mode --- */
@media (max-width: 768px) {
    .desktop-only { display: none; }
    
    .list-item { 
        flex-direction: column; 
        align-items: stretch; 
        background: rgba(255,255,255,0.03); 
        margin-bottom: 12px; 
        border-radius: 8px; 
        border: 1px solid rgba(255,255,255,0.05);
        padding: 16px;
    }

    .col { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 6px 0; 
        text-align: right;
    }
    
    .col::before {
        content: attr(data-label);
        color: var(--text-muted);
        font-size: 0.85rem;
    }

    .col.action { 
        margin-top: 10px; 
        padding-top: 12px; 
        border-top: 1px solid rgba(255,255,255,0.1); 
        justify-content: flex-end; 
    }
    
    .search-wrapper { max-width: 100%; }
}
</style>
