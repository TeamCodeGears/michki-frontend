import { logoutMember } from '../api/member';

function LogoutButton({ onLogout }) {
  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      await logoutMember(accessToken);

      // 토큰 삭제
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');

      if (onLogout) onLogout();
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  return <button onClick={handleLogout}>로그아웃</button>;
}

export default LogoutButton;
