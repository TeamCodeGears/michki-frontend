import { useContext } from "react";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { LanguageContext } from "../context/LanguageContext";
import { useAuth } from "../hooks/useAuth";

function LoginButton() {
  const { login } = useAuth();
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    /* console.log("Google 로그인 성공! (백엔드 API 호출은 임시로 건너뜁니다.)", credentialResponse);*/
    /*  const handleGoogleLoginSuccess = async (credentialResponse) => {*/

    try {
      const response = await fetch("/member/google/login", {
        method: "POST",
        headers: { "Content-Type": "applecation/json" },
        body: JSON.Stringify({ code: credentialResponse.credential }),
      });
      if (!response.ok) {
        throw new Error("백앤드 서버 인증에 실패했습니다.");
      }

      const { accessToken, refreshToken } = await response.json();
      login(accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      navigate("/dashboard");
    } catch (error) {
      console.error("로그인 처리 중 오류 : ", error);
      alert("로그인에 실패했습니다. 다시 시도해주세요.");
    }
    /*
     // --*프론트 엔드 테스트를 위함*--
    login ("TEMPORAY_ACCESS_TOKEN") //임시 토큰 발행 
    navigate('/dashboard'); // 대시보드 이동을 위함*/
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLoginSuccess,
    onError: () => console.log("Google 로그인 실패"),
  });
  /*
    console.log("로그인 성공!", credentialResponse);
    setIsLoggedIn(true);
    navigate('/dashboard');
  };

  const handleLoginError = () => {
    console.log('로그인 실패');
  };
  
  const login = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
  });
  */

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
