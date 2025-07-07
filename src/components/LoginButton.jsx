import './LoginButton.css';
import googleIcon from '../assets/google-icon.png'; 

// 1. 부모로부터 texts를 props로 받도록 수정합니다.
function LoginButton({ texts }) {
  return (
    <div className="login-button-container">
      <button className="login-button">
        <img src={googleIcon} alt="구글 로고" className="google-icon" />
        {/* 2. 고정된 텍스트 대신, props로 받은 텍스트를 사용합니다. */}
        <span>{texts.login}</span>
      </button>
    </div>
  );
}

export default LoginButton;