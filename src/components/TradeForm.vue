<template>
  <div class="card trade-panel" id="trade-form-anchor">
    <h3 class="panel-title">{{ isEditing ? '編輯交易' : '快速下單' }}</h3>
    
    <!-- 🎯 iOS 風格 segmented control -->
    <div class="trade-type-switch">
        <button v-for="t in ['BUY', 'SELL', 'DIV']" :key="t"
            :class="['switch-btn', t.toLowerCase(), { active: form.txn_type === t }]"
            @click="setTxnType(t)">
            <span class="switch-icon">{{ t === 'BUY' ? '📈' : t === 'SELL' ? '📉' : '💵' }}</span>
            <span class="switch-label">{{ t === 'BUY' ? '買進' : t === 'SELL' ? '賣出' : '股息' }}</span>
        </button>
    </div>

    <div class="form-grid">
        <!-- 🎯 交易標的 -->
        <div class="form-group full">
            <label class="form-label">交易標的</label>
            <input 
                type="text" 
                v-model="form.symbol" 
                @change="checkHoldings" 
                placeholder="輸入代碼 (如 NVDA)" 
                :disabled="isEditing" 
                class="input-field input-lg uppercase"
            >
        </div>
        
        <!-- 🏷️ 策略標籤 -->
        <div class="form-group full">
            <label class="form-label">策略標籤 (Groups)</label>
            
            <!-- 智能賣出提示 -->
            <div v-if="form.txn_type === 'SELL' && holdingGroups.length > 0" class="smart-sell-alert">
                <div class="alert-header">
                    <span class="alert-icon">⚠️</span>
                    <span class="alert-text">此標的目前持倉於以下群組，請勾選要賣出的部位：</span>
                </div>
                <div class="checkbox-group">
                    <label v-for="g in holdingGroups" :key="g" class="tag-checkbox">
                        <input type="checkbox" :value="g" v-model="selectedSellGroups" @change="updateTagsFromCheckboxes">
                        <span class="tag-name">{{ g }}</span>
                    </label>
                </div>
            </div>
            
            <!-- 標籤輸入 -->
            <div class="tag-input-container" :class="{ disabled: form.txn_type === 'SELL' && holdingGroups.length > 0 }">
                <div class="tags-list">
                    <span v-for="(tag, idx) in tagsArray" :key="idx" class="tag-chip">
                        {{ tag }}
                        <span class="remove-tag" @click="removeTag(idx)">×</span>
                    </span>
                    <input 
                        type="text" 
                        v-model="tagInput" 
                        @keydown.enter.prevent="addTag"
                        @keydown.tab.prevent="addTag"
                        @blur="addTag"
                        placeholder="輸入標籤後按 Enter..."
                        class="tag-input-field"
                        :disabled="form.txn_type === 'SELL' && holdingGroups.length > 0"
                    >
                </div>
            </div>
            
            <!-- 快速標籤 -->
            <div class="quick-tags" v-if="form.txn_type !== 'SELL' || holdingGroups.length === 0">
                <span v-for="t in commonTags" :key="t" @click="pushTag(t)" class="quick-tag">{{ t }}</span>
            </div>
        </div>
        
        <!-- 📅 日期與價格 -->
        <div class="form-group">
            <label class="form-label">日期</label>
            <input type="date" v-model="form.txn_date" class="input-field">
        </div>
        
        <div class="form-group">
            <label class="form-label">成交單價 (USD)</label>
            <input 
                type="number" 
                v-model="form.price" 
                placeholder="0.00" 
                class="input-field" 
                step="0.0001"
            >
        </div>

        <!-- 📊 股數 -->
        <div class="form-group full">
            <label class="form-label">股數</label>
            <input 
                type="number" 
                v-model="form.qty" 
                @input="calcPriceFromInputs" 
                placeholder="0" 
                class="input-field" 
                step="0.0001"
            >
        </div>

        <!-- 💸 費用 -->
        <div class="form-group">
            <label class="form-label">手續費 (Fee)</label>
            <input 
                type="number" 
                v-model="form.fee" 
                @input="calcPriceFromInputs" 
                placeholder="0.00" 
                class="input-field"
                step="0.01"
            >
        </div>
        
        <div class="form-group">
            <label class="form-label">稅金 (Tax)</label>
            <input 
                type="number" 
                v-model="form.tax" 
                @input="calcPriceFromInputs" 
                placeholder="0.00" 
                class="input-field"
                step="0.01"
            >
        </div>
    </div>

    <!-- 💰 總金額區域 -->
    <div class="summary-section">
        <div class="summary-row">
            <span class="summary-label">交易總金額</span>
            <div class="summary-value-wrapper">
                <span class="summary-currency">USD</span>
                <input 
                    type="number" 
                    v-model="form.total_amount" 
                    @input="calcPriceFromInputs" 
                    class="summary-value" 
                    step="0.01" 
                    placeholder="0.00"
                >
            </div>
        </div>
    </div>
    
    <!-- 🚀 動作按鈕 -->
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-secondary">
            <span class="btn-icon">✕</span>
            <span class="btn-text">取消</span>
        </button>
        <button 
            class="btn btn-primary" 
            @click="submit" 
            :disabled="loading" 
            :class="form.txn_type.toLowerCase()"
        >
            <span class="btn-icon" v-if="!loading">{{ form.txn_type === 'BUY' ? '👑' : form.txn_type === 'SELL' ? '✨' : '🎁' }}</span>
            <span class="btn-icon" v-else>⏳</span>
            <span class="btn-text">{{ loading ? '處理中...' : (isEditing ? '更新記錄' : '送出委託') }}</span>
        </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();
