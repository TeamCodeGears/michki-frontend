// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: 'all',
  },
  define: {
    global: 'window',  // ← 추가: 브라우저 전역으로 매핑
  },
})
