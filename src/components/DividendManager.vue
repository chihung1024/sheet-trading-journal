<template>
  <div class="card dividend-manager">
    <div class="card-header">
      <div class="header-content">
        <h3>待確認配息</h3>
        <span class="badge-count" v-if="localDividends.length > 0">{{ localDividends.length }} 筆</span>
      </div>
      <div class="header-actions">
        <button class="btn-refresh" @click="fetchDividends" :disabled="loading" title="重新檢查配息">
          <span :class="{ 'spinning': loading }">↻</span>
        </button>
      </div>
    </div>

    <div class="table-container desktop-view">
      <table v-if="localDividends.length > 0">
        <thead>
          <tr>
            <th>日期</th>
            <th>代碼</th>
            <th class="text-right" width="160">實發總額</th>
            <th class="text-right" width="140">稅金</th>
            <th class="text-right">淨額</th>
            <th class="text-right" width="140">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="div in localDividends" :key="div.id" class="div-row">
            <td class="date-cell">{{ formatDate(div.date) }}</td>
            <td><span class="symbol-badge">{{ div.symbol }}</span></td>
            
            <td class="text-right input-cell">
                <span class="currency-prefix">{{ getCurrency(div.symbol) }}</span>
                <input 
                  type="number" 
                  v-model.number="div.amount" 
                  class="inline-input font-num" 
                  step="0.01"
                  placeholder="0.00"
                >
            </td>
            <td class="text-right input-cell">
                <input 
                  type="number" 
                  v-model.number="div.tax" 
                  class="inline-input font-num text-sub" 
                  step="0.01"
                  placeholder="0.00"
                >
            </td>
            
            <td class="text-right font-num font-bold text-success">
                {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
            </td>
            <td class="actions-cell">
              <button class="btn-confirm" @click="confirmDividend(div)" :disabled="processingId === div.id">
                {{ processingId === div.id ? '...' : '確認' }}
              </button>
              <button class="btn-delete" @click="deleteDividend(div.id)" :disabled="processingId === div.id">
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>目前沒有待確認的配息紀錄</p>
      </div>
    </div>

    <div class="mobile-view">
      <div v-if="localDividends.length === 0" class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>目前沒有待確認的配息</p>
      </div>

      <div v-else class="mobile-cards">
        <div v-for="div in localDividends" :key="'mob_'+div.id" class="div-card">
          <div class="card-top">
            <div class="card-date">{{ formatDate(div.date) }}</div>
            <div class="symbol-badge">{{ div.symbol }}</div>
          </div>
          
          <div class="card-main">
            <div class="edit-row">
                <label>總額 ({{ getCurrency(div.symbol) }})</label>
                <input 
                  type="number" 
                  v-model.number="div.amount" 
                  class="mobile-input font-num"
                  step="0.01"
                  placeholder="輸入總額"
                >
            </div>
            <div class="edit-row">
                <label>稅金 ({{ getCurrency(div.symbol) }})</label>
                <input 
                  type="number" 
                  v-model.number="div.tax" 
                  class="mobile-input font-num"
                  step="0.01"
                  placeholder="輸入稅金"
                >
            </div>
            
            <div class="amount-row">
              <span class="label">淨額試算</span>
              <span class="value text-success font-num">
                <small class="currency-tag">{{ getCurrency(div.symbol) }}</small> 
                {{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
              </span>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-card-delete" @click="deleteDividend(div.id)" :disabled="processingId === div.id">
              刪除
            </button>
            <button class="btn-card-confirm" @click="confirmDividend(div)" :disabled="processingId === div.id">
              {{ processingId === div.id ? '處理中...' : '確認入帳' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const { addToast } = useToast();

const loading = ref(false);
const processingId = ref(null);
const localDividends = ref([]);

// 判斷是否為台股 (支援 .TW 與 .TWO)
const isTWStock = (symbol) => {
    // 1. 4碼數字開頭 (如 2330, 8069)
    // 2. 結尾是 .TW (上市)
    // 3. 結尾是 .TWO (上櫃)
    return /^\d{4}/.test(symbol) || /\.TW(O)?$/i.test(symbol);
};

// 取得幣別顯示
const getCurrency = (symbol) => {
    return isTWStock(symbol) ? 'TWD' : 'USD';
};

// 監聽並初始化
watch(() => store.pending_dividends, (newVal) => {
    if (newVal && newVal.length > 0) {
        localDividends.value = newVal.map(d => {
            const gross = Number(d.total_gross) || 0;
            const net = Number(d.total_net_usd) || 0; // API 欄位名稱可能是 net_usd 但內容為當地幣別
            const currency = getCurrency(d.symbol);
            
            // 稅金計算邏輯：
            // 台股 (TWD) -> 預設 0 (除非已編輯過)
            // 美股 (USD) -> 預設 總額 - 淨額 (即預扣稅)
            let defaultTax = 0;
            if (currency === 'USD') {
                defaultTax = parseFloat((gross - net).toFixed(2));
                // 防止計算誤差出現負數
                if (defaultTax < 0) defaultTax = 0;
            }

            return {
                ...d,
                amount: d.amount !== undefined ? d.amount : gross,
                tax: d.tax !== undefined ? d.tax : defaultTax
            };
        });
    } else {
        localDividends.value = [];
    }
}, { immediate: true, deep: true });

const fetchDividends = async () => {
  loading.value = true;
  try {
    await store.fetchAll(); 
    addToast('已刷新配息資訊', 'success');
  } catch (e) {
    addToast('刷新失敗', 'error');
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
};

const formatNumber = (val, d=2) => {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const confirmDividend = async (div) => {
  const finalAmount = Number(div.amount) || 0;
  const finalTax = Number(div.tax) || 0;
  const netAmount = finalAmount - finalTax;
  const currency = getCurrency(div.symbol);
  
  if (!confirm(`確認將 ${div.symbol} 的配息 ${currency} ${formatNumber(netAmount)} 入帳嗎？`)) return;
  
  processingId.value = div.id;
  try {
    const record = {
      txn_date: div.date,
      symbol: div.symbol,
      txn_type: 'DIV',
      qty: 0,
      price: 0,
      fee: 0,
      tax: finalTax,
      total_amount: finalAmount,
      tag: 'Auto-Dividend'
    };

    const success = await store.addRecord(record);
    if (success) {
      await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${div.id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${store.token || localStorage.getItem('token')}` 
        }
      }).catch(err => console.warn('刪除 pending 失敗', err));

      addToast(`${div.symbol} 配息已入帳`, 'success');
      localDividends.value = localDividends.value.filter(d => d.id !== div.id);
      setTimeout(async () => { await store.fetchAll(); }, 500);
    }
  } catch (e) {
    console.error(e);
    addToast('入帳失敗', 'error');
  } finally {
    processingId.value = null;
  }
};

const deleteDividend = async (id) => {
  if (!confirm('確定要忽略這筆配息嗎？')) return;
  processingId.value = id;
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${store.token || localStorage.getItem('token')}` 
        }
    });
    if (res.ok) {
        addToast('已移除', 'info');
        localDividends.value = localDividends.value.filter(d => d.id !== id);
        if (store.rawData && store.rawData.pending_dividends) {
            store.rawData.pending_dividends = store.rawData.pending_dividends.filter(d => d.id !== id);
        }
    } else {
        throw new Error('API delete failed');
    }
  } catch (e) {
    addToast('移除失敗', 'error');
  } finally {
    processingId.value = null;
  }
};
</script>

<style scoped>
.dividend-manager {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  margin-bottom: 24px;
  border-left: 4px solid var(--warning);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent);
}

.header-content { display: flex; align-items: center; gap: 12px; }
h3 { margin: 0; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
h3::before { content: '💰'; font-size: 1.2rem; }
.badge-count { background: var(--warning); color: white; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }

.btn-refresh {
  background: transparent; border: 1px solid var(--border-color); width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-sub); transition: all 0.2s;
}
.btn-refresh:hover:not(:disabled) { background: var(--bg-secondary); color: var(--primary); border-color: var(--primary); }
.spinning { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from {transform: rotate(0deg);} to {transform: rotate(360deg);} }

/* 桌面版表格樣式 */
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 12px 20px; font-size: 0.85rem; color: var(--text-sub); font-weight: 600; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
td { padding: 12px 20px; border-bottom: 1px solid var(--border-color); font-size: 0.95rem; color: var(--text-main); vertical-align: middle; }
tr:last-child td { border-bottom: none; }

.input-cell { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.currency-prefix { font-size: 0.75rem; color: var(--text-sub); font-weight: 500; }

.inline-input {
    width: 100px;
    padding: 6px;
    border: 1px solid transparent;
    border-bottom: 1px dashed var(--border-color);
    background: transparent;
    text-align: right;
    font-size: 0.95rem;
    color: var(--text-main);
    transition: all 0.2s;
    font-family: 'JetBrains Mono', monospace;
}
.inline-input:focus { outline: none; border-bottom-color: var(--primary); background: var(--bg-secondary); }

.symbol-badge { font-weight: 700; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; display: inline-block; }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-sub { color: var(--text-sub); }
.text-success { color: var(--success); }

.actions-cell { display: flex; justify-content: flex-end; gap: 8px; }
.btn-confirm { background: var(--success); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-delete { background: transparent; border: 1px solid var(--border-color); color: var(--text-sub); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
button:disabled { opacity: 0.6; cursor: not-allowed; }

/* Mobile View */
.mobile-view { display: none; }
.mobile-cards { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.div-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-date { font-size: 0.9rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }

.card-main { margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }

/* 垂直堆疊輸入框 */
.edit-row { display: flex; flex-direction: column; gap: 6px; }
.edit-row label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; }

.mobile-input { 
    width: 100%; 
    padding: 10px; 
    border: 1px solid var(--border-color); 
    border-radius: 6px; 
    text-align: right; 
    font-size: 1rem; 
    background: var(--bg-card);
    color: var(--text-main);
    box-sizing: border-box;
}

.amount-row { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px dashed var(--border-color); margin-top: 4px; }
.amount-row .label { font-size: 0.95rem; font-weight: 600; color: var(--text-main); }
.amount-row .value { font-size: 1.4rem; font-weight: 700; display: flex; align-items: baseline; gap: 6px; }
.currency-tag { font-size: 0.85rem; color: var(--text-sub); font-weight: 500; }

.card-actions { display: flex; gap: 12px; }
.btn-card-delete { flex: 1; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-sub); border-radius: 8px; font-weight: 600; cursor: pointer; }
.btn-card-confirm { flex: 2; padding: 12px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2); }

@media (max-width: 768px) {
  .desktop-view { display: none; }
  .mobile-view { display: block; }
  .card-header { padding: 12px 16px; }
}
</style>
