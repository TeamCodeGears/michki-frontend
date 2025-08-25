// src/api/place.js
import http from "./http";

/** ------------ 유틸  ------------ */
const safeNum = (v) => {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

const toISODate = (dLike) => {
  if (!dLike) return null;
  try {
    if (typeof dLike === "string" && /^\d{4}-\d{2}-\d{2}/.test(dLike)) {
      return dLike.slice(0, 10);
    }
    const d = new Date(dLike);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

/** 서버 응답을 프런트 표준 필드로 정규화 */
function normalizePlace(p, defaults = {}) {
  if (!p) return null;

  const lat = p.latitude ?? p.lat ?? p.latLng?.lat ?? p.location?.lat ?? p.coord?.lat;
  const lng = p.longitude ?? p.lng ?? p.latLng?.lng ?? p.location?.lng ?? p.coord?.lng;

  const latitude = safeNum(lat);
  const longitude = safeNum(lng);

  const travelDateRaw =
    p.travelDate ?? p.visitDate ?? p.dayDate ?? defaults.travelDate ?? null;

  const normalized = {
    id: p.id ?? p.placeId ?? p.uid ?? null,
    name: (p.name ?? p.title ?? p.placeName ?? "").trim(),
    description: (p.description ?? p.memo ?? p.note ?? "").trim(),
    latitude,
    longitude,
    googlePlaceId: p.googlePlaceId ?? p.google_id ?? p.placeIdStr ?? "",
    travelDate: toISODate(travelDateRaw),
    orderInDay:
      safeNum(p.orderInDay ?? p.seq ?? p.order ?? p.sortOrder) ??
      (defaults.orderInDay ?? null),
  };

  if (normalized.id == null) return null;
  if (normalized.latitude == null || normalized.longitude == null) return null;

  return normalized;
}

/** Plan 상세 응답에서 place들을 평탄화 */
function extractPlacesFromPlan(plan) {
  if (!plan || typeof plan !== "object") return [];

  const topKeys = ["places", "placeList", "placeDtos", "placeResponses"];
  for (const k of topKeys) {
    if (Array.isArray(plan[k])) {
      return plan[k]
        .map((p, i) =>
          normalizePlace(p, {
            orderInDay: i + 1,
            travelDate: p?.travelDate ?? null,
          })
        )
        .filter(Boolean);
    }
  }

  const dayKeys = ["days", "itinerary", "scheduleDays", "planDays", "itineraryDays"];
  for (const dk of dayKeys) {
    const days = plan[dk];
    if (Array.isArray(days)) {
      const out = [];
      days.forEach((day) => {
        const dayDate = day?.travelDate ?? day?.date ?? day?.dayDate ?? null;
        const innerKeys = ["places", "items", "planPlaces", "poiList"];
        for (const ik of innerKeys) {
          const arr = day?.[ik];
          if (Array.isArray(arr)) {
            arr.forEach((p, seqIdx) => {
              const np = normalizePlace(p, {
                orderInDay: seqIdx + 1,
                travelDate: dayDate,
              });
              if (np) out.push(np);
            });
          }
        }
      });
      if (out.length) return out;
    }
  }

  return [];
}

/** 정렬 */
function sortPlaces(arr) {
  return [...arr].sort((a, b) => {
    const ad = a.travelDate ?? "";
    const bd = b.travelDate ?? "";
    if (ad !== bd) return ad.localeCompare(bd);
    const ao = a.orderInDay ?? 0;
    const bo = b.orderInDay ?? 0;
    return ao - bo;
  });
}

const near = (a, b, tol = 1e-5) => Math.abs(Number(a) - Number(b)) <= tol;

/** ============ API ============ */

// 목록: /plans/{planId}
export const listPlaces = async (planId) => {
  const res = await http.get(`/plans/${planId}`);
  const places = extractPlacesFromPlan(res.data);
  return sortPlaces(places);
};

// 생성: 서버가 id를 안 주는 경우가 있어 목록 재조회로 id 회수
export const createPlace = async (planId, dto) => {
  // dto: { name, description, latitude, longitude, googlePlaceId, travelDate, orderInDay }
  const res = await http.post(`/plans/${planId}/places`, dto);
  const payload = res?.data;

  // 1) 응답 객체에 id가 있으면 그대로
  const directId = payload?.id ?? payload?.placeId ?? null;
  if (directId) return { id: directId, ...payload };

  // 2) 폴백: 목록에서 막 만든 후보 찾기
  const all = await listPlaces(planId);
  const bySameDay = all.filter((p) => p.travelDate === toISODate(dto.travelDate));

  // googlePlaceId가 있으면 1순위
  let found =
    dto.googlePlaceId &&
    bySameDay.find(
      (p) =>
        p.googlePlaceId === dto.googlePlaceId &&
        p.name === dto.name &&
        near(p.latitude, dto.latitude) &&
        near(p.longitude, dto.longitude)
    );

  // 없으면 좌표/이름으로 근사 매칭
  if (!found) {
    found = bySameDay
      .filter((p) => p.name === dto.name && near(p.latitude, dto.latitude) && near(p.longitude, dto.longitude))
      .sort((a, b) => (b.orderInDay ?? 0) - (a.orderInDay ?? 0))[0];
  }

  return found ?? null;
};

// 수정
export const updatePlace = async (planId, placeId, dto) => {
  const res = await http.put(`/plans/${planId}/places/${placeId}`, dto);
  return res.data;
};

// 삭제
export const deletePlace = (planId, placeId) =>
  http.delete(`/plans/${planId}/places/${placeId}`);

// ✅ 순서 재정렬 (스펙 준수)
export const reorderPlaces = (planId, travelDate, places) =>
  http.put(`/plans/${planId}/places/reorder`, {
    travelDate,                       // "YYYY-MM-DD"
    places: places.map((p) => ({
      placeId: p.placeId,
      orderInDay: p.orderInDay,
    })),
  });

/** ---------- 추천 ---------- */

/** 응답 정규화: 누적 핀수 필드를 pinCount로 통일 */
const normalizeRecommendation = (r) => {
  if (!r || typeof r !== "object") return null;
  const latitude = safeNum(r.latitude ?? r.lat);
  const longitude = safeNum(r.longitude ?? r.lng);
  if (latitude == null || longitude == null) return null;

  const pinCount =
    Number(
      r.pinCount ??
      r.count ??
      r.total ??
      r.hits ??
      r.frequency ??
      r.numPins ??
      r.placeCount ??
      0
    ) || 0;

  return {
    googlePlaceId: r.googlePlaceId ?? r.placeIdStr ?? r.google_id ?? "",
    name: (r.name ?? "").trim(),
    latitude,
    longitude,
    pinCount, // ✅ 누적 핀 수 (서버 집계)
  };
};

/**
 * 추천 호출 (서버 DTO: PlaceRecommendationRequestDto)
 * @param {number} planId
 * @param {{centerLatitude:number, centerLongitude:number, zoomLevel:number}} dto
 * @returns {Promise<Array<{googlePlaceId:string,name:string,latitude:number,longitude:number,pinCount:number}>>}
 */
export const recommendPlaces = async (planId, dto) => {
  // 서버 @NotNull 준수 + 타입 정리
  const centerLatitude = Number(dto?.centerLatitude);
  const centerLongitude = Number(dto?.centerLongitude);
  let zoomLevel = Number(dto?.zoomLevel);

  if (!Number.isFinite(centerLatitude) || !Number.isFinite(centerLongitude) || !Number.isFinite(zoomLevel)) {
    throw new Error("recommendPlaces: centerLatitude/centerLongitude/zoomLevel are required numbers");
    }

  // 지도 일반 범위로 클램프(선택) — 서버가 자체 검증한다면 제거해도 무방
  zoomLevel = Math.max(0, Math.min(22, Math.round(zoomLevel)));

  const payload = { centerLatitude, centerLongitude, zoomLevel };
  const res = await http.post(`/plans/${planId}/recommendations`, payload);

  const raw = Array.isArray(res?.data) ? res.data : (res?.data ? [res.data] : []);
  return raw.map(normalizeRecommendation).filter(Boolean);
};
