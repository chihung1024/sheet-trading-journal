import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CONFIG } from '../config' // 修正引用方式

export const useAuthStore = defineStore('auth', () => {
    // 1. 初始化時嘗試從 LocalStorage 讀取 Token
    const token = ref(localStorage.getItem('auth_token') || '')
    const user = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))
    const loading = ref(false)
    const error = ref(null)

    const isAuthenticated = computed(() => !!token.value)

    async function loginWithGoogle(credential) {
        loading.value = true
        error.value = null
        try {
            // 發送 Token 到後端驗證
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: credential })
            })

            const data = await res.json()

            if (data.success) {
                // 2. 登入成功，保存 Token 到 LocalStorage
                token.value = data.token
                user.value = data.user
                
                localStorage.setItem('auth_token', data.token)
                localStorage.setItem('auth_user', JSON.stringify(data.user))
            } else {
                throw new Error(data.error || 'Login failed')
            }
        } catch (e) {
            console.error(e)
            error.value = e.message
            throw e
        } finally {
            loading.value = false
        }
    }

    function logout() {
        // 3. 登出時清除 LocalStorage
        token.value = ''
        user.value = null
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        
        // 重新整理頁面以確保狀態乾淨
        window.location.reload()
    }

    return {
        token,
        user,
        loading,
        error,
        isAuthenticated,
        loginWithGoogle,
        logout
    }
})
