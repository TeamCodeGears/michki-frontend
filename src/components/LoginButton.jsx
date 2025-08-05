import { useContext } from 'react';
import './LoginButton.css';
import googleIcon from '../assets/google-icon.png';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';

function LoginButton({ setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const handleLoginSuccess = async (tokenResponse) => {
    try {
      // 구글 프로필 정보 요청
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });
      const profile = await res.json();
      console.log("구글 프로필:", profile);

      setUser(profile);      // 구글 프로필 저장
      setIsLoggedIn(true);
      navigate('/dashboard');
    } catch (err) {
      console.error("구글 프로필 불러오기 실패:", err);
      setIsLoggedIn(false);
    }
  };

  const handleLoginError = () => {
    console.log('로그인 실패');
  };

  const login = useGoogleLogin({
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
