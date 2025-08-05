import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 이 부분을 추가합니다. 저장소 이름으로 바꿔주세요.
  base: "/michiki-project-frontend/", 
})