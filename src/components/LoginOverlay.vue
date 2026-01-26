<template>
  <div class="login-overlay">
    <div class="bg-pattern"></div>
    
    <div class="login-card">
      <div class="logo-section">
        <div class="logo-circle">
          <span class="logo-icon">📊</span>
        </div>
        <h1>Trading Journal <span class="badge">PRO</span></h1>
        <p class="subtitle">專業交易日誌與資產管理系統</p>
      </div>

      <div v-if="error" class="error-alert">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <strong>登入發生錯誤</strong>
          <p>{{ error }}</p>
        </div>
      </div>

      <div v-if="isLoggingIn" class="loading-state">
        <div class="spinner"></div>
        <p>正在同步投資組合數據...</p>
      </div>

      <div v-show="!isLoggingIn" class="google-btn-wrapper">
        <div ref="googleBtn" class="g-btn"></div>
      </div>

      <div class="footer-section">
        <div class="feature-pills">
          <span>🔒 Google 安全驗證</span>
          <span>☁️ 雲端即時同步</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const error = ref('');
const isLoggingIn = ref(false);

onMounted(() => {
  window.handleCredentialResponse = async (response) => {
    console.log('🔐 收到 Google 憑證');
    error.value = '';
    isLoggingIn.value = true;
    
    try {
      // 1. 執行登入 (交換 Token)
      await authStore.login(response.credential); 
      
      // 2. 登入成功後，立即載入數據
      console.log('🎉 登入成功，開始載入數據...');
      await portfolioStore.fetchAll();

    } catch (err) {
      console.error('登入流程發生錯誤:', err);
      error.value = err.message || '無法連接伺服器，請稍後再試';
      isLoggingIn.value = false;
      
      // 如果失敗，重新渲染按鈕以供重試
      initGoogleSignIn();
    }
  };  

  if (window.google) {
    initGoogleSignIn();
  } else {
    const checkGoogle = setInterval(() => {
      if (window.google) {
        clearInterval(checkGoogle);
        initGoogleSignIn();
      }
    }, 100);
    
    setTimeout(() => {
      if (!window.google) {
        clearInterval(checkGoogle);
        error.value = '無法載入 Google 登入服務，請檢查網路連線或廣告阻擋器';
      }
    }, 10000);
  }
});

const initGoogleSignIn = () => {
  try {
    if(!window.google) return;
    
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });

    window.google.accounts.id.renderButton(googleBtn.value, {
      theme: 'filled_blue',
      size: 'large',
      width: '320',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left'
    });

    console.log('✅ Google 登入按鈕已渲染');
  } catch (err) {
    console.error('❌ 初始化錯誤:', err);
    error.value = '初始化登入系統失敗，請重新整理頁面';
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
  background: #0f172a; /* 深色背景底色 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow: hidden;
}

/* 背景網格裝飾 */
.bg-pattern {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
  pointer-events: none;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  max-width: 420px;
  width: 100%;
  text-align: center;
  animation: cardEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 1;
}

@keyframes cardEntry {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.logo-section {
  margin-bottom: 36px;
}

.logo-circle {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.logo-icon {
  font-size: 3rem;
}

.login-card h1 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 8px 0;
  letter-spacing: -0.02em;
}

.badge {
  background: #3b82f6;
  color: white;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 99px;
  vertical-align: middle;
  transform: translateY(-2px);
  display: inline-block;
}

.subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
  font-weight: 500;
}

/* 錯誤訊息 */
.error-alert {
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.alert-icon { font-size: 1.2rem; }
.alert-content strong { display: block; color: #991b1b; font-size: 0.9rem; }
.alert-content p { margin: 0; color: #b91c1c; font-size: 0.85rem; }

/* 載入狀態 */
.loading-state {
  margin: 32px 0;
  color: #64748b;
  font-weight: 500;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Google 按鈕 */
.google-btn-wrapper {
  display: flex;
  justify-content: center;
  margin: 32px 0;
  min-height: 50px;
}

.footer-section {
  margin-top: 32px;
  border-top: 1px solid #e2e8f0;
  padding-top: 24px;
}

.feature-pills {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.feature-pills span {
  font-size: 0.8rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 6px 12px;
  border-radius: 99px;
  font-weight: 500;
}

/* RWD */
@media (max-width: 480px) {
  .login-card { padding: 32px 24px; }
  .logo-circle { width: 64px; height: 64px; }
  .logo-icon { font-size: 2.2rem; }
  .login-card h1 { font-size: 1.5rem; }
}
</style>
