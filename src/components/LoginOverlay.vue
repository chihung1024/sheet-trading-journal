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

  // 確保 Google GSI script 已載入
  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });
    
    // 渲染按鈕：使用 "outline" (白底) 或 "filled_blue" (藍底) 以搭配明亮主題
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { 
        theme: "outline",  // 明亮主題適合用 outline 或 filled_blue
        size: "large", 
        width: 280, 
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
/* 明亮版背景 */
.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #f3f4f6; /* 淺灰色背景 */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
}

/* 明亮版卡片 */
.login-card {
    background: white;
    padding: 40px 30px;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    width: 100%;
    max-width: 400px;
    text-align: center;
    border: 1px solid #e5e7eb;
}

.icon {
    font-size: 3rem;
    margin-bottom: 16px;
    display: block;
}

h2 {
    margin: 0 0 12px;
    color: #111827; /* 深色標題 */
    font-size: 1.5rem;
    font-weight: 700;
}

p {
    color: #6b7280; /* 灰色說明文字 */
    margin-bottom: 32px;
    font-size: 0.95rem;
    line-height: 1.5;
}

/* 按鈕容器置中 */
.google-btn-container {
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
    min-height: 50px;
}

.footer-help {
    margin-top: 16px;
    color: #9ca3af;
    font-size: 0.8rem;
}

/* 手機版優化 */
@media (max-width: 480px) {
    .login-overlay {
        align-items: center; /* 確保垂直置中 */
    }
    .login-card {
        padding: 30px 20px;
        max-width: 90%;
    }
}
</style>
