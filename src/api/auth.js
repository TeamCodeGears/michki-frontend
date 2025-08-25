// src/api/auth.js
// NOTE: client.js가 이 파일의 refreshAccessToken을 import하므로
// 여기서는 client의 apiFetch를 import하지 않고, 순수 fetch만 사용해
// 순환 의존을 피한다.

const RAW_BASE = import.meta.env.VITE_API_BASE || "";
const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

function joinUrl(base, path) {
  if (!path) return base;
  return base + (path.startsWith("/") ? path : `/${path}`);
}

async function fetchJson(path, init) {
  const res = await fetch(joinUrl(API_BASE, path), init);

  // 204 No Content
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
    const message =
      typeof body === "string" && body
        ? body
        : body?.message || `API ${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return isJson ? await res.json() : await res.text();
}

/** Google OAuth 로그인: POST /member/google/login  ({ code }) */
export async function loginWithGoogle(code) {
  const data = await fetchJson("/member/google/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const accessToken =
    data?.accessToken ?? data?.token ?? data?.access ?? null;
  const refreshToken =
    data?.refreshToken ?? data?.refresh ?? null;

  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));

  return data;
}

/** 로그아웃: POST /member/logout  (토큰 포함 권장) */
export async function logout() {
  try {
    const accessToken = localStorage.getItem("accessToken");
    await fetchJson("/member/logout", {
      method: "POST",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
  } catch {
    // 서버 호출 실패해도 로컬 세션 정리는 진행
  } finally {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch {}
  }
}

/** 회원 탈퇴: POST /member/withdraw  (토큰 포함 권장) */
export async function withdraw() {
  try {
    const accessToken = localStorage.getItem("accessToken");
    await fetchJson("/member/withdraw", {
      method: "POST",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
  } finally {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch {}
  }
}

/** 액세스 토큰 갱신: POST /auth/refresh-token ({ refreshToken }) */
export async function refreshAccessToken(refreshToken) {
  // client.js에서 import되어 사용됨 (401 발생 시 1회 자동 갱신)
  const data = await fetchJson("/auth/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  return data;
}
