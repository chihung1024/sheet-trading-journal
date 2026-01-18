import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio'; // ✅ 引入 portfolioStore 以利清除數據

export const useAuthStore = defineStore('auth', () => {
    const token = ref(null);
    const user = ref(null);
    const loading = ref(false);

    /**
     * 初始化驗證狀態
     * 從 localStorage 恢復登入資訊
     */
    const initAuth = () => {
        const savedToken = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('auth_user');
        
        if (savedToken && savedUser) {
            token.value = savedToken;
            try {
                user.value = JSON.parse(savedUser);
                return true;
            } catch (e) {
                console.error("解析使用者資訊失敗:", e);
                logout();
                return false;
            }
        }
        return false;
    };

    /**
     * 登入處理
     * @param {String} googleCredential - Google 回傳的 id_token
     */
    const login = async (googleCredential) => {
        loading.value = true;
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: googleCredential })
            });

            const data = await response.json();

            if (data.success) {
                token.value = data.token;
                user.value = {
                    name: data.user,
                    email: data.email,
                    picture: data.picture // 若後端有回傳大頭貼
                };

                // 持久化儲存
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_user', JSON.stringify(user.value));
                
                console.log(`✅ 登入成功: ${data.email}`);
                return { success: true };
            } else {
                throw new Error(data.error || '登入驗證失敗');
            }
        } catch (error) {
            console.error('Login Error:', error);
            return { success: false, error: error.message };
        } finally {
            loading.value = false;
        }
    };

    /**
     * 登出處理
     * ✅ 核心優化：同時清空身分資訊與投資組合數據
     */
    const logout = () => {
        console.log('🚪 正在執行登出程序...');
        
        // 1. 清除身分狀態
        token.value = null;
        user.value = null;

        // 2. 清除本地存儲
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

        // 3. ✅ 重要：呼叫 Portfolio Store 的清空功能
        const portfolioStore = usePortfolioStore();
        portfolioStore.clearData();

        // 4. 可選：重新導向或刷新網頁以確保環境完全乾淨
        // location.reload(); 
        
        console.log('✨ 登出完成，所有帳號數據已清除');
    };

    /**
     * 檢查 Token 是否過期 (簡單判斷)
     */
    const isTokenExpired = computed(() => {
        if (!token.value) return true;
        try {
            const payload = JSON.parse(atob(token.value.split('.')[1]));
            return payload.exp < Date.now() / 1000;
        } catch (e) {
            return true;
        }
    });

    return {
        token,
        user,
        loading,
        initAuth,
        login,
        logout,
        isTokenExpired
    };
});
