<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="logo-section">
        <span class="logo">📊</span>
        <h1>Trading Journal</h1>
        <p class="subtitle">專業交易日誌系統</p>
      </div>

      <div v-if="error" class="error-message">
        <strong>登入失敗</strong>
        <p>{{ error }}</p>
      </div>

      <!-- Google 按鈕容器 -->
      <div class="google-btn-container" ref="googleBtn"></div>

      <div class="footer-text">
        <small>🔒 安全且私密的登入方式</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const authStore = useAuthStore();
const googleBtn = ref(null);
const error = ref('');

const handleCredentialResponse = async (response) => {
  try {
    error.value = '';
    console.log('🔐 Google 登入成功，正在驗證...');
    await authStore.login(response.credential);
  } catch (err) {
    error.value = err.message || '登入失敗，請稍後重試';
    console.error('❌ 登入錯誤:', err);
  }
};

onMounted(() => {
  // 檢查 Google GSI 是否已載入
  const checkGoogleLoaded = setInterval(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(checkGoogleLoaded);
      initGoogleSignIn();
    }
  }, 100);

  // 超時保護 (5秒)
  setTimeout(() => {
    clearInterval(checkGoogleLoaded);
    if (typeof google === 'undefined') {
      error.value = 'Google 登入服務載入失敗，請重新整理頁面';
      console.error('❌ Google 登入服務未載入');
    }
  }, 5000);
});

const initGoogleSignIn = () => {
  try {
    // 初始化 Google Identity Services
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false,
      ux_mode: 'popup'
    });

    // 渲染按鈕
    google.accounts.id.renderButton(googleBtn.value, {
      theme: 'outline',
      size: 'large',
      width: '280',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    });

    console.log('✅ Google 登入按鈕已渲染');
  } catch (err) {
    error.value = '初始化 Google 登入失敗';
    console.error('❌ 初始化錯誤:', err);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  box-sizing: border-box;
}

.login-card {
  background: white;
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
  text-align: center;
  animation: slideUp 0.5s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  text-align: left;
  border: 1px solid #fecaca;
}

.error-message strong {
  display: block;
  margin-bottom: 8px;
}

.error-message p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Google 按鈕容器 */
.google-btn-container {
  display: flex;
  justify-content: center;
  margin: 32px 0;
  min-height: 50px;
}

/* 確保 Google 按鈕響應式 */
:deep(.g_id_signin) {
  width: 100% !important;
}

.footer-text {
  color: #9ca3af;
  font-size: 0.85rem;
  margin-top: 24px;
}

/* 響應式設計 */
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
