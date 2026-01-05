<template>
  <div class="overlay">
    <h2>SaaS Trading Journal</h2>
    <p>Please sign in to continue</p>
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
.overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9); z-index: 999;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
h2 { color: white; margin-bottom: 10px; }
p { color: #888; margin-bottom: 20px; }
</style>
