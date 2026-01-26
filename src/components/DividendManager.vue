<template>
  <div class="card dividend-manager">
    <div class="card-header">
      <div class="header-left">
        <h3 class="card-title">
          <span class="icon">💰</span> 配息管理
        </h3>
        <span class="badge-count" v-if="pendingDividends.length > 0">
          {{ pendingDividends.length }} 筆待確認
        </span>
      </div>
      
      <div class="header-actions" v-if="pendingDividends.length > 0">
        <button class="btn btn-action" @click="refreshData" :disabled="isLoading" title="重新檢查">
          <span class="icon" :class="{ spinning: isLoading }">⟳</span>
        </button>
        <button class="btn btn-primary" @click="confirmAll">
          <span class="icon">✓</span> 全部確認
        </button>
      </div>
    </div>

    <div v-if="pendingDividends.length === 0" class="empty-state">
      <div class="empty-content">
        <span class="empty-icon">🎉</span>
        <h4>目前沒有待確認的配息</h4>
        <p>系統會自動追蹤持倉的除息日與預估配息，當有新資料時會顯示於此。</p>
      </div>
    </div>

    <transition-group name="list" tag="div" class="dividend-list" v-else>
      <div 
        v-for="(div, index) in pendingDividends" 
        :key="`${div.symbol}_${div.ex_date}`"
        class="div-card"
        :class="{ 'is-editing': editingIndex === index }"
      >
        <div v-if="editingIndex !== index" class="card-content">
          <div class="div-main-info">
            <div class="symbol-group">
              <span class="symbol">{{ div.symbol }}</span>
              <span class="date-tag">{{ formatDate(div.ex_date) }} 除息</span>
            </div>
            <div class="amount-group">
              <span class="amount-twd">NT${{ formatNumber(div.total_net_twd, 0) }}</span>
              <span class="amount-usd">(${{ formatNumber(div.total_net_usd, 2) }})</span>
            </div>
          </div>
          
          <div class="div-details-grid">
            <div class="detail-item">
              <label>持股</label>
              <span>{{ formatNumber(div.shares_held, 2) }} 股</span>
            </div>
            <div class="detail-item">
              <label>每股(稅前)</label>
              <span>${{ formatNumber(div.dividend_per_share_gross, 4) }}</span>
            </div>
            <div class="detail-item">
              <label>預扣稅率</label>
              <span>{{ div.tax_rate }}%</span>
            </div>
            <div class="detail-item mobile-hide">
              <label>參考匯率</label>
              <span>{{ formatNumber(div.fx_rate, 2) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-text edit" @click="editDividend(index)">
              ✏️ 編輯 / 修正
            </button>
            <div class="right-actions">
              <button class="btn-sm confirm" @click="confirmDividend(index)">
                確認入帳
              </button>
            </div>
          </div>
        </div>

        <div v-else class="card-edit-form">
          <div class="form-header">
            <h4>修正配息資訊 - {{ div.symbol }}</h4>
          </div>
          
          <div class="form-body">
            <div class="form-row">
              <div class="form-group">
                <label>實際發放日</label>
                <input type="date" v-model="editForm.pay_date" class="input-control">
              </div>
              <div class="form-group">
                <label>稅率 (%)</label>
                <input 
                  type="number" 
                  v-model.number="editForm.tax_rate" 
                  @input="recalculateNet"
                  class="input-control"
                  step="1"
                >
              </div>
            </div>
            
            <div class="form-group highlight">
              <label>實際入帳金額 (USD)</label>
              <input 
                type="number" 
                v-model.number="editForm.total_net_usd" 
                class="input-control bold"
                step="0.01"
              >
              <span class="hint">約合台幣 NT$ {{ formatNumber(editForm.total_net_usd * div.fx_rate, 0) }}</span>
            </div>
            
            <div class="form-group">
              <label>備註</label>
              <input type="text" v-model="editForm.notes" class="input-control" placeholder="選填...">
            </div>
          </div>

          <div class="form-footer">
            <button class="btn-text cancel" @click="cancelEdit">取消</button>
            <button class="btn-sm save" @click="saveEdit(index)">儲存並確認</button>
          </div>
        </div>
      </div>
    </transition-group>
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

const isLoading = ref(false);
const editingIndex = ref(null);
const editForm = ref({
  pay_date: '',
  tax_rate: 30.0,
  total_net_usd: 0,
  notes: ''
});

const pendingDividends = computed(() => store.pending_dividends || []);

// Formatters
const formatNumber = (num, d=2) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// Actions
const refreshData = async () => {
  isLoading.value = true;
  try {
    await store.fetchAll();
    addToast('配息資料已更新', 'success');
  } catch (e) {
    addToast('更新失敗', 'error');
  } finally {
    setTimeout(() => isLoading.value = false, 500);
  }
};

const editDividend = (index) => {
  const div = pendingDividends.value[index];
  editingIndex.value = index;
  editForm.value = {
    pay_date: div.pay_date || div.ex_date, // 預設發放日為除息日 (通常需手動改)
    tax_rate: div.tax_rate || 30,
    total_net_usd: div.total_net_usd,
    notes: ''
  };
};

const cancelEdit = () => {
  editingIndex.value = null;
};

const recalculateNet = () => {
  const div = pendingDividends.value[editingIndex.value];
  if (!div) return;
  // 簡單試算： 總額 * (1 - 稅率%)
  const rate = editForm.value.tax_rate / 100;
  editForm.value.total_net_usd = parseFloat((div.total_gross * (1 - rate)).toFixed(2));
};

const confirmDividendWithData = async (divData) => {
  try {
    const payload = {
      txn_date: divData.pay_date || divData.ex_date,
      symbol: divData.symbol,
      txn_type: 'DIV',
      qty: divData.shares_held,
      price: divData.total_net_usd / (divData.shares_held || 1), // 反推每股淨額
      commission: 0,
      tax: divData.total_gross * (divData.tax_rate / 100),
      total_amount: divData.total_net_usd,
      tag: `配息-${divData.ex_date}`,
      notes: divData.notes
    };

    const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload)
    });
    
    const json = await res.json();
    if (json.success) {
      return true;
    } else {
      throw new Error(json.error || 'API Error');
    }
  } catch (e) {
    console.error('Confirm dividend error:', e);
    throw e;
  }
};

