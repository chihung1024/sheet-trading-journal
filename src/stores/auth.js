import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio';

export const useAuthStore = defineStore('auth', () => {
    const token = ref('');
    const user = ref({ name: '', email: '' });
    const portfolioStore = usePortfolioStore();

    const initAuth = () => {
        const t = localStorage.getItem('token');
        const n = localStorage.getItem('name');
        const e = localStorage.getItem('email');
        if (t) {
            token.value = t;
            user.value = { name: n, email: e };
            // 登入成功後自動拉取資料
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
                
                portfolioStore.fetchAll();
            } else {
                alert("Login Failed: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Login Network Error");
        }
    };

    const logout = () => {
        token.value = '';
        user.value = {};
        localStorage.clear();
        location.reload();
    };

    return { token, user, login, logout, initAuth };
});
