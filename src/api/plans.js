// src/api/plans.js
import http from "./http";

/** 연도별 플랜 목록: GET /plans?year=YYYY */
export async function getPlans(year) {
  const res = await http.get("/plans", { params: { year } });
  return res.data ?? [];
}

/** (별칭) */
export { getPlans as listPlans };

/** 플랜 생성: POST /plans  (title, startDate, endDate) */
export async function createPlan({ title, startDate, endDate }) {
  const payload = { title, startDate, endDate };
  const res = await http.post("/plans", payload);

  const data = res.data ?? {};
  const planId = data.planId ?? data.id ?? data?.data?.planId ?? null;
  if (planId) return { ...data, planId };

  // 폴백: 같은 연도 목록에서 가장 근접한 걸 찾기
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

/** 플랜 상세: GET /plans/{planId} */
export async function getPlan(planId) {
  const res = await http.get(`/plans/${planId}`);
  return res.data;
}

/** 방 나가기/삭제 트리거: POST /plans/{planId}
 * - Swagger에 존재. 프로젝트에서 '나가기'와 '삭제' 모두 이 엔드포인트를 쓰므로
 *   두 이름으로 래핑해서 내보냅니다.
 */
export async function leavePlan(planId) {
  await http.post(`/plans/${planId}`);
}
export async function deletePlan(planId) {
  await http.post(`/plans/${planId}`);
}

/** 온라인 멤버: GET /plans/{planId}/members/online-members (문서에 있음) */
export async function getOnlineMembers(planId) {
  const res = await http.get(`/plans/${planId}/members/online-members`);
  return res.data ?? [];
}

/** 공유된 플랜 조회: GET /plans/share/{shareURI} */
export async function getSharedPlan(shareURI) {
  const res = await http.get(`/plans/share/${shareURI}`);
  return res.data;
}

/** 색상 변경: POST /plans/{planId}/newColor { color } */
export async function changeColor(planId, color) {
  await http.post(`/plans/${planId}/newColor`, { color });
}

/** 내 색상 조회: GET /plans/{planId} 의 members 배열에서 내 멤버 찾아 color 반환 */
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

/** 알림 읽음 처리 */
export async function markNotificationsRead(planId) {
  // planId를 서버에서 사용하지 않으면 제외해도 됨. 있으면 쿼리/바디로 같이 보냄
  return http.post("/plans/notifications/read", { planId }).then(r => r.data);
}