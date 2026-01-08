<template>
  <div class="login-overlay">
    <div class="login-card">
      <h2 style="font-size: 1.8rem; color: white; margin-bottom: 10px;">SaaS 交易管理系統</h2>
      <p style="color:#ccc; margin-bottom: 30px;">請使用 Google 帳號登入以存取您的投資組合</p>
      
      <div ref="googleBtn" class="google-btn-container"></div>
      
      <p v-if="error" style="color: #ff6b6b; margin-top: 20px; font-size: 0.9rem;">
        {{ error }}
      </p>
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
  // 1. 定義全域 callback
  window.handleCredentialResponse = (response) => {
    console.log("收到 Google 憑證，正在登入...");
    authStore.login(response.credential);
  };

  // 2. 啟動定時檢查器 (解決競態條件)
  const checkGoogleLoaded = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(checkGoogleLoaded); // 載入成功，停止檢查
      renderGoogleButton();
    }
  }, 100); // 每 100ms 檢查一次

  // 3. 超時保護 (如果 5 秒都沒載入，顯示錯誤)
  setTimeout(() => {
    clearInterval(checkGoogleLoaded);
    if (!window.google) {
      error.value = "Google 登入服務載入過久，請檢查網路或重新整理頁面";
    }
  }, 5000);
});

const renderGoogleButton = () => {
  try {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });
    
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { 
        theme: "filled_black", // 保留您喜歡的深色按鈕
        size: "large", 
        width: 280,            // 稍微加寬以適應手機
        shape: "rectangular"
      }
    );
  } catch (err) {
    console.error("按鈕渲染失敗:", err);
    error.value = "登入按鈕初始化失敗";
  }
};
</script>

<style scoped>
.login-overlay { 
    position: fixed; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%; 
    background: rgba(0,0,0,0.92); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    z-index: 9999; 
    padding: 20px;
}

.login-card {
    text-align: center;
    width: 100%;
    max-width: 400px;
}

.google-btn-container {
    display: flex;
    justify-content: center;
    min-height: 50px; /* 預留高度避免跳動 */
}
</style>
