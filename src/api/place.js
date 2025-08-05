// src/api/place.js

// 장소 등록 API
export async function createPlace(planId, data, accessToken) {
  const res = await fetch(`/plans/${planId}/places`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error("장소 등록 실패: " + msg);
  }

  return await res.json(); // 응답은 string일 수 있음
}

// 📁 src/api/place.js

export async function updatePlace(planId, data, accessToken) {
  const res = await fetch(`/plans/${planId}/places`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error("장소 수정 실패: " + msg);
  }

  return await res.json(); // 응답은 string일 수 있음
}

