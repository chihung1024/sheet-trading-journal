import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { exchangeGoogleCredential } from '../services/authApi';
import { createGoogleCredentialRefreshController } from '../services/googleCredentialRefresh';
import {
  decodeJwtClaims,
  isJwtExpired,
} from '../services/jwtClaims';
import { clearSensitiveProjectStorage } from '../services/projectStorage';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '', picture: '' });
  let refreshController = null;

  const isTokenExpired = () => {
    if (!token.value) return true;
    try {
      return isJwtExpired(token.value, { skewSeconds: 300 });
    } catch (error) {
      console.error('❗ Token claims 解析失敗:', error);
      return true;
    }
  };

  const login = async (googleCredential, { signal = null } = {}) => {
    try {
      console.log('🔄 正在驗證 Google 憑證...');
      const authenticated = await exchangeGoogleCredential(googleCredential, {
        apiBaseUrl: CONFIG.API_BASE_URL,
        signal,
      });

      token.value = authenticated.token;
      user.value = authenticated.user;

      localStorage.setItem('token', authenticated.token);
      localStorage.setItem('name', authenticated.user.name);
      localStorage.setItem('email', authenticated.user.email);

      console.log('✅ 登入成功，認證狀態已保存');
      return true;
    } catch (error) {
      console.error('❌ 登入過程出錯:', error);
      throw error;
    }
  };

  const getRefreshController = () => {
    if (!refreshController) {
      refreshController = createGoogleCredentialRefreshController({
        getGoogleIdentity: () => globalThis.window?.google?.accounts?.id,
        clientId: CONFIG.GOOGLE_CLIENT_ID,
        exchangeCredential: (credential, { signal }) => login(credential, { signal }),
        logger: console,
      });
    }
    return refreshController;
  };

  const refreshToken = () => getRefreshController().refresh();

  const logout = () => {
    refreshController?.cancel();
    token.value = '';
    user.value = { name: '', email: '', picture: '' };
    try {
      clearSensitiveProjectStorage(localStorage);
    } catch (error) {
      console.warn('⚠️ 部分本機專案狀態清除失敗:', error);
    }
    console.log('✅ 已登出');
    location.reload();
  };

  const initAuth = () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return false;

    try {
      const claims = decodeJwtClaims(storedToken);
      if (isJwtExpired(storedToken, { skewSeconds: 300 })) {
        throw new Error('Stored token is expired or too close to expiry');
      }

      const storedName = localStorage.getItem('name');
      const storedEmail = localStorage.getItem('email');
      const restoredName = typeof storedName === 'string' && storedName.trim()
        ? storedName
        : (typeof claims.name === 'string' ? claims.name : '');
      const restoredEmail = typeof storedEmail === 'string' && storedEmail.trim()
        ? storedEmail.trim()
        : (typeof claims.email === 'string' ? claims.email.trim() : '');
      if (!restoredEmail) throw new Error('Stored authentication has no tenant email');

      token.value = storedToken;
      user.value = {
        name: restoredName,
        email: restoredEmail,
        picture: typeof claims.picture === 'string' ? claims.picture : '',
      };

      console.log('✅ 已從 localStorage 恢復認證狀態');
      return true;
    } catch (error) {
      console.warn('⚠️ 儲存的認證狀態無效，將清除:', error);
      logout();
      return false;
    }
  };

  return {
    token,
    user,
    login,
    logout,
    initAuth,
    isTokenExpired,
    refreshToken,
  };
});
