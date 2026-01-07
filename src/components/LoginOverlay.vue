<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="login-header">
        <div class="app-icon">📊</div>
        <h1>交易日誌</h1>
        <p>股票交易組合管理系統</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form" novalidate>
        <div class="form-group">
          <label for="password">訪問密碼</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="輸入訪問密碼..."
              class="form-input"
              :class="{ 'input-error': error }"
              @keyup.enter="handleLogin"
              @focus="inputFocused = true"
              @blur="inputFocused = false"
              autocomplete="current-password"
              aria-label="訪問密碼"
              aria-describedby="password-error"
            />
            <button
              type="button"
              class="password-toggle"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
          <span v-if="error" id="password-error" class="error-text">{{ error }}</span>
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-large"
          :disabled="isLoading || !password.trim()"
          :aria-busy="isLoading"
        >
          <span v-if="!isLoading" class="button-content">進入系統</span>
          <span v-else class="loading-spinner">
            <span class="spinner-icon">⟳</span>
            <span>驗證中...</span>
          </span>
        </button>
      </form>

      <div class="login-footer">
        <p class="footer-text">🔒 密碼已安全加密傳輸</p>
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
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

const authStore = useAuthStore();
const toastStore = useToastStore();

const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const error = ref('');
const inputFocused = ref(false);

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
    showPassword.value = false;
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
  letter-spacing: -0.5px;
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
  display: block;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  padding: 12px 16px;
  padding-right: 44px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 200ms ease;
  flex: 1;
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

.password-toggle {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 200ms ease;
  color: var(--text-muted);
}

.password-toggle:hover {
  opacity: 0.8;
}

.password-toggle:active {
  transform: scale(0.95);
}

.error-text {
  color: var(--error-light);
  font-size: 0.85rem;
  animation: slideDown 200ms ease-out;
  display: block;
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

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, var(--primary));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(31, 110, 251, 0.3);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(31, 110, 251, 0.2);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-large {
  padding: 14px 24px;
  font-size: 1rem;
  width: 100%;
}

.button-content {
  display: inline-block;
}

.loading-spinner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner-icon {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
