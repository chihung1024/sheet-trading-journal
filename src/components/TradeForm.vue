<![CDATA[<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <h3 class="panel-title">{{ isEditing ? '編輯交易' : '快速下單' }}</h3>
    
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            {{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}
        </button>
    </div>

    <div class="form-grid">
        <div class="form-group full">
            <label>交易標的</label>
            <input type="text" v-model="form.symbol" placeholder="輸入代碼 (如 NVDA)" :disabled="isEditing" class="input-lg uppercase">
        </div>
        
        <!-- ✅ 新增：群組選擇器 -->
        <div class="form-group full">
            <label>
                <span class="label-icon">📁</span>
                所屬群組
            </label>
            <select v-model="form.tag" class="input-lg group-select">
                <option value="長線投資">🎯 長線投資</option>
                <option value="短線交易">⚡ 短線交易</option>
                <option value="波段操作">📈 波段操作</option>
                <option value="價值投資">💎 價值投資</option>
                <option value="成長股">🚀 成長股</option>
                <option value="股息股">💰 股息股</option>
                <option value="指數ETF">📊 指數ETF</option>
                <option value="其他">📝 其他</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 (USD)</label>
            <input type="number" v-model="form.price" placeholder="0.00" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>股數</label>
            <input type="number" v-model="form.qty" @input="calcPriceFromInputs" placeholder="0" class="input-md" step="0.0001">
        </div>

        <div class="form-group">
            <label>費用 (Fee/Tax)</label>
            <div class="dual-input">
                <input type="number" v-model="form.fee" @input="calcPriceFromInputs" placeholder="手續費" step="0.01">
                <input type="number" v-model="form.tax" @input="calcPriceFromInputs" placeholder="稅金" step="0.01">
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">交易總金額 (USD)</div>
        <input type="number" v-model="form.total_amount" @input="calcPriceFromInputs" class="summary-value" step="0.01" placeholder="0.00">
    </div>
    
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button class="btn btn-submit" @click="submit" :disabled="loading" :class="form.txn_type.toLowerCase()">
            {{ loading ? '處理中...' : (isEditing ? '更新交易' : '送出委託') }}
        </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();
const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '', 
    txn_type: 'BUY', 
    qty: '', 
    price: '', 
    fee: 0, 
    tax: 0, 
    total_amount: '',
    tag: '長線投資'  // ✅ 預設群組
});

const setTxnType = (type) => { 
    form.txn_type = type; 
};

const calcPriceFromInputs = () => {
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    
    if (qty <= 0 || total <= 0) return;
    
    let avgCost = 0;
    
    if (form.txn_type === 'BUY') {
        avgCost = (total + fee + tax) / qty;
    } else if (form.txn_type === 'SELL') {
        avgCost = (total - fee - tax) / qty;
    } else {
        avgCost = (total - tax) / qty;
    }
    
    form.price = parseFloat(avgCost.toFixed(4));
};

const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { 
        addToast("請填寫完整資料", "error"); 
        return; 
    }
    
    if (!auth.token || auth.isTokenExpired()) {
        addToast("登入已過期，請重新登入", "error");
        setTimeout(() => {
            auth.logout();
        }, 2000);
        return;
    }
    
    loading.value = true;
    try {
        const method = isEditing.value ? "PUT" : "POST";
        const payload = { ...form, id: isEditing.value ? editingId.value : undefined };
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method, 
            headers: { 
                'Authorization': `Bearer ${auth.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        if (res.status === 401) {
            addToast("身份驗證失敗，請重新登入", "error");
            setTimeout(() => {
                auth.logout();
            }, 2000);
            return;
        }
        
        const json = await res.json();
        
        if (json.success) {
            addToast(isEditing.value ? "更新成功" : "新增成功", "success");
            resetForm(); 
            store.fetchRecords();
        } else { 
            addToast(json.error || "操作失敗", "error"); 
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
        addToast("連線錯誤，請稍後再試", "error"); 
    } finally { 
        loading.value = false; 
    }
};

const resetForm = () => {
    isEditing.value = false; 
    editingId.value = null;
    form.symbol = ''; 
    form.qty = ''; 
    form.price = ''; 
    form.fee = 0; 
    form.tax = 0; 
    form.total_amount = '';
    form.txn_type = 'BUY';
    form.tag = '長線投資';  // ✅ 重置為預設群組
};

const setupForm = (r) => {
    isEditing.value = true; 
    editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
};

defineExpose({ setupForm });
</script>

<style scoped>
.trade-panel { 
    border: 1px solid var(--border-color); 
    box-shadow: var(--shadow-card); 
    background: var(--bg-card); 
    padding: 24px;
}

.panel-title { 
    margin-bottom: 24px; 
    font-size: 1.3rem; 
    color: var(--text-main);
    font-weight: 700;
}

.trade-type-switch { 
    display: flex; 
    background: var(--bg-secondary); 
    padding: 4px; 
    border-radius: 12px; 
    margin-bottom: 24px; 
}

.switch-btn { 
    flex: 1; 
    border: none; 
    background: transparent; 
    padding: 10px; 
    font-weight: 500; 
    color: var(--text-sub); 
    cursor: pointer; 
    border-radius: 8px; 
    transition: all 0.2s; 
    font-size: 1rem; 
}

.switch-btn.active { 
    background: var(--bg-card); 
    box-shadow: var(--shadow-sm); 
    color: var(--text-main); 
    font-weight: 600; 
}

.switch-btn.buy.active { 
    color: var(--primary); 
}

.switch-btn.sell.active { 
    color: var(--success); 
}

.switch-btn.div.active { 
    color: var(--warning); 
}

.form-grid { 
    display: grid; 
    grid-template-columns: 1fr 1fr; 
    gap: 20px; 
    margin-bottom: 24px; 
}

.form-group { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
}

.form-group.full { 
    grid-column: span 2; 
}

label { 
    font-size: 0.9rem; 
    color: var(--text-sub); 
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

.label-icon {
    font-size: 1rem;
}

input, select { 
    padding: 12px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 1.05rem; 
    width: 100%; 
    box-sizing: border-box; 
    font-family: 'JetBrains Mono', monospace; 
    transition: all 0.2s; 
    color: var(--text-main);
    background: var(--bg-card);
}

/* ✅ 群組選擇器特殊樣式 */
.group-select {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 500;
    cursor: pointer;
    padding-right: 36px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    appearance: none;
}

.group-select option {
    padding: 12px;
    font-size: 1rem;
}

input::placeholder, select::placeholder {
    color: var(--text-sub);
    opacity: 0.6;
}

input:focus, select:focus { 
    outline: none; 
    border-color: var(--primary); 
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); 
}

input:disabled {
    background: var(--bg-secondary);
    cursor: not-allowed;
    opacity: 0.7;
}

.uppercase { 
    text-transform: uppercase; 
}

.dual-input { 
    display: flex; 
    gap: 12px; 
}

.summary-box { 
    background: var(--bg-secondary); 
    padding: 20px; 
    border-radius: 12px; 
    text-align: center; 
    margin-bottom: 24px; 
    border: 1px dashed var(--border-color); 
}

.summary-label { 
    font-size: 0.95rem; 
    color: var(--text-sub); 
    margin-bottom: 8px; 
    font-weight: 500;
}

.summary-value { 
    background: transparent; 
    border: none; 
    text-align: center; 
    font-size: 2rem; 
    font-weight: 700; 
    color: var(--text-main); 
    padding: 0; 
    width: 100%; 
    box-shadow: none; 
}

.summary-value:focus { 
    box-shadow: none; 
}

.action-buttons { 
    display: flex; 
    gap: 16px; 
}

.btn { 
    flex: 1; 
    padding: 14px; 
    border: none; 
    border-radius: 10px; 
    font-weight: 600; 
    cursor: pointer; 
    transition: all 0.2s; 
    font-size: 1.05rem; 
    letter-spacing: 0.02em; 
}

.btn-cancel { 
    background: var(--bg-secondary); 
    color: var(--text-sub); 
    border: 1px solid var(--border-color);
}

.btn-cancel:hover { 
    background: var(--border-color); 
    color: var(--text-main);
}

.btn-submit { 
    color: white; 
    background: var(--primary); 
}

.btn-submit.buy { 
    background: var(--primary); 
}

.btn-submit.sell { 
    background: var(--success); 
}

.btn-submit.div { 
    background: var(--warning); 
}

.btn-submit:hover { 
    opacity: 0.9; 
    transform: translateY(-1px); 
    box-shadow: var(--shadow-card);
}

.btn-submit:disabled { 
    opacity: 0.6; 
    cursor: not-allowed; 
    transform: none; 
}

@media (max-width: 768px) {
    .trade-panel {
        padding: 20px;
    }
    
    .form-grid {
        gap: 16px;
    }
    
    .panel-title {
        font-size: 1.2rem;
    }
}

:global(.dark) .trade-panel {
    background-color: #1e293b !important;
    border-color: #334155 !important;
    color: #f1f5f9 !important;
}

:global(.dark) .panel-title,
:global(.dark) label,
:global(.dark) .summary-label {
    color: #f1f5f9 !important;
}

:global(.dark) input,
:global(.dark) select,
:global(.dark) .summary-value {
    background-color: #0f172a !important;
    color: #f1f5f9 !important;
    border-color: #334155 !important;
}

:global(.dark) .trade-type-switch,
:global(.dark) .summary-box {
    background-color: #334155 !important;
}

:global(.dark) .switch-btn {
    color: #94a3b8 !important;
}

:global(.dark) .switch-btn.active {
    background-color: #1e293b !important;
    color: #f1f5f9 !important;
}

:global(.dark) .group-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
}
</style>]]>