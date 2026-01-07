import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio'; // 確保路徑正確

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || '');
    const user = ref({ 
        name: localStorage.getItem('name') || '', 
        email: localStorage.getItem('email') || '',
        picture: localStorage.getItem('picture') || '' // 新增圖片欄位
    });
    
    // 初始化 Auth 並嘗試載入資料
    const initAuth = async () => {
        if (token.value) {
            // 這裡可以選擇性地加入 token 有效性檢查
            const portfolioStore = usePortfolioStore();
            await portfolioStore.fetchAll();
        }
    };

    const login = async (googleCredential) => {
        try {
            // 發送 ID Token 到您的後端進行驗證
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
                    picture: data.picture || '' // 如果後端有回傳圖片
                };
                
                // 持久化儲存
                localStorage.setItem('token', data.token);
                localStorage.setItem('name', data.user);
                localStorage.setItem('email', data.email);
                if (data.picture) localStorage.setItem('picture', data.picture);
                
                // 成功後重整頁面以觸發 App.vue 的重新渲染
                window.location.reload(); 
            } else {
                alert("登入失敗: " + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error("Login Error:", e);
            alert("登入連線錯誤，請檢查網路或後端狀態");
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
