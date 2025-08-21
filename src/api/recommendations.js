const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

function getAccessToken() {
  return localStorage.getItem("accessToken");
}
function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}
function setAccessToken(token) {
  if (token) localStorage.setItem("accessToken", token);
}

async function refreshAccessTokenOnce() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
      return true;
    }
  } catch {}
  return false;
}

export async function postRecommendations(planId, center, zoom, signal) {
  if (!planId) throw new Error("planId 누락");
  if (typeof center?.lat !== "number" || typeof center?.lng !== "number")
    throw new Error("center 좌표가 잘못되었습니다.");
  if (typeof zoom !== "number") throw new Error("zoomLevel 누락");

  const body = {
    centerLatitude: Number(center.lat.toFixed(6)),
    centerLongitude: Number(center.lng.toFixed(6)),
    zoomLevel: zoom,
  };

  async function call() {
    const res = await fetch(`${API_BASE}/plans/${planId}/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    return res;
  }

  // 1차 호출
  let res = await call();

  // 401이면 재발급 시도 후 1회 재시도
  if (res.status === 401) {
    const refreshed = await refreshAccessTokenOnce();
    if (refreshed) res = await call();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`추천 조회 실패: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }

  // 응답이 단일 객체/배열 모두 안전 처리
  const data = await res.json().catch(() => null);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
