import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { clearSensitiveProjectStorage } from '../services/projectStorage';

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

  // 登出：只清除本專案的敏感／租戶綁定狀態，保留主題等非敏感偏好。
  const logout = () => {
    token.value = '';
    user.value = { name: '', email: '' };
    try {
      clearSensitiveProjectStorage(localStorage);
    } catch (error) {
      console.warn('⚠️ 部分本機專案狀態清除失敗:', error);
    }
    console.log('✅ 已登出');
    location.reload();
  };

  /**
   * 靜默刷新 Token
   * 使用 Google Identity Services 自動刷新
   */
  const refreshToken = async () => {
    if (!window.google?.accounts?.id) {
      console.warn('⚠️ Google Identity Services 未載入，無法刷新 Token');
      return false;
    }

    return new Promise((resolve) => {
      try {
        window.google.accounts.id.initialize({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          callback: async (response) => {
            console.log('🔐 [Token 刷新] 收到新的 Google 憑證');
            try {
              await login(response.credential);
              console.log('✅ [Token 刷新] Token 刷新成功！');
              resolve(true);
            } catch (error) {
              console.error('❌ [Token 刷新] 登入失敗:', error);
              resolve(false);
            }
          },
          auto_select: true,
          cancel_on_tap_outside: false
        });

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('⚠️ [Token 刷新] 靜默刷新失敗，需要手動重新登入');
            resolve(false);
          }
        });

        // 10 秒逾時
        setTimeout(() => resolve(false), 10000);

      } catch (error) {
        console.error('❌ [Token 刷新] 初始化失敗:', error);
        resolve(false);
      }
    });
  };

  return {
    token,
    user,
    login,
    logout,
    initAuth,
    isTokenExpired,
    refreshToken
  };
});
