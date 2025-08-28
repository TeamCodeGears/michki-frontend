// src/api/plans.js
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

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null) return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

function jsonInit(body, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

/* API 함수 */

// 연도별 플랜 목록
export async function getPlans(year) {
  const data = await fetchJson(`/plans${qs({ year })}`);
  return data ?? [];
}
export { getPlans as listPlans };

// 플랜 생성
export async function createPlan({ title, startDate, endDate }) {
  const payload = { title, startDate, endDate };
  const data = await fetchJson(`/plans`, jsonInit(payload));

  const planId = data?.planId ?? data?.id ?? data?.data?.planId ?? null;
  if (planId) return { ...data, planId };

  // 폴백
  const year = Number(String(startDate).slice(0, 4));
  const list = await getPlans(year);

  const found = list.find(
    (p) =>
      p.title === title &&
      String(p.startDate).slice(0, 10) === String(startDate).slice(0, 10) &&
      String(p.endDate).slice(0, 10) === String(endDate).slice(0, 10)
  );
  if (found?.planId) return found;

  const candidates = list.filter((p) => p.title === title);
  if (candidates.length) {
    candidates.sort((a, b) => (b.planId ?? 0) - (a.planId ?? 0));
    return candidates[0];
  }
  throw new Error("생성 응답에 planId가 없고 목록에서도 찾을 수 없어요.");
}

// 플랜 상세
export async function getPlan(planId) {
  return await fetchJson(`/plans/${planId}`);
}

// 방 나가기 / 삭제
export async function leavePlan(planId) {
  const res = await fetchJson(`/plans/${planId}`, jsonInit()); // POST
  // 서버는 { message: "방 ... 성공" } 형태로 응답
  if (res && typeof res === "object" && "message" in res) {
    return res.message;
  }
  // 혹시 백엔드가 문자열을 줄 수도 있으니 폴백
  if (typeof res === "string" && res.trim()) return res;
  return "방 나가기 완료";
}
export async function deletePlan(planId) {
  await fetchJson(`/plans/${planId}`, jsonInit());
}

// 온라인 멤버 조회
export async function getOnlineMembers(planId) {
  const data = await fetchJson(`/plans/${planId}/members/online-members`);
  return data ?? [];
}

// 공유된 플랜 조회
export async function getSharedPlan(shareURI) {
  return await fetchJson(`/plans/share/${shareURI}`);
}

// 내 색상 조회
export async function getMyColorViaPlan(planId, { memberId, nickname }) {
  const data = await getPlan(planId);
  const members = data?.members || [];
  let me = null;
  if (memberId != null) {
    me = members.find((m) => String(m.memberId) === String(memberId));
  }
  if (!me && nickname) {
    me = members.find((m) => m.nickname === nickname);
  }
  return { color: me?.color ?? null, me };
}

// 알림 읽음 처리
export async function markNotificationsRead() {
  // 빈 POST (토큰만 필요)
  return await fetchJson(`/plans/notifications/read`, { method: "POST" });
}
