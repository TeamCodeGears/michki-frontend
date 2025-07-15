import './LoginButton.css';
import googleIcon from '../assets/google-icon.png';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

function LoginButton({ texts, setIsLoggedIn }) {

  const navigate = useNavigate();

  const handleLoginSuccess = (credentialResponse) => {
    console.log("로그인 성공!", credentialResponse);
    setIsLoggedIn(true);     // 앱 로그인 상태로 변경
    navigate('/dashboard');  // 로그인 후, 대쉬보드 페이지로
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