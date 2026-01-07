<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="icon">📊</div>
      <h2>Trading Journal</h2>
      <p>請輸入您的 API Token 以繼續</p>
      
      <div class="input-group">
        <input 
          type="password" 
          v-model="token" 
          placeholder="Paste API Token here..." 
          @keyup.enter="submit"
        >
      </div>
      
      <button class="btn-login" @click="submit" :disabled="!token">
        登入系統 (Enter)
      </button>

      <div class="footer-help">
         <small>Token 僅儲存於您的瀏覽器</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const token = ref('');
const authStore = useAuthStore();

const submit = () => {
  if (token.value.trim()) {
    authStore.setToken(token.value.trim());
    window.location.reload(); // 重新整理以觸發初始化
  }
};
</script>

<style scoped>
.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #f8f9fa; /* 配合明亮主題 */
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
    max-width: 400px;
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
    margin-bottom: 24px;
    font-size: 0.95rem;
}

.input-group {
    margin-bottom: 20px;
}

input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    transition: all 0.2s;
    background: #f9fafb;
    box-sizing: border-box; /* 關鍵：防止寬度溢出 */
}

input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    background: white;
}

.btn-login {
    width: 100%;
    padding: 12px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    /* 增加觸控友善度 */
    min-height: 48px; 
}

.btn-login:hover:not(:disabled) {
    background-color: #1d4ed8;
}

.btn-login:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
}

.footer-help {
    margin-top: 24px;
    color: #9ca3af;
    font-size: 0.8rem;
}

/* 手機版特別優化 */
@media (max-width: 480px) {
    .login-overlay {
        align-items: flex-start; /* 改為靠上，避免鍵盤遮擋 */
        padding-top: 20vh;
    }
    .login-card {
        padding: 30px 20px;
    }
}
</style>
