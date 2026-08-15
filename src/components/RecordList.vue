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
                    placeholder="搜尋代碼、標籤或備註..."
                    class="search-input"
                    aria-label="搜尋交易紀錄"
                >
             </div>

             <div class="filters-wrapper" v-show="!isMobile || showFilters">
                 <div class="filters">
                     <select v-model="filterType" class="filter-select" aria-label="交易類型">
                        <option value="ALL">所有類型</option>
                        <option value="BUY">買入</option>
                        <option value="SELL">賣出</option>
                        <option value="DIV">配息</option>
                    </select>

                    <div class="filter-date-range" :class="{ invalid: dateRangeError }">
                        <span class="filter-label">日期</span>
                        <input
                            type="date"
                            v-model="dateFrom"
                            class="filter-date-input"
                            :max="dateTo || undefined"
                            aria-label="開始日期"
                        >
                        <span class="date-separator">→</span>
                        <input
                            type="date"
                            v-model="dateTo"
                            class="filter-date-input"
                            :min="dateFrom || undefined"
                            aria-label="結束日期"
                        >
                    </div>

                    <select v-model="itemsPerPage" class="filter-select" aria-label="每頁筆數">
                        <option :value="10">每頁 10 筆</option>
                        <option :value="20">每頁 20 筆</option>
                        <option :value="50">每頁 50 筆</option>
                        <option :value="100">每頁 100 筆</option>
                    </select>

                    <button
                        v-if="hasLocalFilters"
                        type="button"
                        class="btn-clear-filters"
                        @click="clearLocalFilters"
                    >
                        清除篩選
                    </button>
                 </div>
             </div>

             <IbkrTradeImport />

             <button class="btn-refresh" @click="refreshData" :disabled="isRefreshing">
                <span class="refresh-icon" :class="{ spinning: isRefreshing }">↺</span>
                <span class="btn-text">刷新</span>
             </button>
        </div>

        <div v-if="hasFilterContext || dateRangeError" class="filter-context" aria-live="polite">
            <span class="filter-result-count">顯示 {{ processedRecords.length }} / {{ store.records.length }} 筆</span>
            <span
                v-for="item in filterContextItems"
                :key="item.key"
                class="filter-context-chip"
                :class="{ fixed: item.fixed }"
            >
                {{ item.label }}
            </span>
            <span v-if="dateRangeError" class="filter-error">{{ dateRangeError }}</span>
        </div>
    </div>

    <div class="stats-summary">
        <div class="stat-item">
            <span class="stat-label">顯示筆數</span>
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
                        代碼 / 策略 / 備註 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
                    </th>
                    <th @click="sortBy('txn_type')" class="sortable">
                        類型 <span class="sort-icon">{{ getSortIcon('txn_type') }}</span>
                    </th>
                    <th class="text-right">股數</th>
                    <th class="text-right">單價</th>
                    <th
                        @click="sortBy('total_amount_twd')"
                        class="text-right sortable"
                        title="外幣 TWD 金額只使用目前已載入快照中完全相同交易日期的權威 FX；缺少證據時不估算"
                    >
                        總額 <span class="sort-icon">{{ getSortIcon('total_amount_twd') }}</span>
                    </th>
                    <th class="text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">
                        <div class="empty-icon">📋</div>
                        <div>{{ dateRangeError ? '請修正日期範圍' : '無符合條件的紀錄' }}</div>
                    </td>
                </tr>
                <template v-for="r in paginatedRecords" :key="r.id">
                    <tr
                        class="record-row"
                        :class="{ 'editing': editingId === r.id, 'expanded': isRecordExpanded(r.id) }"
                    >
                        <td class="date-cell">
                            <span class="date-text">{{ formatDate(r.txn_date) }}</span>
                        </td>
                        <td class="symbol-cell">
                            <div class="symbol-stack">
                                <span class="symbol-badge">{{ r.symbol }}</span>
                                <div v-if="getRecordTags(r).length > 0" class="record-tags" aria-label="策略標籤">
                                    <span v-for="tag in getRecordTags(r)" :key="tag" class="tag-chip">{{ tag }}</span>
                                </div>
                                <span v-if="r.note" class="record-note-inline">{{ r.note }}</span>
                                <span v-if="r.note" class="record-note-inline">{{ r.note }}</span>
                                <span v-if="r.note" class="record-note-inline">{{ r.note }}</span>
                                <span v-if="r.note" class="record-note-inline">{{ r.note }}</span>
                            </div>
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
                            <button
                                class="btn-icon view"
                                @click="toggleRecordDetails(r.id)"
                                :aria-expanded="isRecordExpanded(r.id)"
                                :aria-controls="getRecordDetailId(r.id)"
                                :aria-label="isRecordExpanded(r.id) ? '收合完整交易明細' : '查看完整交易明細'"
                                :title="isRecordExpanded(r.id) ? '收合交易明細' : '查看完整交易明細'"
                            >
                                {{ isRecordExpanded(r.id) ? '▴' : '▾' }}
                            </button>
                            <button class="btn-icon edit" @click="editRecord(r)" title="編輯">✎</button>
                            <button class="btn-icon delete" @click="deleteRecord(r.id)" title="刪除">✕</button>
                        </td>
                    </tr>
                    <tr v-if="isRecordExpanded(r.id)" class="record-detail-row">
                        <td colspan="7">
                            <RecordDetailPanel :record="r" :panel-id="getRecordDetailId(r.id)" />
                        </td>
                    </tr>
                </template>
            </tbody>
        </table>
    </div>

    <div class="mobile-view">
        <div v-if="paginatedRecords.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <div>{{ dateRangeError ? '請修正日期範圍' : '無符合條件的紀錄' }}</div>
        </div>

        <div
            v-for="r in paginatedRecords"
            :key="'mob_'+r.id"
            class="mobile-card"
            :class="{ 'editing': editingId === r.id, 'expanded': isRecordExpanded(r.id) }"
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
                <div v-if="getRecordTags(r).length > 0" class="record-tags mobile-tags" aria-label="策略標籤">
                    <span v-for="tag in getRecordTags(r)" :key="tag" class="tag-chip">{{ tag }}</span>
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
                        ({{ getRecordCurrency(r) }} 費稅: {{ (r.fee||0) + (r.tax||0) }})
                    </span>
                </div>
                <div v-if="r.note" class="m-note m-note-preview">{{ r.note }}</div>
            </div>

            <RecordDetailPanel
                v-if="isRecordExpanded(r.id)"
                :record="r"
                :panel-id="getRecordDetailId(r.id)"
                class="mobile-detail-panel"
            />

            <div class="m-card-actions">
                <button
                    class="btn-action view"
                    @click="toggleRecordDetails(r.id)"
                    :aria-expanded="isRecordExpanded(r.id)"
                    :aria-controls="getRecordDetailId(r.id)"
                    :aria-label="isRecordExpanded(r.id) ? '收合完整交易明細' : '查看完整交易明細'"
                >
                    {{ isRecordExpanded(r.id) ? '▴ 收合明細' : '▾ 查看明細' }}
                </button>
                <div class="m-divider"></div>
                <button class="btn-action edit" @click="editRecord(r)">
                    ✎ 編輯
                </button>
                <div class="m-divider"></div>
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
import IbkrTradeImport from './IbkrTradeImport.vue';
import RecordDetailPanel from './RecordDetailPanel.vue';
import {
    detectNativeCurrency,
    formatNativeAmount,
} from '../services/instrumentCurrency.js';
import {
    resolveSettlementAmountNative,
    resolveTransactionValuation,
} from '../services/transactionValuation.js';
import {
    getHistoryDateRangeError,
    getRecordTags,
    hasLocalHistoryFilters,
    normalizeRecordDate,
    recordMatchesHistoryFilters,
} from '../services/recordHistoryPresentation.js';

