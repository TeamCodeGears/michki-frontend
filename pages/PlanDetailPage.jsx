import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { changeColor, getOnlineMembers, getPlan, leavePlan } from "../api/plans";

export default function PlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [members, setMembers] = useState([]);
  const [color, setColor] = useState("#6a6a6a");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPlan(planId);
        setPlan(p);
        const m = await getOnlineMembers(planId);
        setMembers(m);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [planId]);

  const onLeave = async () => {
    if (!window.confirm("이 플랜에서 나가시겠어요?")) return;
    setBusy(true);
    try {
      await leavePlan(planId);
      navigate("/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const onColor = async () => {
    setBusy(true);
    try {
      await changeColor(planId, color);
      alert("색깔이 변경되었습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!plan) return <div style={{ padding: 20 }}>불러오는 중…</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{plan.title}</h2>
      <div style={{ color: "#666" }}>
        {plan.startDate} ~ {plan.endDate}
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>접속 중 멤버</strong>
        <ul>
          {members.map((m) => (
            <li key={m.memberId ?? m.email}>{m.name ?? m.email}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={onColor} disabled={busy}>내 색 변경</button>
        <button onClick={onLeave} disabled={busy} style={{ color: "crimson" }}>플랜 나가기</button>
      </div>
    </div>
  );
}
