<template>
  <div class="card dividend-manager">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">💰 待確認配息</h3>
        <span v-if="currentGroupId !== 'ALL'" class="group-badge" :style="{ color: currentGroupColor, borderColor: currentGroupColor }">
            {{ currentGroupName }}
        </span>
      </div>
      
      <div class="header-right">
        <span class="stat-text" v-if="pendingDividends.length > 0">
           共 {{ pendingDividends.length }} 筆待入帳
           <span class="total-amount">(約 {{ formatCurrency(totalPendingAmountTWD) }} TWD)</span>
        </span>
      </div>
    </div>

    <div class="dividend-list">
      <div v-if="pendingDividends.length === 0" class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>目前沒有待確認的配息</p>
        <small v-if="currentGroupId !== 'ALL'">
            (僅顯示 {{ currentGroupName }} 群組的配息)
        </small>
        <small v-else>系統會自動根據持倉偵測除息日</small>
      </div>

      <div 
        v-for="(div, index) in pendingDividends" 
        :key="index" 
        class="dividend-item"
      >
        <div class="div-date">
          <span class="month">{{ getMonth(div.ex_date) }}</span>
          <span class="day">{{ getDay(div.ex_date) }}</span>
          <span class="year">{{ getYear(div.ex_date) }}</span>
        </div>

        <div class="div-info">
          <div class="div-header">
            <span class="symbol">{{ div.symbol }}</span>
            <span class="share-info">{{ formatNumber(div.shares_held) }} 股 × ${{ div.dividend_per_share_gross }}</span>
          </div>
          <div class="div-meta">
            預估發放日: {{ div.pay_date || 'N/A' }}
          </div>
        </div>

        <div class="div-amounts">
            <div class="amount-row">
                <span class="label">稅前</span>
                <span class="val">{{ formatCurrency(div.total_gross, 'USD') }}</span>
            </div>
            <div class="amount-row net">
                <span class="label">稅後 (30%)</span>
                <span class="val highlight">{{ formatCurrency(div.total_net_usd, 'USD') }}</span>
            </div>
             <div class="amount-row twd">
                <span class="label">約合台幣</span>
                <span class="val">{{ formatCurrency(div.total_net_twd, 'TWD') }}</span>
            </div>
        </div>

        <div class="div-actions">
          <button class="btn-confirm" @click="confirmDividend(div)" :disabled="isProcessing">
            <span class="icon">✓</span> 確認入帳
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { createTransaction } from '../js/api';

const store = usePortfolioStore();
const toast = useToast();
const isProcessing = ref(false);

// --- Phase 2: 群組連動 ---
// 自動從 Store 取得「當前群組」的待確認配息
const pendingDividends = computed(() => store.pendingDividends || []);

const currentGroupId = computed(() => store.currentGroupId);
const currentGroupName = computed(() => {
    const group = store.availableGroups.find(g => g.id === currentGroupId.value);
    return group ? group.name : currentGroupId.value;
});
const currentGroupColor = computed(() => {
    const group = store.availableGroups.find(g => g.id === currentGroupId.value);
    return group ? group.color : '#666';
});

const totalPendingAmountTWD = computed(() => {
    return pendingDividends.value.reduce((sum, d) => sum + (d.total_net_twd || 0), 0);
});

// --- 日期格式化 ---
const getYear = (d) => d.split('-')[0];
const getMonth = (d) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(d.split('-')[1]) - 1];
};
const getDay = (d) => d.split('-')[2];

const formatNumber = (val) => Number(val).toLocaleString();
const formatCurrency = (val, currency = '') => {
    const num = Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${currency === 'TWD' ? 'NT$' : '$'}${num}` : num;
};

// --- 核心功能：確認配息 ---
const confirmDividend = async (divData) => {
    if (isProcessing.value) return;
    
    // 防呆確認
    const msg = `確定要將 ${divData.symbol} 的配息 US$${divData.total_net_usd.toFixed(2)} 入帳嗎？\n\n` +
                (currentGroupId.value !== 'ALL' 
                 ? `此紀錄將自動標記為群組: [${currentGroupName.value}]` 
                 : `此紀錄將歸入總帳 (未指定群組)`);
                 
    if (!confirm(msg)) return;

    isProcessing.value = true;
    try {
        // 1. 建構交易物件
        const payload = {
            date: divData.ex_date, // 通常記在除息日或發放日，這邊預設除息日
            type: 'DIV',
            symbol: divData.symbol,
            qty: 0, // 配息不影響持股數，通常記 0 或該批次的持股數(僅供參考)
            price: divData.total_net_usd, // Price 欄位存入「稅後總金額」
            commission: 0,
            tax: 0, // 系統計算時已扣 30%，這裡設 0 避免重複扣
            tag: currentGroupId.value !== 'ALL' ? currentGroupId.value : '' // 【關鍵】自動帶入當前群組
        };

        // 2. 送出 API
        await createTransaction(payload);
        
        toast.success(`${divData.symbol} 配息已入帳`);
        
        // 3. 重新整理 (讓後端重新計算並移除 Pending 狀態)
        await store.triggerUpdate(); 

    } catch (e) {
        console.error(e);
        toast.error('入帳失敗: ' + e.message);
    } finally {
        isProcessing.value = false;
    }
};
</script>

<style scoped>
.dividend-manager {
  display: flex;
  flex-direction: column;
  /* max-height: 500px;  如果需要固定高度可開啟 */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.panel-title {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-main);
  border-left: 4px solid var(--warning, #f59e0b);
  padding-left: 12px;
}

.group-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border: 1px solid currentColor;
    border-radius: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
}

.stat-text {
    font-size: 0.9rem;
    color: var(--text-sub);
}

.total-amount {
    color: var(--text-main);
    font-weight: 600;
    margin-left: 4px;
}

.dividend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-sub);
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.empty-icon { font-size: 2.5rem; margin-bottom: 12px; }

/* 單筆配息卡片 */
.dividend-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s;
}

.dividend-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: var(--primary);
}

/* 日期區塊 */
.div-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  padding: 8px 12px;
  border-radius: 8px;
  min-width: 60px;
}

.month { font-size: 0.75rem; color: var(--text-sub); text-transform: uppercase; font-weight: 700; }
.day { font-size: 1.4rem; font-weight: 700; color: var(--text-main); line-height: 1.1; }
.year { font-size: 0.7rem; color: var(--text-sub); }

/* 資訊區塊 */
.div-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.div-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
}

.symbol { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
.share-info { font-size: 0.9rem; color: var(--text-sub); }

.div-meta {
    font-size: 0.8rem;
    color: var(--text-sub);
    font-family: 'JetBrains Mono', monospace;
}

/* 金額區塊 */
.div-amounts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    min-width: 120px;
}

.amount-row {
    display: flex;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--text-sub);
}

.amount-row.net {
    font-size: 1rem;
    color: var(--text-main);
    font-weight: 600;
}

.amount-row.twd {
    font-size: 0.8rem;
    opacity: 0.8;
}

.val.highlight { color: var(--success); }

/* 按鈕區塊 */
.btn-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-confirm:hover:not(:disabled) {
  background: #059669; /* emerald-600 */
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--text-sub);
}

/* RWD 響應式 */
@media (max-width: 768px) {
    .dividend-item {
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
        gap: 12px;
    }

    .div-amounts {
        grid-column: 2;
        align-items: flex-start;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 4px;
    }
    
    .div-actions {
        grid-column: 1 / -1;
        width: 100%;
    }
    
    .btn-confirm {
        width: 100%;
        justify-content: center;
        padding: 12px;
    }
}
</style>
