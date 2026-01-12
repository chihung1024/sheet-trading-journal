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
import { onMounted, ref, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const error = ref('');

let initCheckInterval = null;

// ✅ 清理函數：確保組件銀毀時清理資源
const cleanup = () => {
  if (initCheckInterval) {
    clearInterval(initCheckInterval);
    initCheckInterval = null;
  }
  
  // 移除全域 callback
  if (window.handleCredentialResponse) {
    delete window.handleCredentialResponse;
  }
};

onMounted(() => {
  console.log('🔑 初始化登入頁面...');
  
  // ✅ 定義 callback
  window.handleCredentialResponse = async (response) => {
    console.log('🔐 收到 Google 憑證');
    try {
      await authStore.login(response.credential); 
      console.log('🎉 登入成功，開始載入數據...');
      await portfolioStore.fetchAll();
    } catch (err) {
      console.error('登入流程發生錯誤:', err);
      error.value = '登入驗證失敗: ' + (err.message || '無法連接後端伺服器');
    }
  };  

  // ✅ 初始化 Google Sign-In
  if (window.google) {
    initGoogleSignIn();
  } else {
    let checkCount = 0;
    const maxChecks = 100; // 10秒最多檢查100次
    
    initCheckInterval = setInterval(() => {
      checkCount++;
      
      if (window.google) {
        clearInterval(initCheckInterval);
        initCheckInterval = null;
        initGoogleSignIn();
      } else if (checkCount >= maxChecks) {
        clearInterval(initCheckInterval);
        initCheckInterval = null;
        error.value = '無法載入 Google 登入服務，請檢查網路連線';
      }
    }, 100);
  }
});

const initGoogleSignIn = () => {
  try {
    console.log('🔧 正在初始化 Google Sign-In...');
    
    // ✅ 重要：確保每次都是全新的初始化
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,           // ✅ 關閉自動選擇
      cancel_on_tap_outside: false, // ✅ 點擊外部不取消
      itp_support: true              // ✅ 支援 ITP (智能防跟蹤)
    });

    // ✅ 確保每次都顯示 One Tap 提示（不自動登入）
    window.google.accounts.id.prompt();

    // ✅ 渲染按鈕
    if (googleBtn.value) {
      window.google.accounts.id.renderButton(googleBtn.value, {
        theme: 'outline',
        size: 'large',
        width: '280',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      });
      console.log('✅ Google 登入按鈕已渲染');
    } else {
      console.warn('⚠️ googleBtn ref 不存在');
    }
  } catch (err) {
    console.error('❌ 初始化錯誤:', err);
    error.value = '初始化登入系統失敗';
  }
};

// ✅ 組件銀毀時清理
onUnmounted(() => {
  console.log('🧹 清理登入組件資源...');
  cleanup();
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
