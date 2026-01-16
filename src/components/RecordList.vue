<template>
  <div class="card record-list">
    <div class="card-header">
      <h3>交易紀錄 ({{ filteredRecords.length }})</h3>
      
      <div class="filters">
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜尋代碼或備註..." 
            class="input-search"
          >
        </div>
        
        <select v-model="filterType" class="select-filter">
          <option value="ALL">所有類型</option>
          <option value="BUY">買入 (BUY)</option>
          <option value="SELL">賣出 (SELL)</option>
          <option value="DIV">股息 (DIV)</option>
        </select>

        <select v-model="filterYear" class="select-filter">
          <option value="ALL">所有年份</option>
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="store.loading" class="skeleton-wrapper">
      <TableSkeleton :rows="5" />
    </div>

    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>代碼</th>
            <th>類型</th>
            <th class="text-right">股數</th>
            <th class="text-right">價格</th>
            <th class="text-right">總額</th>
            <th>策略群組 (Tags)</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredRecords.length === 0">
            <td colspan="8" class="text-center empty-state">
              沒有符合條件的交易紀錄
            </td>
          </tr>
          
          <tr v-for="record in filteredRecords" :key="record.id" class="record-row">
            <td class="col-date">{{ formatDate(record.txn_date) }}</td>
            <td class="col-symbol">{{ record.symbol }}</td>
            <td>
              <span class="badge" :class="getTypeClass(record.txn_type)">
                {{ record.txn_type }}
              </span>
            </td>
            <td class="text-right">{{ formatNumber(record.qty) }}</td>
            <td class="text-right">{{ formatPrice(record.price) }}</td>
            <td class="text-right font-mono">{{ formatCurrency(calculateTotal(record)) }}</td>
            
            <td class="col-tags">
              <div class="tags-wrapper">
                <span 
                    v-for="tag in parseTags(record.tag)" 
                    :key="tag" 
                    class="tag-badge"
                    :class="{ 'active-group': tag === store.currentGroup }"
                >
                  {{ tag }}
                </span>
              </div>
            </td>
            
            <td class="text-center col-actions">
              <button 
                class="btn-icon edit" 
                @click="handleEdit(record)" 
                title="編輯"
              >
                ✎
              </button>
              <button 
                class="btn-icon delete" 
                @click="handleDelete(record.id)" 
                title="刪除"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import TableSkeleton from './skeletons/TableSkeleton.vue';

// 尋找父層的 TradeForm (透過 DOM ID 查找並觸發 setupForm，或依賴父層 App.vue 處理)
// 為了確保獨立運作，這裡我們嘗試尋找 TradeForm 元件並呼叫它的方法
// 註：更標準的做法是 emit event，由 App.vue 處理，但為了確保代碼在不修改 App.vue 的情況下也能運作，這裡採用直接呼叫 (如果結構允許)
// 或者，我們發送一個 Custom Event，讓 TradeForm 監聽。
// 但依照此專案架構，我們發送 emit 'edit' 給父層是最標準的。
const emit = defineEmits(['edit']);

const store = usePortfolioStore();
const { addToast } = useToast();

const searchQuery = ref('');
const filterType = ref('ALL');
const filterYear = ref('ALL');

// --- Helper Functions ---

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0]; // YYYY-MM-DD
};

const formatNumber = (val) => {
    if (!val) return '0';
    return parseFloat(val).toLocaleString('en-US', { maximumFractionDigits: 4 });
};

