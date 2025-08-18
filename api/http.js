import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE;

const http = axios.create({
  baseURL,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  const access = localStorage.getItem("accessToken");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (response?.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const r = await axios.post(`${baseURL}/auth/refresh-token`, { refreshToken });
          const newAccess = r.data?.accessToken;
          if (newAccess) {
            localStorage.setItem("accessToken", newAccess);
            config.headers.Authorization = `Bearer ${newAccess}`;
            return http.request(config);
          }
        } catch (_) {
          // 재발급 실패 → 그대로 에러
        }
      }
    }
    return Promise.reject(error);
  }
);

export default http;
