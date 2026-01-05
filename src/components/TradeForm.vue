<template>
  <div class="card">
    <h3>Add / Edit Transaction</h3>
    <div class="form">
      <div class="group">
        <label>Date</label>
        <input type="date" v-model="form.txn_date">
      </div>
      <div class="group">
        <label>Symbol</label>
        <input v-model="form.symbol" placeholder="e.g. AAPL">
      </div>
      <div class="group">
        <label>Type</label>
        <select v-model="form.txn_type">
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
          <option value="DIV">DIV</option>
        </select>
      </div>
      <div class="group">
        <label>Qty</label>
        <input type="number" v-model="form.qty" step="any">
      </div>
      <div class="group">
        <label>Price</label>
        <input type="number" v-model="form.price" step="any">
      </div>
      <div class="group">
        <label>Fee</label>
        <input type="number" v-model="form.fee" step="any">
      </div>
      <button class="btn-submit" @click="submit" :disabled="loading">
        {{ loading ? 'Saving...' : 'Submit' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { CONFIG } from '../config';

const auth = useAuthStore();
const portfolio = usePortfolioStore();
const loading = ref(false);

const form = reactive({
  txn_date: new Date().toISOString().split('T')[0],
  symbol: '',
  txn_type: 'BUY',
  qty: '',
  price: '',
  fee: 0
});

const submit = async () => {
  if(!form.symbol || !form.qty || !form.price) return alert("Missing fields");
  
  loading.value = true;
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    if(json.success) {
      alert("Success");
      portfolio.fetchRecords();
      // Reset critical fields
      form.qty = ''; form.price = '';
    } else {
      alert("Error: " + json.error);
    }
  } catch(e) { alert("Network Error"); }
  finally { loading.value = false; }
};
</script>

<style scoped>
.form { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; align-items: end; }
.group { display: flex; flex-direction: column; gap: 5px; }
input, select { background: #25252a; border: 1px solid #444; color: white; padding: 8px; border-radius: 4px; }
.btn-submit { background: #00e676; border: none; padding: 10px; border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; }
.btn-submit:disabled { opacity: 0.5; }
</style>