const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

const tagInput = ref('');
const selectedSellGroups = ref([]);
const holdingGroups = ref([]);

const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '', 
    txn_type: 'BUY', 
    qty: '', 
    price: '', 
    fee: 0, 
    tax: 0, 
    total_amount: '',
    tag: '' 
});

const tagsArray = computed(() => {
    return (form.tag || '').split(/[,;]/).map(t=>t.trim()).filter(t=>t);
});

const commonTags = computed(() => {
    return store.availableGroups.filter(g => g !== 'all' && !tagsArray.value.includes(g));
});

const checkHoldings = () => {
    if (form.txn_type === 'SELL' && form.symbol) {
        holdingGroups.value = store.getGroupsWithHolding(form.symbol.toUpperCase());
        selectedSellGroups.value = [];
        if (isEditing.value) {
            const currentTags = (form.tag || '').split(',').map(t=>t.trim());
            selectedSellGroups.value = holdingGroups.value.filter(g => currentTags.includes(g));
        }
    } else {
        holdingGroups.value = [];
    }
};

const updateTagsFromCheckboxes = () => {
    form.tag = selectedSellGroups.value.join(', ');
};

const addTag = () => {
    const val = tagInput.value.trim();
    if (val && !tagsArray.value.includes(val)) {
        const newTags = [...tagsArray.value, val];
        form.tag = newTags.join(', ');
    }
    tagInput.value = '';
};

const removeTag = (index) => {
    const newTags = [...tagsArray.value];
    newTags.splice(index, 1);
    form.tag = newTags.join(', ');
    if (holdingGroups.value.length > 0) {
        selectedSellGroups.value = newTags.filter(t => holdingGroups.value.includes(t));
    }
};

const pushTag = (t) => {
    if (!tagsArray.value.includes(t)) {
        const newTags = [...tagsArray.value, t];
        form.tag = newTags.join(', ');
    }
};

watch(() => form.txn_type, () => checkHoldings());

const setTxnType = (type) => { 
    form.txn_type = type;
    checkHoldings();
};

const calcPriceFromInputs = () => {
    const qty = parseFloat(form.qty) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const fee = parseFloat(form.fee) || 0;
    const tax = parseFloat(form.tax) || 0;
    if (qty <= 0 || total <= 0) return;
    let avgCost = 0;
    if (form.txn_type === 'BUY') { avgCost = (total + fee + tax) / qty; } 
    else if (form.txn_type === 'SELL') { avgCost = (total - fee - tax) / qty; } 
    else { avgCost = (total - tax) / qty; }
    form.price = parseFloat(avgCost.toFixed(4));
};

