// src/components/LoginButton.jsx
import { useNavigate } from "react-router-dom"; // 추가
import React, { useContext } from "react";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";

// code만 받아서 백엔드로 전달하는 함수
async function googleLoginApi(code) {
  const res = await fetch("http://www.michiki.org/member/google/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("구글 로그인 실패");
  console.log("@@응답값:", res.json.toString);
  return res.json();
}

function LoginButton({ setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate(); // 추가

  // 성공 콜백: code를 바로 받도록 구조분해
  const handleLoginSuccess = async ({ code }) => {
    console.log("구글 인증 코드:", code);
    try {
      const backendLogin = await googleLoginApi(code);

      // 상태 업데이트 & 토큰 저장
      setUser({ id: backendLogin.id });
      setIsLoggedIn(true);
      if (backendLogin.accessToken) {
        localStorage.setItem("accessToken", backendLogin.accessToken);
      }
      if (backendLogin.refreshToken) {
        localStorage.setItem("refreshToken", backendLogin.refreshToken);
      }

      // 백엔드에서 처리된 후, 실제 OAuth 콜백 엔드포인트로 리디렉트
      navigate("/dashboard");
    } catch (err) {console.error("로그인 실패:", err);
      setIsLoggedIn(false);
    }
  };

  const handleLoginError = () => {
    console.log("구글 로그인 중 오류 발생");
  };

  // useGoogleLogin에 redirect_uri 옵션을 추가
  const login = useGoogleLogin({
    flow: "auth-code",
    redirect_uri: "http://www.michiki.org",
    // redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
  });

  return (
    <div className="login-button-container">
      <button className="login-button" onClick={() => login()}>
        <img
          src={googleIcon}
          alt="구글 로그인 아이콘"
          className="google-icon"
        />
        <span>{texts.login}</span>
      </button>
    </div>
  );
}

export default LoginButton;