<template>
  <div class="login-overlay">
    <div class="ambient-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="grid-pattern"></div>
    </div>

    <div class="login-card">
      <div class="brand-section">
        <div class="logo-circle">
          <span class="logo-icon">📊</span>
        </div>
        <h1 class="app-name">Trading Journal <span class="pro-tag">PRO</span></h1>
        <p class="app-slogan">掌握每一筆交易，優化您的投資策略</p>
      </div>

      <div class="action-section">
        <div v-if="error" class="error-banner">
          <span class="icon">⚠️</span> {{ error }}
        </div>

        <div class="google-btn-wrapper" :class="{ 'is-loading': isLoading }">
          <div id="google-btn-container"></div>
          
          <div v-if="isLoading" class="loading-mask">
            <span class="spinner"></span>
            <span>正在驗證身分...</span>
          </div>
        </div>

        <div class="divider">
          <span>SECURE LOGIN</span>
        </div>

        <p class="terms-text">
          繼續使用即代表您同意 <a href="#">服務條款</a> 與 <a href="#">隱私權政策</a>
        </p>
      </div>
    </div>
    
    <div class="footer-info">
      v1.0.0 • Institutional Grade Analytics
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const authStore = useAuthStore();
const isLoading = ref(false);
const error = ref('');

// 初始化 Google Sign-In
const initGoogleBtn = () => {
  if (window.google) {
    try {
      window.google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false
      });
      
      window.google.accounts.id.renderButton(
        document.getElementById("google-btn-container"),
        { 
          theme: 'filled_blue', 
          size: 'large', 
          shape: 'pill',
          width: '280',
          text: 'continue_with',
          logo_alignment: 'left'
        }
      );
    } catch (e) {
      error.value = "Google Sign-In 初始化失敗，請重新整理頁面";
      console.error(e);
    }
  } else {
    // Retry if script not loaded yet
    setTimeout(initGoogleBtn, 500);
  }
};

const handleCredentialResponse = async (response) => {
  isLoading.value = true;
  error.value = '';
  try {
    const success = await authStore.loginWithGoogle(response.credential);
    if (!success) {
      error.value = "登入失敗，請稍後再試";
    }
  } catch (e) {
    error.value = e.message || "登入過程發生錯誤";
  } finally {
    // 成功的話組件會被銷毀 (v-if in App.vue)，失敗則停止 loading
    if (error.value) isLoading.value = false;
  }
};

onMounted(() => {
  initGoogleBtn();
});
</script>

<style scoped>
/* Container & Background */
.login-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-color: #0f172a; /* Dark Slate */
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  color: #fff;
}

.ambient-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  animation: float 10s ease-in-out infinite;
}

.orb-1 {
  width: 400px; height: 400px;
  background: #3b82f6;
  top: -100px; left: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 300px; height: 300px;
  background: #8b5cf6;
  bottom: -50px; right: -50px;
  animation-delay: -5s;
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 40%, transparent 100%);
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, 50px); }
}

/* Card */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 48px 32px;
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 40px;
  animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Brand */
.brand-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.logo-circle {
  width: 64px; height: 64px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem;
  box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
  animation: pulse-glow 3s infinite;
}

.app-name {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
  background: linear-gradient(to right, #fff, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pro-tag {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
  border: 1px solid rgba(59, 130, 246, 0.3);
  -webkit-text-fill-color: #60a5fa; /* Override gradient */
}

.app-slogan {
  font-size: 0.95rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

/* Actions */
.action-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  align-items: center;
}

.google-btn-wrapper {
  position: relative;
  min-height: 44px;
  display: flex;
  justify-content: center;
  width: 100%;
}

/* Customizing Google Button Container */
#google-btn-container {
  transform: scale(1.05); /* Make it slightly larger */
}

.loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(30, 41, 59, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 99px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
  z-index: 5;
}

.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  width: 100%;
  color: #475569;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #334155;
}
.divider span { padding: 0 12px; }

.terms-text {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}
.terms-text a {
  color: #94a3b8;
  text-decoration: none;
  border-bottom: 1px dashed #64748b;
  transition: color 0.2s;
}
.terms-text a:hover { color: #fff; border-bottom-style: solid; }

/* Footer */
.footer-info {
  position: absolute;
  bottom: 24px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.3);
  font-family: 'JetBrains Mono', monospace;
}

/* Animations */
@keyframes spin { 100% { transform: rotate(360deg); } }
@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 10px 40px rgba(59, 130, 246, 0.6); }
}
</style>
