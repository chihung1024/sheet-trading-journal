<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="logo-section">
        <span class="logo">📊</span>
        <h1>Trading Journal</h1>
        <p class="subtitle">專業交易日誌系統 (Pro)</p>
      </div>

      <div v-if="error" class="error-message">
        <strong>❌ 登入失敗</strong>
        <p>{{ error }}</p>
      </div>

      <div class="google-btn-container" ref="googleBtn">
        <div v-if="!isGoogleReady" class="btn-skeleton">載入登入服務中...</div>
      </div>

      <div class="footer-text">
        <small>🔒 基於 Google OAuth 2.0 安全驗證</small>
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
const isGoogleReady = ref(false);

/**
 * 處理 Google 登入回傳
 * [核心邏輯]：登入成功後立即鏈結 fetchAll 數據載入
 */
const handleCredentialResponse = async (response) => {
  console.log('🔐 [Login] 收到 Google 憑證，開始驗證...');
  try {
    // 1. 執行後端 Token 換取與 User 資訊儲存
    await authStore.login(response.credential); 
    
    // 2. 登入成功，主動觸發投資組合數據載入
    // 這裡會執行 fetchRecords -> check if empty -> (fetchSnapshot or resetData)
    console.log('🎉 [Login] 認證成功，執行數據初始化...');
    await portfolioStore.fetchAll();

  } catch (err) {
    console.error('❌ [Login] 流程發生錯誤:', err);
    error.value = '登入驗證失敗: ' + (err.message || '無法連接伺服器');
  }
};

onMounted(() => {
  // 將 callback 掛載至全域，供 Google GSI 腳本調用
  window.handleCredentialResponse = handleCredentialResponse;

  // 初始化檢查與循環監控 Google 腳本
  const initCheck = () => {
    if (window.google && window.google.accounts) {
      isGoogleReady.value = true;
      initGoogleSignIn();
      return true;
    }
    return false;
  };

  if (!initCheck()) {
    const checkGoogle = setInterval(() => {
      if (initCheck()) clearInterval(checkGoogle);
    }, 200);
    
    // 15 秒超時檢查
    setTimeout(() => {
      if (!isGoogleReady.value) {
        clearInterval(checkGoogle);
        error.value = '無法載入 Google 登入組件，請檢查網路或廣告攔截器設定';
      }
    }, 15000);
  }
});

const initGoogleSignIn = () => {
  try {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });

    if (googleBtn.value) {
      window.google.accounts.id.renderButton(googleBtn.value, {
        theme: 'outline',
        size: 'large',
        width: '280',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      });
      console.log('✅ [Login] Google 登入按鈕已渲染');
    }
  } catch (err) {
    console.error('❌ [Login] 初始化 GSI 失敗:', err);
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
  /* 使用漸層背景增強專業感 */
  background: linear-gradient(135deg, var(--primary, #3b82f6) 0%, var(--primary-dark, #1d4ed8) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.login-card {
  background: var(--bg-card, white);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
  text-align: center;
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.logo-section { margin-bottom: 32px; }
.logo { font-size: 4rem; display: block; margin-bottom: 16px; }
.login-card h1 { font-size: 1.75rem; font-weight: 700; color: var(--text-main, #1f2937); margin: 0 0 8px 0; }
.subtitle { color: var(--text-sub, #6b7280); font-size: 0.95rem; margin: 0; }

.error-message {
  background: #fee2e2;
  color: #991b1b;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  text-align: left;
  border: 1px solid #fecaca;
  font-size: 0.9rem;
}

.google-btn-container {
  display: flex;
  justify-content: center;
  margin: 32px 0;
  min-height: 50px;
}

.btn-skeleton {
  width: 280px;
  height: 50px;
  background: #f3f4f6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.9rem;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.footer-text { color: var(--text-sub, #9ca3af); font-size: 0.85rem; margin-top: 24px; }

@media (max-width: 480px) {
  .login-card { padding: 32px 24px; }
  .logo { font-size: 3rem; }
  .login-card h1 { font-size: 1.5rem; }
}
</style>
