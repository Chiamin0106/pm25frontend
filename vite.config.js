import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Vue plugin 讓 Vite 可以解析 .vue 單檔元件。
  plugins: [vue()],
})
