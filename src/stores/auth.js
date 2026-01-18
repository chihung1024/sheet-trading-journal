import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '' });

  /**
   * ✅ [修復版]：檢查 token 是否過期
   * 解決 Google Token (Base64Url) 在 atob() 下解析失敗的問題
   */
  const isTokenExpired = () => {
    if (!token.value) return true;
    
    try {
      // 1. 分解 JWT
      const parts = token.value.split('.');
      if (parts.length !== 3) return true;
      
      // 2. 修復 Base64Url 編碼問題
      // 將 '-' 轉回 '+', '_' 轉回 '/'，確保 atob() 能正常運作
      const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      
      // 3. 解析 JSON
      const payload = JSON.parse(atob(base64Payload));
      const now = Math.floor(Date.now() / 1000);
      
      // 4. 檢查是否過期（緩衝 5 分鐘，即 300 秒）
      return payload.exp < (now + 300);
    } catch (e) {
      console.error('❗ Token 解析異常 (Base64Url 解碼失敗):', e);
      return true; // 發生解析錯誤時，為了安全性視為過期
    }
  };

  // 初始化認證狀態
  const initAuth = () => {
    const t = localStorage.getItem('token');
    const n = localStorage.getItem('name');
    const e = localStorage.getItem('email');
    
    if (t) {
      token.value = t;
      user.value = { name: n, email: e };
      
      // ✅ 檢查 token 是否過期
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
    initAuth,
    isTokenExpired
  };
});
