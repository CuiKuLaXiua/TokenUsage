import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(async () => {
  const { default: AutoImport } = await import('unplugin-auto-import/vite')
  const { default: Components } = await import('unplugin-vue-components/vite')
  const { ElementPlusResolver } = await import('unplugin-vue-components/resolvers')

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [
          ElementPlusResolver({
            importStyle: 'css',
          }),
        ],
        dts: 'src/components.d.ts',
      }),
    ],
    base: './',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 14200,
      host: '127.0.0.1',
    },
    build: {
      target: 'chrome120',
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            'echarts': ['echarts', 'vue-echarts'],
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
  }
})
