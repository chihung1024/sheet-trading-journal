import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';

// 定義路由表
const routes = [
  {
    path: '/',
    name: 'Dashboard',
    // 使用動態導入 (Lazy Loading)，確保構建時能正確分包
    // 確保 src/views/Dashboard.vue 檔案存在
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true, title: '儀表板' }
  },
  {
    path: '/login',
    name: 'Login',
    // 確保 src/views/Login.vue 檔案存在
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false, title: '登入' }
  },
  // 捕捉所有未定義路由，導向首頁
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
});

// 全域導航守衛
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const { addToast } = useToast();

  // 設定頁面標題
  document.title = to.meta.title 
    ? `${to.meta.title} - Trading Journal PRO` 
    : 'Trading Journal PRO';

  // 確保 Auth 狀態已初始化 (防止重新整理後狀態遺失)
  if (!authStore.token && localStorage.getItem('token')) {
    authStore.initAuth();
  }

  const isAuthenticated = authStore.isAuthenticated;

  // 1. 需要權限的頁面
  if (to.meta.requiresAuth && !isAuthenticated) {
    addToast('請先登入以訪問此頁面', 'info');
    return next({ name: 'Login', query: { redirect: to.fullPath } });
  }

  // 2. 已登入用戶訪問登入頁 (自動踢回 Dashboard)
  if (to.name === 'Login' && isAuthenticated) {
    return next({ name: 'Dashboard' });
  }

  next();
});

export default router;
