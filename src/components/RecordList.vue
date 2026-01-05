<template>
  <div class="card">
    <div class="flex-row">
        <h3>最近交易紀錄 (API)</h3>
        <button class="btn btn-outline btn-sm" @click="store.fetchRecords">重新整理</button>
    </div>
    <table v-if="store.records.length > 0">
        <thead>
            <tr>
                <th>日期</th>
                <th>代碼</th>
                <th>動作</th>
                <th>股數</th>
                <th>價格</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="r in store.records" :key="r.id">
                <td>{{ r.txn_date }}</td>
                <td>{{ r.symbol }}</td>
                <td>
                    <span :class="getTypeColor(r.txn_type)">
                        {{ r.txn_type }}
                    </span>
                </td>
                <td>{{ r.qty }}</td>
                <td>{{ r.price }}</td>
                <td>
                    <button class="btn btn-outline btn-sm" @click="$emit('edit', r)">修</button>
                    <button class="btn btn-danger btn-sm" @click="del(r.id)" style="margin-left:5px">刪</button>
                </td>
            </tr>
        </tbody>
    </table>
    <div v-else class="empty">無交易紀錄</div>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();
const emit = defineEmits(['edit']);

const getTypeColor = (t) => {
    if (t === 'BUY') return 'text-red';
    if (t === 'SELL') return 'text-green';
    return 'text-yellow';
};

const del = async (id) => {
    if(!confirm("確定要刪除嗎?")) return;
    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        store.fetchRecords();
    } catch(e) { alert("刪除失敗"); }
};
</script>

<style scoped>
.empty { text-align: center; padding: 20px; color: #666; }
.flex-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
</style>
