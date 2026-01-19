<template>
  <div class="card no-padding-mobile"> <div class="card-header">
      <div class="header-left">
        <h3>歷史交易紀錄</h3>
        <span class="count-badge">共 {{ filteredRecords.length }} 筆</span>
      </div>
      
      <div class="header-right">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜尋代碼或標籤..."
            class="search-input"
          >
        </div>
      </div>
    </div>

    <div class="mobile-record-list tablet-hidden">
      <div v-if="filteredRecords.length === 0" class="empty-state">
        無交易紀錄數據
      </div>
      <div 
        v-for="r in filteredRecords" 
        :key="r.id" 
        class="record-card"
        @click="$emit('edit', r)"
      >
        <div class="card-top">
          <div class="symbol-info">
            <span class="symbol-tag">{{ r.symbol }}</span>
            <span class="txn-date">{{ formatDate(r.txn_date) }}</span>
          </div>
          <div class="txn-type-badge" :class="r.txn_type.toLowerCase()">
            {{ r.txn_type === 'BUY' ? '買進' : r.txn_type === 'SELL' ? '賣出' : '股息' }}
          </div>
        </div>
        
        <div class="card-body">
          <div class="main-info">
            <div class="info-item">
              <span class="info-label">成交價</span>
              <span class="info-val font-num">${{ formatNumber(r.price, 2) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">股數</span>
              <span class="info-val font-num">{{ formatNumber(r.qty, 2) }}</span>
            </div>
            <div class="info-item highlight">
              <span class="info-label">總金額</span>
              <span class="info-val font-num">${{ formatNumber(r.qty * r.price, 0) }}</span>
            </div>
          </div>
          
          <div class="sub-info">
            <span v-if="r.fee > 0">手續費: ${{ r.fee }}</span>
            <span v-if="r.tax > 0">稅金: ${{ r.tax }}</span>
            <span v-if="r.tag" class="tag-text">#{{ r.tag }}</span>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn-card-edit">編輯詳情</button>
          <button class="btn-card-delete" @click.stop="handleDelete(r.id)">刪除</button>
        </div>
      </div>
    </div>

    <div class="table-container mobile-hidden">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>代碼</th>
            <th>類型</th>
            <th class="text-right">股數</th>
            <th class="text-right">單價(USD)</th>
            <th class="text-right">費用</th>
            <th>標籤/備註</th>
            <th class="text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredRecords.length === 0">
            <td colspan="8" class="empty-state">目前無交易紀錄</td>
          </tr>
          <tr v-for="r in filteredRecords" :key="r.id" class="record-row">
            <td class="font-num text-sm">{{ r.txn_date }}</td>
            <td><span class="symbol-pill">{{ r.symbol }}</span></td>
            <td>
              <span class="type-tag" :class="r.txn_type.toLowerCase()">
                {{ r.txn_type }}
              </span>
            </td>
            <td class="text-right font-num">{{ formatNumber(r.qty, 2) }}</td>
            <td class="text-right font-num">{{ formatNumber(r.price, 4) }}</td>
            <td class="text-right font-num text-xs text-sub">
              ${{ (Number(r.fee||0) + Number(r.tax||0)).toFixed(2) }}
            </td>
            <td class="text-sm">
              <div class="tag-container">
                <span v-if="r.tag" class="tag-chip">{{ r.tag }}</span>
                <span v-if="r.note" class="note-text" :title="r.note">{{ r.note }}</span>
              </div>
            </td>
            <td class="text-center">
              <div class="action-btns">
                <button class="btn-icon edit" @click="$emit('edit', r)" title="編輯">✎</button>
                <button class="btn-icon delete" @click="handleDelete(r.id)" title="刪除">🗑</button>
              </div>
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

const store = usePortfolioStore();
const { addToast } = useToast();
const searchQuery = ref('');

const filteredRecords = computed(() => {
  if (!searchQuery.value) return store.records;
  const q = searchQuery.value.toLowerCase();
  return store.records.filter(r => 
    r.symbol.toLowerCase().includes(q) || 
    (r.tag && r.tag.toLowerCase().includes(q))
  );
});

const handleDelete = async (id) => {
  if (!confirm("確定要刪除此筆交易紀錄嗎？這會影響損益計算。")) return;
  const success = await store.deleteRecord(id);
  if (success) {
    addToast("紀錄已刪除", "success");
  }
};

const formatNumber = (num, d = 0) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// MODIFIED: 增加日期簡化函數
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.count-badge { font-size: 0.8rem; background: var(--bg-secondary); color: var(--text-sub); padding: 2px 8px; border-radius: 99px; font-weight: 600; }

.search-box { position: relative; min-width: 240px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; background: var(--bg-secondary); color: var(--text-main); }

/* MODIFIED: 行動端卡片佈局樣式 */
.mobile-record-list { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.record-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; box-shadow: var(--shadow-sm); transition: transform 0.1s; }
.record-card:active { transform: scale(0.98); background: var(--bg-secondary); }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.symbol-tag { font-weight: 800; font-size: 1.1rem; color: var(--primary); font-family: 'JetBrains Mono', monospace; margin-right: 8px; }
.txn-date { font-size: 0.85rem; color: var(--text-sub); }

.txn-type-badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
.txn-type-badge.buy { background: rgba(59, 130, 246, 0.15); color: var(--primary); }
.txn-type-badge.sell { background: rgba(16, 185, 129, 0.15); color: var(--success); }
.txn-type-badge.div { background: rgba(245, 158, 11, 0.15); color: var(--warning); }

.main-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.info-item { display: flex; flex-direction: column; }
.info-label { font-size: 0.7rem; color: var(--text-sub); margin-bottom: 2px; }
.info-val { font-size: 0.95rem; font-weight: 700; color: var(--text-main); }
.info-item.highlight .info-val { color: var(--text-main); }

.sub-info { font-size: 0.75rem; color: var(--text-sub); display: flex; gap: 12px; border-top: 1px dashed var(--border-color); padding-top: 8px; flex-wrap: wrap; }
.tag-text { color: var(--primary); font-weight: 600; }

.card-actions { display: flex; gap: 8px; margin-top: 12px; }
.btn-card-edit, .btn-card-delete { flex: 1; padding: 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer; }
.btn-card-edit { background: var(--bg-secondary); color: var(--text-main); }
.btn-card-delete { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

/* 桌機版表格樣式 */
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px 16px; font-size: 0.8rem; color: var(--text-sub); background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); }
td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); }
.record-row:hover td { background: var(--bg-secondary); }

