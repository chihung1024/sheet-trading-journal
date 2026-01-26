<template>
  <div class="card dividend-manager">
    <div class="header-section">
      <div class="header-title">
        <h3>配息管理</h3>
        <span class="pending-count" v-if="pendingDividends.length > 0">
          {{ pendingDividends.length }} 筆待確認
        </span>
      </div>
      
      <div class="header-actions" v-if="pendingDividends.length > 0">
        <button class="btn btn-secondary" @click="confirmAll" :disabled="isProcessing">
          <span v-if="isProcessing" class="spinner-sm"></span>
          <span v-else class="icon">✓</span>
          全部確認
        </button>
        <button class="btn btn-tertiary" @click="refreshData" :disabled="isProcessing">
          <span class="icon" :class="{ spinning: isProcessing }">↻</span>
          刷新
        </button>
      </div>
    </div>

    <div v-if="pendingDividends.length === 0" class="empty-state">
      <div class="empty-icon">🎉</div>
      <p class="empty-title">沒有待確認的配息</p>
      <p class="empty-desc">系統會自動偵測美股配息，當有新的配息入帳時會顯示於此。</p>
    </div>

    <div v-else class="dividend-list">
      <div 
        v-for="(div, index) in pendingDividends" 
        :key="`${div.symbol}_${div.ex_date}`"
        class="dividend-card"
        :class="{ editing: editingIndex === index }"
      >
        <div v-if="editingIndex !== index" class="dividend-display">
          <div class="dividend-header">
            <div class="dividend-symbol">
              <span class="symbol-text">{{ div.symbol }}</span>
              <span class="badge badge-pending">待確認</span>
            </div>
            <div class="dividend-amount">
              <span class="amount-twd">NT$ {{ formatNumber(div.total_net_twd, 0) }}</span>
              <span class="amount-usd">USD {{ formatNumber(div.total_net_usd, 2) }}</span>
            </div>
          </div>
          
          <div class="dividend-details">
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">除息日</span>
                    <span class="detail-value font-mono">{{ div.ex_date }}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">持股數</span>
                    <span class="detail-value font-mono">{{ formatNumber(div.shares_held, 2) }}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">每股配息</span>
                    <span class="detail-value font-mono">${{ formatNumber(div.dividend_per_share_gross, 4) }}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">稅前總額</span>
                    <span class="detail-value font-mono">${{ formatNumber(div.total_gross, 2) }}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">預扣稅 ({{ div.tax_rate }}%)</span>
                    <span class="detail-value font-mono text-red">-${{ formatNumber(div.total_gross * (div.tax_rate/100), 2) }}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">匯率</span>
                    <span class="detail-value font-mono">{{ formatNumber(div.fx_rate, 2) }}</span>
                </div>
            </div>
          </div>

          <div class="dividend-actions">
            <button class="btn-action btn-edit" @click="editDividend(index)" :disabled="isProcessing">
              <span class="icon">✎</span> 編輯
            </button>
            <button class="btn-action btn-confirm" @click="confirmDividend(index)" :disabled="isProcessing">
              <span class="icon">✓</span> 確認
            </button>
            </div>
        </div>

        <div v-else class="dividend-edit">
          <div class="edit-header">
            <h4>修正配息資訊 - {{ div.symbol }}</h4>
          </div>
          
          <div class="edit-form-grid">
            <div class="form-group">
              <label>發放日期 (Pay Date)</label>
              <input type="date" v-model="editForm.pay_date" class="form-input">
            </div>
            
            <div class="form-group">
              <label>預扣稅率 (%)</label>
              <input 
                type="number" 
                v-model.number="editForm.tax_rate" 
                step="0.1"
                class="form-input"
                @input="recalculateNet"
              >
            </div>
            
            <div class="form-group">
              <label>稅後實收 (USD)</label>
              <input 
                type="number" 
                v-model.number="editForm.total_net_usd" 
                step="0.01"
                class="form-input font-mono"
              >
              <span class="help-text">約 NT$ {{ formatNumber(editForm.total_net_usd * div.fx_rate, 0) }}</span>
            </div>
            
            <div class="form-group full-width">
              <label>備註</label>
              <textarea v-model="editForm.notes" rows="2" class="form-input" placeholder="選填"></textarea>
            </div>
          </div>

          <div class="edit-actions">
            <button class="btn-action btn-cancel" @click="cancelEdit">取消</button>
            <button class="btn-action btn-save" @click="saveEdit(index)" :disabled="isProcessing">
                <span v-if="isProcessing" class="spinner-sm"></span>
                儲存並確認
            </button>
          </div>
        </div>
      </div>
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

