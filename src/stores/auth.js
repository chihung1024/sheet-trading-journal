import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { usePortfolioStore } from './portfolio';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '' });
  const portfolioStore = usePortfolioStore();

  // 初始化認證狀態
  const initAuth = () => {
    const t = localStorage.getItem('token');
    const n = localStorage.getItem('name');
    const e = localStorage.getItem('email');
    
    if (t) {
      token.value = t;
      user.value = { name: n, email: e };
      console.log('✅ 已從 localStorage 恢復認證狀態');
      
      // ✅ 修復：還原自動拉取資料（這是關鍵修復）
      portfolioStore.fetchAll();
    }
  };

  // Google 登入
  const login = async (googleCredential) => {
    try {
      console.log('🔄 正在驗證 Google 憑證...');
      
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_token: googleCredential })
      });

      const data = await res.json();
      
      if (data.success) {
        console.log('✅ 登入成功！');
        
        token.value = data.token;
        user.value = { name: data.user, email: data.email };
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('name', data.user);
        localStorage.setItem('email', data.email);
        
        console.log('📦 用戶資訊已保存到 localStorage');
        
        await portfolioStore.fetchAll();
        
        console.log('📊 投資組合數據已載入');
      } else {
        console.error('❌ 登入失敗:', data.error);
        throw new Error(`登入失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('❌ 登入過程出錯:', error);
      throw error;
    }
  };

  // 登出
  const logout = () => {
    token.value = '';
    user.value = {};
    localStorage.clear();
    console.log('✅ 已登出');
    location.reload();
  };

  return {
    token,
    user,
    login,
    logout,
    initAuth
  };
});
