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
        <button class="btn btn-secondary" @click="confirmAll">
          <span class="icon">✓</span>
          全部確認
        </button>
        <button class="btn btn-tertiary" @click="refreshData">
          <span class="icon">↻</span>
          刷新
        </button>
      </div>
    </div>

    <div v-if="pendingDividends.length === 0" class="empty-state">
      <div class="empty-icon">🎉</div>
      <p class="empty-title">沒有待確認的配息</p>
      <p class="empty-desc">系統會自動抓取持股的配息資訊，您可以在此確認後寫入交易記錄。</p>
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
              <span class="badge badge-pending">{{ div.status === 'pending' ? '待確認' : '已確認' }}</span>
            </div>
            <div class="dividend-amount">
              <span class="amount-twd">NT${{ formatNumber(div.total_net_twd, 0) }}</span>
              <span class="amount-usd">${{ formatNumber(div.total_net_usd, 2) }}</span>
            </div>
          </div>
          
          <div class="dividend-details">
            <div class="detail-row">
              <span class="detail-label">除息日：</span>
              <span class="detail-value">{{ div.ex_date }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">持股數：</span>
              <span class="detail-value">{{ formatNumber(div.shares_held, 2) }} 股</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">每股配息：</span>
              <span class="detail-value">${{ formatNumber(div.dividend_per_share_gross, 4) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">稅前總額：</span>
              <span class="detail-value">${{ formatNumber(div.total_gross, 2) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">稅率：</span>
              <span class="detail-value">{{ div.tax_rate }}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">匯率：</span>
              <span class="detail-value">{{ formatNumber(div.fx_rate, 4) }}</span>
            </div>
          </div>

          <div class="dividend-actions">
            <button class="btn-action btn-edit" @click="editDividend(index)">
              <span class="icon">✎</span>
              編輯
            </button>
            <button class="btn-action btn-confirm" @click="confirmDividend(index)">
              <span class="icon">✓</span>
              確認
            </button>
            <button class="btn-action btn-ignore" @click="ignoreDividend(index)">
              <span class="icon">✕</span>
              忽略
            </button>
          </div>
        </div>

        <div v-else class="dividend-edit">
          <div class="edit-header">
            <h4>編輯配息資訊 - {{ div.symbol }}</h4>
          </div>
          
          <div class="edit-form">
            <div class="form-group">
              <label>發放日期</label>
              <input 
                type="date" 
                v-model="editForm.pay_date" 
                class="form-input"
              >
            </div>
            
            <div class="form-group">
              <label>稅率 (%)</label>
              <input 
                type="number" 
                v-model.number="editForm.tax_rate" 
                step="0.1"
                min="0"
                max="100"
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
                class="form-input"
              >
              <span class="help-text">台幣約 NT${{ formatNumber(editForm.total_net_usd * (div.fx_rate || 1), 0) }}</span>
            </div>
            
            <div class="form-group">
              <label>備註</label>
              <textarea 
                v-model="editForm.notes" 
                rows="2"
                class="form-input"
                placeholder="選填"
              ></textarea>
            </div>
          </div>

          <div class="edit-actions">
            <button class="btn-action btn-cancel" @click="cancelEdit">
              取消
            </button>
            <button class="btn-action btn-save" @click="saveEdit(index)">
              儲存
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
const editForm = ref({
  pay_date: '',
  tax_rate: 30.0,
  total_net_usd: 0,
  notes: ''
});

// 從 store 中取得待確認配息 (增加空陣列防禦)
const pendingDividends = computed(() => {
  return store.pending_dividends || [];
});

const formatNumber = (num, decimals = 2) => {
  const val = Number(num);
  if (isNaN(val)) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const refreshData = async () => {
  try {
    await store.fetchAll();
    addToast('資料已更新', 'success');
  } catch (e) {
    addToast('更新失敗', 'error');
  }
};

const editDividend = (index) => {
  const div = pendingDividends.value[index];
  if (!div) return;
  editingIndex.value = index;
  editForm.value = {
    pay_date: div.pay_date || div.ex_date,
    tax_rate: Number(div.tax_rate) || 30.0,
    total_net_usd: Number(div.total_net_usd) || 0,
    notes: div.notes || ''
  };
};

const cancelEdit = () => {
  editingIndex.value = null;
  editForm.value = { pay_date: '', tax_rate: 30.0, total_net_usd: 0, notes: '' };
};

const recalculateNet = () => {
  const div = pendingDividends.value[editingIndex.value];
  if (!div) return;
  const taxRate = (Number(editForm.value.tax_rate) || 0) / 100;
  editForm.value.total_net_usd = (Number(div.total_gross) || 0) * (1 - taxRate);
};

const saveEdit = async (index) => {
  const div = pendingDividends.value[index];
  if (!div) return;
  
  const updatedDiv = {
    ...div,
    ...editForm.value,
    total_net_twd: (Number(editForm.value.total_net_usd) || 0) * (Number(div.fx_rate) || 1)
  };
  
  await confirmDividendWithData(updatedDiv);
  cancelEdit();
};

const confirmDividend = async (index) => {
  const div = pendingDividends.value[index];
  if (div) await confirmDividendWithData(div);
};

/**
 * 核心 API 提交邏輯
 * 確保數值在寫入 Records 之前經過嚴格的數字轉換
 */
const confirmDividendWithData = async (divData) => {
  try {
    const qty = Number(divData.shares_held) || 0;
    const netUsd = Number(divData.total_net_usd) || 0;
    const grossUsd = Number(divData.total_gross) || 0;
    const taxRate = Number(divData.tax_rate) || 0;

    const response = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        txn_date: divData.pay_date || divData.ex_date,
        symbol: String(divData.symbol).toUpperCase(),
        txn_type: 'DIV',
        qty: qty,
        price: qty > 0 ? (netUsd / qty) : 0, 
        fee: 0,
        tax: grossUsd * (taxRate / 100),
        tag: `配息-${divData.ex_date}`,
        note: divData.notes || ''
      })
    });
    
    const json = await response.json();
    if (json.success) {
      addToast(`${divData.symbol} 配息已確認並寫入紀錄`, 'success');
      await store.fetchAll();
    } else {
      throw new Error(json.error || '確認失敗');
    }
  } catch (e) {
    console.error('確認配息錯誤:', e);
    addToast(e.message || '連線錯誤', 'error');
  }
};

const confirmAll = async () => {
  if (pendingDividends.value.length === 0) return;
  if (!confirm(`確定要確認所有 ${pendingDividends.value.length} 筆配息嗎？`)) return;
  
  addToast('正在處理多筆配息確認...', 'info');
  for (const div of pendingDividends.value) {
    try {
      await confirmDividendWithData(div);
    } catch (e) {
      console.warn(`[ConfirmAll] 略過錯誤筆數: ${div.symbol}`);
    }
  }
};

const ignoreDividend = (index) => {
  addToast('忽略功能將在未來更新中支援持久化', 'info');
};
</script>

<style scoped>
/* 樣式部分保持不變 */
.dividend-manager { padding: 24px; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.header-title { display: flex; align-items: center; gap: 12px; }
.header-title h3 { margin: 0; font-size: 1.3rem; font-weight: 700; color: var(--text-main); }
.pending-count { background: var(--warning); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; }
.header-actions { display: flex; gap: 12px; }
.btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.95rem; }
.btn-secondary { background: var(--success); color: white; }
.btn-tertiary { background: var(--bg-secondary); color: var(--text-sub); border: 1px solid var(--border-color); }
.empty-state { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 4rem; margin-bottom: 16px; }
.empty-title { font-size: 1.2rem; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
.empty-desc { color: var(--text-sub); font-size: 0.95rem; max-width: 500px; margin: 0 auto; }
.dividend-list { display: grid; gap: 16px; }
.dividend-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; transition: all 0.2s ease; }
.dividend-card:hover { box-shadow: var(--shadow-sm); border-color: var(--primary); }
.dividend-card.editing { border-color: var(--warning); background: rgba(245, 158, 11, 0.05); }
.dividend-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.dividend-symbol { display: flex; align-items: center; gap: 8px; }
.symbol-text { font-size: 1.2rem; font-weight: 700; color: var(--primary); }
.badge { padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
.badge-pending { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
.dividend-amount { text-align: right; }
.amount-twd { display: block; font-size: 1.5rem; font-weight: 700; color: var(--success); font-family: 'JetBrains Mono', monospace; }
.amount-usd { display: block; font-size: 0.9rem; color: var(--text-sub); font-family: 'JetBrains Mono', monospace; margin-top: 4px; }
.dividend-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 8px; }
.detail-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.detail-label { color: var(--text-sub); font-weight: 500; }
.detail-value { color: var(--text-main); font-weight: 600; font-family: 'JetBrains Mono', monospace; }
.dividend-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-action { display: flex; align-items: center; gap: 4px; padding: 8px 14px; border: none; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.btn-edit { background: var(--bg-secondary); color: var(--text-sub); }
.btn-confirm { background: var(--success); color: white; }
.btn-ignore { background: var(--bg-secondary); color: var(--danger); }
.edit-header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); }
.edit-header h4 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main); }
.edit-form { display: grid; gap: 16px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.9rem; font-weight: 600; color: var(--text-sub); }
.form-input { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 1rem; color: var(--text-main); background: var(--bg-card); transition: all 0.2s ease; }
.help-text { font-size: 0.85rem; color: var(--text-sub); margin-top: 4px; }
.edit-actions { display: flex; gap: 12px; justify-content: flex-end; }
.btn-cancel { background: var(--bg-secondary); color: var(--text-sub); }
.btn-save { background: var(--primary); color: white; }
@media (max-width: 768px) { .header-section { flex-direction: column; align-items: stretch; } .header-actions { width: 100%; } .dividend-details { grid-template-columns: 1fr; } .dividend-actions { flex-wrap: wrap; } .btn-action { flex: 1; } }
</style>
