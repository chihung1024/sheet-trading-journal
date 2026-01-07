<template>
  <div class="card" id="trade-form-anchor">
    <div class="header-row">
        <h3>{{ isEditing ? '✏️ 修改交易' : '➕ 新增交易' }}</h3>
        <button v-if="isEditing" @click="resetForm" class="btn btn-outline btn-sm">取消</button>
    </div>
    
    <div class="editor-form">
        <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date">
        </div>
        <div class="form-group">
            <label>代碼</label>
            <input type="text" v-model="form.symbol" placeholder="e.g. NVDA" :disabled="isEditing" class="uppercase">
        </div>
        <div class="form-group">
            <label>類型</label>
            <div class="radio-group">
                <button type="button" :class="{active: form.txn_type==='BUY'}" @click="setTxnType('BUY')">買入</button>
                <button type="button" :class="{active: form.txn_type==='SELL'}" @click="setTxnType('SELL')">賣出</button>
                <button type="button" :class="{active: form.txn_type==='DIV'}" @click="setTxnType('DIV')">股息</button>
            </div>
        </div>
        <div class="form-group">
            <label>股數</label>
            <input type="number" step="any" v-model="form.qty" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>單價</label>
            <input type="number" step="any" v-model="form.price" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>手續費</label>
            <input type="number" step="any" v-model="form.fee" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>稅金</label>
            <input type="number" step="any" v-model="form.tax" @input="calcTotal">
        </div>
        <div class="form-group total-group">
            <label>總金額 (USD)</label>
            <input type="number" step="any" v-model="form.total_amount" @input="calcPrice" placeholder="Auto" class="total-input">
        </div>
        
        <div class="form-actions">
            <button class="btn btn-primary full-width" @click="submit" :disabled="loading">
                {{ loading ? '處理中...' : (isEditing ? '更新交易' : '確認新增') }}
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

const setTxnType = (type) => {
    form.txn_type = type;
    calcTotal();
}

const calcTotal = () => {
    const qty = parseFloat(form.qty) || 0;
    const price = parseFloat(form.price) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    const base = qty * price;
    
    if (form.txn_type === 'BUY') form.total_amount = parseFloat((base + fee + tax).toFixed(2));
    else if (form.txn_type === 'SELL') form.total_amount = parseFloat((base - fee - tax).toFixed(2));
    else if (form.txn_type === 'DIV') form.total_amount = parseFloat((base - tax).toFixed(2));
};

const calcPrice = () => {
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    if (qty <= 0) return;

    if (form.txn_type === 'BUY') form.price = parseFloat(((total - fee - tax) / qty).toFixed(4));
    else if (form.txn_type === 'SELL') form.price = parseFloat(((total + fee + tax) / qty).toFixed(4));
    else form.price = parseFloat(((total + tax) / qty).toFixed(4));
};

const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) {
        addToast("請填寫完整資料", "error"); return;
    }
    loading.value = true;
    try {
        const method = isEditing.value ? "PUT" : "POST";
        const payload = { ...form };
        if (isEditing.value) payload.id = editingId.value;

        // 轉型
        payload.qty = parseFloat(payload.qty);
        payload.price = parseFloat(payload.price);
        payload.fee = parseFloat(payload.fee || 0);
        payload.tax = parseFloat(payload.tax || 0);

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method,
            headers: { 
                'Authorization': `Bearer ${auth.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        
        if (json.success) {
            addToast(isEditing.value ? "更新成功" : "新增成功", "success");
            resetForm();
            store.fetchRecords();
        } else {
            addToast("操作失敗: " + json.error, "error");
        }
    } catch(e) { addToast("連線錯誤", "error"); }
    finally { loading.value = false; }
};

const resetForm = () => {
    isEditing.value = false;
    editingId.value = null;
    form.symbol = ''; form.qty = ''; form.price = ''; form.fee = 0; form.tax = 0; form.total_amount = '';
    form.txn_type = 'BUY';
};

const setupForm = (record) => {
    isEditing.value = true;
    editingId.value = record.id;
    form.txn_date = record.txn_date;
    form.symbol = record.symbol;
    form.txn_type = record.txn_type;
    form.qty = record.qty;
    form.price = record.price;
    form.fee = record.fee || 0;
    form.tax = record.tax || 0;
    calcTotal();
};

defineExpose({ setupForm });
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.editor-form { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
    gap: 16px; 
    align-items: start; 
}

.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }

input, select { 
    background: rgba(0,0,0,0.2); 
    border: 1px solid var(--card-border); 
    color: white; 
    padding: 10px; 
    border-radius: 8px; 
    font-size: 0.95rem; 
    width: 100%; 
    box-sizing: border-box;
    transition: 0.2s;
}
input:focus { border-color: var(--primary); background: rgba(0,0,0,0.4); outline: none; }
.uppercase { text-transform: uppercase; }

/* 類型切換按鈕組 */
.radio-group { display: flex; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 3px; border: 1px solid var(--card-border); }
.radio-group button { 
    flex: 1; background: transparent; border: none; color: #888; padding: 6px; 
    font-size: 0.85rem; border-radius: 6px; 
}
.radio-group button.active { background: var(--primary); color: white; font-weight: bold; }

.total-input { font-weight: bold; color: var(--primary); border-color: rgba(64,169,255,0.3); }

.form-actions { grid-column: 1 / -1; margin-top: 10px; }
.full-width { width: 100%; padding: 12px; font-size: 1rem; }

@media (max-width: 600px) {
    .editor-form { grid-template-columns: 1fr 1fr; }
    .form-actions { grid-column: span 2; }
}
</style>
