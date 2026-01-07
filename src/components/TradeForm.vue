<template>
  <div class="card" id="trade-form-anchor">
    <h3>{{ isEditing ? '✏️ 編輯交易' : '📝 新增交易' }}</h3>
    
    <div class="form-content">
        <div class="type-tabs">
            <button type="button" v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
                :class="{ active: form.txn_type === t, [t.toLowerCase()]: true }"
                @click="setTxnType(t)">
                {{ t === 'BUY' ? '買入' : t === 'SELL' ? '賣出' : '股息' }}
            </button>
        </div>

        <div class="input-grid">
            <div class="field">
                <label>日期</label>
                <input type="date" v-model="form.txn_date">
            </div>
            <div class="field">
                <label>代碼</label>
                <input type="text" v-model="form.symbol" placeholder="NVDA" :disabled="isEditing" class="uppercase font-mono">
            </div>
            <div class="field">
                <label>股數</label>
                <input type="number" v-model="form.qty" @input="calcTotal" placeholder="0.00">
            </div>
            <div class="field">
                <label>單價 (USD)</label>
                <input type="number" v-model="form.price" @input="calcTotal" placeholder="0.00">
            </div>
            <div class="field">
                <label>手續費</label>
                <input type="number" v-model="form.fee" @input="calcTotal" placeholder="0">
            </div>
            <div class="field">
                <label>稅金</label>
                <input type="number" v-model="form.tax" @input="calcTotal" placeholder="0">
            </div>
        </div>

        <div class="total-section">
            <label>總金額 (USD)</label>
            <input type="number" v-model="form.total_amount" @input="calcPrice" class="total-input">
        </div>
        
        <div class="actions">
            <button v-if="isEditing" @click="resetForm" class="btn btn-outline">取消</button>
            <button class="btn btn-primary flex-1" @click="submit" :disabled="loading">
                {{ loading ? '處理中...' : (isEditing ? '更新紀錄' : '確認新增') }}
            </button>
        </div>
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
    total_amount: ''
});

const setTxnType = (type) => { form.txn_type = type; calcTotal(); }

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
        ['qty', 'price', 'fee', 'tax'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        
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
    form.fee = r.fee || 0; form.tax = r.tax || 0;
    calcTotal();
};
defineExpose({ setupForm });
</script>

<style scoped>
.form-content { display: flex; flex-direction: column; gap: 16px; }

/* Tabs */
.type-tabs { display: flex; background: var(--bg-body); padding: 4px; border-radius: 8px; gap: 4px; }
.type-tabs button {
    flex: 1; border: none; padding: 8px; border-radius: 6px; font-size: 0.85rem; 
    font-weight: 600; cursor: pointer; color: var(--text-secondary); background: transparent; transition: 0.2s;
}
.type-tabs button.active { background: white; shadow: var(--shadow-sm); color: var(--text-primary); }
.type-tabs button.active.buy { color: var(--primary); border-left: 3px solid var(--primary); }
.type-tabs button.active.sell { color: var(--success); border-left: 3px solid var(--success); }
.type-tabs button.active.div { color: var(--warning); border-left: 3px solid var(--warning); }

/* Inputs */
.input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
input {
    padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;
    font-size: 0.9rem; transition: 0.2s; background: white; color: var(--text-primary);
}
input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1); }
input:disabled { background: var(--bg-body); cursor: not-allowed; }
.uppercase { text-transform: uppercase; }
.font-mono { font-family: 'JetBrains Mono', monospace; }

.total-section { background: var(--bg-body); padding: 12px; border-radius: 8px; }
.total-input { width: 100%; border: none; background: transparent; font-size: 1.25rem; font-weight: 700; color: var(--text-primary); padding: 4px 0; }
.total-input:focus { box-shadow: none; }

.actions { display: flex; gap: 10px; margin-top: 8px; }
.flex-1 { flex: 1; }
</style>
