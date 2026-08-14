<template>
  <div class="card">
    <div class="card-header">
        <div class="header-title-row">
            <h3>交易紀錄列表</h3>
            <button class="btn-toggle-filter mobile-only" @click="showFilters = !showFilters">
                {{ showFilters ? '收起篩選' : '顯示篩選' }} <span class="filter-icon">🌪️</span>
            </button>
        </div>
        
        <div class="toolbar" :class="{ 'mobile-expanded': showFilters }">
             <div class="search-box">
                <span class="icon">🔍</span>
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="搜尋代碼..." 
                    class="search-input"
                >
             </div>
             
             <div class="filters-wrapper" v-show="!isMobile || showFilters">
                 <div class="filters">
                     <select v-model="filterType" class="filter-select">
                        <option value="ALL">所有類型</option>
                        <option value="BUY">買入</option>
                        <option value="SELL">賣出</option>
                        <option value="DIV">配息</option>
                    </select>
                    
                    <select v-model="filterYear" class="filter-select">
                        <option value="ALL">所有年份</option>
                        <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
                    </select>
                    
                    <select v-model="itemsPerPage" class="filter-select">
                        <option :value="10">每頁 10 筆</option>
                        <option :value="20">每頁 20 筆</option>
                        <option :value="50">每頁 50 筆</option>
                        <option :value="100">每頁 100 筆</option>
                    </select>
                 </div>
             </div>
             
             <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">↺</span>
                <span class="btn-text">刷新</span>
             </button>
        </div>
    </div>

    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">總交易</span>
            <span class="stat-value">{{ processedRecords.length }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">買入</span>
            <span class="stat-value text-primary">{{ buyCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">賣出</span>
            <span class="stat-value text-success">{{ sellCount }}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">配息</span>
            <span class="stat-value text-warning">{{ divCount }}</span>
        </div>
    </div>

    <div class="table-container desktop-view" ref="tableRef">
        <table>
            <thead>
                <tr>
                    <th @click="sortBy('txn_date')" class="sortable">
                        日期 <span class="sort-icon">{{ getSortIcon('txn_date') }}</span>
                    </th>
                    <th @click="sortBy('symbol')" class="sortable">
                        代碼 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('txn_type')" class="sortable">
                        類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span>
                    </th>
                    <th class="text-right">股數</th>
                    <th class="text-right">單價</th>
                    <th @click="sortBy('total_amount_twd')" class="text-right sortable" title="TWD 排序僅使用可可靠換算的 TWD / USD 交易；其他幣別待後端權威估值">
                        總額 <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
                    </th>
                    <th class="text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">📋</div>
                        <div>無符合條件的紀錄</div>
                    </td>
                </tr>
                <tr 
                    v-for="r in paginatedRecords" 
                    :key="r.id"
                    class="record-row"
                    :class="{ 'editing': editingId === r.id }"
                >
                    <td class="date-cell">
                        <span class="date-text">{{ formatDate(r.txn_date) }}</span>
                    </td>
                    <td>
                        <span class="symbol-badge">{{ r.symbol }}</span>
                    </td>
                    <td>
                        <span class="type-badge" :class="r.txn_type.toLowerCase()">
                            {{ getTypeLabel(r.txn_type) }}
                        </span>
                    </td>
                    <td class="text-right font-num">{{ formatNumber(r.qty, 2) }}</td>
                    <td class="text-right font-num">{{ formatNativeAmount(getRecordAvgPrice(r), getRecordCurrency(r), 4) }}</td>
                    <td class="text-right font-num font-bold">
                        <div>{{ formatRecordNativeAmount(r, 2) }}</div>
                        <div
                            v-if="getRecordCurrency(r) !== 'TWD'"
                            class="record-twd-note"
                            :class="{ unavailable: getTotalAmountTWD(r) == null }"
                        >
                            {{ getTwdPresentation(r) }}
                        </div>
                    </td>
                    <td class="text-right actions">
                        <button class="btn-icon edit" @click="editRecord(r)" title="編輯">✎</button>
                        <button class="btn-icon delete" @click="deleteRecord(r.id)" title="刪除">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-if="paginatedRecords.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <div>無符合條件的紀錄</div>
        </div>

        <div 
            v-for="r in paginatedRecords" 
            :key="'mob_'+r.id" 
            class="mobile-card"
            :class="{ 'editing': editingId === r.id }"
        >
            <div class="m-card-header">
                <span class="m-date">{{ formatDate(r.txn_date) }}</span>
                <span class="type-badge sm" :class="r.txn_type.toLowerCase()">
                    {{ getTypeLabel(r.txn_type) }}
                </span>
            </div>
            
            <div class="m-card-body">
                <div class="m-main-info">
                    <span class="m-symbol">{{ r.symbol }}</span>
                    <span class="m-amount">{{ formatRecordNativeAmount(r, 2) }}</span>
                </div>
                <div
                    v-if="getRecordCurrency(r) !== 'TWD'"
                    class="m-twd-note"
                    :class="{ unavailable: getTotalAmountTWD(r) == null }"
                >
                    {{ getTwdPresentation(r) }}
                </div>
                <div class="m-sub-info">
                    <span class="m-detail">
                        {{ formatNumber(r.qty, 2) }} 股 @ {{ formatNativeAmount(getRecordAvgPrice(r), getRecordCurrency(r), 2) }}
                    </span>
                    <span class="m-fee" v-if="r.fee > 0 || r.tax > 0">
                        ({{ getRecordCurrency(r) }} 費: {{ (r.fee||0) + (r.tax||0) }})
                    </span>
                </div>
            </div>

            <div class="m-card-actions">
                <button class="btn-action edit" @click="editRecord(r)">
                    ✎ 編輯
                </button>
                <div class="v-divider"></div>
                <button class="btn-action delete" @click="deleteRecord(r.id)">
                    ✕ 刪除
                </button>
            </div>
        </div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="goToPage(1)" :disabled="currentPage === 1">«</button>
        <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">←</button>
        
        <div class="page-numbers">
            <button 
                v-for="page in visiblePages" 
                :key="page"
                class="page-number"
                :class="{ active: page === currentPage }"
                @click="goToPage(page)"
            >
                {{ page }}
            </button>
        </div>
        
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">→</button>
        <button class="page-btn" @click="goToPage(totalPages)" :disabled="currentPage === totalPages">»</button>
        
        <span class="page-info">
            {{ currentPage }} / {{ totalPages }}
        </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import {
    canConvertWithLegacyUsdTwdRate,
    detectNativeCurrency,
    formatNativeAmount,
} from '../services/instrumentCurrency.js';

const store = usePortfolioStore();
const { addToast } = useToast();
const emit = defineEmits(['edit']);

const tableRef = ref(null);
const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');
const currentPage = ref(1);
const itemsPerPage = ref(20);
const sortKey = ref('txn_date');
const sortOrder = ref('desc');
const isRefreshing = ref(false);
const editingId = ref(null);

// 手機版狀態
const isMobile = ref(false);
const showFilters = ref(false);

const updateMedia = () => {
    isMobile.value = window.innerWidth < 768;
    if (!isMobile.value) showFilters.value = true; // 桌面預設展開
};

onMounted(() => {
    updateMedia();
    window.addEventListener('resize', updateMedia);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateMedia);
});

// 格式化函數
const formatNumber = (num, d=2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// 修正：日期格式改為 YYYY-MM-DD
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getTypeLabel = (type) => {
    const labels = { 'BUY': '買入', 'SELL': '賣出', 'DIV': '配息' };
    return labels[type] || type;
};

const getRecordCurrency = (record) => detectNativeCurrency(record?.symbol);

// Legacy history exposes one scalar USD/TWD reference rate only. Keep that
// compatibility path for USD, but never reuse it as KRW/HKD/CNY/JPY/GBp/EUR FX.
const fxRateMap = computed(() => {
    const map = {};
    if (store.history && store.history.length > 0) {
        store.history.forEach(item => {
            const rate = Number(item.fx_rate);
            if (item.date && Number.isFinite(rate) && rate > 0) map[item.date] = rate;
        });
    }
    return map;
});

const getFxRateByDate = (dateStr) => {
    if (fxRateMap.value[dateStr]) return fxRateMap.value[dateStr];
    const dates = Object.keys(fxRateMap.value).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= dateStr) return fxRateMap.value[dates[i]];
    }
    return null;
};

const calculateTotalAmountNative = (record) => {
    const qty = Number(record.qty) || 0;
    const price = Number(record.price) || 0;
    const totalAmount = Number(record.total_amount) || 0;
    const commission = Number(record.fee || record.commission) || 0;
    const tax = Number(record.tax) || 0;
    const baseTotal = totalAmount > 0 ? totalAmount : Math.abs(qty * price);
    return baseTotal + commission + tax;
};

const formatRecordNativeAmount = (record, digits = 2) => (
    formatNativeAmount(calculateTotalAmountNative(record), getRecordCurrency(record), digits)
);

const getRecordAvgPrice = (record) => {
    const qty = Number(record.qty) || 0;
    if (qty <= 0) return 0;
    const price = Number(record.price) || 0;
    const totalAmount = Number(record.total_amount) || 0;
    const commission = Number(record.fee || record.commission) || 0;
    const tax = Number(record.tax) || 0;
    const baseTotal = totalAmount > 0 ? totalAmount : Math.abs(qty * price);
    if (record.txn_type === 'BUY') {
        return (baseTotal + commission + tax) / qty;
    }
    if (record.txn_type === 'SELL') {
        return (baseTotal - commission - tax) / qty;
    }
    return price;
};

const getTotalAmountTWD = (record) => {
    const nativeAmount = calculateTotalAmountNative(record);
    const currency = getRecordCurrency(record);
    if (!canConvertWithLegacyUsdTwdRate(currency)) return null;
    if (currency === 'TWD') return nativeAmount;

    const fxRate = getFxRateByDate(record.txn_date);
    if (!Number.isFinite(fxRate) || fxRate <= 0) return null;
    return nativeAmount * fxRate;
};

const getTwdPresentation = (record) => {
    const amount = getTotalAmountTWD(record);
    if (amount == null) return 'TWD 尚無可靠換算';
    return `≈ NT$${formatNumber(amount, 0)}`;
};

const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

const buyCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'DIV').length);

