// src/components/LoginButton.jsx
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "";

async function googleLoginApi(code) {
  const url = `${API_BASE}/member/google/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    // credentials: "include", // ← 쿠키 세션이면 주석 해제
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`구글 로그인 실패: ${res.status} ${text}`);
  }
  return res.json(); // { id, name, picture, accessToken, refreshToken }
}

function LoginButton({ setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const handleLoginSuccess = async ({ code }) => {
    setErrMsg("");
    setLoading(true);
    try {
      const data = await googleLoginApi(code);

      const user = {
        id: data?.id ?? "",
        name: data?.name ?? "",
        picture: data?.picture ?? "",
      };
      setUser(user);
      setIsLoggedIn(true);

      if (data?.accessToken) localStorage.setItem("accessToken", data.accessToken);
      if (data?.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/dashboard"); // 로그인 후 대시보드로
    } catch (err) {
      console.error("로그인 실패:", err);
      setIsLoggedIn(false);
      setErrMsg(err?.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginError = (err) => {
    console.error("구글 로그인 중 오류 발생:", err);
    setErrMsg("구글 로그인 중 오류가 발생했습니다.");
  };

  const redirectUri =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GOOGLE_REDIRECT_URI) ||
    "http://localhost:5173";

  const login = useGoogleLogin({
    flow: "auth-code",
    redirect_uri: redirectUri,
    // scope: "openid profile email",
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
  });

  return (
    <div className="login-button-container">
      <button
        className="login-button"
        onClick={() => login()}
        disabled={loading}
        aria-busy={loading}
      >
        <img src={googleIcon} alt="구글 로그인 아이콘" className="google-icon" />
        <span>{loading ? "로그인 중..." : texts.login}</span>
      </button>

      {errMsg ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#c00", wordBreak: "break-all" }}>
          {errMsg}
        </div>
      ) : null}
    </div>
  );
}

export default LoginButton;