.symbol-pill { font-weight: 700; color: var(--primary); font-family: 'JetBrains Mono', monospace; }
.type-tag { font-size: 0.75rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.type-tag.buy { color: var(--primary); border: 1px solid var(--primary); }
.type-tag.sell { color: var(--success); border: 1px solid var(--success); }
.type-tag.div { color: var(--warning); border: 1px solid var(--warning); }

.tag-chip { font-size: 0.75rem; background: var(--bg-secondary); color: var(--text-sub); padding: 2px 6px; border-radius: 4px; }
.note-text { font-size: 0.75rem; color: var(--text-sub); margin-left: 6px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: middle; }

.action-btns { display: flex; gap: 6px; justify-content: center; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 4px; border-radius: 4px; transition: all 0.2s; }
.btn-icon:hover { background: var(--bg-secondary); }
.btn-icon.delete:hover { color: var(--danger); }

.font-num { font-family: 'JetBrains Mono', monospace; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-sub { color: var(--text-sub); }
.text-sm { font-size: 0.85rem; }
.text-xs { font-size: 0.75rem; }

.empty-state { text-align: center; padding: 40px; color: var(--text-sub); font-size: 0.95rem; }

/* MODIFIED: 響應式中斷點 */
@media (max-width: 767px) {
  .mobile-hidden { display: none !important; }
  .no-padding-mobile { padding: 12px 4px !important; border: none; background: transparent; box-shadow: none; }
  .card-header { padding: 0 8px 12px 8px; }
  .search-box { min-width: 0; flex: 1; }
}

@media (min-width: 768px) {
  .tablet-hidden { display: none !important; }
}
</style>
