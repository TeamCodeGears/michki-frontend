// src/api/http.js
import axios from "axios";

const baseURL =
  import.meta.env?.VITE_API_BASE ||
  process.env?.VITE_API_BASE ||
  "http://localhost:8080";

const http = axios.create({ baseURL, withCredentials: false });
const raw  = axios.create({ baseURL, withCredentials: false });

const getAT = () => { try { return localStorage.getItem("accessToken"); } catch { return null; } };
const getRT = () => { try { return localStorage.getItem("refreshToken"); } catch { return null; } };
const setAT = (t) => { try { t && localStorage.setItem("accessToken", t); } catch {} };
const setRT = (t) => { try { t && localStorage.setItem("refreshToken", t); } catch {} };
const clearAll = () => { try {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
} catch {} };

http.interceptors.request.use((config)=>{
  const at = getAT();
  if (at) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${at}`;
  }
  return config;
});

const isRefreshPath = (url) => {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url, baseURL);
    return u.pathname.includes("/auth/refresh-token");
  } catch {
    return url.includes("/auth/refresh-token");
  }
};

http.interceptors.response.use(
  (r)=>r,
  async (error)=>{
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);

    const status = response.status;
    const shouldTryRefresh =
      (status === 401 || status === 403) && !config.__retry && !isRefreshPath(config.url);

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    config.__retry = true;

    const rt = getRT();
    if (!rt) {
      clearAll();
      return Promise.reject(error);
    }

    try {
      const { data } = await raw.post("/auth/refresh-token", { refreshToken: rt });

      // 백엔드 응답 키 대응 (여러 케이스 호환)
      const newAT =
        data?.accessToken || data?.token || data?.access || null;
      const newRT =
        data?.refreshToken || data?.newRefreshToken || null;

      if (newAT) setAT(newAT);
      if (newRT) setRT(newRT);

      if (newAT) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${newAT}`;
        return http.request(config);
      }
    } catch (e) {
      // refresh 실패 → 토큰 정리
      clearAll();
    }
    return Promise.reject(error);
  }
);

export default http;
export { raw };
