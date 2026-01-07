<script setup>
// ... (保留原本邏輯)
</script>

<template>
  <div class="form-container">
    <div class="form-header">
        <h3 class="title">
            <span class="icon">{{ isEditing ? '📝' : '➕' }}</span>
            {{ isEditing ? '修改交易紀錄' : '新增交易紀錄' }}
        </h3>
        <button v-if="isEditing" @click="resetForm" class="btn-cancel">取消修改</button>
    </div>
    
    <div class="grid-form">
        <div class="input-group">
            <label>日期</label>
            <input type="date" v-model="form.txn_date">
        </div>
        <div class="input-group">
            <label>代碼 (Symbol)</label>
            <input type="text" v-model="form.symbol" placeholder="e.g. NVDA" :disabled="isEditing" class="uppercase">
        </div>
        <div class="input-group">
            <label>類型</label>
            <select v-model="form.txn_type" @change="calcTotal">
                <option value="BUY">🔴 買入</option>
                <option value="SELL">🟢 賣出</option>
                <option value="DIV">🔵 股息</option>
            </select>
        </div>
        <div class="input-group">
            <label>股數</label>
            <input type="number" v-model="form.qty" @input="calcTotal" placeholder="0.00">
        </div>
        <div class="input-group">
            <label>單價 (USD)</label>
            <input type="number" v-model="form.price" @input="calcTotal" placeholder="0.00">
        </div>
        <div class="input-group highlight">
            <label>交易總額 (Total)</label>
            <input type="number" v-model="form.total_amount" @input="calcPrice" placeholder="自動計算">
        </div>
        
        <div class="form-actions">
            <button class="btn-submit" @click="submit" :disabled="loading">
                <span v-if="loading" class="spinner-sm"></span>
                {{ loading ? '處理中' : (isEditing ? '更新交易' : '存入紀錄') }}
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.grid-form { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
    gap: 20px; 
}
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 0.8rem; color: #9ca3af; font-weight: 500; }

input, select {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px 12px;
    color: white;
    transition: all 0.2s;
}

input:focus { border-color: var(--primary); background: rgba(0,0,0,0.4); outline: none; box-shadow: 0 0 0 3px var(--primary-glow); }

.highlight input { border-color: var(--primary-glow); color: var(--primary); font-weight: bold; }

.form-actions { grid-column: 1 / -1; margin-top: 10px; }

.btn-submit {
    width: 100%; background: var(--primary); color: white; border: none;
    padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;
    transition: transform 0.2s;
}
.btn-submit:active { transform: scale(0.98); }

.uppercase { text-transform: uppercase; }

@media (max-width: 600px) {
    .grid-form { grid-template-columns: 1fr 1fr; }
    .form-actions { grid-column: span 2; }
}
</style>
