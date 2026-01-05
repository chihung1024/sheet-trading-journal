<template>
  <div class="card" id="trade-form-anchor">
    <div class="flex-row" style="margin-bottom:15px">
        <h3>{{ isEditing ? '修改交易紀錄' : '新增交易紀錄' }}</h3>
        <button v-if="isEditing" @click="resetForm" class="btn btn-outline btn-sm">取消修改</button>
    </div>
    
    <div class="editor-form">
        <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date">
        </div>
        <div class="form-group">
            <label>代碼</label>
            <input type="text" v-model="form.symbol" placeholder="e.g. NVDA" :disabled="isEditing">
        </div>
        <div class="form-group">
            <label>類型</label>
            <select v-model="form.txn_type" @change="calcTotal">
                <option value="BUY">買入</option>
                <option value="SELL">賣出</option>
                <option value="DIV">股息</option>
            </select>
        </div>
        <div class="form-group">
            <label>股數</label>
            <input type="number" step="any" v-model="form.qty" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>單價 (平均成本)</label>
            <input type="number" step="any" v-model="form.price" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>手續費 (Fee)</label>
            <input type="number" step="any" v-model="form.fee" @input="calcTotal">
        </div>
        <div class="form-group">
            <label>交易稅 (Tax)</label>
            <input type="number" step="any" v-model="form.tax" @input="calcTotal">
        </div>
        <div class="form-group" style="min-width: 120px;">
            <label>交易總額 (Total)</label>
            <input type="number" step="any" v-model="form.total_amount" @input="calcPrice" placeholder="自動計算">
        </div>
        
        <div class="form-group" style="grid-column: 1 / -1;">
            <button class="btn btn-primary" @click="submit" :disabled="loading" style="width:100%">
                {{ loading ? '處理中...' : (isEditing ? '更新' : '新增') }}
            </button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
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

// 計算邏輯：輸入 股數/單價 -> 算總額
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

// 計算邏輯：輸入 總額 -> 反推單價
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

// 提交
const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) {
        alert("請填寫完整資料"); return;
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
            alert(isEditing.value ? "更新成功" : "新增成功");
            resetForm();
            store.fetchRecords();
        } else {
            alert("操作失敗: " + json.error);
        }
    } catch(e) { alert("連線錯誤"); }
    finally { loading.value = false; }
};

const resetForm = () => {
    isEditing.value = false;
    editingId.value = null;
    form.symbol = ''; form.qty = ''; form.price = ''; form.fee = 0; form.tax = 0; form.total_amount = '';
    form.txn_type = 'BUY';
};

// 暴露給父組件的方法
const setupForm = (record) => {
    isEditing.value = true;
    editingId.value = record.id;
    // 複製資料
    form.txn_date = record.txn_date;
    form.symbol = record.symbol;
    form.txn_type = record.txn_type;
    form.qty = record.qty;
    form.price = record.price;
    form.fee = record.fee || 0;
    form.tax = record.tax || 0;
    calcTotal(); // 重算總額顯示
};

defineExpose({ setupForm });
</script>

<style scoped>
.editor-form { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); 
    gap: 12px; 
    align-items: end; 
    background: #222; 
    padding: 20px; 
    border-radius: 8px; 
    border: 1px solid #444; 
}
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.8rem; color: #aaa; white-space: nowrap; }
.form-group input, .form-group select { 
    background: #111; 
    border: 1px solid #333; 
    color: white; 
    padding: 8px; 
    border-radius: 4px; 
    font-size: 0.95rem; 
    width: 100%; 
}
.form-group input:focus { border-color: var(--primary); outline: none; }
</style>
