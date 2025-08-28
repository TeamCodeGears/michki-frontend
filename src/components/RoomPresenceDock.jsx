import React, { useEffect, useMemo, useRef, useState } from "react";
import { changeColor, getPlan, getMyColorViaPlan, markNotificationsRead } from "../api/plans";
import createPlanStompClient from "../socket/planSocket";

/* ========================= helpers & constants ========================= */

const COLORS = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#1677ff", "#722ed1", "#eb2f96"];
const PALETTE = COLORS;

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

const getIdStr = (x) => String(x?.memberId ?? x?.id ?? x?.email ?? Math.random());

function getPresence(roomKey) {
  try {
    return JSON.parse(localStorage.getItem(`presence:${roomKey}`) || "{}");
  } catch {
    return {};
  }
}
function setPresence(roomKey, data) {
  try {
    localStorage.setItem(`presence:${roomKey}`, JSON.stringify(data));
  } catch { }
}

/* ========================= UI: Avatar ========================= */

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
            display: "block",
            boxSizing: "border-box",
            border: `3px solid ${borderColor || "#ccc"}`,
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
            userSelect: "none",
          }}
        >
          {fallbackInitial?.[0]?.toUpperCase() || "U"}
        </span>
      )}
    </button>
  );
}

/* ========================= main ========================= */