const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '⇅';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const processedRecords = computed(() => {
    let result = store.records.filter(r => {
        const matchSearch = r.symbol.toUpperCase().includes(searchQuery.value.toUpperCase());
        const matchType = filterType.value === 'ALL' || r.txn_type === filterType.value;
        const matchYear = filterYear.value === 'ALL' || r.txn_date.startsWith(filterYear.value);
        let matchGroup = true;
        if (store.currentGroup !== 'all') {
            const tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
            matchGroup = tags.includes(store.currentGroup);
        }
        return matchSearch && matchType && matchYear && matchGroup;
    });

    result.sort((a, b) => {
        let valA, valB;
        if (sortKey.value === 'total_amount_twd') {
            valA = getTotalAmountTWD(a);
            valB = getTotalAmountTWD(b);
            const missingA = valA == null;
            const missingB = valB == null;
            if (missingA || missingB) {
                if (missingA && missingB) return 0;
                return missingA ? 1 : -1;
            }
        } else {
            valA = a[sortKey.value];
            valB = b[sortKey.value];
        }
        if (sortKey.value === 'txn_date') {
            return sortOrder.value === 'asc' ? new Date(valA) - new Date(valB) : new Date(valB) - new Date(valA);
        }
        if (typeof valA === 'string') {
            return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
    return result;
});

const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return processedRecords.value.slice(start, start + itemsPerPage.value);
});

const totalPages = computed(() => Math.ceil(processedRecords.value.length / itemsPerPage.value) || 1);

const visiblePages = computed(() => {
    const pages = [];
    const total = totalPages.value;
    const current = currentPage.value;
    if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        if (current <= 3) {
            for (let i = 1; i <= 4; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 2) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 3; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            pages.push(current);
            pages.push('...');
            pages.push(total);
        }
    }
    return pages;
});

