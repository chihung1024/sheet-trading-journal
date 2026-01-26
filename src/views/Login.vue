<template>
  <div class="login-container">
    <div class="login-card">
      <div class="brand-section">
        <div class="logo-circle">
          <span class="logo-icon">📈</span>
        </div>
        <h1 class="app-title">
          Trading Journal <span class="pro-badge">PRO</span>
        </h1>
        <p class="app-slogan">
          專業交易員的資產管理與覆盤工具
        </p>
      </div>

      <div class="action-section">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在安全驗證您的身份...</p>
        </div>

        <div 
          v-show="!loading" 
          id="google-btn-container" 
          class="google-btn-wrapper"
        ></div>

        <p class="terms-hint">
          繼續使用即代表您同意本服務的<br>
          <span class="link">使用條款</span> 與 <span class="link">隱私權政策</span>
        </p>
      </div>
    </div>

    <footer class="login-footer">
      <p>&copy; {{ new Date().getFullYear() }} Trading Journal PRO. v{{ appVersion }}</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import { useDarkMode } from '../composables/useDarkMode';
import { CONFIG } from '../config';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { addToast } = useToast();
const { isDark } = useDarkMode();

const loading = ref(false);
const appVersion = CONFIG.APP_VERSION;

// 處理 Google 登入回調
const handleCredentialResponse = async (response) => {
  loading.value = true;
  try {
    // 呼叫 Store 進行驗證
    await authStore.login(response.credential);
    
    // 驗證成功，判斷跳轉路徑
    const redirectPath = route.query.redirect || '/';
    addToast('登入成功，正在跳轉...', 'success');
    
    // 稍微延遲以展示成功狀態
    setTimeout(() => {
      router.push(redirectPath);
    }, 500);

  } catch (error) {
    console.error('Login Failed:', error);
    addToast('登入驗證失敗，請重試', 'error');
    loading.value = false;
    
    // 失敗後重新渲染按鈕，避免按鈕失效
    renderGoogleButton();
  }
};

// 渲染 Google 按鈕
const renderGoogleButton = () => {
  if (window.google) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false, // 是否自動選擇帳號
      cancel_on_tap_outside: false
    });

    window.google.accounts.id.renderButton(
      document.getElementById("google-btn-container"),
      { 
        theme: isDark.value ? 'filled_black' : 'outline', 
        size: 'large',
        width: 280,
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left'
      }
    );
  } else {
    addToast('Google 登入服務載入失敗，請檢查網路連線', 'error');
  }
};

onMounted(() => {
  // 確保 Google Script 已載入
  // 如果是首次載入，可能需要一點時間等待 script tag 生效
  const checkGoogleScript = setInterval(() => {
    if (window.google) {
      clearInterval(checkGoogleScript);
      renderGoogleButton();
    }
  }, 100);

  // 3秒後若還沒載入，顯示錯誤
  setTimeout(() => {
    clearInterval(checkGoogleScript);
    if (!window.google) {
      addToast('無法連接 Google 服務', 'warning');
    }
  }, 3000);
});
</script>

<style scoped>
.login-container {
  min-height: calc(100vh - 64px); /* 扣除 Header 高度 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

/* 背景裝飾 (選用) */
.login-container::before {
  content: '';
  position: absolute;
  top: -10%;
  left: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%);
  z-index: 0;
  pointer-events: none;
}

.login-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 50px -12px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(20px);
}

/* Brand Section */
.brand-section {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo-circle {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-card));
  border: 1px solid var(--border-color);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px -4px rgba(0,0,0,0.05);
  margin-bottom: 8px;
}

.logo-icon {
  font-size: 32px;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.pro-badge {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 12px;
  vertical-align: middle;
  position: relative;
  top: -2px;
}

.app-slogan {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin: 0;
}

/* Action Section */
.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  min-height: 120px; /* 預留高度避免跳動 */
}

.google-btn-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 10px 0;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.terms-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}

.link {
  color: var(--primary-color);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link:hover {
  color: var(--primary-hover);
}

/* Footer */
.login-footer {
  margin-top: 24px;
  font-size: 0.8rem;
  color: var(--text-muted);
  opacity: 0.6;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* RWD */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
    border: none;
    box-shadow: none;
    background: transparent;
  }
}
</style>