const store = usePortfolioStore();
const { addToast } = useToast();
const emit = defineEmits(['edit']);

const tableRef = ref(null);
const searchQuery = ref('');
const filterType = ref('ALL');
const dateFrom = ref('');
const dateTo = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(20);
const sortKey = ref('txn_date');
const sortOrder = ref('desc');
const isRefreshing = ref(false);
const editingId = ref(null);
const expandedRecordId = ref(null);

const isMobile = ref(false);
const showFilters = ref(false);

const updateMedia = () => {
    isMobile.value = window.innerWidth < 768;
    if (!isMobile.value) showFilters.value = true;
};

onMounted(() => {
    updateMedia();
    window.addEventListener('resize', updateMedia);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateMedia);
});

const formatNumber = (num, d=2) => {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatDate = (dateStr) => normalizeRecordDate(dateStr) || String(dateStr || '');

const getTypeLabel = (type) => {
    const labels = { 'BUY': '買入', 'SELL': '賣出', 'DIV': '配息' };
    return labels[type] || type;
};

const getRecordCurrency = (record) => detectNativeCurrency(record?.symbol);

const getRecordValuation = (record) => {
    const currency = getRecordCurrency(record);
    if (currency !== 'TWD' && store.snapshotFreshness !== 'loaded') return null;
    return resolveTransactionValuation(store.rawData, record);
};

const getRecordSettlementNative = (record) => resolveSettlementAmountNative(record);

const formatRecordNativeAmount = (record, digits = 2) => (
    formatNativeAmount(getRecordSettlementNative(record), getRecordCurrency(record), digits)
);

const getRecordAvgPrice = (record) => {
    const qty = Number(record?.qty);
    const settlement = getRecordSettlementNative(record);
    if (!Number.isFinite(qty) || qty <= 0 || settlement == null) return null;
    return settlement / qty;
};

const getTotalAmountTWD = (record) => {
    const currency = getRecordCurrency(record);
    if (currency === 'TWD') return getRecordSettlementNative(record);
    return getRecordValuation(record)?.settlementAmountTwd ?? null;
};

const getTwdPresentation = (record) => {
    const valuation = getRecordValuation(record);
    if (!valuation) return 'TWD 尚無可靠換算';
    const prefix = valuation.fxSource === 'legacy-usd-reference' ? '≈ ' : '';
    return `${prefix}NT$${formatNumber(valuation.settlementAmountTwd, 0)}`;
};

const getRecordDetailId = (id) => `record-detail-${id}`;
const isRecordExpanded = (id) => expandedRecordId.value === id;
const collapseRecordDetails = () => { expandedRecordId.value = null; };
const toggleRecordDetails = (id) => {
    expandedRecordId.value = isRecordExpanded(id) ? null : id;
};

const historyFilters = computed(() => ({
    query: searchQuery.value,
    type: filterType.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
    currentGroup: store.currentGroup,
}));

const dateRangeError = computed(() => getHistoryDateRangeError(historyFilters.value));
const hasLocalFilters = computed(() => hasLocalHistoryFilters(historyFilters.value));
const hasFilterContext = computed(() => hasLocalFilters.value || store.currentGroup !== 'all');

const filterContextItems = computed(() => {
    const items = [];
    if (store.currentGroup !== 'all') {
        items.push({ key: 'group', label: `策略群組：${store.currentGroup}`, fixed: true });
    }
    const query = searchQuery.value.trim();
    if (query) items.push({ key: 'query', label: `搜尋：${query}`, fixed: false });
    if (filterType.value !== 'ALL') {
        items.push({ key: 'type', label: `類型：${getTypeLabel(filterType.value)}`, fixed: false });
    }
    if (dateFrom.value || dateTo.value) {
        items.push({
            key: 'date',
            label: `日期：${dateFrom.value || '最早'} → ${dateTo.value || '最新'}`,
            fixed: false,
        });
    }
    return items;
});

const buyCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'BUY').length);
const sellCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'SELL').length);
const divCount = computed(() => processedRecords.value.filter(r => r.txn_type === 'DIV').length);

