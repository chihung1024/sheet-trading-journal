<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="logo-section">
        <span class="logo">📊</span>
        <h1>Trading Journal</h1>
        <p class="subtitle">專業交易日誌系統</p>
      </div>

      <div v-if="error" class="error-message">
        <strong>❌ 登入失敗</strong>
        <p>{{ error }}</p>
      </div>

      <!-- Google 登入按鈕容器 -->
      <div class="google-btn-container" ref="googleBtn"></div>

      <div class="footer-text">
        <small>🔒 安全且私密的登入方式</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();
const error = ref('');

onMounted(() => {
  // 定義 callback
  window.handleCredentialResponse = async (response) => {
    console.log('🔐 收到 Google 憑證');
    try {
      // 加上 await 等待後端回應
      await authStore.login(response.credential); 
    } catch (err) {
      // 捕捉錯誤並顯示在畫面上
      console.error('登入流程發生錯誤:', err);
      error.value = '登入驗證失敗: ' + (err.message || '無法連接後端伺服器');
      
      // 如果是因為 Token 過期等問題，可以考慮重新渲染按鈕
      // initGoogleSignIn(); 
    }
  };  

  // 1. 改良版：等待 Google Script 載入
  const checkGoogleScript = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(checkGoogleScript);
      console.log('✅ Google 登入服務已就緒');
      initGoogleSignIn();
    }
  }, 300); // 每 0.3 秒檢查一次

  // 2. 設定一個超時機制 (例如 10秒後還是沒載入才報錯)
  setTimeout(() => {
    if (!window.google && error.value === '') {
      clearInterval(checkGoogleScript);
      error.value = '連線逾時，無法載入 Google 登入服務，請檢查網路';
    }
  }, 10000);
});

const initGoogleSignIn = () => {
  try {
    // 初始化 Google Identity Services（tag 1.10 配置）
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });

    // 渲染按鈕（使用與 tag 1.10 相同的配置）
    window.google.accounts.id.renderButton(googleBtn.value, {
      theme: 'outline',
      size: 'large',
      width: '280',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    });

    console.log('✅ Google 登入按鈕已渲染');
  } catch (err) {
    console.error('❌ 初始化錯誤:', err);
    error.value = '初始化登入系統失敗';
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
