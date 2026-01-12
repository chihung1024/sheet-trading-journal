import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '' });

  const isTokenExpired = () => {
    if (!token.value) return true;
    
    try {
      const parts = token.value.split('.');
      if (parts.length !== 3) return true;
      
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp < (now + 300);
    } catch (e) {
      console.error('❗ Token 解析錯誤:', e);
      return true;
    }
  };

  const initAuth = () => {
    const t = localStorage.getItem('token');
    const n = localStorage.getItem('name');
    const e = localStorage.getItem('email');
    
    if (t) {
      token.value = t;
      user.value = { name: n, email: e };
      
      if (isTokenExpired()) {
        console.warn('⚠️ Token 已過期，清除認證狀態');
        logout();
        return false;
      }
      
      console.log('✅ 已從 localStorage 恢復認證狀態');
      return true; 
    }
    return false;
  };

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
        
        return true;
      } else {
        console.error('❌ 登入失敗:', data.error);
        throw new Error(`登入失敗: ${data.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('❌ 登入過程出錯:', error);
      throw error;
    }
  };

  // ✅ 修正登出邏輯：完全清理 Google OAuth 狀態
  const logout = () => {
    console.log('🚪 正在登出...');
    
    // 1. 清理本地狀態
    token.value = '';
    user.value = {};
    localStorage.clear();
    
    // 2. ✅ 清理 Google Sign-In 狀態
    if (window.google?.accounts?.id) {
      try {
        // 取消自動選擇
        window.google.accounts.id.disableAutoSelect();
        
        // 撤銷授權 (如果支援)
        if (window.google.accounts.id.revoke) {
          window.google.accounts.id.revoke(user.value.email || '', () => {
            console.log('✅ Google OAuth 授權已撤銷');
          });
        }
        
        console.log('✅ Google Sign-In 狀態已清理');
      } catch (e) {
        console.warn('⚠️ 清理 Google 狀態時出錯:', e);
      }
    }
    
    // 3. ✅ 添加延遲再 reload，確保清理完成
    console.log('✅ 已登出，正在重新載入...');
    setTimeout(() => {
      location.reload();
    }, 100);
  };

  return {
    token,
    user,
    login,
    logout,
    initAuth,
    isTokenExpired
  };
});
