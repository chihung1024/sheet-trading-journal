import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useToast } from '../composables/useToast';

export const useAuthStore = defineStore('auth', () => {
    const { addToast } = useToast();

    // --- State ---
    const token = ref(localStorage.getItem('token') || null);
    const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
    const tokenTimer = ref(null);

    // --- Getters ---
    
    // 判斷是否已登入且 Token 有效
    const isAuthenticated = computed(() => {
        return !!token.value && !isTokenExpired(token.value);
    });

    // 取得 API 請求用的 Header 物件
    const authHeader = computed(() => {
        return token.value ? { 'Authorization': `Bearer ${token.value}` } : {};
    });

    // --- Actions ---

    /**
     * Google 登入處理
     * @param {string} googleCredential - Google 回傳的 JWT Credential
     */
    const login = async (googleCredential) => {
        try {
            // 1. 發送憑證到後端驗證 (交換自定義 Token 或驗證 Google Token)
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: googleCredential })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Login verification failed');
            }

            const data = await res.json();
            
            // 2. 解析 User 資訊 (優先使用後端回傳，若無則解析 Google Token)
            const accessToken = data.token || googleCredential;
            const userData = data.user || parseJwt(accessToken);

            // 3. 更新狀態
            setSession(accessToken, userData);
            
            addToast(`歡迎回來，${userData.name || 'User'}`, 'success');
            return true;

        } catch (error) {
            console.error('Login Error:', error);
            logout(false); // 失敗則清除狀態
            throw error;
        }
    };

    /**
     * 登出
     * @param {boolean} notify - 是否顯示登出提示
     */
    const logout = (notify = true) => {
        token.value = null;
        user.value = null;
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        if (tokenTimer.value) {
            clearTimeout(tokenTimer.value);
            tokenTimer.value = null;
        }

        if (notify) {
            addToast('已成功登出', 'info');
        }
        
        // 可選：重新整理頁面以重置所有 Store 狀態
        // window.location.reload(); 
    };

    /**
     * 初始化驗證 (App 啟動時呼叫)
     */
    const initAuth = () => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            if (isTokenExpired(storedToken)) {
                console.warn('Token expired during init');
                logout(false); // 過期則靜默登出
                return false;
            }
            
            // 恢復狀態
            token.value = storedToken;
            user.value = JSON.parse(storedUser);
            
            // 重新設定自動登出計時器
            setupAutoLogout(storedToken);
            return true;
        }
        return false;
    };

    /**
     * 設定 Session 與自動登出
     */
    const setSession = (accessToken, userData) => {
        token.value = accessToken;
        user.value = userData;

        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(userData));

        setupAutoLogout(accessToken);
    };

    /**
     * 設定自動登出計時器
     */
    const setupAutoLogout = (jwtString) => {
        // 清除舊的計時器
        if (tokenTimer.value) clearTimeout(tokenTimer.value);

        try {
            const payload = parseJwt(jwtString);
            if (!payload.exp) return;

            const now = Date.now();
            const expTime = payload.exp * 1000; // 轉毫秒
            const timeLeft = expTime - now;

            console.log(`Token expires in ${(timeLeft / 60000).toFixed(1)} mins`);

            if (timeLeft > 0) {
                // 設定計時器，時間到自動登出
                tokenTimer.value = setTimeout(() => {
                    addToast('登入階段已過期，請重新登入', 'warning');
                    logout(false);
                }, timeLeft);
            } else {
                logout(false);
            }
        } catch (e) {
            console.error('Auto logout setup failed:', e);
        }
    };

    /**
     * 檢查 Token 是否過期
     */
    const isTokenExpired = (jwtString) => {
        try {
            const payload = parseJwt(jwtString);
            if (!payload || !payload.exp) return true;
            
            // 預留 10 秒緩衝時間
            return Date.now() >= (payload.exp * 1000) - 10000;
        } catch (e) {
            return true;
        }
    };

    /**
     * JWT 解析 (支援 Unicode)
     */
    const parseJwt = (jwtString) => {
        try {
            const base64Url = jwtString.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            
            // 使用 decodeURIComponent + escape 來處理 UTF-8 中文字元
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('JWT Parse Error:', e);
            return {};
        }
    };

    return {
        // State
        token,
        user,
        
        // Getters
        isAuthenticated,
        authHeader,
        
        // Actions
        login,
        logout,
        initAuth,
        isTokenExpired
    };
});
