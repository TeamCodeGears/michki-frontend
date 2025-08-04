// vite.config.js
export default {
  server: {
    proxy: {
      // 백엔드의 경로에 맞게 작성 (여기서는 /member, /auth)
      '/member': 'http://43.200.191.212',
      '/auth': 'http://43.200.191.212',
    },
  },
};
