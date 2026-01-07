import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio';

export const useAuthStore = defineStore('auth', () => {
    const token = ref('');
    const user = ref({ name: '', email: '' });
    // 注意：為了避免 Pinia 循環依賴，建議在函式內部呼叫 usePortfolioStore()，或在外部組件處理資料拉取

    const initAuth = () => {
        const t = localStorage.getItem('token');
        const n = localStorage.getItem('name');
        const e = localStorage.getItem('email');
        if (t) {
            token.value = t;
            user.value = { name: n, email: e };
            
            // 登入後自動觸發資料拉取
            const portfolioStore = usePortfolioStore();
            portfolioStore.fetchAll();
        }
    };

    const login = async (googleCredential) => {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
                method: "POST",
                body: JSON.stringify({ id_token: googleCredential })
            });
            const data = await res.json();
            
            if (data.success) {
                token.value = data.token;
                user.value = { name: data.user, email: data.email };
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('name', data.user);
                localStorage.setItem('email', data.email);
                
                const portfolioStore = usePortfolioStore();
                portfolioStore.fetchAll();
            } else {
                alert("登入失敗: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("登入連線錯誤，請檢查網路狀態");
        }
    };

    const logout = () => {
        // 清除狀態
        token.value = '';
        user.value = {};
        // 清除儲存
        localStorage.removeItem('token');
        localStorage.removeItem('name');
        localStorage.removeItem('email');
        
        // 不需要 location.reload()，App.vue 的 v-if="!authStore.token" 會自動切換回 LoginOverlay
    };

    return { token, user, login, logout, initAuth };
});
