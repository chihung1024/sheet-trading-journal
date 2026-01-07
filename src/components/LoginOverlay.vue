<template>
  <div class="login-overlay">
    <h2 style="font-size: 1.8rem; color: white;">SaaS 交易管理系統</h2>
    <p style="color:#888; margin-bottom: 20px;">請使用 Google 帳號登入以存取您的投資組合</p>
    <div ref="googleBtn"></div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { CONFIG } from '../config';

const googleBtn = ref(null);
const authStore = useAuthStore();

onMounted(() => {
  // 定義全域 callback 供 Google Script 呼叫
  window.handleCredentialResponse = (response) => {
    authStore.login(response.credential);
  };

  if (window.google) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false
    });
    window.google.accounts.id.renderButton(
      googleBtn.value,
      { theme: "filled_black", size: "large", width: 250 }
    );
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
    background: rgba(0,0,0,0.92); 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
    align-items: center; 
    z-index: 9999; 
}
</style>
