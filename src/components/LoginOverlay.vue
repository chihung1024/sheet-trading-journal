<template>
  <div class="login-overlay">
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>

    <div class="login-card">
      <div class="logo-section">
        <div class="logo-circle">
          <span class="logo">📊</span>
        </div>
        <h1>Trading Journal</h1>
        <p class="subtitle">專業交易日誌與績效追蹤</p>
      </div>

      <div v-if="error" class="error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <strong>登入失敗</strong>
          <p>{{ error }}</p>
        </div>
      </div>

      <div class="google-wrapper">
        <div class="google-btn-container" ref="googleBtn"></div>
      </div>

      <div class="footer-text">
        <span class="lock-icon">🔒</span> 安全且私密的登入方式
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { CONFIG } from '../config';

const GOOGLE_SCRIPT_POLL_MS = 100;
const GOOGLE_SCRIPT_TIMEOUT_MS = 10_000;

const googleBtn = ref(null);
const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const error = ref('');

let isActive = false;
let isGoogleInitialized = false;
let googlePollTimer = null;
let googleLoadTimeout = null;

const clearGoogleWaitTimers = () => {
  if (googlePollTimer !== null) {
    clearInterval(googlePollTimer);
    googlePollTimer = null;
  }
  if (googleLoadTimeout !== null) {
    clearTimeout(googleLoadTimeout);
    googleLoadTimeout = null;
  }
};

const getGoogleIdentity = () => {
  try {
    return window.google?.accounts?.id || null;
  } catch (err) {
    console.error('❌ 讀取 Google Identity Services 失敗:', err);
    return null;
  }
};

const handleCredentialResponse = async (response) => {
  if (!isActive) return;

  const credential = response?.credential;
  if (typeof credential !== 'string' || !credential.trim()) {
    error.value = '登入驗證失敗: Google 未提供有效憑證';
    return;
  }

  console.log('🔐 收到 Google 憑證');
  try {
    await authStore.login(credential);
  } catch (err) {
    console.error('登入驗證失敗:', err);
    if (isActive) {
      error.value = '登入驗證失敗: ' + (err?.message || '無法連接後端伺服器');
    }
    return;
  }

  // Authentication already succeeded. Normal unmount after the token is set must
  // not cancel this accepted login flow; a later data-load failure is not auth failure.
  console.log('🎉 登入成功，開始載入數據...');
  try {
    await portfolioStore.fetchAll();
  } catch (err) {
    console.error('登入成功，但初始資料載入失敗:', err);
  }
};

const initGoogleSignIn = () => {
  if (!isActive || isGoogleInitialized) return false;

  const googleIdentity = getGoogleIdentity();
  if (!googleIdentity || typeof googleIdentity.initialize !== 'function' || typeof googleIdentity.renderButton !== 'function') {
    return false;
  }
  if (!googleBtn.value) return false;

  clearGoogleWaitTimers();

  try {
    googleIdentity.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });

    googleIdentity.renderButton(googleBtn.value, {
      theme: 'outline',
      size: 'large',
      width: '280',
      text: 'signin_with',
      shape: 'pill',
      logo_alignment: 'left'
    });

    isGoogleInitialized = true;
    console.log('✅ Google 登入按鈕已渲染');
    return true;
  } catch (err) {
    if (isActive) {
      console.error('❌ 初始化錯誤:', err);
      error.value = '初始化登入系統失敗';
    }
    return false;
  }
};

const waitForGoogleIdentity = () => {
  if (initGoogleSignIn()) return;

  googlePollTimer = setInterval(() => {
    if (!isActive) return;
    initGoogleSignIn();
  }, GOOGLE_SCRIPT_POLL_MS);

  googleLoadTimeout = setTimeout(() => {
    clearGoogleWaitTimers();
    if (!isActive || isGoogleInitialized) return;
    error.value = '無法載入 Google 登入服務，請檢查網路連線';
  }, GOOGLE_SCRIPT_TIMEOUT_MS);
};

onMounted(() => {
  isActive = true;
  window.handleCredentialResponse = handleCredentialResponse;
  waitForGoogleIdentity();
});

onUnmounted(() => {
  isActive = false;
  clearGoogleWaitTimers();
  if (window.handleCredentialResponse === handleCredentialResponse) {
    delete window.handleCredentialResponse;
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
  background: radial-gradient(circle at top left, #1e293b 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow: hidden;
}
.bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0; opacity: 0.6; animation: floatOrb 10s infinite ease-in-out; }
.orb-1 { width: 300px; height: 300px; background: rgba(59, 130, 246, 0.2); top: -50px; left: -50px; animation-delay: 0s; }
.orb-2 { width: 400px; height: 400px; background: rgba(139, 92, 246, 0.15); bottom: -100px; right: -100px; animation-delay: -5s; }
@keyframes floatOrb { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 30px); } }
.login-card { position: relative; z-index: 10; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 24px; padding: 48px 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); max-width: 400px; width: 100%; text-align: center; animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255, 255, 255, 0.5); }
@keyframes slideUpFade { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.logo-section { margin-bottom: 32px; }
.logo-circle { width: 80px; height: 80px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.logo { font-size: 3rem; display: block; }
.login-card h1 { font-size: 1.75rem; font-weight: 800; color: #1e293b; margin: 0 0 8px 0; letter-spacing: -0.025em; }
.subtitle { color: #64748b; font-size: 1rem; margin: 0; font-weight: 500; }
.error-message { background: #fef2f2; color: #991b1b; padding: 12px 16px; border-radius: 12px; margin-bottom: 24px; text-align: left; border: 1px solid #fee2e2; display: flex; align-items: flex-start; gap: 12px; font-size: 0.9rem; }
.error-icon { font-size: 1.2rem; }
.error-content strong { display: block; margin-bottom: 2px; }
.error-content p { margin: 0; opacity: 0.9; }
.google-wrapper { display: flex; justify-content: center; margin: 24px 0 32px 0; min-height: 50px; }
.footer-text { color: #94a3b8; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 500; }
.lock-icon { font-size: 0.9rem; }
@media (max-width: 480px) {
  .login-card { padding: 32px 24px; margin: 16px; width: auto; }
  .logo-circle { width: 64px; height: 64px; margin-bottom: 16px; }
  .logo { font-size: 2.5rem; }
  .login-card h1 { font-size: 1.5rem; }
  .subtitle { font-size: 0.9rem; }
}
</style>
