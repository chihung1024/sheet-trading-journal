<template>
  <div class="card holdings-card">
    <div class="card-header">
      <div class="header-left">
        <h3 class="card-title">
          <span class="icon">💼</span> 持倉明細
        </h3>
        <div class="summary-pill">
          <span class="label">總市值</span>
          <span class="value">{{ formatNumber(totalMarketValue) }}</span>
          <span class="currency">TWD</span>
        </div>
      </div>
      
      <div class="header-controls">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜尋代碼..."
            class="search-input"
          >
        </div>
        
        <div class="filter-wrapper">
          <select v-model="filterStatus" class="filter-select">
            <option value="all">全部持倉</option>
            <option value="profit">僅顯示獲利</option>
            <option value="loss">僅顯示虧損</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="table-container" ref="tableContainer">
      <table class="responsive-table">
        <thead>
          <tr>
            <th @click="sortBy('symbol')" class="sortable col-symbol">
              標的 <span class="sort-icon">{{ getSortIcon('symbol') }}</span>
            </th>
            <th @click="sortBy('weight')" class="sortable col-weight mobile-hide">
              佔比 <span class="sort-icon">{{ getSortIcon('weight') }}</span>
            </th>
            <th @click="sortBy('qty')" class="sortable text-right mobile-hide">
              股數 <span class="sort-icon">{{ getSortIcon('qty') }}</span>
            </th>
            <th @click="sortBy('avg_cost_usd')" class="sortable text-right mobile-hide">
              成本(USD) <span class="sort-icon">{{ getSortIcon('avg_cost_usd') }}</span>
            </th>
            <th @click="sortBy('current_price_origin')" class="sortable text-right">
              現價/漲跌 <span class="sort-icon">{{ getSortIcon('current_price_origin') }}</span>
            </th>
            <th @click="sortBy('market_value_twd')" class="sortable text-right">
              市值(TWD) <span class="sort-icon">{{ getSortIcon('market_value_twd') }}</span>
            </th>
            <th @click="sortBy('pnl_twd')" class="sortable text-right">
              總損益 <span class="sort-icon">{{ getSortIcon('pnl_twd') }}</span>
            </th>
            <th @click="sortBy('pnl_percent')" class="sortable text-right">
              報酬率 <span class="sort-icon">{{ getSortIcon('pnl_percent') }}</span>
            </th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredHoldings.length === 0">
            <td colspan="9" class="empty-state">
              <div class="empty-content">
                <span class="empty-icon">📂</span>
                <p>查無符合條件的持倉</p>
              </div>
            </td>
          </tr>
          
          <tr 
            v-for="h in visibleHoldings" 
            :key="h.symbol" 
            class="row-item"
            :class="{ 'highlighted': highlightedSymbol === h.symbol }"
            @click="handleRowClick(h)"
          >
            <td class="col-symbol" data-label="標的">
              <div class="symbol-box">
                <span class="symbol-text">{{ h.symbol }}</span>
                <span class="symbol-badge fire" v-if="h.pnl_percent > 50">🔥</span>
                <span class="symbol-badge new" v-if="isNewHolding(h)">NEW</span>
              </div>
            </td>

            <td class="col-weight mobile-hide" data-label="佔比">
              <div class="weight-bar-container">
                <div class="weight-info">{{ h.weight }}%</div>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: h.weight + '%' }"></div>
                </div>
              </div>
            </td>

            <td class="text-right font-num mobile-hide" data-label="股數">
              {{ formatNumber(h.qty, 2) }}
            </td>

            <td class="text-right font-num text-sub mobile-hide" data-label="成本">
              {{ formatNumber(h.avg_cost_usd, 2) }}
            </td>

            <td class="text-right font-num" data-label="現價">
              <div class="price-cell">
                <div class="main-price">{{ formatNumber(h.current_price_origin, 2) }}</div>
                <div class="sub-price" :class="getTrendClass(h.daily_change_usd)">
                  {{ h.daily_change_usd >= 0 ? '▲' : '▼' }} {{ formatNumber(Math.abs(h.daily_change_usd), 2) }}
                </div>
              </div>
            </td>

            <td class="text-right font-num font-bold" data-label="市值">
              {{ formatNumber(h.market_value_twd, 0) }}
            </td>

            <td class="text-right font-num" data-label="損益">
              <div class="pnl-cell" :class="getTrendClass(h.pnl_twd)">
                {{ h.pnl_twd >= 0 ? '+' : '' }}{{ formatNumber(h.pnl_twd, 0) }}
              </div>
            </td>

            <td class="text-right font-num" data-label="報酬率">
              <div class="roi-pill" :class="getTrendClass(h.pnl_percent, true)">
                {{ h.pnl_percent >= 0 ? '+' : '' }}{{ safeNum(h.pnl_percent) }}%
              </div>
            </td>
            
            <td class="col-action" data-label="操作">
              <button class="btn-trade" @click.stop="quickTrade(h.symbol)" title="快速交易">
                ⚡
              </button>
            </td>
          </tr>
        </tbody>
        
        <tfoot v-if="filteredHoldings.length > 0">
            <tr class="summary-row">
                <td colspan="5" class="text-right label-total mobile-hide">合計</td>
                <td class="text-right font-num val-total" data-label="合計市值">{{ formatNumber(summaryData.marketValue, 0) }}</td>
                <td class="text-right font-num val-total" :class="getTrendClass(summaryData.pnl)" data-label="合計損益">
                    {{ summaryData.pnl >= 0 ? '+' : '' }}{{ formatNumber(summaryData.pnl, 0) }}
                </td>
                <td colspan="2"></td>
            </tr>
        </tfoot>
      </table>
    </div>
    
    <div class="scroll-hint" v-if="filteredHoldings.length > displayLimit">
      <span>已顯示 {{ visibleHoldings.length }} 筆，繼續捲動載入更多...</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const { addToast } = useToast();

