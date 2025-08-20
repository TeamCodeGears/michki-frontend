// src/components/RoomPresenceDock.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { changeColor } from "../api/plans";

/** 입장 순서 기본 팔레트 (테두리 노란 느낌은 CSS로 표현) */
const COLORS = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#1677ff", "#722ed1", "#eb2f96"];

/** 팝오버에서 보여줄 팔레트 (원하면 추가/수정) */
const PALETTE = COLORS; // 동일 팔레트 사용 (원하면 더 늘려도 됨)

const ringStyle = (c, clickable) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: `4px solid ${c}`,
  overflow: "hidden",
  background: "#fff",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,.18)",
  fontWeight: 800,
  color: "#444",
  cursor: clickable ? "pointer" : "default",
});


function getPresence(roomKey) {
  try {
    return JSON.parse(localStorage.getItem(`presence:${roomKey}`) || "{}");
  } catch {
    return {};
  }
}
function setPresence(roomKey, data) {
  localStorage.setItem(`presence:${roomKey}`, JSON.stringify(data));
}

export default function RoomPresenceDock({ roomKey, currentUser, planId }) {
  /** 훅은 항상 호출 (조기 return 금지) */
  const [members, setMembers] = useState([]);
  const dockRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });

  // 이미지 에러 트래킹: 실패한 멤버는 이니셜로 폴백
  const [imgErrorMap, setImgErrorMap] = useState({});

  const me = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: String(currentUser.id || currentUser.email || "me"),
      name: currentUser.name || "User",
      picture: currentUser.picture || "",
    };
  }, [currentUser]);

  /** 내 현재 색상 (멤버 없을 때 안전 디폴트) */
  const myColor = useMemo(() => {
    if (!me) return COLORS[0];
    const mine = members.find((m) => m.id === me.id);
    return mine?.color || COLORS[0];
  }, [members, me]);

  /** 입장/퇴장 & 주기 동기화 */
  useEffect(() => {
    if (!roomKey || !me) return;

    const now = Date.now();
    const store = getPresence(roomKey);

    if (!store[me.id]) {
      const order = Object.keys(store).length;
      const color = COLORS[order % COLORS.length];
      store[me.id] = { id: me.id, name: me.name, picture: me.picture, color, ts: now };
    } else {
      store[me.id] = { ...store[me.id], name: me.name, picture: me.picture, ts: now };
    }
    setPresence(roomKey, store);

    const updateUI = () => {
      const latest = getPresence(roomKey);
      setMembers(Object.values(latest).sort((a, b) => a.ts - b.ts));
    };
    updateUI();
    const i = setInterval(updateUI, 1200);

    return () => {
      clearInterval(i);
      const s = getPresence(roomKey);
      delete s[me.id];
      setPresence(roomKey, s);
    };
  }, [roomKey, me]);

  /** 외부 클릭 시 팝오버 닫기 */
  useEffect(() => {
    const onDocClick = (e) => {
      if (!dockRef.current) return;
      if (!dockRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const hasMembers = roomKey && members.length > 0;

  /** 내 아바타 클릭 → 팝오버 위치 계산 & 토글 */
  const openPickerForMe = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setPickerPos({ x: rect.left, y: rect.top });
    setPickerOpen((v) => !v);
  };

  /** 이미 사용 중인 색(다른 사람)이면 선택 불가 */
  const usedColors = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (!me || m.id !== me.id) set.add(m.color);
    });
    return set;
  }, [members, me]);

  /** 색 적용 (경합 방지 포함) */
  const applyColor = async (hex) => {
    if (!me) return;

    // 최신 상태 재확인 (경합 방지)
    const s = getPresence(roomKey);
    const takenByOther = Object.values(s).some((m) => m.color === hex && m.id !== me.id);
    if (takenByOther) {
      alert("이미 다른 사용자가 선택한 색상입니다.");
      return;
    }

    // 낙관적 반영
    if (s[me.id]) s[me.id].color = hex;
    setPresence(roomKey, s);
    setMembers(Object.values(s).sort((a, b) => a.ts - b.ts));

    try {
      if (planId) await changeColor(planId, hex);
    } catch (e) {
      console.error("색 저장 실패:", e);
      // 필요 시 롤백 로직 추가 가능
    } finally {
      setPickerOpen(false);
    }
  };

  return (
    <div
      ref={dockRef}
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 1000,
        display: "flex",
        gap: 12,
        padding: 0,
        background: "transparent",
      }}
    >
      {hasMembers
        ? members.map((m) => {
            const isMe = me && m.id === me.id;
            const showImage = m.picture && !imgErrorMap[m.id];
            const initial = (m.name?.[0] || "U").toUpperCase();

            return (
              <button
                key={m.id}
                title={isMe ? "아바타 색 선택" : m.name}
                aria-label={m.name}
                style={ringStyle(m.color, isMe)}
                onClick={isMe ? openPickerForMe : undefined}
              >
                {showImage ? (
                  <img
                    src={m.picture}
                    alt={m.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    referrerPolicy="no-referrer" // 구글 이미지 차단 방지
                    onError={() =>
                      setImgErrorMap((prev) => ({
                        ...prev,
                        [m.id]: true, // 실패 시 이니셜로 폴백
                      }))
                    }
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </button>
            );
          })
        : null}

      {/* 팝오버: 어두운 배경 + 연살구색 테두리 느낌 */}
      {pickerOpen && (
        <div
          style={{
            position: "fixed",
            left: pickerPos.x,
            top: pickerPos.y - 60, // 아바타 위에 뜨도록
            transform: "translateX(-6px)",
            background: "#fffbe5",
            borderRadius: 10,
            padding: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
            display: "flex",
            gap: 10,
            zIndex: 10000,
          }}
          role="dialog"
          aria-label="아바타 색 선택"
        >
          {PALETTE.map((c) => {
            const disabled = usedColors.has(c) && c !== myColor; // 다른 사람이 쓰는 색이면 비활성(내가 이미 쓰는 건 허용)
            return (
              <button
                key={c}
                onClick={() => !disabled && applyColor(c)}
                title={disabled ? "이미 사용 중" : c}
                aria-label={`색상 ${c}`}
                style={{
                  width: 30,
                  height: 35,
                  borderRadius: "50%",
                  background: c,
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                  outline: "none",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
