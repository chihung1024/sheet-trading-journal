<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="login-header">
        <div class="app-icon">📊</div>
        <h1>交易日誌</h1>
        <p>股票交易組合管理系統</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="password">訪問密碼</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="輸入訪問密碼..."
            class="form-input"
            :class="{ 'input-error': error }"
            @keyup.enter="handleLogin"
            autocomplete="current-password"
          />
          <span v-if="error" class="error-text">{{ error }}</span>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-large"
          :disabled="isLoading"
        >
          <span v-if="!isLoading">進入系統</span>
          <span v-else class="loading-spinner">⟳ 驗證中...</span>
        </button>
      </form>

      <div class="login-footer">
        <p class="footer-text">🔒 密碼已安全加密傳輸</p>
      </div>
    </div>

    <!-- 背景動畫 -->
    <div class="background-animation">
      <div v-for="i in 6" :key="i" class="float-shape" :style="{ '--index': i }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

const authStore = useAuthStore();
const toastStore = useToastStore();

const password = ref('');
const isLoading = ref(false);
const error = ref('');

const handleLogin = async () => {
  if (!password.value.trim()) {
    error.value = '請輸入密碼';
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    // 模擬密碼驗證延遲
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 調用認證方法
    await authStore.login(password.value);
    
    toastStore.success('登入成功！');
    password.value = '';
  } catch (err) {
    error.value = '密碼錯誤，請重試';
    toastStore.error('登入失敗');
    console.error('Login error:', err);
  } finally {
    isLoading.value = false;
  }
};
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
  max-width: 400px;
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
}

.login-header p {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
}

.form-input {
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 200ms ease;
}

.form-input::placeholder {
  color: var(--text-muted);
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(31, 110, 251, 0.1);
  background: var(--card-bg);
}

.form-input.input-error {
  border-color: var(--error-light);
  box-shadow: 0 0 0 4px rgba(248, 81, 73, 0.1);
}

.error-text {
  color: var(--error-light);
  font-size: 0.85rem;
  animation: slideDown 200ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.btn-large {
  padding: 14px 24px;
  font-size: 1rem;
  font-weight: 600;
  width: 100%;
}

.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
</style>
