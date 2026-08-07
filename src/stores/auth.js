import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CONFIG } from '../config';
import { exchangeGoogleCredential } from '../services/authApi.js';
import {
  TOKEN_STORAGE_KEY,
  persistAuthentication,
  readAuthenticationStorage,
} from '../services/authStorage.js';
import { createGoogleCredentialRefreshController } from '../services/googleCredentialRefresh.js';
import {
  decodeJwtClaims,
  isJwtExpired,
} from '../services/jwtClaims.js';
import { clearSensitiveProjectStorage } from '../services/projectStorage.js';

const readSignedEmail = (claims) => {
  if (typeof claims?.email !== 'string' || !claims.email.trim()) {
    throw new Error('Authentication token has no signed tenant email');
  }
  return claims.email.trim().toLowerCase();
};

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const user = ref({ name: '', email: '', picture: '' });
  let refreshController = null;
  let storageSyncStarted = false;

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

      // 先完成可回滾的持久化，再公布 reactive 登入狀態，避免半登入。
      const persisted = persistAuthentication(localStorage, authenticated);
      token.value = persisted.token;
      user.value = {
        ...authenticated.user,
        email: persisted.user.email,
      };

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
  const cancelTokenRefresh = () => refreshController?.cancel();

  const clearInMemoryAuthState = () => {
    cancelTokenRefresh();
    token.value = '';
    user.value = { name: '', email: '', picture: '' };
  };

  const handleStorageEvent = (event) => {
    if (event.key === TOKEN_STORAGE_KEY && event.newValue === null) {
      clearInMemoryAuthState();
      console.log('✅ 已同步其他分頁的登出狀態');
    }
  };

  const startStorageSync = () => {
    if (storageSyncStarted || !globalThis.window?.addEventListener) return;
    globalThis.window.addEventListener('storage', handleStorageEvent);
    storageSyncStarted = true;
  };

  const stopStorageSync = () => {
    if (!storageSyncStarted || !globalThis.window?.removeEventListener) return;
    globalThis.window.removeEventListener('storage', handleStorageEvent);
    storageSyncStarted = false;
  };

  const logout = () => {
    clearInMemoryAuthState();
    try {
      clearSensitiveProjectStorage(localStorage);
    } catch (error) {
      console.warn('⚠️ 部分本機專案狀態清除失敗:', error);
    }
    console.log('✅ 已登出');
    location.reload();
  };

  const initAuth = () => {
    try {
      const stored = readAuthenticationStorage(localStorage);
      const storedToken = stored.token;
      if (!storedToken) return false;

      const claims = decodeJwtClaims(storedToken);
      if (isJwtExpired(storedToken, { skewSeconds: 300 })) {
        throw new Error('Stored token is expired or too close to expiry');
      }

      const signedEmail = readSignedEmail(claims);
      if (
        typeof stored.email === 'string'
        && stored.email.trim()
        && stored.email.trim().toLowerCase() !== signedEmail
      ) {
        console.warn('⚠️ 忽略與簽章 Token 不一致的本機 email');
      }

      const restoredName = typeof claims.name === 'string'
        ? claims.name
        : (typeof stored.name === 'string' ? stored.name : '');

      // 所有 claims 驗證完成後才發布 token，避免 watcher 啟動無效排程。
      token.value = storedToken;
      user.value = {
        name: restoredName,
        email: signedEmail,
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
    cancelTokenRefresh,
    startStorageSync,
    stopStorageSync,
  };
});
