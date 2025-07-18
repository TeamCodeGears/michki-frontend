import { useContext } from 'react';
import './LoginButton.css';
import googleIcon from '../assets/google-icon.png';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext';

function LoginButton({ setIsLoggedIn }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const handleLoginSuccess = (credentialResponse) => {
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