const sortBy = (key) => {
    collapseRecordDetails();
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
    if (dateRangeError.value) return [];

    const result = store.records.filter(r => recordMatchesHistoryFilters(r, historyFilters.value));

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
            return sortOrder.value === 'asc'
                ? String(valA || '').localeCompare(String(valB || ''))
                : String(valB || '').localeCompare(String(valA || ''));
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

const prevPage = () => {
    if (currentPage.value > 1) {
        collapseRecordDetails();
        currentPage.value--;
        scrollToTop();
    }
};
const nextPage = () => {
    if (currentPage.value < totalPages.value) {
        collapseRecordDetails();
        currentPage.value++;
        scrollToTop();
    }
};
const goToPage = (page) => {
    if (page !== '...' && page >= 1 && page <= totalPages.value) {
        collapseRecordDetails();
        currentPage.value = page;
        scrollToTop();
    }
};

const scrollToTop = () => {
    const el = document.querySelector('.section-records');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const clearLocalFilters = () => {
    collapseRecordDetails();
    searchQuery.value = '';
    filterType.value = 'ALL';
    dateFrom.value = '';
    dateTo.value = '';
};

const refreshData = async () => {
    collapseRecordDetails();
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
    collapseRecordDetails();
    editingId.value = record.id;
    emit('edit', record);
    setTimeout(() => { editingId.value = null; }, 2000);
};

const deleteRecord = async (id) => {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;
    if (isRecordExpanded(id)) collapseRecordDetails();
    await store.deleteRecord(id);
};

watch([searchQuery, filterType, dateFrom, dateTo, itemsPerPage], () => {
    collapseRecordDetails();
    currentPage.value = 1;
});
watch(() => store.currentGroup, () => {
    collapseRecordDetails();
    currentPage.value = 1;
});
</script>

<style scoped>
.card-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.header-title-row { display: flex; justify-content: space-between; align-items: center; }
.header-title-row h3 { margin: 0; padding-left: 12px; border-left: 4px solid var(--primary); }
.btn-toggle-filter { background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 8px; font-size: var(--type-control); color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 6px; }

.toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); transition: all 0.3s ease; }
.search-box { position: relative; flex: 1 1 200px; min-width: 180px; }
.search-box .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-sub); pointer-events: none; }
.search-input { width: 100%; box-sizing: border-box; padding: 10px 10px 10px 36px; border: 1px solid var(--border-color); border-radius: 8px; font-size: var(--type-control); background: var(--bg-card); color: var(--text-main); }
.search-input:focus { outline: none; border-color: var(--primary); }

