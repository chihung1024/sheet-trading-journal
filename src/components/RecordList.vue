<template>
  <div class="card">
    <div style="display:flex; justify-content:space-between">
      <h3>History</h3>
      <button @click="store.fetchRecords" style="background:none; border:none; color:#2979ff; cursor:pointer">Refresh</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Symbol</th>
          <th>Type</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in store.records" :key="r.id">
          <td>{{ r.txn_date }}</td>
          <td>{{ r.symbol }}</td>
          <td>{{ r.txn_type }}</td>
          <td>{{ r.qty }}</td>
          <td>{{ r.price }}</td>
          <td>
            <button @click="del(r.id)" class="btn-del">Del</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const store = usePortfolioStore();
const auth = useAuthStore();

const del = async (id) => {
  if(!confirm("Delete?")) return;
  await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  store.fetchRecords();
};
</script>

<style scoped>
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
.btn-del { background: #3c1f1f; color: #ff5252; border: 1px solid #ff5252; border-radius: 4px; cursor: pointer; }
</style>
