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
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio'; 
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();
const portfolioStore = usePortfolioStore(); 
const error = ref('');

onMounted(() => {
  // 定義 callback（保留錯誤處理）
  window.handleCredentialResponse = async (response) => {
    console.log('🔐 收到 Google 憑證');
    try {
      // 執行登入 (這一步只會更新 Token 與 User 狀態，已不含抓資料邏輯)
      await authStore.login(response.credential); 
      
      // ✅ 3. 關鍵修正：登入成功後，主動載入投資組合數據
      console.log('🎉 登入成功，開始載入數據...');
      await portfolioStore.fetchAll();

    } catch (err) {
      console.error('登入流程發生錯誤:', err);
      error.value = '登入驗證失敗: ' + (err.message || '無法連接後端伺服器');
    }
  };  

  // 初始化 Google 登入按鈕
  if (window.google) {
    initGoogleSignIn();
  } else {
    // 如果 Google Script 還沒載入，等待一下
    const checkGoogle = setInterval(() => {
      if (window.google) {
        clearInterval(checkGoogle);
        initGoogleSignIn();
      }
    }, 100);
    
    // 10 秒後仍未載入，顯示錯誤
    setTimeout(() => {
      if (!window.google) {
        clearInterval(checkGoogle);
        error.value = '無法載入 Google 登入服務，請檢查網路連線';
      }
    }, 10000);
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

    window.google.accounts.id.renderButton(googleBtn.value, {
      theme: 'outline',
      size: 'large',
      width: '280',
      text: 'signin_with',
      shape: 'pill', // 優化為圓角 pill 形狀
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
  background: radial-gradient(circle at top left, #1e293b 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow: hidden;
}

/* 動態背景光暈 */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
  opacity: 0.6;
  animation: floatOrb 10s infinite ease-in-out;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: rgba(59, 130, 246, 0.2); /* Blue */
  top: -50px;
  left: -50px;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: rgba(139, 92, 246, 0.15); /* Purple */
  bottom: -100px;
  right: -100px;
  animation-delay: -5s;
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, 30px); }
}

.login-card {
  position: relative;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 48px 40px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  max-width: 400px;
  width: 100%;
  text-align: center;
  animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.logo-section {
  margin-bottom: 32px;
}

.logo-circle {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px auto;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.logo {
  font-size: 3rem;
  display: block;
}

.login-card h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 8px 0;
  letter-spacing: -0.025em;
}

.subtitle {
  color: #64748b;
  font-size: 1rem;
  margin: 0;
  font-weight: 500;
}

.error-message {
  background: #fef2f2;
  color: #991b1b;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  text-align: left;
  border: 1px solid #fee2e2;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 0.9rem;
}

.error-icon {
  font-size: 1.2rem;
}

.error-content strong {
  display: block;
  margin-bottom: 2px;
}

.error-content p {
  margin: 0;
  opacity: 0.9;
}

/* Google 按鈕容器 */
.google-wrapper {
  display: flex;
  justify-content: center;
  margin: 24px 0 32px 0;
  min-height: 50px;
}

.footer-text {
  color: #94a3b8;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 500;
}

.lock-icon {
  font-size: 0.9rem;
}

/* 響應式設計 */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
    margin: 16px;
    width: auto;
  }

  .logo-circle {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
  }

  .logo {
    font-size: 2.5rem;
  }

  .login-card h1 {
    font-size: 1.5rem;
  }
  
  .subtitle {
    font-size: 0.9rem;
  }
}
</style>
