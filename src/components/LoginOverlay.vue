<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { CONFIG } from '../config' // 修正引用方式

const authStore = useAuthStore()
const loginBtn = ref(null)
const errorMsg = ref('')

const handleCredentialResponse = async (response) => {
  try {
    await authStore.loginWithGoogle(response.credential)
  } catch (e) {
    errorMsg.value = "登入失敗，請稍後再試"
    console.error(e)
  }
}

onMounted(() => {
  // 確保 google script 已載入
  if (window.google) {
    try {
      window.google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, // 使用正確的 CONFIG 物件存取
        callback: handleCredentialResponse
      })
      
      window.google.accounts.id.renderButton(
        loginBtn.value,
        { theme: "outline", size: "large", width: "100%" } 
      )
    } catch (e) {
      console.error("Google Init Error:", e)
      errorMsg.value = "Google 登入初始化失敗，請檢查 Client ID"
    }
  } else {
    errorMsg.value = "Google Script 尚未載入，請重新整理頁面"
  }
})
</script>

<template>
  <div v-if="!authStore.isAuthenticated" class="fixed inset-0 bg-gray-900 bg-opacity-90 z-50 flex items-center justify-center p-4">
    <div class="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-8 border border-gray-700">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Trading Journal</h1>
        <p class="text-gray-400">請登入以存取您的投資組合</p>
      </div>

      <div class="space-y-6">
        <div ref="loginBtn" class="flex justify-center h-[40px]"></div>
        
        <p v-if="errorMsg" class="text-red-400 text-sm text-center">{{ errorMsg }}</p>
        
        <div class="text-xs text-center text-gray-500 mt-6">
          <p>僅限授權帳號使用</p>
        </div>
      </div>
    </div>
  </div>
</template>
