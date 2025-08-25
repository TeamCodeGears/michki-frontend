// src/components/InlineLoginFab.jsx
import React, { useContext, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";
import { decodeJwt } from "../utils/jwt"; // ✅ JWT 디코더

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

// --- 백엔드에 코드 전달 (구글 OAuth code → 우리 서버 토큰/유저) ---
async function googleLoginApi(code) {
  const url = `${API_BASE.replace(/\/$/, "")}/member/google/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`구글 로그인 실패: ${res.status} ${text}`);
  }
  const data = await res.json();
  console.log("@@백엔드 응답:", data);
  return data;
}

// (선택) 구글 프로필 이미지 사이즈 정규화
function normalizeGooglePhoto(url) {
  if (!url) return "";
  try {
    const u = new URL(url, window.location.origin);
    if (/googleusercontent\.com/i.test(u.hostname)) {
      const hasPathSize = /=s\d+/i.test(u.pathname);
      const hasQuerySz = u.searchParams.has("sz");
      if (!hasPathSize && !hasQuerySz) u.pathname += "=s64-c";
      return u.toString();
    }
  } catch {}
  return url;
}

/**
 * LoginButton.jsx와 동일한 구조/로직
 * - auth-code flow
 * - /member/google/login 교환
 * - accessToken 디코드해서 {id,name,picture} 생성
 * - localStorage: accessToken, refreshToken, user 저장
 *
 * props:
 *   - setUser?: (u)=>void
 *   - setIsLoggedIn?: (bool)=>void
 *   - onLoggedIn?: (u)=>void
 *   - style?: React.CSSProperties  (FAB 위치/디자인 커스터마이즈)
 *   - label?: string               (버튼 라벨)
 */
export default function InlineLoginFab({
  setUser,
  setIsLoggedIn,
  onLoggedIn,
  style,
  label,
}) {
  const { texts } = useContext(LanguageContext);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const redirectUri =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GOOGLE_REDIRECT_URI) ||
    window.location.origin;

  // ---- Google OAuth: auth-code flow (LoginButton.jsx와 동일 구조) ----
  const loginWithCode = useGoogleLogin({
    flow: "auth-code",
    redirect_uri: redirectUri,
    scope: "openid profile email",
    onSuccess: async ({ code }) => {
      setErrMsg("");
      setLoading(true);
      try {
        // 1) 백엔드 로그인 교환
        const { id, accessToken, refreshToken } = await googleLoginApi(code);

        // 2) 토큰 저장
        if (accessToken) localStorage.setItem("accessToken", accessToken);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);

        // 3) JWT payload에서 사용자 정보 구성
        let user = { id: null, name: "User", picture: "" };
        if (accessToken) {
          const payload = decodeJwt(accessToken);
          console.log("JWT payload:", payload);
          user = {
            id: id ?? payload.memberId ?? payload.id ?? null,
            name: payload.nickname || payload.name || "User",
            picture: normalizeGooglePhoto(
              payload.profileImage || payload.picture || ""
            ),
          };
        }

        // 4) 저장 + 상위로 반영
        localStorage.setItem("user", JSON.stringify(user));
        setUser?.(user);
        setIsLoggedIn?.(true);
        onLoggedIn?.(user);
      } catch (err) {
        console.error("로그인 실패:", err);
        setIsLoggedIn?.(false);
        setErrMsg(err?.message || "로그인 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      console.error("구글 로그인 중 오류 발생:", err);
      setErrMsg("구글 로그인 중 오류가 발생했습니다.");
    },
  });

  return (
    <button
      onClick={() => loginWithCode()}
      disabled={loading}
      title="로그인하고 편집 기능 사용"
      aria-label="로그인"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1200,
        padding: "10px 14px",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
        boxShadow: "0 8px 22px rgba(0,0,0,0.15)",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.85 : 1,
        ...style,
      }}
    >
      {loading ? "로그인 중..." : (label ?? texts?.login ?? "로그인")}
      {errMsg && (
        <span style={{ display: "block", marginTop: 6, color: "#c00", fontSize: 11 }}>
          {errMsg}
        </span>
      )}
    </button>
  );
}
