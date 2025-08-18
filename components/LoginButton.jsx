import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

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

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const handleLoginSuccess = async ({ code }) => {
  setErrMsg("");
  setLoading(true);
  try {
    const backendLogin = await googleLoginApi(code);

    const name = backendLogin?.name ?? "";
    const picture = backendLogin?.picture ?? "";

    if (backendLogin?.id) {
      const nextUser = { id: backendLogin.id, name, picture };
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser)); // 로그인 유지용
    }

    if (backendLogin?.accessToken) {
      localStorage.setItem("accessToken", backendLogin.accessToken);
    }
    if (backendLogin?.refreshToken) {
      localStorage.setItem("refreshToken", backendLogin.refreshToken);
    }

    setIsLoggedIn(true);
    navigate("/dashboard"); // 필요하면 { replace: true } 붙여도 됨
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
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
  });

  // 로그인 상태일 때 누르면 대시보드로 이동하는 버튼
  const handleStartClick = () => {
    navigate("/dashboard");
  };

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

  // 로그인 안 된 상태의 구글 로그인 버튼
  return (
    <div className="login-button-container">
      <button
        className="login-button"
        onClick={() => login()}
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