const editingIndex = ref(null);
const isProcessing = ref(false);

const editForm = ref({
  pay_date: '',
  tax_rate: 30.0,
  total_net_usd: 0,
  notes: ''
});

const pendingDividends = computed(() => store.pending_dividends || []);

const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const refreshData = async () => {
  if(isProcessing.value) return;
  isProcessing.value = true;
  try {
    await store.fetchAll();
    addToast('配息資料已更新', 'success');
  } catch (e) {
    addToast('更新失敗', 'error');
  } finally {
    setTimeout(() => { isProcessing.value = false; }, 500);
  }
};

const editDividend = (index) => {
  const div = pendingDividends.value[index];
  editingIndex.value = index;
  editForm.value = {
    pay_date: div.pay_date || div.ex_date,
    tax_rate: div.tax_rate,
    total_net_usd: div.total_net_usd,
    notes: div.notes || ''
  };
};

const cancelEdit = () => {
  editingIndex.value = null;
};

const recalculateNet = () => {
  const div = pendingDividends.value[editingIndex.value];
  if (!div) return;
  const taxRate = editForm.value.tax_rate / 100;
  editForm.value.total_net_usd = parseFloat((div.total_gross * (1 - taxRate)).toFixed(2));
};

const saveEdit = async (index) => {
  const div = pendingDividends.value[index];
  const updatedDiv = {
    ...div,
    ...editForm.value,
    total_net_twd: editForm.value.total_net_usd * div.fx_rate
  };
  await confirmDividendWithData(updatedDiv);
  cancelEdit();
};

const confirmDividend = async (index) => {
  const div = pendingDividends.value[index];
  await confirmDividendWithData(div);
};

const confirmDividendWithData = async (divData) => {
  isProcessing.value = true;
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        txn_date: divData.pay_date || divData.ex_date,
        symbol: divData.symbol,
        txn_type: 'DIV',
        qty: divData.shares_held,
        price: divData.total_net_usd / divData.shares_held, 
        commission: 0,
        tax: divData.total_gross * (divData.tax_rate / 100),
        tag: `配息-${divData.ex_date}`
      })
    });
    
    const json = await response.json();
    if (json.success) {
      addToast(`${divData.symbol} 配息已入帳`, 'success');
      await store.fetchAll(); // Refresh list to remove confirmed item
    } else {
      addToast(json.error || '確認失敗', 'error');
    }
  } catch (e) {
    console.error(e);
    addToast('連線錯誤', 'error');
  } finally {
    isProcessing.value = false;
  }
};

const confirmAll = async () => {
  if (!confirm(`確定要一次確認所有 ${pendingDividends.value.length} 筆配息嗎？`)) return;
  
  isProcessing.value = true;
  let successCount = 0;
  
  // 逐筆確認 (Sequential to prevent overwhelming backend)
  for (const div of pendingDividends.value) {
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                txn_date: div.pay_date || div.ex_date,
                symbol: div.symbol,
                txn_type: 'DIV',
                qty: div.shares_held,
                price: div.total_net_usd / div.shares_held,
                commission: 0,
                tax: div.total_gross * (div.tax_rate / 100),
                tag: `配息-${div.ex_date}`
            })
        });
        successCount++;
    } catch (e) { console.error(e); }
  }
  
  addToast(`已處理 ${successCount} 筆配息`, 'success');
  await store.fetchAll();
  isProcessing.value = false;
};

