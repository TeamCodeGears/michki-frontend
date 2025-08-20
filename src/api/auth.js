// src/api/auth.js
import http, { raw } from "./http";

export async function loginWithGoogle(code) {
  // 서버가 { code }를 받음 (Swagger)
  const { data } = await raw.post("/member/google/login", { code });
  const accessToken  = data?.accessToken ?? data?.token ?? data?.access ?? null;
  const refreshToken = data?.refreshToken ?? data?.refresh ?? null;
  if (accessToken)  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  if (data?.user)    localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function logout() {
  try { await http.post("/member/logout"); } catch {}
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  } catch {}
}

export async function withdraw() {
  try { await http.post("/member/withdraw"); } finally {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch {}
  }
}
