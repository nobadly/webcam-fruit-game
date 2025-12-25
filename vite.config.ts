/*
 * @Author: xianggan
 * @Date: 2025-12-25 10:12:28
 * @LastEditors: xianggan
 * @LastEditTime: 2025-12-25 10:27:53
 * @FilePath: \webcam-fruit-game\vite.config.ts
 * @Description: 
 * 
 * 
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import Inspector from 'unplugin-vue-dev-locator/vite'
import traeBadgePlugin from 'vite-plugin-trae-solo-badge'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    sourcemap: false,
  },
  plugins: [
    vue(),
    Inspector(),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#app',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ✅ 定义 @ = src
    },
  },
})
