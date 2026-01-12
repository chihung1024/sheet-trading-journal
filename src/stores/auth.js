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

  // ✅ 修正：使用硬重載徹底清除狀態
  const logout = () => {
    console.log('🚪 正在登出...');
    
    // 1. 保存用戶 email（用於撤銷授權）
    const userEmail = user.value?.email || '';
    
    // 2. 清理本地狀態
    token.value = '';
    user.value = {};
    
    // 3. 清除所有 localStorage（包括可能的其他快取）
    localStorage.clear();
    
    // 4. 清除 sessionStorage
    sessionStorage.clear();
    
    // 5. ✅ 清理 Google Sign-In 狀態
    if (window.google?.accounts?.id) {
      try {
        // 取消自動選擇
        window.google.accounts.id.disableAutoSelect();
        
        // 撤銷授權
        if (userEmail && window.google.accounts.id.revoke) {
          window.google.accounts.id.revoke(userEmail, (done) => {
            console.log('✅ Google OAuth 授權已撤銷', done);
          });
        }
        
        console.log('✅ Google Sign-In 狀態已清理');
      } catch (e) {
        console.warn('⚠️ 清理 Google 狀態時出錯:', e);
      }
    }
    
    // 6. ✅ 關鍵修正：使用硬重載 (清除快取)
    console.log('✅ 已登出，正在硬重載頁面...');
    
    // 使用 location.replace 並加上時間戳強制硬重載
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now()); // 加上時間戳防止快取
    
    // 延遲一點時間確保清理完成
    setTimeout(() => {
      // 使用 replace 避免留下歷史記錄
      window.location.replace(url.toString());
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
