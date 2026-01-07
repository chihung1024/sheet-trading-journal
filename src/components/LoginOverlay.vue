<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="login-header">
        <div class="app-icon">📊</div>
        <h1>交易日誌</h1>
        <p>股票交易組合管理系統</p>
        <p class="subtitle">使用 Google 帳號登入</p>
      </div>
      <div ref="googleBtn" class="google-button-container"></div>
      <div class="login-footer">
        <p class="footer-text">🔒 使用 Google OAuth 安全認證</p>
      </div>
    </div>
    <!-- 背景動畫 -->
    <div class="background-animation" aria-hidden="true">
      <div
        v-for="i in 6"
        :key="i"
        class="float-shape"
        :style="{ '--index': i }"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();

onMounted(() => {
  // 定義全域 callback 供 Google Script 呼叫
  window.handleCredentialResponse = (response) => {
    authStore.login(response.credential);
  };

  if (window.google) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false
    });
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { theme: "filled_black", size: "large", width: 300 }
    );
  }
});
</script>

<style scoped>
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overflow: hidden;
}

.background-animation {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  opacity: 0.05;
}

.float-shape {
  position: absolute;
  width: 200px;
  height: 200px;
  background: var(--primary);
  border-radius: 50%;
  animation: float 20s infinite ease-in-out;
  animation-delay: calc(var(--index) * 3s);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) translateX(0px);
  }
  25% {
    transform: translateY(-50px) translateX(50px);
  }
  50% {
    transform: translateY(-100px) translateX(0px);
  }
  75% {
    transform: translateY(-50px) translateX(-50px);
  }
}

.login-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  max-width: 450px;
  width: 90%;
  box-shadow: var(--shadow-xl);
  animation: slideInUp 500ms var(--easing-ease-out);
  position: relative;
  z-index: 1;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--space-lg);
    max-width: 100%;
    margin: 0 16px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.app-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.login-header h1 {
  font-size: 2rem;
  margin: 0 0 8px 0;
  color: var(--text);
  font-weight: 700;
  letter-spacing: -0.5px;
}

.login-header p {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 8px 0 0 0;
}

.login-header .subtitle {
  font-size: 0.9rem;
  color: var(--primary);
  margin-top: 12px;
  font-weight: 500;
}

.google-button-container {
  display: flex;
  justify-content: center;
  margin: var(--space-xl) 0;
}

.google-button-container :deep(> div) {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.login-footer {
  text-align: center;
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.footer-text {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0;
}

:root {
  --primary: #1f6efb;
  --bg: #0f0f0f;
  --card-bg: #1a1a1a;
  --border: #333;
  --text: #fff;
  --text-muted: #999;
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  --radius-xl: 16px;
  --radius-lg: 12px;
  --space-2xl: 32px;
  --space-xl: 24px;
  --space-lg: 16px;
  --space-md: 12px;
  --easing-ease-out: cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