.filters-wrapper { display: flex; flex-wrap: wrap; gap: 12px; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.filter-select, .filter-date-input { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); font-size: var(--type-control); color: var(--text-main); }
.filter-select { cursor: pointer; }
.filter-date-range { display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); }
.filter-date-range.invalid { border-color: var(--danger); }
.filter-date-range .filter-date-input { border: 0; padding: 6px 4px; min-width: 130px; }
.filter-date-input:focus { outline: none; }
.filter-label { font-size: var(--type-label); font-weight: 700; color: var(--text-sub); white-space: nowrap; }
.date-separator { color: var(--text-sub); font-size: var(--type-label); }
.btn-clear-filters { padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-sub); font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-clear-filters:hover { border-color: var(--primary); color: var(--primary); background: var(--bg-secondary); }
.filter-context { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); font-size: var(--type-label); }
.filter-result-count { color: var(--text-sub); font-weight: 600; }
.filter-context-chip { padding: 4px 9px; border-radius: 999px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); }
.filter-context-chip.fixed { color: var(--primary); border-color: rgba(59, 130, 246, 0.35); }
.filter-error { color: var(--danger); font-weight: 700; }

.btn-refresh {
  margin-left: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-sub);
  font-size: var(--type-control);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-refresh:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); background: var(--bg-secondary); }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.refresh-icon { font-size: var(--icon-md); display: inline-block; }
.refresh-icon.spinning { animation: spin 1s linear infinite; }
.btn-text { font-family: inherit; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.stats-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-sm); }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-label { font-size: var(--type-label); color: var(--text-sub); font-weight: 600; text-transform: uppercase; }
.stat-value { font-size: var(--type-metric); font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text-main); }
.stat-value.text-primary { color: var(--primary); }
.stat-value.text-success { color: var(--success); }
.stat-value.text-warning { color: var(--warning); }

