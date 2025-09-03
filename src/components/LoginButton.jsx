// src/components/LoginButton.jsx
import React, { useContext, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";
import { decodeJwt } from "../utils/jwt";   // ✅ JWT 디코더 추가

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

// 백엔드 로그인 API 호출
async function googleLoginApi(code) {
  const url = `${API_BASE}/member/google/login`;
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

function LoginButton({ isLoggedIn, setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();
  const location = useLocation();

  // URL 파라미터: redirect, popup 모드 체크
  const params = new URLSearchParams(location.search);
  const redirectParam = params.get("redirect") || "/dashboard";
  const isPopup = params.get("popup") === "1";

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const redirectUri =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GOOGLE_REDIRECT_URI) ||
    window.location.origin;

  // ---- Google OAuth: auth-code flow ----
  const loginWithCode = useGoogleLogin({
    flow: "auth-code",
    redirect_uri: redirectUri,
    scope: "openid profile email",
    onSuccess: async ({ code }) => {
      setErrMsg("");
      setLoading(true);
      try {
        // 1. 백엔드 로그인
        const backendLogin = await googleLoginApi(code);
        const { id, accessToken, refreshToken } = backendLogin || {};

        // 2. 토큰 저장
        if (accessToken) localStorage.setItem("accessToken", accessToken);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);

        // 3. JWT payload에서 name/picture 추출
        let user = { id: null, name: "User", picture: "" };
        if (accessToken) {
          const payload = decodeJwt(accessToken);
          console.log("JWT payload:", payload);

          user = {
            id: id ?? payload.memberId ?? payload.id ?? null,
            name: payload.nickname || payload.name || "User",
            picture: payload.profileImage || payload.picture || "",
          };
        }

        // 4. user 상태 저장
        localStorage.setItem("user", JSON.stringify(user));
        setUser(user);
        setIsLoggedIn(true);

        // 5. 팝업/리다이렉트 분기
        if (isPopup) {
          try {
            window.opener?.postMessage({ type: "login-success" }, window.location.origin);
          } catch (e) {
            console.warn("postMessage 실패(무시 가능):", e);
          }
          window.close();
        } else {
          navigate(redirectParam, { replace: true });
        }
      } catch (err) {
        console.error("로그인 실패:", err);
        setIsLoggedIn(false);
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

  // ---- 로그인된 상태라면 "시작하기" 버튼 ----
  const handleStartClick = () => navigate("/dashboard");

  if (isLoggedIn) {
    return (
      <button
        className="start-button"
        onClick={handleStartClick}
        aria-label="시작하기"
      >
        {texts.start}
      </button>
    );
  }

  // ---- 로그인 버튼 UI ----
  return (
    <div className="login-button-container">
      <button
        className="login-button"
        onClick={() => loginWithCode()}
        disabled={loading}
        aria-busy={loading}
      >
        <img
          src={googleIcon}
          alt="구글 로그인 아이콘"
          className="google-icon"
        />
        <span>{loading ? "로그인 중..." : texts.login}</span>
      </button>

      {errMsg ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#c00",
            wordBreak: "break-all",
          }}
        >
          {errMsg}
        </div>
      ) : null}
    </div>
  );
}

export default LoginButton;
