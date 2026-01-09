<template>
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
        
        <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date" class="input-md">
        </div>
        
        <div class="form-group">
            <label>成交單價 (USD)</label>
            <input type="number" v-model="form.price" @input="calcTotal" placeholder="0.00" class="input-md">
        </div>

        <div class="form-group">
            <label>股數</label>
            <input type="number" v-model="form.qty" @input="calcTotal" placeholder="0" class="input-md">
        </div>

        <div class="form-group">
            <label>費用 (Fee/Tax)</label>
            <div class="dual-input">
                <input type="number" v-model="form.fee" @input="calcTotal" placeholder="手續費">
                <input type="number" v-model="form.tax" @input="calcTotal" placeholder="稅金">
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">預估總金額 (USD)</div>
        <input type="number" v-model="form.total_amount" @input="calcPrice" class="summary-value">
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
    symbol: '', txn_type: 'BUY', qty: '', price: '', fee: 0, tax: 0, total_amount: ''
});

const setTxnType = (type) => { form.txn_type = type; calcTotal(); };

const calcTotal = () => {
    const qty = parseFloat(form.qty)||0; const price = parseFloat(form.price)||0;
    const fee = parseFloat(form.fee)||0; const tax = parseFloat(form.tax)||0;
    let base = qty * price;
    if (form.txn_type === 'BUY') form.total_amount = parseFloat((base + fee + tax).toFixed(2));
    else if (form.txn_type === 'SELL') form.total_amount = parseFloat((base - fee - tax).toFixed(2));
    else form.total_amount = parseFloat((base - tax).toFixed(2));
};

const calcPrice = () => {
    const qty = parseFloat(form.qty)||0; const total = parseFloat(form.total_amount)||0;
    const fee = parseFloat(form.fee)||0; const tax = parseFloat(form.tax)||0;
    if (qty <= 0) return;
    if (form.txn_type === 'BUY') form.price = parseFloat(((total - fee - tax) / qty).toFixed(4));
    else if (form.txn_type === 'SELL') form.price = parseFloat(((total + fee + tax) / qty).toFixed(4));
    else form.price = parseFloat(((total + tax) / qty).toFixed(4));
};

const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { addToast("請填寫完整資料", "error"); return; }
    loading.value = true;
    try {
        const method = isEditing.value ? "PUT" : "POST";
        const payload = { ...form, id: isEditing.value ? editingId.value : undefined };
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method, headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            addToast(isEditing.value ? "更新成功" : "新增成功", "success");
            resetForm(); store.fetchRecords();
        } else { addToast(json.error, "error"); }
    } catch(e) { addToast("連線錯誤", "error"); } finally { loading.value = false; }
};

const resetForm = () => {
    isEditing.value = false; editingId.value = null;
    form.symbol = ''; form.qty = ''; form.price = ''; form.fee = 0; form.tax = 0; form.total_amount = '';
    form.txn_type = 'BUY';
};

const setupForm = (r) => {
    isEditing.value = true; editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
    calcTotal();
};
defineExpose({ setupForm });
</script>

<style scoped>
.trade-panel { 
    border: 1px solid var(--border-color); 
    box-shadow: var(--shadow-card); 
    background: var(--bg-card); 
    padding: 24px;
    
    /* ❌ 刪除以下這兩行，避免與外層衝突 */
    /* position: sticky; */
    /* top: 24px; */
}

.panel-title { 
    margin-bottom: 24px; 
    font-size: 1.2rem; 
    color: var(--text-main);
    font-weight: 700;
}

/* 切換按鈕 */
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
    font-size: 0.95rem; 
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

/* 表單區塊 */
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
    font-size: 0.85rem; 
    color: var(--text-sub); 
    font-weight: 600; 
}

input { 
    padding: 12px; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    font-size: 1rem; 
    width: 100%; 
    box-sizing: border-box; 
    font-family: 'JetBrains Mono', monospace; 
    transition: all 0.2s; 
    color: var(--text-main);
    background: var(--bg-card);
}

input::placeholder {
    color: var(--text-sub);
    opacity: 0.6;
}

input:focus { 
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

/* 總金額區塊 */
.summary-box { 
    background: var(--bg-secondary); 
    padding: 20px; 
    border-radius: 12px; 
    text-align: center; 
    margin-bottom: 24px; 
    border: 1px dashed var(--border-color); 
}

.summary-label { 
    font-size: 0.9rem; 
    color: var(--text-sub); 
    margin-bottom: 8px; 
    font-weight: 500;
}

.summary-value { 
    background: transparent; 
    border: none; 
    text-align: center; 
    font-size: 1.8rem; 
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
    font-size: 1rem; 
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

/* 響應式調整 */
@media (max-width: 768px) {
    .trade-panel {
        padding: 20px;
    }
    
    .form-grid {
        gap: 16px;
    }
    
    .panel-title {
        font-size: 1.1rem;
    }
}
</style>
