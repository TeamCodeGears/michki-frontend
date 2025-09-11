import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSharedPlan } from "../api/plans"; // 아래 2번에 추가
import { getAvatarBorderColor } from "../utils/avatarColor";

export default function ShareGate() {
  const { shareURI } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const access = localStorage.getItem("accessToken");
    if (!access) {
      // 나중에 로그인 성공 시 이어가기
      localStorage.setItem("pendingShareURI", shareURI);
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        const plan = await getSharedPlan(shareURI); // { planId, title, startDate, endDate, places: [...] }
        if (!plan?.planId) throw new Error("플랜을 찾을 수 없어요.");
        // 스케줄맵으로 이동(상태도 함께 전달 가능)
        navigate(`/schedule/${plan.planId}`, {
          replace: true,
          state: {
            title: plan.title,
            startDate: plan.startDate,
            endDate: plan.endDate,
            planId: plan.planId,
            // destination 같은 건 필요 시 추가
          },
        });
      } catch (e) {
        console.error(e);
        alert("공유 링크를 불러오지 못했어요.");
        navigate("/dashboard", { replace: true });
      }
    })();
  }, [shareURI, navigate]);

  return null;
}
