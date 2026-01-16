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
            <input type="text" v-model="form.symbol" @change="checkHoldings" placeholder="代碼" :disabled="isEditing" class="uppercase">
        </div>
        <div class="form-group"><label>日期</label><input type="date" v-model="form.txn_date"></div>
        <div class="form-group"><label>單價</label><input type="number" v-model="form.price" step="0.0001"></div>
        <div class="form-group"><label>股數</label><input type="number" v-model="form.qty" @input="calcPriceFromInputs"></div>
        <div class="form-group">
            <label>費用 (Fee/Tax)</label>
            <div class="dual-input">
                <input type="number" v-model="form.fee" @input="calcPriceFromInputs" placeholder="手續費">
                <input type="number" v-model="form.tax" @input="calcPriceFromInputs" placeholder="稅金">
            </div>
        </div>

        <div class="form-group full">
            <label>策略群組 (Tags)</label>
            
            <div v-if="form.txn_type === 'SELL' && holdingDistribution.length > 0" class="smart-sell-panel">
                <p class="hint">⚠️ 請勾選要賣出的群組視圖：</p>
                <div class="pos-list">
                    <label v-for="pos in holdingDistribution" :key="pos.group" class="pos-item">
                        <input type="checkbox" :value="pos.group" v-model="selectedSellGroups" @change="updateTags">
                        <span>{{ pos.group }} ({{ pos.qty }}股)</span>
                    </label>
                </div>
            </div>

            <div v-else class="tag-input-area">
                <div class="tags"><span v-for="t in tagsArray" :key="t" class="tag">{{t}} <b @click="removeTag(t)">x</b></span></div>
                <input v-model="tagInput" @keydown.enter.prevent="addTag" placeholder="輸入標籤...">
            </div>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-label">總金額</div>
        <input type="number" v-model="form.total_amount" @input="calcPriceFromInputs" class="summary-value">
    </div>
    <div class="action-buttons">
        <button v-if="isEditing" @click="resetForm" class="btn btn-cancel">取消</button>
        <button class="btn btn-submit" @click="submit" :disabled="loading">{{ loading?'...':'送出' }}</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config'; // 需要 import CONFIG 來發送 API

const store = usePortfolioStore();
const { addToast } = useToast(); // 修正 addToast 引用
// ... (保留 loading, isEditing 等狀態)
const loading = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

// Form Data (需包含 tag)
const form = reactive({
    txn_date: new Date().toISOString().split('T')[0],
    symbol: '', txn_type: 'BUY', qty: '', price: '', fee: 0, tax: 0, total_amount: '',
    tag: '' 
});

// Smart Sell State
const selectedSellGroups = ref([]);
const holdingDistribution = ref([]);
const tagInput = ref('');

const tagsArray = computed(() => form.tag ? form.tag.split(',').map(t=>t.trim()).filter(t=>t) : []);

// Logic: Check Holdings
const checkHoldings = () => {
    if(form.txn_type === 'SELL' && form.symbol) {
        holdingDistribution.value = store.getHoldingDistribution(form.symbol);
        if(isEditing.value) {
            // 回填邏輯
            selectedSellGroups.value = tagsArray.value.filter(t => holdingDistribution.value.some(h=>h.group===t));
        } else {
            selectedSellGroups.value = [];
            form.tag = '';
        }
    } else {
        holdingDistribution.value = [];
    }
};

const updateTags = () => { form.tag = selectedSellGroups.value.join(', '); };
const addTag = () => { if(tagInput.value) { form.tag = [...tagsArray.value, tagInput.value].join(', '); tagInput.value=''; } };
const removeTag = (t) => { form.tag = tagsArray.value.filter(x=>x!==t).join(', '); };

watch(() => form.txn_type, checkHoldings);

// 保留原有的 calcPriceFromInputs
const calcPriceFromInputs = () => { /* ...原代碼... */ };
const setTxnType = (t) => { form.txn_type = t; };

const submit = async () => {
    // 驗證
    if(form.txn_type === 'SELL' && holdingDistribution.value.length > 0 && selectedSellGroups.value.length === 0) {
        addToast("請勾選賣出群組", "error"); return;
    }
    // ... 原有的 submit 邏輯 ...
    // 記得將 form 轉為 payload 送出
};

// ... resetForm, setupForm (記得加上 checkHoldings())
const setupForm = (r) => {
    isEditing.value = true; editingId.value = r.id;
    Object.keys(form).forEach(k => form[k] = r[k]);
    checkHoldings();
};
defineExpose({ setupForm });
</script>

<style scoped>
/* 補上 Smart Sell 的樣式 */
.smart-sell-panel { background: #fffbeb; padding: 10px; border: 1px solid #fcd34d; border-radius: 8px; }
.pos-item { display: block; margin: 4px 0; }
.tag { background: #e0f2fe; padding: 2px 8px; border-radius: 12px; margin-right: 4px; display: inline-block; }
</style>
