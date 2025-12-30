import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electron 打包后使用相对路径
  base: './',
  server: {
    port: 30005
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