const submit = async () => {
    if (!form.symbol || !form.qty || !form.price) { 
        addToast("請填寫完整資料", "error"); 
        return; 
    }
    
    if (form.txn_type === 'SELL' && holdingGroups.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請勾選要賣出的群組", "error");
        return;
    }
    
    if (!auth.token || auth.isTokenExpired()) {
        addToast("登入已過期，請重新登入", "error");
        setTimeout(() => auth.logout(), 2000);
        return;
    }
    
    loading.value = true;
    try {
        const payload = { ...form };
        ['qty', 'price', 'fee', 'tax', 'total_amount'].forEach(k => payload[k] = parseFloat(payload[k] || 0));
        
        let success = false;
        if (isEditing.value) {
            payload.id = editingId.value;
            success = await store.updateRecord(payload);
        } else {
            success = await store.addRecord(payload);
        }
        
        if (success) {
            resetForm(); 
        }
    } catch(e) { 
        console.error('❌ 提交錯誤:', e);
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
    form.tag = ''; 
    form.txn_type = 'BUY';
    holdingGroups.value = [];
    selectedSellGroups.value = [];
    tagInput.value = '';
};

const setupForm = (r) => {
    isEditing.value = true; 
    editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
    checkHoldings();
};

defineExpose({ setupForm });
</script>

<style scoped>
/* ========================================
   🎯 全局規範
   ======================================== */
.trade-panel {
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
    background: var(--bg-card);
    padding: 24px;
    position: relative;
}

.panel-title {
    margin: 0 0 20px 0;
    font-size: 1.25rem;
    color: var(--text-main);
    font-weight: 700;
    letter-spacing: -0.01em;
}

/* ========================================
   🎯 iOS 風格 Segmented Control
   ======================================== */
.trade-type-switch {
    display: flex;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 10px;
    margin-bottom: 24px;
    gap: 4px;
}

.switch-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 8px;
    font-weight: 500;
    color: var(--text-sub);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
}

.switch-btn.active {
    background: var(--bg-card);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
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

.switch-icon {
    font-size: 1.1rem;
}

.switch-label {
    font-size: 0.95rem;
}

/* ========================================
   📋 表單佈局
   ======================================== */
.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group.full {
    grid-column: span 2;
}

.form-label {
    font-size: 0.8rem;
    color: var(--text-sub);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.input-field {
    padding: 12px 14px;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    font-size: 1rem;
    font-family: 'JetBrains Mono', monospace;
    transition: all 0.2s ease;
    color: var(--text-main);
    background: var(--bg-card);
    min-height: 44px;
}

.input-field::placeholder {
    color: var(--text-sub);
    opacity: 0.6;
}

.input-field:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-field:disabled {
    background: var(--bg-secondary);
    cursor: not-allowed;
    opacity: 0.7;
}

.input-lg {
    font-size: 1.1rem;
    font-weight: 600;
}

.uppercase {
    text-transform: uppercase;
}

/* ========================================
   🏷️ 標籤輸入
   ======================================== */
.smart-sell-alert {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03));
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-left: 4px solid var(--warning);
    padding: 12px;
    border-radius: 10px;
    margin-bottom: 12px;
}

.alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.alert-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
}

.alert-text {
    font-size: 0.85rem;
    color: var(--warning);
    font-weight: 600;
    line-height: 1.4;
}

.checkbox-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.tag-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 6px 10px;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
    min-height: 36px;
}

.tag-checkbox:hover {
    background: var(--bg-secondary);
    border-color: var(--warning);
}

.tag-checkbox input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
    margin: 0;
}

.tag-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-main);
}

.tag-input-container {
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 8px;
    background: var(--bg-card);
    min-height: 44px;
    transition: all 0.2s ease;
}

.tag-input-container:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.tag-input-container.disabled {
    opacity: 0.6;
    pointer-events: none;
    background: var(--bg-secondary);
}

.tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    align-items: center;
}

.tag-chip {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08));
    color: var(--primary);
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(59, 130, 246, 0.2);
    transition: all 0.2s ease;
}

.tag-chip:hover {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.12));
}

.remove-tag {
    cursor: pointer;
    opacity: 0.6;
    font-weight: 700;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.2s ease;
}

.remove-tag:hover {
    opacity: 1;
    color: var(--danger);
    transform: scale(1.2);
}

.tag-input-field {
    border: none;
    outline: none;
    background: transparent;
    flex: 1;
    min-width: 120px;
    padding: 6px 4px;
    color: var(--text-main);
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
}

.quick-tags {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.quick-tag {
    font-size: 0.8rem;
    color: var(--text-sub);
    border: 1px solid var(--border-color);
    padding: 4px 10px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
}

.quick-tag:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(59, 130, 246, 0.05);
    transform: translateY(-1px);
}

/* ========================================
   💰 總金額區域
   ======================================== */
