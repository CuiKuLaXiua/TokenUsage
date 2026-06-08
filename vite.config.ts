import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 14200,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'ANNOTATION_POSITION' && warning.message?.includes('#__PURE__')) {
          return
        }
        warn(warning)
      },
    },
  },
})
