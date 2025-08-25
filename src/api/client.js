// src/api/client.js
import { refreshAccessToken } from './auth';

const RAW_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;

function joinUrl(base, path) {
  if (!path) return base;
  return base + (path.startsWith('/') ? path : `/${path}`);
}

// (선택) 바디를 매번 새로 만드는 함수도 허용: options.body || options.bodyFactory?.()
function buildInit(options, token) {
  const headers = new Headers(options?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const body = typeof options?.bodyFactory === 'function'
    ? options.bodyFactory()
    : options?.body;

  return {
    ...options,
    headers,
    body,
  };
}

export async function apiFetch(path, options = {}, retry = true) {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  // 1st request
  let res = await fetch(joinUrl(API_BASE, path), buildInit(options, accessToken));

  // If unauthorized → try refresh once
  if (res.status === 401 && retry && refreshToken) {
    try {
      const data = await refreshAccessToken(refreshToken);
      const newAccessToken =
        data?.accessToken ?? data?.access_token ?? data?.token;

      if (newAccessToken) {
        localStorage.setItem('accessToken', newAccessToken);
        if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);

        // retried request (no further retry)
        res = await fetch(joinUrl(API_BASE, path), buildInit(options, newAccessToken));
        // 두 번째도 401이면 그대로 반환 (명시적으로 의도 드러냄)
        return res;
      }
    } catch (e) {
      // refresh 실패 → 세션 클리어
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      throw e;
    }
  }

  return res;
}
