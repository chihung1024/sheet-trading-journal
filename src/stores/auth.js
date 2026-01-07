import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('access_token') || null);
  const user = ref(JSON.parse(localStorage.getItem('user_info') || 'null'));
  const error = ref(null);

  // 初始化：檢查 URL 是否有 callback token
  const initAuth = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    if (params.has('access_token')) {
      const accessToken = params.get('access_token');
      token.value = accessToken;
      localStorage.setItem('access_token', accessToken);
      
      // 清除 URL hash，保持網址乾淨
      window.history.replaceState(null, null, ' ');
      
      fetchUserInfo(accessToken);
    } else if (token.value) {
      // 如果已經有 token，檢查是否過期或有效
      fetchUserInfo(token.value);
    }
  };

  const login = () => {
    // Google OAuth 2.0 Implicit Flow
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CONFIG.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&response_type=token&scope=email%20profile`;
    window.location.href = authUrl;
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
        throw new Error('Token expired or invalid');
      }
    } catch (e) {
      console.error('Auth Error:', e);
      logout(); // Token 失效則登出
    }
  };
  
  // 為了相容之前的 API Token 模式，這裡保留 setToken 介面，但內部邏輯改為處理 OAuth Token
  const setToken = (newToken) => {
      token.value = newToken;
      localStorage.setItem('access_token', newToken);
  };

  return { token, user, login, logout, initAuth, setToken };
});
