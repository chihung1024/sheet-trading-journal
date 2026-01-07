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
  // 定義全域 callback
  window.handleCredentialResponse = (response) => {
    authStore.login(response.credential);
  };

  // 載入 Google 按鈕
  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });
    
    // 渲染按鈕：使用 outline (白底) 風格
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { 
        theme: "outline", 
        size: "large", 
        width: 280, 
        shape: "rectangular",
        logo_alignment: "left"
      }
    );
  } else {
    console.error("Google GSI script not loaded. Check index.html");
  }
});
</script>

<style scoped>
/* 這裡確保背景是淺色的，絕不會是黑色 */
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

.login-card {
    background: white; /* 白色卡片 */
    padding: 40px 30px;
    border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
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
    color: #111827; /* 深黑色文字 */
    font-size: 1.5rem;
    font-weight: 700;
}

p {
    color: #6b7280; /* 灰色說明文字 */
    margin-bottom: 32px;
    font-size: 0.95rem;
    line-height: 1.5;
}

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

@media (max-width: 480px) {
    .login-overlay {
        align-items: center;
    }
}
</style>