const saveEdit = async (index) => {
  const div = pendingDividends.value[index];
  const updatedDiv = {
    ...div,
    ...editForm.value,
    // total_net_twd 僅用於顯示，實際寫入依賴 total_net_usd
  };
  
  try {
    await confirmDividendWithData(updatedDiv);
    addToast(`${div.symbol} 配息已入帳`, 'success');
    cancelEdit();
    store.fetchAll(); // Refresh list
  } catch(e) {
    addToast('儲存失敗', 'error');
  }
};

const confirmDividend = async (index) => {
  const div = pendingDividends.value[index];
  try {
    // 預設確認：直接使用預估數據
    const defaultData = {
        ...div,
        pay_date: div.pay_date || div.ex_date, // 若無 pay_date 則用 ex_date
        notes: '快速確認'
    };
    await confirmDividendWithData(defaultData);
    addToast(`${div.symbol} 配息已確認`, 'success');
    store.fetchAll();
  } catch(e) {
    addToast('確認失敗', 'error');
  }
};

const confirmAll = async () => {
  if (!confirm(`確定將 ${pendingDividends.value.length} 筆配息全部依預設值入帳嗎？`)) return;
  
  let count = 0;
  for (const div of pendingDividends.value) {
    try {
        const defaultData = { ...div, pay_date: div.pay_date || div.ex_date };
        await confirmDividendWithData(defaultData);
        count++;
    } catch(e) { /* continue */ }
  }
  
  addToast(`成功確認 ${count} 筆配息`, 'success');
  store.fetchAll();
};
</script>

<style scoped>
/* Container */
.dividend-manager {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-float);
  transition: all 0.3s ease;
}

/* Header */
.card-header {
  padding: 16px 20px;
  background: rgba(var(--bg-secondary-rgb), 0.5);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-count {
  background: var(--warning);
  color: #fff;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Button Styles */
.btn { border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 4px; padding: 6px 12px; }
.btn-action { background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); }
.btn-action:hover { background: var(--bg-card); color: var(--text-main); }
.btn-primary { background: var(--primary); color: white; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
.btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-sm { padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; }
.btn-sm.confirm { background: var(--success); color: white; }
.btn-sm.confirm:hover { box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3); transform: translateY(-1px); }
.btn-sm.save { background: var(--primary); color: white; }
.btn-text { background: transparent; border: none; color: var(--text-sub); font-size: 0.85rem; cursor: pointer; }
.btn-text:hover { color: var(--primary); text-decoration: underline; }
.btn-text.cancel:hover { color: var(--text-main); }

.icon.spinning { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { 100% { transform: rotate(360deg); } }

/* Empty State */
.empty-state { padding: 40px 20px; text-align: center; color: var(--text-sub); background: var(--bg-card); }
.empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }
.empty-content h4 { margin: 0 0 8px 0; color: var(--text-main); }
.empty-content p { font-size: 0.9rem; margin: 0; opacity: 0.8; }

/* List */
.dividend-list { padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--bg-secondary); }

/* Card Item */
.div-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
  position: relative;
}
.div-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); border-color: var(--border-highlight); }
.div-card.is-editing { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); transform: none; }

.card-content { padding: 16px; }

/* Main Info */
.div-main-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); }
.symbol-group { display: flex; flex-direction: column; gap: 2px; }
.symbol { font-size: 1.2rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.02em; }
.date-tag { font-size: 0.8rem; color: var(--text-sub); background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; display: inline-block; width: fit-content; }
.amount-group { display: flex; flex-direction: column; align-items: flex-end; }
.amount-twd { font-size: 1.1rem; font-weight: 700; color: var(--success); font-family: 'JetBrains Mono', monospace; }
.amount-usd { font-size: 0.85rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; }

/* Grid Details */
.div-details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.detail-item { display: flex; flex-direction: column; gap: 2px; }
.detail-item label { font-size: 0.75rem; color: var(--text-sub); text-transform: uppercase; }
.detail-item span { font-size: 0.95rem; font-weight: 600; color: var(--text-main); font-family: 'JetBrains Mono', monospace; }

/* Actions */
.card-actions { display: flex; justify-content: space-between; align-items: center; }
.right-actions { display: flex; gap: 8px; }

/* Edit Form */
.card-edit-form { padding: 16px; background: var(--bg-app); }
.form-header { margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
.form-header h4 { margin: 0; font-size: 1rem; color: var(--primary); }
.form-body { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; gap: 12px; }
.form-group { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-sub); }
.input-control { padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.95rem; width: 100%; box-sizing: border-box; background: var(--bg-card); color: var(--text-main); transition: border 0.2s; }
.input-control:focus { border-color: var(--primary); outline: none; }
.input-control.bold { font-weight: 700; color: var(--primary); }
.hint { font-size: 0.75rem; color: var(--text-sub); margin-top: 4px; display: block; }
.form-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color); }

/* Animations */
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(20px); }

/* Responsive */
@media (max-width: 600px) {
  .div-details-grid { grid-template-columns: 1fr 1fr; gap: 16px 8px; }
  .mobile-hide { display: none; }
  .form-row { flex-direction: column; gap: 12px; }
  .card-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .header-actions { justify-content: flex-end; }
}
</style>