const prevPage = () => { if (currentPage.value > 1) { currentPage.value--; scrollToTop(); } };
const nextPage = () => { if (currentPage.value < totalPages.value) { currentPage.value++; scrollToTop(); } };
const goToPage = (page) => { if (page !== '...' && page >= 1 && page <= totalPages.value) { currentPage.value = page; scrollToTop(); } };

const scrollToTop = () => {
    // 簡單的頂部滾動
    const el = document.querySelector('.section-records');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const refreshData = async () => {
    isRefreshing.value = true;
    try {
        await store.fetchRecords();
        addToast('數據已更新', 'success');
    } catch (e) {
        addToast('刷新失敗', 'error');
    } finally {
        setTimeout(() => { isRefreshing.value = false; }, 500);
    }
};

const editRecord = (record) => {
    editingId.value = record.id;
    emit('edit', record);
    setTimeout(() => { editingId.value = null; }, 2000);
};

const deleteRecord = async (id) => {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;
    await store.deleteRecord(id);
};

watch([searchQuery, filterType, filterYear, itemsPerPage], () => { currentPage.value = 1; });
watch(() => store.currentGroup, () => { currentPage.value = 1; });
</script>

<style scoped>
.card-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.header-title-row { display: flex; justify-content: space-between; align-items: center; }
.header-title-row h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); }
.btn-toggle-filter { background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 8px; font-size: 0.9rem; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 6px; }

.toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); transition: all 0.3s ease; }
.search-box { position: relative; flex: 1 1 200px; min-width: 180px; }
.search-box .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; padding: 10px 10px 10px 36px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; background: var(--bg-card); color: var(--text-main); }
.search-input:focus { outline: none; border-color: var(--primary); }

.filters-wrapper { display: flex; flex-wrap: wrap; gap: 12px; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; }
.filter-select { padding: 10px 16px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); font-size: 0.95rem; color: var(--text-main); cursor: pointer; }

/* 修正：統一刷新按鈕樣式 */
.btn-refresh {
  margin-left: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-sub);
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-refresh:hover:not(:disabled) {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--bg-secondary);
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1.1rem;
  display: inline-block;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

.btn-text {
  font-family: inherit;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Stats Summary */
.stats-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-label { font-size: 0.8rem; color: var(--text-sub); font-weight: 600; text-transform: uppercase; }
.stat-value { font-size: 1.4rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text-main); }
.stat-value.text-primary { color: var(--primary); }
.stat-value.text-success { color: var(--success); }
.stat-value.text-warning { color: var(--warning); }

/* Desktop Table */
.table-container { overflow-x: auto; border-radius: var(--radius-sm); }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-sub); font-size: 0.85rem; font-weight: 700; white-space: nowrap; background: var(--bg-secondary); }
th.sortable { cursor: pointer; }
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; }
.record-row:hover { background-color: var(--bg-secondary); }
.date-cell { font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: var(--text-sub); }
.symbol-badge { font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--primary); }
.record-twd-note, .m-twd-note { margin-top: 2px; color: var(--text-sub); font-size: 0.75rem; font-weight: 500; }
.record-twd-note.unavailable, .m-twd-note.unavailable { color: var(--warning); }

.type-badge { font-size: 0.8rem; padding: 4px 8px; border-radius: 6px; font-weight: 600; display: inline-block; }
.type-badge.buy { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
.type-badge.sell { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.type-badge.div { background: rgba(245, 158, 11, 0.1); color: var(--warning); }

.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-icon { border: none; background: var(--bg-secondary); cursor: pointer; color: var(--text-sub); font-size: 1rem; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.btn-icon:hover { background: var(--bg-card); border: 1px solid var(--border-color); }

/* Mobile Card View */
.mobile-view { display: none; }
.mobile-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 12px; padding: 16px; transition: transform 0.2s; }
.mobile-card:active { transform: scale(0.99); background: var(--bg-secondary); }

.m-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.m-date { font-size: 0.85rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.type-badge.sm { font-size: 0.75rem; padding: 2px 6px; }

.m-card-body { margin-bottom: 12px; }
.m-main-info { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.m-symbol { font-size: 1.1rem; font-weight: 700; color: var(--primary); }
.m-amount { font-size: 1.1rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.m-twd-note { text-align: right; margin-bottom: 4px; }

.m-sub-info { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-sub); }
.m-fee { font-size: 0.75rem; color: var(--text-sub); opacity: 0.7; }

.m-card-actions { display: flex; border-top: 1px solid var(--border-color); margin: 0 -16px -16px -16px; }
.btn-action { flex: 1; border: none; background: transparent; padding: 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; color: var(--text-sub); }
.btn-action.edit { color: var(--primary); }
.btn-action.delete { color: var(--danger); }
.v-divider { width: 1px; background: var(--border-color); }

/* Pagination */
.pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 24px; }
.page-btn, .page-number { min-width: 32px; height: 32px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: 0.9rem; }
.page-number.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-info { font-size: 0.9rem; color: var(--text-sub); margin-left: 8px; font-family: 'JetBrains Mono', monospace; }

/* Utilities */
.mobile-only { display: none; }
.desktop-only { display: inline-block; }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
.empty-icon { font-size: 2rem; margin-bottom: 8px; opacity: 0.5; }

/* RWD Media Queries */
@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }
    .mobile-only { display: flex; }
    .desktop-only { display: none; }
    
    .toolbar { padding: 12px; gap: 12px; align-items: stretch; }
    .toolbar:not(.mobile-expanded) .filters-wrapper { display: none; } /* 預設隱藏篩選 */
    
    .filters-wrapper { width: 100%; flex-direction: column; }
    .filters { flex-direction: column; width: 100%; }
    .filter-select { width: 100%; }
    
    .btn-refresh { padding: 10px; min-width: 42px; }
    .btn-text { display: none; } /* 手機版隱藏文字 */
    .refresh-icon { font-size: 1.2rem; }
    
    .stats-summary { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat-value { font-size: 1.2rem; }
}
</style>