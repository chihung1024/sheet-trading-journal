<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="logo-section">
        <span class="logo">📊</span>
        <h1>Trading Journal</h1>
        <p class="subtitle">專業交易日誌系統</p>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div id="google-signin-button" class="google-btn-container"></div>

      <div class="features">
        <div class="feature-item">
          <span class="icon">✓</span>
          <span>即時持倉追蹤</span>
        </div>
        <div class="feature-item">
          <span class="icon">✓</span>
          <span>績效分析報表</span>
        </div>
        <div class="feature-item">
          <span class="icon">✓</span>
          <span>多設備同步</span>
        </div>
      </div>

      <div class="footer-text">
        使用 Google 帳號安全登入
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const error = ref('');

const initGoogleSignIn = () => {
  if (typeof google === 'undefined') {
    error.value = 'Google 登入服務載入失敗';
    console.error('Google Identity Services not loaded');
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { 
        theme: 'outline', 
        size: 'large',
        width: 280,
        text: 'signin_with',
        shape: 'rectangular'
      }
    );
  } catch (e) {
    error.value = '初始化登入失敗';
    console.error('Google Sign-In initialization error:', e);
  }
};

const handleCredentialResponse = async (response) => {
  try {
    error.value = '';
    await authStore.loginWithGoogle(response.credential);
  } catch (e) {
    error.value = '登入失敗，請稍後再試';
    console.error('Login error:', e);
  }
};

onMounted(() => {
  // 等待 Google Identity Services 載入
  const checkGoogleLoaded = setInterval(() => {
    if (typeof google !== 'undefined') {
      clearInterval(checkGoogleLoaded);
      initGoogleSignIn();
    }
  }, 100);

  // 超時保護
  setTimeout(() => {
    clearInterval(checkGoogleLoaded);
    if (typeof google === 'undefined') {
      error.value = 'Google 登入服務載入超時';
    }
  }, 5000);
});
</script>

<style scoped>
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.login-card {
  background: white;
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  text-align: center;
  animation: slideUp 0.5s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.logo-section {
  margin-bottom: 32px;
}

.logo {
  font-size: 4rem;
  display: block;
  margin-bottom: 16px;
}

.login-card h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #6b7280;
  font-size: 0.95rem;
  margin: 0;
}

.error-message {
  background: #fee2e2;
  color: #991b1b;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 0.9rem;
  font-weight: 500;
}

.google-btn-container {
  margin: 32px 0;
  display: flex;
  justify-content: center;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 32px 0;
  padding: 24px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  color: #4b5563;
  text-align: left;
}

.feature-item .icon {
  width: 24px;
  height: 24px;
  background: #dcfce7;
  color: #166534;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.footer-text {
  color: #9ca3af;
  font-size: 0.85rem;
  margin-top: 24px;
}

/* 響應式 */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
  }

  .logo {
    font-size: 3rem;
  }

  .login-card h1 {
    font-size: 1.5rem;
  }
}
</style>
