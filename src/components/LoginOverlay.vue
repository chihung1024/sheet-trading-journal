<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="icon">📊</div>
      <h2>Trading Journal</h2>
      <p>請登入 Google 帳號以存取您的投資組合</p>
      
      <button class="btn-google" @click="authStore.login">
        <span class="g-icon">G</span>
        使用 Google 帳號登入
      </button>

      <div class="footer-help">
         <small>安全且私密的登入方式</small>
      </div>
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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
}

.login-card {
    background: white;
    padding: 40px;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 380px;
    text-align: center;
    border: 1px solid #e5e7eb;
}

.icon {
    font-size: 3rem;
    margin-bottom: 16px;
    display: block;
}

h2 {
    margin: 0 0 8px;
    color: #111827;
    font-size: 1.5rem;
    font-weight: 700;
}

p {
    color: #6b7280;
    margin-bottom: 32px;
    font-size: 0.95rem;
}

.btn-google {
    width: 100%;
    padding: 12px;
    background-color: #ffffff;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 48px; /* 手機觸控友善 */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.btn-google:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
}

.g-icon {
    font-weight: bold;
    color: #4285F4;
    font-family: serif; /* 模擬 Google Logo 風格 */
    font-size: 1.2rem;
}

.footer-help {
    margin-top: 24px;
    color: #9ca3af;
    font-size: 0.8rem;
}

/* 手機版優化：防止鍵盤或工具列遮擋 */
@media (max-width: 480px) {
    .login-overlay {
        align-items: center; /* 保持置中 */
    }
    .login-card {
        padding: 30px 20px;
    }
}
</style>
