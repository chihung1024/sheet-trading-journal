<template>
  <div class="card recent-activity">
    <div class="header">
        <h3>近期動態</h3>
        <button class="btn-refresh" @click="store.fetchRecords">↺</button>
    </div>

    <div class="activity-list">
        <div v-if="filteredRecords.length === 0" class="empty">尚無交易紀錄</div>
        
        <div v-for="r in filteredRecords.slice(0, 8)" :key="r.id" class="activity-item">
            <div class="item-left">
                <div class="date-badge">
                    <span class="month">{{ getMonth(r.txn_date) }}</span>
                    <span class="day">{{ getDay(r.txn_date) }}</span>
                </div>
            </div>
            <div class="item-main">
                <div class="row-top">
                    <span class="symbol">{{ r.symbol }}</span>
                    <span class="type-tag" :class="r.txn_type.toLowerCase()">{{ r.txn_type }}</span>
                </div>
                <div class="row-btm">
                    {{ r.qty }} 股 @ {{ formatNumber(r.price) }}
                </div>
            </div>
            <div class="item-right">
                <div class="amount">{{ formatNumber(r.total_amount) }}</div>
                <div class="actions">
                    <button @click="$emit('edit', r)">✎</button>
                    <button @click="del(r.id)" class="del">×</button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const { addToast } = useToast();

const filteredRecords = computed(() => {
    return [...store.records].sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));
});

const formatNumber = (num) => Number(num).toLocaleString('en-US');
const getMonth = (d) => new Date(d).toLocaleString('en-US', { month: 'short' });
const getDay = (d) => new Date(d).getDate();

const del = async (id) => {
    if(!confirm("刪除此紀錄?")) return;
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        addToast("刪除成功", "success"); store.fetchRecords();
    } catch(e) { addToast("錯誤", "error"); }
};
</script>

<style scoped>
.recent-activity { padding: 0; overflow: hidden; border: none; background: transparent; box-shadow: none; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 0 4px 16px 4px; border-bottom: 2px solid var(--border-color); margin-bottom: 12px; }
.header h3 { font-size: 1rem; margin: 0; border: none; padding: 0; color: var(--text-sub); text-transform: uppercase; letter-spacing: 1px; }
.btn-refresh { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-sub); padding: 0; }
.btn-refresh:hover { color: var(--primary); }

.activity-list { display: flex; flex-direction: column; gap: 12px; }
.activity-item { 
    background: #fff; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); 
    display: flex; align-items: center; gap: 12px; transition: transform 0.1s;
}
.activity-item:hover { transform: translateX(2px); border-color: var(--primary); }

.date-badge { 
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #f1f5f9; width: 44px; height: 44px; border-radius: 8px; 
    font-size: 0.75rem; color: var(--text-sub); font-weight: 600; line-height: 1.1;
}
.day { font-size: 1rem; color: var(--text-main); font-weight: 700; }

.item-main { flex: 1; }
.row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.symbol { font-weight: 700; font-size: 1rem; }
.type-tag { font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
.type-tag.buy { color: var(--primary); background: #eff6ff; }
.type-tag.sell { color: var(--success); background: #ecfdf5; }
.type-tag.div { color: #d97706; background: #fff7ed; }
.row-btm { font-size: 0.8rem; color: var(--text-sub); }

.item-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.amount { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 0.95rem; }
.actions { display: flex; gap: 8px; opacity: 0; transition: opacity 0.2s; }
.activity-item:hover .actions { opacity: 1; }
.actions button { border: none; background: none; cursor: pointer; color: var(--text-sub); font-size: 0.9rem; padding: 0; }
.actions button:hover { color: var(--primary); }
.actions button.del:hover { color: var(--danger); }

.empty { text-align: center; padding: 20px; color: var(--text-sub); font-size: 0.9rem; }
</style>
