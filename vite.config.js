import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 生產環境關閉 SourceMap 以減少體積並保護原始碼
    
    // ⚠️ 關鍵優化：Rollup 打包策略
    rollupOptions: {
      output: {
        // 手動分包 (Manual Chunks)
        // 將第三方套件拆分，提升瀏覽器快取命中率與並行下載效能
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. 核心框架 (變動少，長期快取)
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vendor-core';
            }
            
            // 2. 圖表庫 (體積大，獨立拆分)
            if (id.includes('chart.js')) {
              return 'vendor-charts';
            }
            
            // 3. 其他第三方依賴
            return 'vendor-common';
          }
        }
      }
    },
    
    // 提高 Chunk 大小警告閾值 (預設 500kb)，避免因圖表庫較大而頻繁警告
    chunkSizeWarningLimit: 800
  },

  server: {
    port: 3000,
    open: true, // 啟動後自動開啟瀏覽器
    host: true  // 允許區域網路存取 (方便手機實機測試)
  }
})
