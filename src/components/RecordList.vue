<template>
  <div class="card">
    <div class="header-row">
        <h3>交易紀錄</h3>
        <div class="filters">
             <input type="text" v-model="searchQuery" placeholder="搜尋代碼..." class="search-input">
             <select v-model="filterType" class="filter-select">
                <option value="ALL">全部</option>
                <option value="BUY">買入</option>
                <option value="SELL">賣出</option>
                <option value="DIV">配息</option>
            </select>
        </div>
    </div>

    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th>日期</th>
                    <th>代碼</th>
                    <th>類型</th>
                    <th class="text-right">股數</th>
                    <th class="text-right">價格 (USD)</th>
                    <th class="text-right">總額 (USD)</th>
                    <th class="text-right">操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="paginatedRecords.length === 0">
                    <td colspan="7" class="empty-state">無符合資料</td>
                </tr>
                <tr v-for="r in paginatedRecords" :key="r.id">
                    <td>{{ r.txn_date }}</td>
                    <td><span class="symbol-badge">{{ r.symbol }}</span></td>
                    <td>
                        <span class="type-badge" :class="r.txn_type.toLowerCase()">
                            {{ r.txn_type }}
                        </span>
                    </td>
                    <td class="text-right font-mono">{{ r.qty }}</td>
                    <td class="text-right font-mono">{{ formatNumber(r.price, 2) }}</td>
                    <td class="text-right font-mono">{{ formatNumber(r.total_amount, 2) }}</td>
                    <td class="text-right">
                        <button class="btn-icon" @click="$emit('edit', r)" title="編輯">✎</button>
                        <button class="btn-icon delete" @click="del(r.id)" title="刪除">✕</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="pagination" v-if="totalPages > 1">
        <button class="btn btn-sm btn-outline" @click="prevPage" :disabled="currentPage === 1">上一頁</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="btn btn-sm btn-outline" @click="nextPage" :disabled="currentPage === totalPages">下一頁</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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
const currentPage = ref(1);
const itemsPerPage = 8;

const formatNumber = (num, d=0) => Number(num||0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const filteredRecords = computed(() => {
    return store.records.filter(r => {
        if (searchQuery.value && !r.symbol.includes(searchQuery.value.toUpperCase())) return false;
        if (filterType.value !== 'ALL' && r.txn_type !== filterType.value) return false;
        return true;
    }).sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredRecords.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredRecords.value.length / itemsPerPage) || 1);
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };

const del = async (id) => {
    if(!confirm("確定刪除?")) return;
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        addToast("已刪除", "success"); store.fetchRecords();
    } catch(e) { addToast("刪除失敗", "error"); }
};
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.filters { display: flex; gap: 8px; }
.search-input, .filter-select { padding: 6px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem; background: white; }
.table-responsive { overflow-x: auto; }
.text-right { text-align: right; }
.font-mono { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }

.symbol-badge { font-weight: 600; color: var(--text-primary); }
.type-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.type-badge.buy { background: #eff6ff; color: var(--primary); }
.type-badge.sell { background: #ecfdf5; color: var(--success); }
.type-badge.div { background: #fff7ed; color: var(--warning); }

.btn-icon { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px 8px; font-size: 1rem; transition: color 0.2s; }
.btn-icon:hover { color: var(--primary); }
.btn-icon.delete:hover { color: var(--danger); }
.empty-state { text-align: center; color: var(--text-light); padding: 20px; font-style: italic; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
.page-info { font-size: 0.85rem; color: var(--text-secondary); }
</style>