.summary-section {
    background: linear-gradient(135deg, 
        rgba(59, 130, 246, 0.05) 0%, 
        rgba(59, 130, 246, 0.02) 100%);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.summary-label {
    font-size: 0.85rem;
    color: var(--text-sub);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.summary-value-wrapper {
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.summary-currency {
    font-size: 0.9rem;
    color: var(--text-sub);
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
}

.summary-value {
    background: transparent;
    border: none;
    text-align: right;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--primary);
    font-family: 'JetBrains Mono', monospace;
    padding: 0;
    width: auto;
    min-width: 120px;
}

.summary-value:focus {
    outline: none;
    box-shadow: none;
}

/* ========================================
   🚀 動作按鈕
   ======================================== */
.action-buttons {
    display: flex;
    gap: 12px;
}

.btn {
    flex: 1;
    padding: 14px 16px;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 1rem;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
}

.btn-icon {
    font-size: 1.2rem;
}

.btn-text {
    font-size: 0.95rem;
}

.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-sub);
    border: 1px solid var(--border-color);
}

.btn-secondary:hover {
    background: var(--border-color);
    color: var(--text-main);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.btn-primary {
    color: white;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary.buy {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary.sell {
    background: linear-gradient(135deg, var(--success), var(--success-light));
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-primary.div {
    background: linear-gradient(135deg, var(--warning), var(--warning-light));
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

.btn-primary:active:not(:disabled) {
    transform: translateY(0);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    filter: grayscale(0.3);
}

/* ========================================
   📱 手機端優化 (不影響桌面)
   ======================================== */

@media (max-width: 768px) {
    .trade-panel {
        padding: 20px 16px;
        padding-bottom: 24px;
    }
    
    .panel-title {
        font-size: 1.15rem;
        margin-bottom: 16px;
    }
    
    /* 🎯 Segmented Control 縮小 */
    .trade-type-switch {
        margin-bottom: 20px;
        padding: 3px;
        border-radius: 10px;
    }
    
    .switch-btn {
        padding: 8px 6px;
        min-height: 38px;
        font-size: 0.9rem;
    }
    
    .switch-icon {
        font-size: 1rem;
    }
    
    .switch-label {
        font-size: 0.85rem;
    }
    
    /* 📋 表單佈局 */
    .form-grid {
        gap: 16px;
        margin-bottom: 16px;
    }
    
    .form-label {
        font-size: 0.75rem;
    }
    
    .input-field {
        padding: 12px;
        font-size: 0.95rem;
    }
    
    /* 🏷️ 標籤 */
    .tag-chip {
        font-size: 0.8rem;
        padding: 5px 8px;
    }
    
    .quick-tag {
        font-size: 0.75rem;
        padding: 4px 8px;
    }
    
    /* 💰 總金額 */
    .summary-section {
        padding: 14px;
        margin-bottom: 16px;
    }
    
    .summary-label {
        font-size: 0.75rem;
    }
    
    .summary-value {
        font-size: 1.4rem;
        min-width: 100px;
    }
    
    /* 🚀 按鈕 */
    .action-buttons {
        gap: 10px;
    }
    
    .btn {
        padding: 13px 14px;
        min-height: 46px;
        font-size: 0.95rem;
    }
    
    .btn-icon {
        font-size: 1.1rem;
    }
    
    .btn-text {
        font-size: 0.9rem;
    }
}

/* 👍 極小手機 */
@media (max-width: 480px) {
    .trade-panel {
        padding: 16px 14px;
        padding-bottom: 20px;
    }
    
    .panel-title {
        font-size: 1.1rem;
        margin-bottom: 14px;
    }
    
    .switch-btn {
        padding: 8px 4px;
        min-height: 36px;
        gap: 4px;
    }
    
    .switch-icon {
        font-size: 0.95rem;
    }
    
    .switch-label {
        font-size: 0.8rem;
    }
    
    .form-grid {
        gap: 14px;
    }
    
    .input-field {
        padding: 11px;
        font-size: 0.9rem;
    }
    
    .summary-value {
        font-size: 1.3rem;
    }
    
    .btn {
        min-height: 44px;
        font-size: 0.9rem;
    }
}

/* 觸控優化 */
@media (hover: none) and (pointer: coarse) {
    .btn:hover {
        transform: none;
    }
    
    .btn:active:not(:disabled) {
        transform: scale(0.98);
        opacity: 0.95;
    }
    
    .quick-tag:hover {
        transform: none;
    }
    
    .quick-tag:active {
        transform: scale(0.95);
    }
}
</style>