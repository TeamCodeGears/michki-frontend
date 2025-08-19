// src/api/place.js
import http from "./http";

// ✅ 장소 목록 조회 (새로고침 시 복구용)
export const listPlaces = async (planId) => {
  const res = await http.get(`/plans/${planId}/places`);
  return res.data; // [{id, name, description, latitude, longitude, googlePlaceId, travelDate, orderInDay}, ...]
};

// 장소 생성
export const createPlace = async (planId, dto) => {
  const res = await http.post(`/plans/${planId}/places`, dto);
  return res.data; // { id, ... }
};

// 장소 수정
export const updatePlace = async (planId, placeId, dto) => {
  const res = await http.put(`/plans/${planId}/places/${placeId}`, dto);
  return res.data;
};

// 장소 삭제
export const deletePlace = (planId, placeId) =>
  http.delete(`/plans/${planId}/places/${placeId}`);

// 순서 재정렬
// payload 예시: [{ placeId, orderInDay, travelDate }, ...]
export const reorderPlaces = (planId, order) =>
  http.put(`/plans/${planId}/places/reorder`, { order });

// 추천 장소
export const recommendPlaces = async (planId, dto) => {
  const res = await http.post(`/plans/${planId}/recommendations`, dto);
  return res.data;
};
