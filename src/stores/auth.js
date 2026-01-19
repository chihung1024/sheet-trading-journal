import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';

/**
 * Auth Store: 認證管理中心 (v20260119 穩定版)
 * 修改：優化 JWT 解析邏輯，支援 UTF-8 字元集，增強 Token 過期檢查的健壯性
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '', picture: '' });

  /**
   * ✅ [優化版]：檢查 token 是否過期
   * 解決 Google Token (Base64Url) 在 atob() 下可能發生的 UTF-8 編碼解析失敗問題
   */
  const isTokenExpired = () => {
    if (!token.value) return true;
    
    try {
      // 1. 分解 JWT (Header.Payload.Signature)
      const parts = token.value.split('.');
      if (parts.length !== 3) return true;
      
      // 2. 修復 Base64Url 編碼問題
      // 將 '-' 轉回 '+', '_' 轉回 '/'，確保 atob() 能正常運作
      const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      
      // 3. 安全解析 JSON (支援多位元組字元，如中文姓名)
      const jsonPayload = decodeURIComponent(
        escape(window.atob(base64Payload))
      );
      
      const payload = JSON.parse(jsonPayload);
      const now = Math.floor(Date.now() / 1000);
      
      // 4. 檢查是否過期（設有 300 秒/5 分鐘的緩衝時間）
      return payload.exp < (now + 300);
    } catch (e) {
      console.error('❗ [Auth] Token 解析異常 (可能為非法格式):', e);
      return true; // 發生解析錯誤時，為了安全性視為過期
    }
  };

  /**
   * 初始化認證狀態 (從 LocalStorage 恢復)
   */
  const initAuth = () => {
    const t = localStorage.getItem('token');
    const n = localStorage.getItem('name');
    const e = localStorage.getItem('email');
    const p = localStorage.getItem('picture');
    
    if (t) {
      token.value = t;
      user.value = { name: n, email: e, picture: p };
      
      // 檢查 Token 是否仍有效
      if (isTokenExpired()) {
        console.warn('⚠️ [Auth] 持久化的 Token 已過期，執行自動登出');
        logout();
        return false;
      }
      
      console.log('✅ [Auth] 已從 localStorage 成功恢復認證狀態');
      return true; 
    }
    return false;
  };

  /**
   * Google 登入驗證
   * 向後端 Worker 發送憑證以換取系統存取權
   */
  const login = async (googleCredential) => {
    try {
      console.log('🔄 [Auth] 正在與後端驗證 Google 憑證...');
      
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_token: googleCredential })
      });

      if (!res.ok) {
        throw new Error(`伺服器回應錯誤: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        console.log('✅ [Auth] 登入成功');
        
        token.value = data.token;
        // 儲存用戶資訊
        user.value = { 
          name: data.user, 
          email: data.email,
          picture: data.picture || '' // 支援顯示 Google 頭像
        };
        
        // 持久化儲存
        localStorage.setItem('token', data.token);
        localStorage.setItem('name', data.user);
        localStorage.setItem('email', data.email);
        if (data.picture) localStorage.setItem('picture', data.picture);
        
        return true;
      } else {
        throw new Error(data.error || '驗證失敗');
      }
    } catch (error) {
      console.error('❌ [Auth] 登入過程失敗:', error);
      throw error;
    }
  };

  /**
   * 登出系統
   * 徹底清理緩存並觸發頁面刷新，確保數據流完全中斷
   */
  const logout = () => {
    token.value = '';
    user.value = { name: '', email: '', picture: '' };
    
    // 清除所有本地儲存 (包含主題、標籤、Token)
    localStorage.clear();
    
    console.log('✅ [Auth] 使用者已登出，清理環境中...');
    
    // 強制重新整理頁面，這會觸發 Service Worker 更新並重置所有 Store 狀態
    window.location.reload();
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
