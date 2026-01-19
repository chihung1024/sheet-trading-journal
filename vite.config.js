import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Vite Configuration (v20260119 穩定版)
 * 修改：優化構建策略，增強 PWA 資源穩定性與環境變數注入
 */
export default defineConfig(({ mode }) => {
  // 載入環境變數 (如 .env 文件)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // ✅ 注入全域變數，供前端代碼使用
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: JSON.stringify("v20260119")
    },
    build: {
      // 確保構建輸出目錄乾淨
      outDir: 'dist',
      emptyOutDir: true,
      // 優化資源混淆
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // 生產環境移除 console
          drop_debugger: true
        }
      },
      // ✅ 關鍵：Rollup 代碼分割策略
      // 避免單個 JS 檔案過大，並優化瀏覽器快取
      rollupOptions: {
        output: {
          manualChunks(id) {
            // 將 node_modules 中的大型套件獨立出來
            if (id.includes('node_modules')) {
              if (id.includes('apexcharts')) return 'vendor-charts-apex';
              if (id.includes('chart.js')) return 'vendor-charts-js';
              if (id.includes('vue') || id.includes('pinia')) return 'vendor-vue-core';
              return 'vendor'; // 其他套件統一打包
            }
          },
          // 確保靜態資源檔名包含 hash 以利快取更新
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      // 提昇編譯後的資源大小警告限制
      chunkSizeWarningLimit: 1000
    },
    // ✅ 開發伺服器設定
    server: {
      port: 5173,
      host: true,
      open: true,
      cors: true
    }
  };
});