const ignoreDividend = () => {
  addToast('忽略功能暫未開放', 'info');
};
</script>

<style scoped>
.dividend-manager {
  padding: 24px;
}

/* Header */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-title h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  border-left: 4px solid var(--warning);
  padding-left: 12px;
  display: inline-block;
}

.pending-count {
  background: var(--warning);
  color: white;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 12px;
  vertical-align: middle;
}

.header-actions { display: flex; gap: 10px; }

.btn {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; font-size: 0.95rem;
}
.btn:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-secondary { background: var(--success); color: white; }
.btn-secondary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); }

.btn-tertiary { background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); }
.btn-tertiary:hover:not(:disabled) { background: var(--border-color); color: var(--text-main); }

/* List */
.dividend-list { display: grid; gap: 16px; }

.dividend-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.dividend-card:hover { border-color: var(--primary); box-shadow: var(--shadow-card); }
.dividend-card.editing { border-color: var(--warning); background: rgba(245, 158, 11, 0.05); }

/* Dividend Display */
.dividend-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }

.dividend-symbol { display: flex; align-items: center; gap: 10px; }
.symbol-text { font-size: 1.25rem; font-weight: 700; color: var(--text-main); }
.badge-pending { background: rgba(245, 158, 11, 0.15); color: var(--warning); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }

.dividend-amount { text-align: right; }
.amount-twd { display: block; font-size: 1.4rem; font-weight: 700; color: var(--success); font-family: 'JetBrains Mono'; }
.amount-usd { display: block; font-size: 0.9rem; color: var(--text-sub); font-family: 'JetBrains Mono'; margin-top: 2px; }

/* Details Grid */
.dividend-details { background: var(--bg-secondary); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px 24px; }

.detail-item { display: flex; flex-direction: column; gap: 2px; }
.detail-label { font-size: 0.8rem; color: var(--text-sub); text-transform: uppercase; }
.detail-value { font-size: 1rem; font-weight: 600; color: var(--text-main); }
.font-mono { font-family: 'JetBrains Mono'; }
.text-red { color: var(--danger); }

/* Actions */
.dividend-actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn-action { 
    padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); 
    background: var(--bg-card); cursor: pointer; font-weight: 600; font-size: 0.9rem;
    display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.btn-edit:hover { border-color: var(--primary); color: var(--primary); }
.btn-confirm { background: var(--success); color: white; border-color: var(--success); }
.btn-confirm:hover { filter: brightness(1.1); }

/* Edit Form */
.edit-header { margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }
.edit-header h4 { margin: 0; font-size: 1.1rem; color: var(--text-main); }

.edit-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.full-width { grid-column: span 2; }

.form-group label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; }
.form-input { 
    padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; 
    font-size: 0.95rem; background: var(--bg-card); color: var(--text-main); 
}
.form-input:focus { outline: none; border-color: var(--primary); }
.help-text { font-size: 0.8rem; color: var(--text-sub); margin-top: 4px; }

.edit-actions { display: flex; justify-content: flex-end; gap: 12px; }
.btn-save { background: var(--primary); color: white; border: none; }

/* Empty State */
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-sub); }
.empty-icon { font-size: 3.5rem; margin-bottom: 16px; opacity: 0.6; }
.empty-title { font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; }
.empty-desc { font-size: 0.95rem; max-width: 400px; margin: 0 auto; line-height: 1.5; }

/* Animations */
.spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Mobile */
@media (max-width: 640px) {
    .header-section { flex-direction: column; align-items: stretch; gap: 16px; }
    .header-actions { flex-direction: column; }
    .btn { justify-content: center; }
    
    .detail-grid { grid-template-columns: 1fr 1fr; }
    .dividend-amount { text-align: left; margin-top: 8px; }
    .dividend-header { flex-direction: column; }
    
    .dividend-actions { flex-direction: column; }
    .btn-action { justify-content: center; width: 100%; }
    
    .edit-form-grid { grid-template-columns: 1fr; }
    .full-width { grid-column: auto; }
}
</style>
