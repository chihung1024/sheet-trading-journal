<template>
  <div class="login-overlay">
    <div class="login-card">
      <div class="icon">📊</div>
      <h2>Trading Journal</h2>
      <p>請使用 Google 帳號登入</p>
      
      <div class="google-btn-container">
          <div ref="googleBtn"></div>
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
  window.handleCredentialResponse = (response) => {
    authStore.login(response.credential);
  };

  if (window.google && window.google.accounts) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false
    });
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { theme: "outline", size: "large", width: 250, shape: "rectangular" }
    );
  }
});
</script>

<style scoped>
.login-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: #f3f4f6; /* 明亮背景 */
    display: flex; align-items: center; justify-content: center; z-index: 9999;
    padding: 20px; box-sizing: border-box;
}
.login-card {
    background: white; padding: 40px; border-radius: 16px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); width: 100%; max-width: 380px;
    text-align: center; border: 1px solid #e5e7eb;
}
.icon { font-size: 3rem; margin-bottom: 16px; }
h2 { margin: 0 0 10px; color: #111827; font-size: 1.5rem; font-weight: 700; }
p { color: #6b7280; margin-bottom: 30px; font-size: 0.95rem; }
.google-btn-container { display: flex; justify-content: center; }
</style>
