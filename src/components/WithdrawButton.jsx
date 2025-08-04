import { withdrawMember } from '../api/member';

function WithdrawButton({ onWithdraw }) {
  const handleWithdraw = async () => {
    if (!window.confirm('정말 탈퇴하시겠습니까?')) return;
    try {
      const accessToken = localStorage.getItem('accessToken');
      await withdrawMember(accessToken);

      // 토큰 삭제 및 로그아웃 처리
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (onWithdraw) onWithdraw();
    } catch (err) {
      console.error("회원 탈퇴 실패:", err);
    }
  };

  return <button onClick={handleWithdraw}>회원 탈퇴</button>;
}

export default WithdrawButton;
