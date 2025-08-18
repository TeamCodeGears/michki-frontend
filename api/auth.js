import http from "./http";

// 백엔드: POST /member/google/login (idToken 전달 형식은 현재 구현과 동일하게 맞춰주세요)
export const googleLogin = async (payload) => {
  const res = await http.post("/member/google/login", payload);
  return res.data; // {accessToken, refreshToken, user: {...}} 형태라고 가정
};

export const logout = async () => {
  try {
    await http.post("/member/logout");
  } finally {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }
};

export const withdraw = async () => {
  try {
    await http.post("/member/withdraw");
  } finally {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  }
};
