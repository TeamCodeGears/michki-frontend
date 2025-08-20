// src/api/plans.js
import http from "./http";

/** 연도별 플랜 목록 */
export async function getPlans(year) {
  const res = await http.get("/plans", { params: { year } });
  return res.data ?? [];
}

/** 단건 조회 */
export async function getPlan(planId) {
  const res = await http.get(`/plans/${planId}`);
  return res.data;
}

/** 생성 (+ planId 미반환 대비 폴백) */
export async function createPlan({ title, startDate, endDate }) {
  const payload = { title, startDate, endDate };
  const res = await http.post("/plans", payload);

  const data = res.data ?? {};
  const planId =
    data.planId ?? data.id ?? data?.data?.planId ?? null;

  if (planId) return { ...data, planId };

  // 폴백: 방금 만든 플랜 찾기
  const year = Number(String(startDate).slice(0, 4));
  const list = await getPlans(year);

  const found = list.find(
    (p) =>
      p.title === title &&
      String(p.startDate).slice(0,10) === String(startDate).slice(0,10) &&
      String(p.endDate).slice(0,10) === String(endDate).slice(0,10)
  );
  if (found?.planId) return found;

  const candidates = list.filter((p) => p.title === title);
  if (candidates.length) {
    candidates.sort((a,b) => (b.planId ?? 0) - (a.planId ?? 0));
    return candidates[0];
  }
  throw new Error("생성 응답에 planId가 없고 목록에서도 찾을 수 없어요.");
}

/** 방 나가기 (백엔드: POST /plans/{planId}; 마지막 1인이면 삭제) */
export async function leavePlan(planId) {
  await http.post(`/plans/${planId}`);
}

/** 내 아바타 테두리 색상 변경 */
export async function changeColor(planId, color) {
  await http.post(`/plans/${planId}/newColor`, { color });
}

/** 일정 삭제 = 방 나가기와 동일 호출 */
export async function deletePlan(planId) {
  await http.post(`/plans/${planId}`);
}

/** 온라인 멤버 */
export async function getOnlineMembers(planId) {
  const res = await http.get(`/plans/${planId}/members/online-members`);
  return res.data ?? [];
}

/** 공유된 플랜 조회 */
export async function getSharedPlan(shareURI) {
  const res = await http.get(`/plans/share/${shareURI}`);
  return res.data;
}

/** getPlans를 listPlans 이름으로도 export (호환) */
export { getPlans as listPlans };
