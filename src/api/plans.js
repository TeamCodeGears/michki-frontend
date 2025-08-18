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

  // 1) 응답 본문에서 시도
  const data = res.data ?? {};
  const planId =
    data.planId ??
    data.id ??
    data?.data?.planId ??
    null;

  if (planId) return { ...data, planId };

  // 2) 폴백: 목록에서 방금 만든 플랜 찾기
  const year = Number(String(startDate).slice(0, 4));
  const list = await getPlans(year);

  // 제목 + 날짜가 일치하는 항목 우선
  const found = list.find(
    (p) =>
      p.title === title &&
      String(p.startDate).slice(0, 10) === String(startDate).slice(0, 10) &&
      String(p.endDate).slice(0, 10) === String(endDate).slice(0, 10)
  );
  if (found?.planId) return found;

  // 그래도 없으면 같은 제목 중 가장 최근(번호 큰 것) 선택
  const candidates = list.filter((p) => p.title === title);
  if (candidates.length) {
    candidates.sort((a, b) => (b.planId ?? 0) - (a.planId ?? 0));
    return candidates[0];
  }

  throw new Error("생성 응답에 planId가 없고 목록에서도 찾을 수 없어요.");
}

/** 방 나가기 (백엔드: POST /plans/{planId}; 마지막 1인이면 실제 삭제) */
export async function leavePlan(planId) {
  await http.post(`/plans/${planId}`);
}

/** 내 색상 변경 */
export async function changeColor(planId, color) {
  await http.post(`/plans/${planId}/newColor`, { color });
}

/**
 * 일정 삭제 (대시보드 X 버튼에서 사용)
 * └ 실제로는 '방 나가기'와 동일 엔드포인트 호출
 *    마지막 1인이라면 서버가 플랜을 삭제함.
 */
export async function deletePlan(planId) {
  await http.post(`/plans/${planId}`);
}

/** getPlans를 listPlans 이름으로도 사용 (대시보드 호환) */
export { getPlans as listPlans };
