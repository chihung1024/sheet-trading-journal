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
.trade-panel { border: none; box-shadow: var(--shadow-md); background: #fff; }
.panel-title { margin-bottom: 16px; font-size: 1.1rem; }

.trade-type-switch { display: flex; background: #f1f5f9; padding: 4px; border-radius: 8px; margin-bottom: 20px; }
.switch-btn { flex: 1; border: none; background: transparent; padding: 8px; font-weight: 600; color: var(--text-sub); cursor: pointer; border-radius: 6px; transition: 0.2s; }
.switch-btn.active { background: #fff; shadow: var(--shadow-sm); color: var(--text-main); }
.switch-btn.buy.active { color: var(--primary); border-bottom: 2px solid var(--primary); }
.switch-btn.sell.active { color: var(--success); border-bottom: 2px solid var(--success); }
.switch-btn.div.active { color: #d97706; border-bottom: 2px solid #d97706; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: span 2; }

label { font-size: 0.85rem; color: var(--text-sub); font-weight: 500; }
input { padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 1rem; width: 100%; box-sizing: border-box; font-family: 'JetBrains Mono', monospace; }
input:focus { outline: none; border-color: var(--primary); }
.uppercase { text-transform: uppercase; }

.dual-input { display: flex; gap: 8px; }

.summary-box { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 1px solid var(--border-color); }
.summary-label { font-size: 0.85rem; color: var(--text-sub); margin-bottom: 4px; }
.summary-value { background: transparent; border: none; text-align: center; font-size: 1.5rem; font-weight: 700; color: var(--text-main); padding: 0; width: 100%; }

.action-buttons { display: flex; gap: 12px; }
.btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 1rem; }
.btn-cancel { background: #f1f5f9; color: var(--text-sub); }
.btn-submit { color: white; background: var(--text-main); }
.btn-submit.buy { background: var(--primary); }
.btn-submit.sell { background: var(--success); }
.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
</style>