const tableContainer = ref(null);
const sortKey = ref('market_value_twd'); 
const sortOrder = ref('desc');
const searchQuery = ref('');
const filterStatus = ref('all');
const highlightedSymbol = ref(null);
const displayLimit = ref(20); // 初始載入少一點以提升首屏速度

// Helpers
const safeNum = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return Number(val).toFixed(2);
};

const formatNumber = (num, d=0) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const totalMarketValue = computed(() => {
    return store.holdings.reduce((sum, h) => sum + (h.market_value_twd || 0), 0);
});

// Processed Data
const filteredHoldings = computed(() => {
    let result = store.holdings.map(h => ({
        ...h,
        weight: totalMarketValue.value > 0 
            ? ((h.market_value_twd || 0) / totalMarketValue.value * 100).toFixed(1) 
            : 0
    }));
    
    // Filter: Search
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(h => h.symbol.toLowerCase().includes(q));
    }
    
    // Filter: Status
    if (filterStatus.value === 'profit') {
        result = result.filter(h => (h.pnl_twd || 0) > 0);
    } else if (filterStatus.value === 'loss') {
        result = result.filter(h => (h.pnl_twd || 0) < 0);
    }
    
    // Sort
    return result.sort((a, b) => {
        let valA = a[sortKey.value];
        let valB = b[sortKey.value];
        
        // Handle strings vs numbers
        if (sortKey.value === 'symbol') {
            return sortOrder.value === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        }
        
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
});

// Summary based on filtered results
const summaryData = computed(() => {
    return filteredHoldings.value.reduce((acc, curr) => ({
        marketValue: acc.marketValue + (curr.market_value_twd || 0),
        pnl: acc.pnl + (curr.pnl_twd || 0)
    }), { marketValue: 0, pnl: 0 });
});

const visibleHoldings = computed(() => {
    return filteredHoldings.value.slice(0, displayLimit.value);
});

// Actions
const sortBy = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'desc';
    }
};

const getSortIcon = (key) => {
    if (sortKey.value !== key) return '';
    return sortOrder.value === 'asc' ? '↑' : '↓';
};

const getTrendClass = (val, isBg = false) => {
    const num = Number(val) || 0;
    if (num >= 0) return isBg ? 'bg-green' : 'text-green';
    return isBg ? 'bg-red' : 'text-red';
};

const isNewHolding = (holding) => {
    // 簡單邏輯：如果持有天數很少可視為 New (需後端支援，目前暫時均回傳 false)
    return false; 
};

const handleRowClick = (h) => {
    // 手機版點擊可以展開更多詳情，目前暫時只做高亮
    highlightedSymbol.value = h.symbol;
    setTimeout(() => highlightedSymbol.value = null, 1000);
};

const quickTrade = (symbol) => {
    addToast(`準備交易: ${symbol}`, 'info');
    // 觸發全域事件或使用 Store 通知 TradeForm
    // 這裡我們假設有一個全域的 event bus 或直接操作 DOM (簡單實作)
    const tradeForm = document.querySelector('.side-column'); 
    if(tradeForm) tradeForm.scrollIntoView({ behavior: 'smooth' });
    
    // 理想做法是透過 Store: store.setTradeSymbol(symbol);
    // 這裡僅示範 UI 反饋
};

const handleScroll = () => {
    if (!tableContainer.value) return;
    const { scrollTop, scrollHeight, clientHeight } = tableContainer.value;
    // 當捲動到底部 50px 內時載入更多
    if (scrollHeight - scrollTop - clientHeight < 50 && displayLimit.value < filteredHoldings.value.length) {
        displayLimit.value += 20;
    }
};

onMounted(() => {
    if (tableContainer.value) {
        tableContainer.value.addEventListener('scroll', handleScroll);
    }
});

onUnmounted(() => {
    if (tableContainer.value) {
        tableContainer.value.removeEventListener('scroll', handleScroll);
    }
});
</script>

<style scoped>
/* Card Base */
.holdings-card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
}

/* Header */
.card-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    background: rgba(var(--bg-secondary-rgb), 0.3);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.card-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
}

