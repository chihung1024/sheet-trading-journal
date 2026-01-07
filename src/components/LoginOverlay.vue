<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="icon">📈</div>
      <h2>Trading Journal</h2>
      <p>請登入以存取您的投資組合</p>
      
      <button class="btn-google" @click="authStore.login">
        登入 Google 帳號
      </button>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth';
const authStore = useAuthStore();
</script>

<style scoped>
.login-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background-color: #f3f4f6;
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
}
.login-card {
    background: white; padding: 40px; border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;
    width: 90%; max-width: 350px;
}
.icon { font-size: 3rem; margin-bottom: 10px; }
.btn-google {
    background-color: #4285F4; color: white; border: none;
    padding: 12px 24px; border-radius: 6px; font-size: 1rem;
    cursor: pointer; width: 100%; font-weight: 500; margin-top: 10px;
}
.btn-google:hover { background-color: #357ae8; }
</style>
