import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // 自動更新 Service Worker (配合 usePWA.js 的邏輯)
      registerType: 'autoUpdate',
      
      // 包含在 PWA 快取中的靜態資源
      includeAssets: ['favicon.ico', 'robots.txt', 'pwa-192x192.png', 'pwa-512x512.png'],
      
      // Manifest 設定 (影響安裝到手機時的名稱與圖示)
      manifest: {
        name: 'Trading Journal PRO',
        short_name: 'Journal',
        description: '專業交易日誌與資產管理系統',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      
      // Workbox 快取策略設定
      workbox: {
        runtimeCaching: [
          // 1. Google Fonts 快取 (StaleWhileRevalidate: 優先用快取，背景更新)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 2. Google Fonts 資源檔 (字體本身)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 3. API 請求 (NetworkFirst: 優先連網，失敗則用快取)
          // 這讓使用者在離線時仍能看到最後一次更新的資產數據
          {
            urlPattern: /^https:\/\/journal-backend\.chired\.workers\.dev\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // <== 1 day
              },
              networkTimeoutSeconds: 10 // 10秒連不上則使用快取
            }
          }
        ]
      }
    })
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  server: {
    host: true, // 允許區網存取 (方便手機測試)
    port: 3000
  },
  
  build: {
    // 構建優化
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 手動拆分 Chunk，優化載入效能
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 將大型圖表庫獨立打包
            if (id.includes('chart.js') || id.includes('vue-chartjs')) {
              return 'chart-vendor';
            }
            // 將 Vue 核心生態系獨立打包
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vue-vendor';
            }
            // 其他第三方套件
            return 'vendor';
          }
        }
      }
    }
  }
});