const formatPrice = (val) => {
    if (!val) return '0';
    return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const calculateTotal = (r) => {
    const amt = r.qty * r.price;
    // 買入加費用，賣出減費用 (此處僅計算淨流動，或依顯示需求調整)
    // 這裡顯示該筆交易的"發生金額"
    if (r.txn_type === 'BUY') return amt + (r.commission || 0) + (r.tax || 0);
    if (r.txn_type === 'SELL') return amt - (r.commission || 0) - (r.tax || 0);
    return amt; // DIV
};

const getTypeClass = (type) => {
    switch (type) {
        case 'BUY': return 'badge-buy';
        case 'SELL': return 'badge-sell';
        case 'DIV': return 'badge-div';
        default: return 'badge-neutral';
    }
};

const parseTags = (tagStr) => {
    if (!tagStr) return [];
    return tagStr.split(/[,;]/).map(t => t.trim()).filter(t => t);
};

// --- Filters & Computed ---

const availableYears = computed(() => {
    const years = new Set(store.records.map(r => r.txn_date.substring(0, 4)));
    return Array.from(years).sort().reverse();
});

const filteredRecords = computed(() => {
    let result = [...store.records];

    // 1. Group Filter (矩陣式記帳核心)
    // 如果當前選中的不是 'all'，則只顯示包含該 Tag 的紀錄
    if (store.currentGroup !== 'all') {
        result = result.filter(r => {
            const tags = parseTags(r.tag);
            return tags.includes(store.currentGroup);
        });
    }

    // 2. Type Filter
    if (filterType.value !== 'ALL') {
        result = result.filter(r => r.txn_type === filterType.value);
    }

    // 3. Year Filter
    if (filterYear.value !== 'ALL') {
        result = result.filter(r => r.txn_date.startsWith(filterYear.value));
    }

    // 4. Search Filter
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(r => 
            r.symbol.toLowerCase().includes(q) || 
            (r.tag && r.tag.toLowerCase().includes(q))
        );
    }

    // Sort by Date DESC
    return result.sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

// --- Actions ---

const handleEdit = (record) => {
    // 嘗試尋找 TradeForm 的元件實例 (透過 Vue Ref 或 DOM)
    // 由於 App.vue 結構中 TradeForm 與 RecordList 是兄弟元件，
    // 最好的方式是我們 Emit 事件，並假設父層會處理，
    // 同時為了增強體驗，我們可以嘗試直接滾動到表單位置
    
    // 1. 觸發捲動
    const formEl = document.getElementById('trade-form-anchor');
    if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth' });
    }

    // 2. 由於我們在 TradeForm 實作了 defineExpose({ setupForm })
    // 但兄弟元件無法直接呼叫。
    // 在此架構下，我們透過尋找父層組件的上下文或使用 DOM event dispatch 作為 workaround，
    // 但最正確的方式是 App.vue 監聽 @edit。
    // 為了讓代碼完整，我們這裡發送標準 Emit。
    // 使用者需確保 App.vue 中的 <RecordList @edit="(r) => tradeFormRef.setupForm(r)" /> 
    // 或者我們使用一個更簡單的方法：直接修改 store 的 editingRecord (如果我們有加的話)，
    // 但既然我們沒有加 store state，這裡我們使用一個全域事件 (CustomEvent) 讓 TradeForm 監聽 (Self-contained fix)
    
    // 方法：派發一個自定義 DOM 事件，TradeForm 可以監聽 window 或 document
    // 不過 TradeForm 並沒有寫監聽器。
    
    // 回歸正規：這裡 Emit，父層負責接。
    // 如果父層沒接，我們嘗試存取 DOM 上的 Vue 實例 (Vue 3 較難)。
    // **解決方案**：我們在 App.vue 已經引入了 TradeForm，
    // 在此專案升級脈絡中，我們假設使用者會將事件接上。
    
    // 這裡我們做一個 fallback，透過 DOM 操作找到 TradeForm 旁邊的按鈕觸發? 不，太髒。
    
    // 最終決定：Emit 'edit'。
    emit('edit', record);
    
    // ⚠️ 關鍵補充：
    // 由於我們無法修改已提供的 App.vue 程式碼 (Step 4 已過)，
    // 為了讓這個「編輯」按鈕在沒有修改 App.vue 的情況下也能運作，
    // 我們可以使用一個簡單的 Bus 模式，或者直接呼叫 TradeForm 的 setupForm 方法 (如果能取得 Ref)。
    // 
    // 這裡我們假設專案中會有一個機制連結兩者。
    // 對於這個檔案本身，Emit 是正確的。
    
    // (進階 Hack: 如果 TradeForm 在頁面上，我們可以嘗試存取其 exposing property，但 Vue 3 `script setup` 封閉性高)
    // 所以我們依賴 App.vue 的 template 寫法: <RecordList @edit="r => $refs.tradeFormRef.setupForm(r)" />
};

const handleDelete = async (id) => {
    if (!confirm('確定要刪除這筆交易紀錄嗎？此操作無法復原。')) return;

    try {
        await store.deleteRecord(id);
        addToast('刪除成功', 'success');
        store.triggerUpdate(); // 觸發重算
    } catch (e) {
        addToast('刪除失敗: ' + e.message, 'error');
    }
};
</script>

<style scoped>
.record-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px;
}

.card-header h3 { margin: 0; font-size: 1.1rem; }

.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.input-search, .select-filter {
  padding: 6px 10px; border: 1px solid var(--border-color);
  border-radius: 6px; background: var(--bg-main); color: var(--text-main);
  font-size: 0.9rem;
}
.input-search { width: 180px; }

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%; border-collapse: collapse; font-size: 0.9rem;
}

.data-table th, .data-table td {
  padding: 12px 16px; text-align: left;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-main);
}
.data-table th {
  background: var(--bg-main); color: var(--text-sub); font-weight: 600; font-size: 0.85rem;
  white-space: nowrap;
}

.text-right { text-align: right; }
.text-center { text-align: center; }
.font-mono { font-family: 'SF Mono', 'Roboto Mono', monospace; }

.col-date { white-space: nowrap; color: var(--text-sub); font-size: 0.85rem; }
.col-symbol { font-weight: 700; color: var(--text-main); }

/* Badges */
.badge { padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
.badge-buy { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-sell { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.badge-div { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.badge-neutral { background: var(--bg-main); color: var(--text-sub); }

/* Tag Badges */
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-badge {
    background: var(--bg-main); border: 1px solid var(--border-color);
    padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; color: var(--text-sub);
    white-space: nowrap;
}
.tag-badge.active-group {
    background: rgba(37, 99, 235, 0.1); color: var(--primary); border-color: var(--primary);
    font-weight: 600;
}

/* Actions */
.btn-icon {
  background: none; border: none; cursor: pointer; padding: 6px;
  font-size: 1.1rem; opacity: 0.6; transition: opacity 0.2s;
}
.btn-icon:hover { opacity: 1; }
.btn-icon.edit:hover { color: var(--primary); }
.btn-icon.delete:hover { color: var(--danger); }

.empty-state { padding: 40px; color: var(--text-sub); font-style: italic; }

.skeleton-wrapper { padding: 20px; }
</style>
