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
            <th class="text-right" width="140">實發總額 (USD)</th>
            <th class="text-right" width="120">稅金</th>
            <th class="text-right">淨額</th>
            <th class="text-right" width="140">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="div in localDividends" :key="div.id" class="div-row">
            <td class="date-cell">{{ formatDate(div.date) }}</td>
            <td><span class="symbol-badge">{{ div.symbol }}</span></td>
            
            <td class="text-right">
                <input 
                  type="number" 
                  v-model.number="div.amount" 
                  class="inline-input font-num" 
                  step="0.01"
                  placeholder="0.00"
                >
            </td>
            <td class="text-right">
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
                <label>總額 (USD)</label>
                <input 
                  type="number" 
                  v-model.number="div.amount" 
                  class="mobile-input font-num"
                  step="0.01"
                >
            </div>
            <div class="edit-row">
                <label>稅金 (USD)</label>
                <input 
                  type="number" 
                  v-model.number="div.tax" 
                  class="mobile-input font-num"
                  step="0.01"
                >
            </div>
            
            <div class="amount-row">
              <span class="label">淨額試算</span>
              <span class="value text-success font-num">
                ${{ formatNumber((div.amount || 0) - (div.tax || 0), 2) }}
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

// ✅ 核心修正：監聽 Store 數據並初始化本地編輯狀態
// 解決數據顯示為 0 的問題
watch(() => store.pending_dividends, (newVal) => {
    if (newVal && newVal.length > 0) {
        localDividends.value = newVal.map(d => {
            // 從 API 欄位 (total_gross, total_net_usd) 計算初始值
            const gross = Number(d.total_gross) || 0;
            const net = Number(d.total_net_usd) || 0;
            const calculatedTax = parseFloat((gross - net).toFixed(2));
            
            return {
                ...d,
                // 如果已經有編輯過的值則保留，否則使用 API 預設值
                amount: d.amount !== undefined ? d.amount : gross,
                tax: d.tax !== undefined ? d.tax : calculatedTax
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
  // 使用使用者編輯後的數值計算淨額
  const finalAmount = Number(div.amount) || 0;
  const finalTax = Number(div.tax) || 0;
  const netAmount = finalAmount - finalTax;
  
  if (!confirm(`確認將 ${div.symbol} 的配息 USD ${formatNumber(netAmount)} 入帳嗎？`)) return;
  
  processingId.value = div.id;
  try {
    const record = {
      txn_date: div.date,
      symbol: div.symbol,
      txn_type: 'DIV',
      qty: 0,
      price: 0,
      fee: 0,
      tax: finalTax,        // 使用編輯後的稅金
      total_amount: finalAmount, // 使用編輯後的總額
      tag: 'Auto-Dividend'
    };

    const success = await store.addRecord(record);
    if (success) {
      // 手動呼叫刪除 API 移除待辦事項
      await fetch(`${CONFIG.API_BASE_URL}/api/pending_dividends?id=${div.id}`, {
        method: 'DELETE',
        headers: { 
            'Authorization': `Bearer ${store.token || localStorage.getItem('token')}` 
        }
      }).catch(err => console.warn('刪除 pending 失敗 (可能是後端已自動處理)', err));

      addToast(`${div.symbol} 配息已入帳`, 'success');
      
      // 移除本地列表項目，避免等待 fetchAll 的延遲感
      localDividends.value = localDividends.value.filter(d => d.id !== div.id);
      
      // 背景刷新數據
      setTimeout(async () => {
          await store.fetchAll();
      }, 500);
    }
  } catch (e) {
    console.error(e);
    addToast('入帳失敗', 'error');
  } finally {
    processingId.value = null;
  }
};

const deleteDividend = async (id) => {
  if (!confirm('確定要忽略這筆配息嗎？(將從列表中移除)')) return;
  
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
        // 同步更新本地與 Store
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

.inline-input {
    width: 100%;
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
.inline-input:hover { border-bottom-color: var(--text-sub); }

.symbol-badge { font-weight: 700; color: var(--primary); background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; display: inline-block; }
.text-right { text-align: right; }
.font-num { font-family: 'JetBrains Mono', monospace; }
.font-bold { font-weight: 700; }
.text-sub { color: var(--text-sub); }
.text-success { color: var(--success); }

.actions-cell { display: flex; justify-content: flex-end; gap: 8px; }
.btn-confirm { background: var(--success); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-confirm:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-delete { background: transparent; border: 1px solid var(--border-color); color: var(--text-sub); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-delete:hover:not(:disabled) { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

/* Mobile View */
.mobile-view { display: none; }
.mobile-cards { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.div-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-date { font-size: 0.9rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }

.card-main { margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }

.edit-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.edit-row label { font-size: 0.9rem; color: var(--text-sub); min-width: 80px; }
.mobile-input { 
    flex: 1; 
    padding: 10px; 
    border: 1px solid var(--border-color); 
    border-radius: 6px; 
    text-align: right; 
    font-size: 1rem; 
    background: var(--bg-card);
    color: var(--text-main);
}
.mobile-input:focus { outline: none; border-color: var(--primary); }

.amount-row { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px dashed var(--border-color); margin-top: 4px; }
.amount-row .label { font-size: 0.95rem; font-weight: 600; color: var(--text-main); }
.amount-row .value { font-size: 1.4rem; font-weight: 700; }

.card-actions { display: flex; gap: 12px; }
.btn-card-delete { flex: 1; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-sub); border-radius: 8px; font-weight: 600; cursor: pointer; }
.btn-card-confirm { flex: 2; padding: 12px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2); }

@media (max-width: 768px) {
  .desktop-view { display: none; }
  .mobile-view { display: block; }
  .card-header { padding: 12px 16px; }
}
</style>
