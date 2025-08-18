import React, { useEffect, useMemo, useState } from "react";

/** 입장 순서 색: 빨/주/노/초/파/남/보 */
const COLORS = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#1677ff", "#722ed1", "#eb2f96"];

const ringStyle = (c) => ({
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
});

function getPresence(roomKey) {
  try { return JSON.parse(localStorage.getItem(`presence:${roomKey}`) || "{}"); }
  catch { return {}; }
}
function setPresence(roomKey, data) {
  localStorage.setItem(`presence:${roomKey}`, JSON.stringify(data));
}

export default function RoomPresenceDock({ roomKey, currentUser }) {
  const [members, setMembers] = useState([]);

  // ✅ 구글 프로필 사진 포함
  const me = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: String(currentUser.id || "me"),
      name: currentUser.name || "User",
      picture: currentUser.picture || "",
    };
  }, [currentUser]);

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
      setMembers(Object.values(latest).sort((a, b) => a.ts - b.ts)); // 입장순
    };
    updateUI();
    const i = setInterval(updateUI, 1500);

    return () => {
      clearInterval(i);
      const s = getPresence(roomKey);
      delete s[me.id];
      setPresence(roomKey, s);
    };
  }, [roomKey, me]);

  if (!roomKey || members.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 1000,
        display: "flex",
        gap: 12,
        /* 바깥 배경 패널 제거 */
        padding: 0,
        background: "transparent",
      }}
    >
      {members.map((m) => (
        <div key={m.id} title={m.name} aria-label={m.name} style={ringStyle(m.color)}>
          {m.picture ? (
            <img
              src={m.picture}
              alt={m.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span>{(m.name?.[0] || "U").toUpperCase()}</span>
          )}
        </div>
      ))}
    </div>
  );
}