export default function RoomPresenceDock({ roomKey, currentUser, planId, colorsByMember, onColorSaved }) {
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

  const membersRef = useRef(members);
  const memberIdsRef = useRef(new Set());
  useEffect(() => {
    membersRef.current = members;
    memberIdsRef.current = new Set(members.map((m) => String(m.id)));
  }, [members]);

  // 알림음
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);
  const playJoinSound = () => {
    try {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    } catch { }
  };

  // me
  const me = useMemo(() => {
    if (!currentUser) return null;
    const rawPic =
      currentUser.picture ||
      currentUser.profileImage ||
      currentUser.profileImageUrl ||
      currentUser.photoUrl ||
      "";
    return {
      id: getIdStr(currentUser),
      memberId: currentUser.memberId ?? currentUser.id ?? null,
      nickname: currentUser.name || currentUser.nickname || "User",
      name: currentUser.name || currentUser.nickname || "User",
      picture: normalizeGooglePhoto(rawPic),
    };
  }, [currentUser]);

  const myColor = useMemo(() => {
    if (!me) return null;
    const c = colorsByMember?.get?.(String(me.memberId ?? me.id));
    return c ?? null;
  }, [me, colorsByMember]);

  const pickFreeColor = (usedColorsSet) => {
    for (const c of PALETTE) if (!usedColorsSet.has(c)) return c;
    return PALETTE[0];
  };

  /* ==== 초기(내 색 불러오기) ==== */
  useEffect(() => {
    if (!roomKey || !me || !planId) return;
    if (didRunRef.current) return;
    didRunRef.current = true;

    let intervalId;

    (async () => {
      const now = Date.now();
      const store = getPresence(roomKey);

      // 내 색 서버에서 1회 조회
      try {
        await getPlan(planId);
        const { color: c } = await getMyColorViaPlan(planId, {
          memberId: me.memberId,
          nickname: me.nickname,
        });
        setServerMyColor(c ?? null);
        await onColorSaved?.();   // ← 저장 후 멤버 재조회 트리거
      } catch (e) {
        const sc = e?.response?.status;
        if (sc === 404) console.warn(`Plan ${planId} not found/inaccessible.`);
        else console.warn("getPlan/getMyColorViaPlan failed:", sc || e?.message);
      }

      // 로컬 presence에 내 정보 반영
      const pic = normalizeGooglePhoto(me.picture);
      if (!store[me.id]) {
        store[me.id] = { id: me.id, name: me.name, picture: pic, color: serverMyColor ?? null, ts: now };
      } else {
        store[me.id] = {
          ...store[me.id],
          name: me.name,
          picture: pic,
          color: (serverMyColor ?? store[me.id].color ?? null),
          ts: store[me.id].ts ?? now,
        };
      }
      setPresence(roomKey, store);

      const initialMembers = Object.values(store).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setMembers(initialMembers);

      // 폴백 업데이트(웹소켓 연결 전)
      intervalId = setInterval(() => {
        if (stompReadyRef.current) return;
        const latest = getPresence(roomKey);
        setMembers(Object.values(latest).sort((a, b) => (a.ts || 0) - (b.ts || 0)));
      }, 1200);
    })();

    return () => {
      clearInterval(intervalId);
      const s = getPresence(roomKey);
      delete s[me.id];
      setPresence(roomKey, s);
    };
  }, [roomKey, me, planId, serverMyColor]);

  /* ==== STOMP 온라인 목록 ==== */
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
    const topic = `/topic/plan/${planId}/online`;

    const handleOnlineListMsg = (msg) => {
      try {
        const list = JSON.parse(msg.body || "[]");
        if (!Array.isArray(list)) return;

        const prev = membersRef.current;
        const prevById = new Map(prev.map((p) => [String(p.id), p]));
        const prevIds = memberIdsRef.current;
        const now = Date.now();

        // 1) 서버 목록을 상태로 병합
        let next = list.map((m, idx) => {
          const idStr = String(m.memberId ?? m.id);
          const prevItem = prevById.get(idStr);
          const rawPic =
            m.profileImage || m.picture || m.profileImageUrl || m.photoUrl || "";
          const picture = normalizeGooglePhoto(rawPic || prevItem?.picture || "");

          return {
            id: idStr,
            memberId: m.memberId ?? m.id ?? null,
            name: m.nickname || m.name || prevItem?.name || "User",
            nickname: m.nickname || m.name || prevItem?.nickname || "User",
            picture,
            color: (m.color ?? prevItem?.color ?? null),
            ts: prevItem?.ts ?? m.joinedAt ?? (now + idx),
          };
        });

        // 2) presence 스토어를 서버 색/이름/사진으로 동기화 (→ CursorLayer와 일치)
        {
          const store = getPresence(roomKey);
          next.forEach((m) => {
            const old = store[m.id] || {};
            store[m.id] = {
              ...old,
              id: m.id,
              name: m.name,
              picture: m.picture,
              color: m.color ?? old.color ?? null,
              ts: old.ts ?? m.ts,
            };
          });
          setPresence(roomKey, store);
        }

        // 4) 정렬(입장 순)
        next.sort((a, b) => (a.ts || 0) - (b.ts || 0));

        // 5) 상태 반영
        setMembers(next);

        // 6) 벨소리/읽음
        const currentIds = new Set(list.map((m) => String(m.memberId ?? m.id)));
        let someoneNew = false;
        currentIds.forEach((id) => {
          if (!prevIds.has(id) && id !== String(me.id)) someoneNew = true;
        });

        if (!initialSyncedRef.current) {
          initialSyncedRef.current = true;
        } else if (someoneNew) {
          const t = Date.now();
          if (t - lastJoinTsRef.current > 500) {
            lastJoinTsRef.current = t;
            playJoinSound();
            markNotificationsRead(planId).catch(() => { });
          }
        }
      } catch { }
    };

    client.onConnect = () => {
      stompReadyRef.current = true;
      sub = client.subscribe(topic, handleOnlineListMsg);
    };

    return () => {
      try { sub?.unsubscribe(); } catch { }
      try { client.deactivate(); } catch { }
      stompReadyRef.current = false;
    };
  }, [planId, me]);

  /* ==== UI ==== */

  const hasMembers = roomKey && members.length > 0;

  const openPickerForMe = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setPickerPos({ x: rect.left, y: rect.top });
    setPickerOpen((v) => !v);
  };

  // 현재 방에서 다른 사람들이 쓰는 색(내 색 제외)
  const usedColors = useMemo(() => {
    const s = new Set();
    members.forEach((m) => {
      if (!m) return;
      // 다른 사람만 넣음
      if (!currentUser || String(m.id) !== String(getIdStr(currentUser))) {
        if (m.color) s.add(m.color);
      }
    });
    return s;
  }, [members, currentUser]);

  const applyColor = async (hex) => {
    if (!me || !planId) return;

    if (usedColors.has(hex)) {
      alert("이미 다른 사용자가 선택한 색상입니다.");
      return;
    }

    // 로컬 presence
    const store = getPresence(roomKey);
    if (store[me.id]) store[me.id].color = hex;
    setPresence(roomKey, store);

    // UI 즉시 반영
    setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, color: hex } : m)));

    // 서버 저장
    try {
      await changeColor(planId, hex);
      setServerMyColor(hex);
    } catch (e) {
      console.error("색 저장 실패:", e?.response?.status || e?.message);
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
        alignItems: "center",
      }}
    >
      {hasMembers &&
        members
          .slice()
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
          .map((m) => {
            const isMe = me && m.id === me.id;
            const pic = normalizeGooglePhoto(m.picture);
            const initial = m.name || "User";
            const ringColor = (() => {
              const srv = colorsByMember?.get?.(String(m.memberId ?? m.id));
              return srv ?? m.color ?? (isMe ? "#8a2be2" : "#ccc");
            })();
            return (
              <AvatarRing
                key={m.id}
                picture={pic}
                fallbackInitial={initial}
                borderColor={ringColor}
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
            const disabled = usedColors.has(c);
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
    </div>
  );
}
