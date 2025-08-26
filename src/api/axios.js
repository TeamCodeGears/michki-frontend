// // src/api/axios.js
// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:8080",
//   withCredentials: false,
// });

// let isRefreshing = false;
// let pending = [];

// function onRefreshed(newAccessToken) {
//   pending.forEach((cb) => cb(newAccessToken));
//   pending = [];
// }

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("accessToken");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   config.headers["Content-Type"] = "application/json";
//   return config;
// });

// // 401 처리: refresh-token으로 갱신 후 원요청 재시도
// api.interceptors.response.use(
//   (res) => res,
//   async (error) => {
//     const { config, response } = error;
//     if (!response) return Promise.reject(error); // 네트워크 오류 등

//     // 이미 한 번 재시도한 요청이면 그대로 실패 반환
//     if (config.__isRetry) return Promise.reject(error);

//     if (response.status === 401) {
//       const refreshToken = localStorage.getItem("refreshToken");
//       if (!refreshToken) return Promise.reject(error);

//       if (!isRefreshing) {
//         isRefreshing = true;
//         try {
//           // Swagger: POST /auth/refresh-token  (body: { refreshToken })
//           const { data } = await axios.post(
//             "http://localhost:8080/auth/refresh-token",
//             { refreshToken },
//             { headers: { "Content-Type": "application/json" } }
//           );
//           // 백엔드 응답 필드명에 맞춰 accessToken 키 조정
//           const newAccessToken =
//             data?.accessToken ?? data?.access_token ?? data?.token;
//           if (!newAccessToken) throw new Error("No access token in refresh result");
//           localStorage.setItem("accessToken", newAccessToken);
//           onRefreshed(newAccessToken);
//         } catch (e) {
//           // 재발급 실패 → 로그인 상태 해제
//           localStorage.removeItem("accessToken");
//           localStorage.removeItem("refreshToken");
//           localStorage.removeItem("user");
//           isRefreshing = false;
//           pending = [];
//           return Promise.reject(e);
//         }
//         isRefreshing = false;
//       }

//       // 새 토큰이 들어오면 원요청 재시도
//       const retryOriginal = new Promise((resolve) => {
//         pending.push((newToken) => {
//           config.headers.Authorization = `Bearer ${newToken}`;
//           config.__isRetry = true;
//           resolve(api(config));
//         });
//       });
//       return retryOriginal;
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;