.table-container { overflow-x: auto; border-radius: var(--radius-sm); }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { text-align: left; padding: 12px 16px; border-bottom: 2px solid var(--border-color); color: var(--text-sub); font-size: var(--type-body); font-weight: 700; white-space: nowrap; background: var(--bg-secondary); }
th.sortable { cursor: pointer; }
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-size: var(--type-emphasis); }
.record-row:hover { background-color: var(--bg-secondary); }
.record-row.expanded { background-color: var(--bg-secondary); }
.record-detail-row td { padding: 8px 12px 16px; background: var(--bg-card); }
.date-cell { font-family: 'JetBrains Mono', monospace; font-size: var(--type-label); color: var(--text-sub); }
.symbol-cell { min-width: 0; }
.symbol-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; }
.symbol-badge { font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--primary); }
.record-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-chip { display: inline-flex; align-items: center; max-width: 160px; padding: 2px 7px; border-radius: 999px; background: rgba(99, 102, 241, 0.09); color: var(--text-sub); border: 1px solid rgba(99, 102, 241, 0.18); font-size: var(--type-caption); font-weight: 650; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-twd-note, .m-twd-note { margin-top: 2px; color: var(--text-sub); font-size: var(--type-caption); font-weight: 500; }
.record-twd-note.unavailable, .m-twd-note.unavailable { color: var(--warning); }
.record-note-inline { display: block; width: 100%; min-width: 0; color: var(--text-sub); font-size: var(--type-label); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.type-badge { font-size: var(--type-label); padding: 4px 8px; border-radius: 6px; font-weight: 600; display: inline-block; }
.type-badge.buy { background: rgba(59, 130, 246, 0.1); color: var(--primary); }
.type-badge.sell { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.type-badge.div { background: rgba(245, 158, 11, 0.1); color: var(--warning); }

.actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-icon { border: none; background: var(--bg-secondary); cursor: pointer; color: var(--text-sub); font-size: var(--icon-sm); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.btn-icon:hover { background: var(--bg-card); border: 1px solid var(--border-color); }
.btn-icon.view { color: var(--primary); }

.mobile-view { display: none; }
.mobile-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 12px; padding: 16px; transition: transform 0.2s; }
.mobile-card:active { transform: scale(0.99); background: var(--bg-secondary); }
.mobile-card.expanded { background: var(--bg-secondary); }
.m-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.m-date { font-size: var(--type-label); color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }
.type-badge.sm { font-size: var(--type-caption); padding: 2px 6px; }
.m-card-body { margin-bottom: 12px; }
.m-main-info { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; gap: 12px; }
.m-symbol { font-size: var(--type-section); font-weight: 700; color: var(--primary); }
.m-amount { font-size: var(--type-metric-sm); font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.mobile-tags { margin: 4px 0 8px; }
.m-twd-note { text-align: right; margin-bottom: 4px; }
.m-sub-info { display: flex; justify-content: space-between; gap: 8px; font-size: var(--type-label); color: var(--text-sub); }
.m-fee { font-size: var(--type-caption); color: var(--text-sub); opacity: 0.7; }
.m-note { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: var(--bg-secondary); color: var(--text-main); font-size: var(--type-label); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.m-note-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; }
.mobile-detail-panel { margin: 0 0 14px; }
.m-card-actions { display: flex; border-top: 1px solid var(--border-color); margin: 0 -16px -16px -16px; }
.btn-action { flex: 1; border: none; background: transparent; padding: 12px 8px; font-size: var(--type-control); font-weight: 600; cursor: pointer; color: var(--text-sub); }
.btn-action.view { color: var(--primary); }
.btn-action.edit { color: var(--primary); }
.btn-action.delete { color: var(--danger); }
.m-divider { width: 1px; background: var(--border-color); }

.pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 24px; }
.page-btn, .page-number { min-width: 32px; height: 32px; border: 1px solid var(--border-color); background: var(--bg-card); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: var(--type-body); }
.page-number.active { background: var(--primary); color: white; border-color: var(--primary); }
.page-info { font-size: var(--type-label); color: var(--text-sub); margin-left: 8px; font-family: 'JetBrains Mono', monospace; }

.mobile-only { display: none; }
.desktop-only { display: inline-block; }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.empty-state { text-align: center; padding: 40px; color: var(--text-sub); }
.empty-icon { font-size: var(--icon-empty); margin-bottom: 8px; opacity: 0.5; }

@media (max-width: 768px) {
    .desktop-view { display: none; }
    .mobile-view { display: block; }
    .mobile-only { display: flex; }
    .desktop-only { display: none; }

    .toolbar { padding: 12px; gap: 12px; align-items: stretch; }
    .toolbar:not(.mobile-expanded) .filters-wrapper { display: none; }
    .filters-wrapper { width: 100%; flex-direction: column; }
    .filters { flex-direction: column; width: 100%; align-items: stretch; }
    .filter-select { width: 100%; box-sizing: border-box; }
    .filter-date-range { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); width: 100%; box-sizing: border-box; }
    .filter-date-range .filter-date-input { min-width: 0; width: 100%; box-sizing: border-box; }
    .btn-clear-filters { width: 100%; }
    .filter-context { margin-top: -4px; }
    .btn-refresh { padding: 10px; min-width: 42px; }
    .btn-text { display: none; }
    .refresh-icon { font-size: var(--icon-lg); }
    .stats-summary { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat-value { font-size: var(--type-metric-sm); }
}

@media (max-width: 480px) {
    .filter-date-range { grid-template-columns: 1fr; gap: 4px; padding: 8px; }
    .date-separator { display: none; }
    .filter-label { margin-bottom: 2px; }
    .filter-date-range .filter-date-input { border: 1px solid var(--border-color); padding: 8px; }
    .m-sub-info { flex-direction: column; }
}
</style>
