import { useContext } from "react";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { LanguageContext } from "../context/LanguageContext";
import { useAuth } from "../hooks/useAuth";

// 1. member.js에서 googleLoginApi 함수를 불러옵니다.
import { googleLoginApi } from "../api/member";

function LoginButton() {
  const { login } = useAuth();
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  // 구글 로그인 성공 시 실행될 함수
  const handleLoginSuccess = async (tokenResponse) => {
    try {
      // 2. 구글에서 받은 인증 코드(tokenResponse.code)를 백엔드로 보냅니다.
      const { accessToken, refreshToken } = await googleLoginApi(tokenResponse.code);

      // 3. AuthContext의 login 함수를 호출하여 토큰을 저장하고 로그인 상태로 만듭니다.
      login(accessToken);

      // 4. refreshToken은 브라우저 저장소에 보관합니다.
      localStorage.setItem("refreshToken", refreshToken);

      // 5. 모든 과정이 성공하면 대시보드로 이동합니다.
      navigate("/dashboard");

    } catch (error) {
      console.error("로그인 처리 중 오류 : ", error);
      alert("로그인에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 구글 로그인 훅(Hook)
  const googleLogin = useGoogleLogin({
    // 6. 백엔드와 통신하려면 반드시 'auth-code' 흐름을 사용해야 합니다.
    flow: 'auth-code',
    onSuccess: handleLoginSuccess,
    onError: () => console.log("Google 로그인 실패"),
  });

  return (
    <div className="login-button-container">
      <button className="login-button" onClick={() => googleLogin()}>
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
