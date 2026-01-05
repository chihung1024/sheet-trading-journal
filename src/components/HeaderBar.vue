<template>
  <div class="header">
    <div class="brand">
      <h2>Dashboard <span class="badge">PRO</span></h2>
      <small>Last Update: {{ portfolioStore.lastUpdate }}</small>
    </div>
    <div class="actions">
      <button class="btn btn-primary" @click="portfolioStore.triggerUpdate">
        ⟳ Update Prices
      </button>
      <div class="avatar">{{ authStore.user.name.charAt(0) }}</div>
      <button class="btn btn-outline" @click="authStore.logout">Logout</button>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid #333; margin-bottom: 20px; }
.brand h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
.badge { font-size: 0.7rem; background: #333; padding: 2px 6px; border-radius: 4px; color: #888; }
.brand small { color: #888; }
.actions { display: flex; gap: 10px; align-items: center; }
.avatar { width: 32px; height: 32px; background: #2979ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.btn { padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; color: white; }
.btn-primary { background: #2979ff; }
.btn-outline { background: transparent; border: 1px solid #555; }
</style>
