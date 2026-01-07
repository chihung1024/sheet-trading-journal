<template>
  <div class="header-bar">
    <div>
      <h2 style="margin:0">Dashboard <span style="font-size:0.8rem; color:#666">Pro Plus</span></h2>
      <small style="color:var(--text-muted)">最後更新: {{ portfolioStore.lastUpdate || 'N/A' }}</small>
    </div>
    <div class="user-info">
      <div class="avatar">{{ authStore.user.name ? authStore.user.name.charAt(0).toUpperCase() : 'U' }}</div>
      <span>{{ authStore.user.name }}</span>
      <button @click="authStore.logout" class="btn btn-outline btn-sm">登出</button>
      <button @click="portfolioStore.triggerUpdate" class="btn btn-primary btn-sm">
        刷新報價
      </button>
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
.header-bar { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 20px; 
    border-bottom: 1px solid var(--border); 
    padding-bottom: 15px; 
}
.user-info { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    font-size: 0.9rem; 
}
.avatar { 
    width: 32px; 
    height: 32px; 
    background: var(--primary); 
    border-radius: 50%; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    color: white; 
    font-weight: bold; 
}
</style>
