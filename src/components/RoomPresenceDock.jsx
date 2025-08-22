// src/components/RoomPresenceDock.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { changeColor, getPlan, getMyColorViaPlan, markNotificationsRead } from "../api/plans";
import { createPlanStompClient } from "../socket/planSocket";

/* ========================= helpers & constants ========================= */

const COLORS = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#1677ff", "#722ed1", "#eb2f96"];
const PALETTE = COLORS;

/** 구글 프로필 URL 정규화 (경로형 =sNN-c, 쿼리형 ?sz= 둘 다 커버) */
function normalizeGooglePhoto(url) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (/googleusercontent\.com/i.test(u.hostname)) {
      const pathHasSize = /=s\d+/i.test(u.pathname);
      const queryHasSz = u.searchParams.has("sz");
      if (!pathHasSize && !queryHasSz) {
        u.pathname = u.pathname + "=s64-c";
        u.searchParams.set("sz", "64");
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** 멤버 식별자 통일 */
const getIdStr = (x) => String(x?.memberId ?? x?.id ?? x?.email ?? Math.random());

/** 로컬 프레즌스 폴백 */
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

/* ========================= AvatarRing (링 위에 이미지 덮기) ========================= */

function AvatarRing({ picture, fallbackInitial, borderColor = "#ccc", size = 40, onClick, blocked }) {
  const [failed, setFailed] = useState(false);
  const showImage = picture && !failed;

  return (
    <button
      onClick={onClick}
      title={fallbackInitial}
      aria-label={fallbackInitial}
      style={{
        position: "relative",
        width: size,
        height: size,
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: blocked ? "default" : "pointer",
        borderRadius: "50%",
        boxShadow: "0 2px 8px rgba(0,0,0,.18)",
      }}
    >
      {/* 링 (아래 레이어) */}
      {/* <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `4px solid ${borderColor}`,
          boxSizing: "border-box",
          background: "transparent",
          zIndex: 0,
        }}
      /> */}
      {/* 이미지/이니셜 (위 레이어) */}
      {showImage ? (
        <img
          src={picture}
          alt={fallbackInitial}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          decoding="async"
          loading="lazy"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
            zIndex: 1,
            display: "block",
            border: `3px solid ${borderColor || "#ccc"}`, // ✅ 본인 색깔 테두리
            left: -3,
            top: -3,
          }}
        />
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: "#666",
            zIndex: 1,
            userSelect: "none",
          }}
        >
          {fallbackInitial?.[0]?.toUpperCase() || "U"}
        </span>
      )}
    </button>
  );
}

/* ========================= main component ========================= */

