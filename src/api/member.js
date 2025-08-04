// /src/api/member.js

// 프록시 환경에서는 BASE_URL 필요 없음

// 1. 회원 탈퇴
export async function withdrawMember(accessToken) {
  const res = await fetch('/member/withdraw', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error("회원 탈퇴 실패");
  return await res.json();
}

// 2. 로그아웃
export async function logoutMember(accessToken) {
  const res = await fetch('/member/logout', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error("로그아웃 실패");
  return await res.json();
}

// 3. 구글 로그인
export async function googleLoginApi(googleAccessToken) {
  const res = await fetch('/member/google/login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: googleAccessToken }),
  });
  if (!res.ok) throw new Error("구글 로그인 실패");
  return await res.json();
}
