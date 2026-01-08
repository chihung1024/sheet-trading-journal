import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio';

export const useAuthStore = defineStore('auth', () => {
  // 狀態
  const token = ref(localStorage.getItem('auth_token') || null);
  const user = ref({
    name: localStorage.getItem('user_name') || null,
    email: localStorage.getItem('user_email') || null,
    picture: localStorage.getItem('user_picture') || null
  });

  // 初始化認證狀態
  const initAuth = async () => {
    if (token.value) {
      try {
        const portfolioStore = usePortfolioStore();
        await portfolioStore.fetchAll();
        console.log('✅ 認證狀態已初始化');
      } catch (err) {
        console.error('❌ 初始化錯誤:', err);
        logout();
      }
    }
  };

  // Google 登入
  const login = async (googleCredential) => {
    try {
      console.log('🔄 正在驗證 Google 憑證...');
      
      // 發送到後端驗證
      const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idtoken: googleCredential
        })
      });

      const data = await response.json();

      if (data.success) {
        // 保存 token 和用戶信息
        token.value = data.token;
        user.value = {
          name: data.user.name || data.user,
          email: data.email,
          picture: data.picture || null
        };

        // 保存到 localStorage
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_name', user.value.name);
        localStorage.setItem('user_email', user.value.email);
        if (data.picture) {
          localStorage.setItem('user_picture', data.picture);
        }

        console.log('✅ 登入成功:', user.value.name);
        
        // 重新整理頁面以載入數據
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        throw new Error(data.error || '登入失敗');
      }
    } catch (error) {
      console.error('❌ 登入錯誤:', error);
      throw error;
    }
  };

  // 登出
  const logout = () => {
    token.value = null;
    user.value = {
      name: null,
      email: null,
      picture: null
    };
    localStorage.clear();
    console.log('✅ 已登出');
    window.location.reload();
  };

  return {
    token,
    user,
    login,
    logout,
    initAuth
  };
});
