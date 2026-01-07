import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

// 注意：這裡移除了 usePortfolioStore 的引用，避免循環依賴導致網頁全黑崩潰
export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || '');
    const user = ref({ 
        name: localStorage.getItem('name') || '', 
        email: localStorage.getItem('email') || '',
        picture: localStorage.getItem('picture') || ''
    });
    
    // 單純初始化狀態
    const initAuth = () => {
        if (token.value) {
            // Token 存在，狀態已就緒
            // 資料拉取的工作交給 App.vue 處理
        }
    };

    const login = async (googleCredential) => {
        try {
            // 發送 ID Token 到後端驗證
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: googleCredential })
            });
            
            const data = await res.json();
            
            if (data.success) {
                // 更新狀態
                token.value = data.token;
                user.value = { 
                    name: data.user, 
                    email: data.email,
                    picture: data.picture || ''
                };
                
                // 寫入 LocalStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('name', data.user);
                localStorage.setItem('email', data.email);
                if (data.picture) localStorage.setItem('picture', data.picture);
                
                // 登入成功，重新整理頁面 (最穩定的做法)
                window.location.reload(); 
            } else {
                alert("登入失敗: " + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error("Login Error:", e);
            alert("登入連線錯誤");
        }
    };

    const logout = () => {
        token.value = '';
        user.value = {};
        localStorage.clear();
        window.location.reload();
    };

    return { token, user, login, logout, initAuth };
});
