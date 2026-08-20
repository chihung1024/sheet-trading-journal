import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createFrontendCspPlugin } from './tools/frontend_csp.mjs'
import { validateFrontendEnvironment } from './tools/frontend_environment_policy.mjs'

export default defineConfig(({ command }) => {
  if (command === 'build') {
    validateFrontendEnvironment(process.env)
  }

  return {
    plugins: [vue(), createFrontendCspPlugin({ source: process.env })],

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('pinia')) {
                return 'vendor-core'
              }
              if (id.includes('chart.js')) {
                return 'vendor-charts'
              }
              return 'vendor-common'
            }
          }
        }
      },
      chunkSizeWarningLimit: 800
    }
  }
})