.summary-pill {
    background: var(--bg-secondary);
    padding: 4px 12px;
    border-radius: 99px;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border-color);
}
.summary-pill .label { color: var(--text-sub); font-size: 0.8rem; }
.summary-pill .value { font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.summary-pill .currency { font-size: 0.75rem; color: var(--text-muted); }

/* Controls */
.header-controls {
    display: flex;
    gap: 10px;
}

.search-wrapper {
    position: relative;
}
.search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    color: var(--text-muted);
}
.search-input {
    padding: 8px 12px 8px 32px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-app);
    color: var(--text-main);
    font-size: 0.9rem;
    width: 160px;
    transition: all 0.2s;
}
.search-input:focus {
    width: 200px;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    outline: none;
}

.filter-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-app);
    color: var(--text-main);
    font-size: 0.9rem;
    cursor: pointer;
}

/* Table */
.table-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
}
.responsive-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 800px; /* Force scroll on desktop if too narrow */
}

th {
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    color: var(--text-sub);
    font-size: 0.8rem;
    text-transform: uppercase;
    font-weight: 600;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    z-index: 2;
    white-space: nowrap;
}
th.text-right { text-align: right; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--text-main); background: var(--border-color); }

td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-main);
    font-size: 0.95rem;
    vertical-align: middle;
}
.row-item { transition: background 0.15s; cursor: default; }
.row-item:hover { background: var(--bg-secondary); }
.row-item.highlighted { background: rgba(59, 130, 246, 0.1); animation: flash 1s; }

/* Columns */
.col-symbol { width: 140px; }
.symbol-box { display: flex; align-items: center; gap: 8px; }
.symbol-text { 
    font-weight: 700; 
    font-family: 'JetBrains Mono', monospace; 
    background: var(--bg-secondary);
    padding: 4px 8px;
    border-radius: 6px;
    color: var(--primary);
}
.symbol-badge { font-size: 0.75rem; padding: 2px 4px; border-radius: 4px; font-weight: 700; }
.symbol-badge.fire { background: #fee2e2; color: #ef4444; }
.symbol-badge.new { background: #dbeafe; color: #2563eb; }

/* Weight Bar */
.weight-bar-container { display: flex; align-items: center; gap: 8px; width: 100px; }
.weight-info { font-size: 0.8rem; width: 36px; text-align: right; font-family: monospace; }
.progress-track { flex: 1; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--primary); border-radius: 3px; }

/* Numbers */
.font-num { font-family: 'JetBrains Mono', monospace; }
.text-sub { color: var(--text-sub); font-size: 0.9rem; }
.font-bold { font-weight: 700; }
.text-green { color: var(--success); }
.text-red { color: var(--danger); }
.bg-green { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.bg-red { background: rgba(239, 68, 68, 0.15); color: var(--danger); }

/* ROI Pill */
.roi-pill {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.85rem;
    min-width: 60px;
    text-align: center;
}

/* Actions */
.btn-trade {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
}
.btn-trade:hover { border-color: var(--primary); color: var(--primary); transform: scale(1.1); }

/* Summary Row */
.summary-row td { background: var(--bg-secondary); font-weight: 700; border-top: 2px solid var(--border-color); }
.label-total { font-size: 0.9rem; color: var(--text-sub); text-transform: uppercase; }
.val-total { font-size: 1rem; }

/* Scroll Hint */
.scroll-hint {
    text-align: center;
    padding: 10px;
    font-size: 0.8rem;
    color: var(--text-sub);
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

/* Empty State */
.empty-state { text-align: center; padding: 40px; }
.empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }

/* Responsive Card View */
@media (max-width: 768px) {
    .card-header { flex-direction: column; align-items: stretch; padding: 16px; }
    .header-left { justify-content: space-between; margin-bottom: 12px; }
    .header-controls { flex-direction: column; }
    .search-input { width: 100%; }
    .filter-select { width: 100%; }
    
    .table-container { overflow: visible; }
    .responsive-table, thead, tbody, th, td, tr { display: block; min-width: 0; }
    
    thead { display: none; } /* Hide headers */
    
    tr.row-item {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        margin-bottom: 12px;
        padding: 12px;
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        box-shadow: var(--shadow-sm);
    }
    
    tr.row-item td {
        border: none;
        padding: 4px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }
    
    td::before {
        content: attr(data-label);
        font-size: 0.8rem;
        color: var(--text-sub);
        font-weight: 500;
        margin-right: 8px;
    }
    
    /* Mobile Layout Overrides */
    .col-symbol { 
        grid-column: 1 / -1; 
        border-bottom: 1px solid var(--border-color) !important;
        padding-bottom: 8px !important;
        margin-bottom: 4px;
    }
    .col-symbol::before { display: none; } /* Symbol header unnecessary */
    
    .col-action {
        position: absolute;
        top: 12px;
        right: 12px;
        width: auto;
        padding: 0 !important;
    }
    .col-action::before { display: none; }

    .mobile-hide { display: none !important; } /* Hide less critical columns on mobile */
    
    /* Summary Row Mobile */
    .summary-row { display: flex; flex-direction: column; gap: 8px; background: var(--bg-secondary); padding: 12px; border-radius: 8px; }
    .summary-row td { border: none; padding: 2px 0; display: flex; justify-content: space-between; background: transparent; }
}
</style>
