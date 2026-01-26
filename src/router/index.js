import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

// 定義路由
const routes = [
  {
    path: '/',
    name: 'Dashboard',
    // 使用動態導入 (Lazy Loading) 提升效能
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false } // 登入頁不需要驗證
  },
  // 404 處理
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 切換頁面時自動捲動到頂部
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// 全域導航守衛 (權限控制)
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const { addToast } = useToast();

  // 確保 Auth 狀態已初始化
  if (!authStore.token && localStorage.getItem('token')) {
    authStore.initAuth();
  }

  // 1. 檢查目標頁面是否需要權限
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // 未登入，踢回 Login
      addToast('請先登入以訪問此頁面', 'warning');
      return next({ name: 'Login', query: { redirect: to.fullPath } });
    }
  }

  // 2. 已登入用戶若訪問 Login，自動轉回 Dashboard
  if (to.name === 'Login' && authStore.isAuthenticated) {
    return next({ name: 'Dashboard' });
  }

  next();
});

export default router;