export default function RoomPresenceDock({ roomKey, currentUser, planId }) {
  const [members, setMembers] = useState([]);
  const [serverMyColor, setServerMyColor] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });

  const dockRef = useRef(null);
  const didRunRef = useRef(false);
  const stompReadyRef = useRef(false);
  const initialSyncedRef = useRef(false);
  const lastJoinTsRef = useRef(0);
  const audioRef = useRef(null);

  // 알림음
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);
  const playJoinSound = async () => {
    try {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch {}
  };

  // me (로그인 사용자)
  const me = useMemo(() => {
    if (!currentUser) return null;
    const rawPic =
      currentUser.picture ||
      currentUser.profileImage ||
      currentUser.profileImageUrl ||
      currentUser.photoUrl ||
      "";
    return {
      id: String(currentUser.memberId ?? currentUser.id ?? currentUser.email ?? "me"),
      memberId: currentUser.memberId ?? currentUser.id ?? null,
      nickname: currentUser.name || currentUser.nickname || "User",
      name: currentUser.name || currentUser.nickname || "User",
      picture: normalizeGooglePhoto(rawPic),
    };
  }, [currentUser]);

  const myColor = useMemo(() => {
    if (!me) return null;
    if (serverMyColor) return serverMyColor;
    const mine = members.find((m) => m.id === me.id);
    return mine?.color || null;
  }, [members, me, serverMyColor]);

  /** 초기 로컬 세팅(+ 서버에서 내 color 조회) */
  useEffect(() => {
    if (!roomKey || !me || !planId) return;
    if (didRunRef.current) return;
    didRunRef.current = true;

    let intervalId;

    (async () => {
      const now = Date.now();
      const store = getPresence(roomKey);

      // 서버 플랜 확인 & 내 색상
      let color = null;
      try {
        await getPlan(planId);
        const { color: c } = await getMyColorViaPlan(planId, {
          memberId: me.memberId,
          nickname: me.nickname,
        });
        color = c ?? null;
        setServerMyColor(color);
      } catch (e) {
        const sc = e?.response?.status;
        if (sc === 404) {
          console.warn(`Plan ${planId} not found/inaccessible. Local-only presence.`);
        } else {
          console.warn("getPlan/getMyColorViaPlan failed:", sc || e?.message);
        }
      }

      // 로컬 프레즌스 기록
      const pic = normalizeGooglePhoto(me.picture);
      if (!store[me.id]) {
        store[me.id] = { id: me.id, name: me.name, picture: pic, color, ts: now };
      } else {
        store[me.id] = {
          ...store[me.id],
          name: me.name,
          picture: pic,
          color: color ?? store[me.id].color ?? null,
          ts: now,
        };
      }
      setPresence(roomKey, store);
      setMembers(Object.values(store).sort((a, b) => a.ts - b.ts));

      // 폴백 주기 업데이트(STOMP 켜지면 중지)
      intervalId = setInterval(() => {
        if (stompReadyRef.current) return;
        const latest = getPresence(roomKey);
        setMembers(Object.values(latest).sort((a, b) => a.ts - b.ts));
      }, 1200);
    })();

    return () => {
      clearInterval(intervalId);
      const s = getPresence(roomKey);
      delete s[me.id];
      setPresence(roomKey, s);
    };
  }, [roomKey, me, planId]);

  /** STOMP presence: LIST/JOIN/LEAVE */
  useEffect(() => {
    if (!planId || !me) return;

    const token = localStorage.getItem("accessToken") || null;
    const client = createPlanStompClient({
      token,
      onConnect: () => (stompReadyRef.current = true),
      onDisconnect: () => (stompReadyRef.current = false),
      onStompError: () => (stompReadyRef.current = false),
    });

    client.activate();

    let sub;
    const topic = `/topic/plans/${planId}/presence`;

    const handlePresenceMsg = async (msg) => {
      try {
        const payload = JSON.parse(msg.body || "{}");
        const { type, members: list, member } = payload;

        if (type === "LIST" && Array.isArray(list)) {
          // 서버 값으로 덮되, picture가 비면 이전 상태/내 로컬 사진으로 보강
          setMembers((prev) => {
            const prevById = new Map(prev.map((p) => [String(p.id), p]));
            const merged = list.map((m) => {
              const idStr = getIdStr(m);
              const prevItem = prevById.get(idStr);
              const rawPic =
                m.picture || m.profileImage || m.profileImageUrl || m.photoUrl || m.avatar || "";

              const isSelf =
                String(m.memberId ?? m.id ?? m.email) === String(me.memberId ?? me.id);

              const picture = normalizeGooglePhoto(
                rawPic || prevItem?.picture || (isSelf ? me.picture : "")
              );

              return {
                id: idStr,
                memberId: m.memberId ?? m.id ?? null,
                name: m.nickname || m.name || prevItem?.name || "User",
                nickname: m.nickname || m.name || prevItem?.nickname || "User",
                picture,
                color: m.color ?? prevItem?.color ?? null,
                ts: Date.now(),
              };
            });
            return merged;
          });

          initialSyncedRef.current = true;
          try { await markNotificationsRead(planId); } catch {}
          return;
        }

        if (type === "JOIN" && member) {
          setMembers((prev) => {
            const idStr = getIdStr(member);
            const exists = prev.some((p) => String(p.id) === idStr);
            if (exists) return prev;

            const rawPic =
              member.picture ||
              member.profileImage ||
              member.profileImageUrl ||
              member.photoUrl ||
              member.avatar ||
              "";

            const isSelf =
              String(member.memberId ?? member.id ?? member.email) === String(me.memberId ?? me.id);

            const picture = normalizeGooglePhoto(rawPic || (isSelf ? me.picture : ""));

            return [
              ...prev,
              {
                id: idStr,
                memberId: member.memberId ?? member.id ?? null,
                name: member.nickname || member.name || "User",
                nickname: member.nickname || member.name || "User",
                picture,
                color: member.color || null,
                ts: Date.now(),
              },
            ];
          });

          const isMe =
            String(member.memberId ?? member.id) === String(me.memberId ?? me.id);
          const now = Date.now();
          if (initialSyncedRef.current && !isMe && now - lastJoinTsRef.current > 500) {
            lastJoinTsRef.current = now;
            await playJoinSound();
            try { await markNotificationsRead(planId); } catch {}
          }
          return;
        }

        if (type === "LEAVE" && member) {
          const idStr = getIdStr(member);
          setMembers((prev) => prev.filter((m) => String(m.id) !== idStr));
          return;
        }
      } catch {}
    };

    client.onConnect = () => {
      stompReadyRef.current = true;
      sub = client.subscribe(topic, handlePresenceMsg);
    };

    return () => {
      try { sub?.unsubscribe(); } catch {}
      try { client.deactivate(); } catch {}
      stompReadyRef.current = false;
    };
  }, [planId, me]);

  /** 외부 클릭시 색상 팝오버 닫기 */
  useEffect(() => {
    const onDocClick = (e) => {
      if (!dockRef.current) return;
      if (!dockRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const hasMembers = roomKey && members.length > 0;

  const openPickerForMe = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setPickerPos({ x: rect.left, y: rect.top });
    setPickerOpen((v) => !v);
  };

  /** 현재 방에서 다른 사람이 쓰는 색은 선택 막기 */
  const usedColors = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (!me || m.id !== me.id) set.add(m.color);
    });
    return set;
  }, [members, me]);

  /** 색상 변경 */
  const applyColor = async (hex) => {
    if (!me || !planId) return;

    const s = getPresence(roomKey);
    const takenByOther = Object.values(s).some((m) => m.color === hex && m.id !== me.id);
    if (takenByOther) {
      alert("이미 다른 사용자가 선택한 색상입니다.");
      return;
    }

    if (s[me.id]) s[me.id].color = hex;
    setPresence(roomKey, s);
    setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, color: hex } : m)));

    try {
      await changeColor(planId, hex);
      setServerMyColor(hex);
    } catch (e) {
      console.error("색 저장 실패:", e?.response?.status || e?.message);
    } finally {
      setPickerOpen(false);
    }
  };

  /* ========================= render ========================= */

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
        alignItems: "center",
      }}
    >
      {hasMembers &&
        members.map((m) => {
          const isMe = me && m.id === me.id;
          const pic = normalizeGooglePhoto(m.picture);
          const initial = m.name || "User";
          return (
            <AvatarRing
              key={m.id}
              picture={pic}
              fallbackInitial={initial}
              borderColor={m.color || "#ccc"}
              size={40}
              onClick={isMe ? openPickerForMe : undefined}
              blocked={!isMe}
            />
          );
        })}

      {/* 색상 선택 팝오버 */}
      {pickerOpen && (
        <div
          style={{
            position: "fixed",
            left: pickerPos.x,
            top: pickerPos.y - 60,
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
            const disabled = usedColors.has(c) && c !== myColor;
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
                }}
              />
            );
          })}
        </div>
      )}

      {/* 혼자 테스트용 버튼: 배포 시에 제거 */}
      <button
        onClick={() => playJoinSound()}
        style={{
          height: 28,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 700,
          color: "#333",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          marginLeft: 6,
        }}
      >
        🔔 알람 테스트
      </button>
    </div>
  );
}
