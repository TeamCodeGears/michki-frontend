// src/api/client.js
import { refreshAccessToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function apiFetch(path, options = {}, retry = true) {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401 && retry && refreshToken) {
    try {
      const data = await refreshAccessToken(refreshToken); // { accessToken }
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        const headers2 = new Headers(options.headers || {});
        headers2.set('Authorization', `Bearer ${data.accessToken}`);
        res = await fetch(API_BASE + path, { ...options, headers: headers2 });
      }
    } catch (e) {
      // 재발급 실패 → 로그인 해제
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      throw e;
    }
  }
  return res;
}
