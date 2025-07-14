import './LoginButton.css';
import googleIcon from '../assets/google-icon.png'; 
import { useGoogleLogin } from '@react-oauth/google';

function LoginButton({ texts }) {
  // 로그인 성공시 발생 함수
  const handleLoginSuccess = (credentialResponse) => {
    console.log("로그인 성공:", credentialResponse);
  };

  // 로그인 실패시 발생 함수
  const handleLoginError = () => {
    console.log('로그인 실패');
  };

  const login = useGoogleLogin ({ // 구글 훅 로그인
    onSuccess : handleLoginSuccess, 
    onError : handleLoginError,
  });

  return (
    <div className="login-button-container">
        <button className = "login-button" onClick={() => login()}>
         <img src={googleIcon} alt="구글 로그인 아이콘" className="google-icon" />
         <span> {texts.login} </span>
        </button>
    </div>
  );
}

export default LoginButton;