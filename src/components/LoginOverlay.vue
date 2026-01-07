<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="icon">📊</div>
      <h2>Trading Journal</h2>
      <p>請使用 Google 帳號登入以存取您的投資組合</p>
      
      <div class="google-btn-container">
          <div ref="googleBtn"></div>
      </div>

      <div class="footer-help">
         <small>安全且私密的登入方式</small>
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

onMounted(() => {
  // 定義全域 callback，讓 Google Script 呼叫
  window.handleCredentialResponse = (response) => {
    authStore.login(response.credential);
  };

  // 確保 Google GSI script 已載入 (需在 index.html 引入)
  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false, // 建議關閉自動選擇，避免迴圈
      cancel_on_tap_outside: false
    });
    
    // 渲染按鈕：使用 RWD 友善的設定
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { 
        theme: "outline", 
        size: "large", 
        width: 280, // 設定適中的寬度
        shape: "rectangular",
        logo_alignment: "left"
      }
    );
  } else {
    console.error("Google GSI script not loaded!");
  }
});
</script>

<style scoped>
.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
}

.login-card {
    background: white;
    padding: 40px;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 380px;
    text-align: center;
    border: 1px solid #e5e7eb;
}

.icon {
    font-size: 3rem;
    margin-bottom: 16px;
    display: block;
}

h2 {
    margin: 0 0 8px;
    color: #111827;
    font-size: 1.5rem;
    font-weight: 700;
}

p {
    color: #6b7280;
    margin-bottom: 32px;
    font-size: 0.95rem;
}

/* 讓 Google 按鈕置中 */
.google-btn-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
    min-height: 50px; /* 預留高度避免跳動 */
}

.footer-help {
    margin-top: 16px;
    color: #9ca3af;
    font-size: 0.8rem;
}

/* 手機版優化 */
@media (max-width: 480px) {
    .login-overlay {
        align-items: center; 
    }
    .login-card {
        padding: 30px 20px;
    }
}
</style>
