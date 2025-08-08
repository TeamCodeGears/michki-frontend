// src/api/auth.js
// 프록시 환경에서는 BASE_URL 필요 없음

// 4. 토큰 재발급
export async function refreshAccessToken(refreshToken) {
  const res = await fetch('/auth/refresh-token', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error("토큰 재발급 실패");
  return await res.json(); // { accessToken }
}
