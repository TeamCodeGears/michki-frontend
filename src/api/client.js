import { refreshAccessToken } from "./auth";

const RAW_BASE = import.meta.env.VITE_API_BASE || "";
const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

function joinUrl(base, path) {
  if (!path) return base;
  return base + (path.startsWith("/") ? path : `/${path}`);
}

function buildInit(options, token) {
  const headers = new Headers(options?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const body =
    typeof options?.bodyFactory === "function"
      ? options.bodyFactory()
      : options?.body;

  return {
    ...options,
    headers,
    body,
  };
}

export async function apiFetch(path, options = {}, retry = true) {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  // 1차 요청
  let res = await fetch(joinUrl(API_BASE, path), buildInit(options, accessToken));

  // 401 → refresh
  if (res.status === 401 && retry && refreshToken) {
    try {
      const data = await refreshAccessToken(refreshToken);
      const newAccessToken =
        data?.accessToken ?? data?.access_token ?? data?.token;

      if (newAccessToken) {
        localStorage.setItem("accessToken", newAccessToken);
        if (data?.refreshToken)
          localStorage.setItem("refreshToken", data.refreshToken);

        // 재시도 (더 이상 retry 안 함)
        res = await fetch(
          joinUrl(API_BASE, path),
          buildInit(options, newAccessToken)
        );
        return res;
      }
    } catch (e) {
      // refresh 실패 → 세션 클리어
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      throw e;
    }
  }

  return res;
}
