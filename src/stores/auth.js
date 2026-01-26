import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONFIG } from '../config';
import { useToast } from '../composables/useToast';

export const useAuthStore = defineStore('auth', () => {
  const { addToast } = useToast();

  // --- State ---
  // 優化：直接在初始化時讀取 localStorage，減少 initAuth 的負擔
  const token = ref(localStorage.getItem('token') || '');
  const user = ref({ 
    name: localStorage.getItem('name') || '', 
    email: localStorage.getItem('email') || '' 
  });

  // --- Getters ---
  
  // 優化：新增 authHeader，統一管理 API Header，供其他 Store (如 portfolio) 使用
  const authHeader = computed(() => {
    return token.value ? { 'Authorization': `Bearer ${token.value}` } : {};
  });

  const isAuthenticated = computed(() => !!token.value && !isTokenExpired());

  // --- Actions ---

  /**
   * 檢查 Token 是否過期
   * 包含 Base64Url 修正邏輯
   */
  const isTokenExpired = () => {
    if (!token.value) return true;
    
    try {
      const parts = token.value.split('.');
      if (parts.length !== 3) return true;
      
      // 修復 Base64Url 編碼問題
      const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64Payload));
      const now = Math.floor(Date.now() / 1000);
      
      // 緩衝 5 分鐘
      return payload.exp < (now + 300);
    } catch (e) {
      console.error('❗ Token 解析異常:', e);
      return true;
    }
  };

  /**
   * 初始化認證狀態
   */
  const initAuth = () => {
    // 狀態已在 ref 初始化時載入，這裡僅做有效性檢查
    if (token.value) {
      if (isTokenExpired()) {
        console.warn('⚠️ Token 已過期，清除認證狀態');
        logout(false); // 過期不跳提示，避免騷擾用戶
        return false;
      }
      console.log('✅ 已恢復認證狀態');
      return true; 
    }
    return false;
  };

  /**
   * Google 登入
   * 保持原始邏輯：使用 { id_token: googleCredential } 格式
   */
  const login = async (googleCredential) => {
    try {
      console.log('🔄 正在驗證 Google 憑證...');
      
      // 保持原始後端接口格式，不進行更動
      const res = await fetch(`${CONFIG.API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: googleCredential }) 
      });

      const data = await res.json();
      
      if (data.success) {
        // 更新狀態
        token.value = data.token;
        user.value = { name: data.user, email: data.email };
        
        // 持久化
        localStorage.setItem('token', data.token);
        localStorage.setItem('name', data.user);
        localStorage.setItem('email', data.email);
        
        addToast(`歡迎回來，${data.user}`, 'success');
        return true;
      } else {
        const errorMsg = data.error || '驗證失敗';
        console.error('❌ 登入失敗:', errorMsg);
        addToast(`登入失敗: ${errorMsg}`, 'error');
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ 登入過程出錯:', error);
      addToast('無法連接伺服器，請稍後再試', 'error');
      throw error;
    }
  };

  /**
   * 登出
   */
  const logout = (notify = true) => {
    token.value = '';
    user.value = { name: '', email: '' };
    localStorage.clear();
    
    if (notify) {
      addToast('已成功登出', 'info');
    }
    
    // 稍微延遲重整，讓 Toast 能被看到
    setTimeout(() => {
        location.reload();
    }, 500);
  };

  return {
    // State
    token,
    user,
    
    // Getters
    authHeader,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    initAuth,
    isTokenExpired
  };
});
