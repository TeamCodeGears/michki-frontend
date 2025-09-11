import { apiFetch } from "./client";

/* 공통 유틸 */
async function fetchJson(path, options) {
  const res = await apiFetch(path, options);
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    const errBody = isJson
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");
    const message =
      typeof errBody === "string" && errBody
        ? errBody
        : errBody?.message || `API ${res.status} ${res.statusText}`;
    const error = new Error(message);
    error.status = res.status;
    error.body = errBody;
    throw error;
  }

  return isJson ? await res.json() : await res.text();
}

function jsonInit(body, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

/* util */
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

function normalizePlace(p, defaults = {}) {
  if (!p) return null;
  const lat =
    p.latitude ?? p.lat ?? p.latLng?.lat ?? p.location?.lat ?? p.coord?.lat;
  const lng =
    p.longitude ?? p.lng ?? p.latLng?.lng ?? p.location?.lng ?? p.coord?.lng;
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
      defaults.orderInDay ??
      null,
  };
  if (normalized.id == null) return null;
  if (normalized.latitude == null || normalized.longitude == null) return null;
  return normalized;
}

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

/* API */

// 목록
export const listPlaces = async (planId) => {
  const data = await fetchJson(`/plans/${planId}`);
  const places = extractPlacesFromPlan(data);
  return sortPlaces(places);
};

// 생성
export const createPlace = async (planId, dto) => {
  const data = await fetchJson(
    `/plans/${planId}/places`,
    jsonInit(dto, "POST")
  );
  const directId = data?.id ?? data?.placeId ?? null;
  if (directId) return { id: directId, ...data };

  const all = await listPlaces(planId);
  const bySameDay = all.filter(
    (p) => p.travelDate === toISODate(dto.travelDate)
  );

  let found =
    dto.googlePlaceId &&
    bySameDay.find(
      (p) =>
        p.googlePlaceId === dto.googlePlaceId &&
        p.name === dto.name &&
        near(p.latitude, dto.latitude) &&
        near(p.longitude, dto.longitude)
    );

  if (!found) {
    found = bySameDay
      .filter(
        (p) =>
          p.name === dto.name &&
          near(p.latitude, dto.latitude) &&
          near(p.longitude, dto.longitude)
      )
      .sort((a, b) => (b.orderInDay ?? 0) - (a.orderInDay ?? 0))[0];
  }
  return found ?? null;
};

// 수정
export const updatePlace = async (planId, placeId, dto) => {
  return await fetchJson(
    `/plans/${planId}/places/${placeId}`,
    jsonInit(dto, "PUT")
  );
};

// 삭제
export const deletePlace = async (planId, placeId) => {
  return await fetchJson(`/plans/${planId}/places/${placeId}`, {
    method: "DELETE",
  });
};

// 순서 재정렬
export const reorderPlaces = async (planId, travelDate, places) => {
  return await fetchJson(
    `/plans/${planId}/places/reorder`,
    jsonInit(
      {
        travelDate,
        places: places.map((p) => ({
          placeId: p.placeId ?? p.id,  // <- id도 허용
          orderInDay: p.orderInDay,
        })),
      },
      "PUT"
    )
  );
};

// 추천
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
    pinCount,
  };
};
export const recommendPlaces = async (planId, dto) => {
  const centerLatitude = Number(dto?.centerLatitude);
  const centerLongitude = Number(dto?.centerLongitude);
  let zoomLevel = Number(dto?.zoomLevel);
  if (
    !Number.isFinite(centerLatitude) ||
    !Number.isFinite(centerLongitude) ||
    !Number.isFinite(zoomLevel)
  ) {
    throw new Error(
      "recommendPlaces: centerLatitude/centerLongitude/zoomLevel are required numbers"
    );
  }
  zoomLevel = Math.max(0, Math.min(22, Math.round(zoomLevel)));
  const payload = { centerLatitude, centerLongitude, zoomLevel };
  const raw = await fetchJson(
    `/plans/${planId}/recommendations`,
    jsonInit(payload, "POST")
  );
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map(normalizeRecommendation).filter(Boolean);
};
