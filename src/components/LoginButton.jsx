import React, { useContext } from 'react';
import './LoginButton.css';
import googleIcon from '../assets/google-icon.webp';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';

// 서버 요청 함수도 code로 받도록 바꿔야 함!
async function googleLoginApi(googleAuthCode) {
  const res = await fetch('/member/google/login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: googleAuthCode }), // ← 핵심!
  });
  if (!res.ok) throw new Error("구글 로그인 실패");
  return await res.json();
}

function LoginButton({ setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const handleLoginSuccess = async (tokenResponse) => {
    console.log("구글 인증 코드:", tokenResponse.code); // code 확인!
    try {
      // 1. 구글 프로필 요청은 code 기반으로 할 수 없으므로(옵션에 따라 필요하면 생략)
      // 실제로 code만 서버로 보내고, 서버에서 구글 프로필 처리하는 경우가 많음

      // 2. 내 백엔드에 구글 인증코드 전달!
      const backendLogin = await googleLoginApi(tokenResponse.code);

      // 3. 상태 업데이트 & 토큰 저장
      // (서버에서 내려주는 정보로 setUser/로그인 처리)
      setUser(backendLogin.user || {}); // 서버에서 user 정보 반환 시
      setIsLoggedIn(true);

      if (backendLogin.accessToken) {
        localStorage.setItem('accessToken', backendLogin.accessToken);
      }
      if (backendLogin.refreshToken) {
        localStorage.setItem('refreshToken', backendLogin.refreshToken);
      }

      navigate('https://teamcodegears.github.io/michki-frontend/oauth/google/redirect');
    } catch (err) {
      console.error("로그인 실패:", err);
      setIsLoggedIn(false);
    }
  };

  const handleLoginError = () => {
    console.log('로그인 실패');
  };

  // flow: 'auth-code' 옵션 추가!!
  const login = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
  });

  return (
    <div className="login-button-container">
      <button className="login-button" onClick={() => login()}>
        <img src={googleIcon} alt="구글 로그인 아이콘" className="google-icon" />
        <span>{texts.login}</span>
      </button>
    </div>
  );
}

export default LoginButton;
