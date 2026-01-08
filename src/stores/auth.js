import { defineStore } from 'pinia';
import { CONFIG } from '../config';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('auth_token') || null,
    user: JSON.parse(localStorage.getItem('user_info') || 'null')
  }),

  actions: {
    async loginWithGoogle(credential) {
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential })
        });

        const data = await response.json();

        if (data.success) {
          this.token = data.token;
          this.user = data.user;
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user_info', JSON.stringify(data.user));
        } else {
          throw new Error(data.error || 'Login failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.location.reload();
    },

    initAuth() {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user_info');
      
      if (token && user) {
        this.token = token;
        this.user = JSON.parse(user);
      }
    }
  }
});
