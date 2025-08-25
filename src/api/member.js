import { apiFetch } from "./client";

/* 공통 유틸: plans.js / place.js 와 동일하게 맞춤 */
async function fetchJson(path, options) {
  const res = await apiFetch(path, options);
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    const errBody = isJson
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");
    const message =
      typeof errBody === "string" && errBody
        ? errBody
        : errBody?.message || `API ${res.status} ${res.statusText}`;
    const error = new Error(message);
    error.status = res.status;
    error.body = errBody;
    throw error;
  }

  return isJson ? await res.json() : await res.text();
}

function jsonInit(body, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

/* ==================== API ==================== */

// 1. 회원 탈퇴: POST /member/withdraw
export async function withdrawMember() {
  return await fetchJson("/member/withdraw", { method: "POST" });
}

// 2. 로그아웃: POST /member/logout
export async function logoutMember() {
  return await fetchJson("/member/logout", { method: "POST" });
}

// 3. 구글 로그인: POST /member/google/login
export async function googleLoginApi(authCode) {
  return await fetchJson(
    "/member/google/login",
    jsonInit({ code: authCode }, "POST")
  );
}
