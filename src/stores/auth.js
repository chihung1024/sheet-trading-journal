import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('access_token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user_info') || 'null'));

  // 登入：直接導向 Google
  const login = () => {
    // 移除 response_type=token 以外的多餘參數，保持最簡
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CONFIG.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&response_type=token&scope=email%20profile`;
    window.location.href = authUrl;
  };

  // 初始化：處理 Google 導回來的網址
  const initAuth = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    if (params.has('access_token')) {
      const accessToken = params.get('access_token');
      token.value = accessToken;
      localStorage.setItem('access_token', accessToken);
      
      // 網址列清乾淨
      window.history.replaceState(null, null, ' ');
      
      fetchUserInfo(accessToken);
    } else if (token.value) {
      // 本地有 token 就檢查一下
      fetchUserInfo(token.value);
    }
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    window.location.reload();
  };

  const fetchUserInfo = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        user.value = data;
        localStorage.setItem('user_info', JSON.stringify(data));
      } else {
        // Token 失效就登出
        logout();
      }
    } catch (e) {
      logout();
    }
  };

  return { token, user, login, logout, initAuth };
});
