// src/components/RoomPresenceDock.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPlan, getMyColorViaPlan, markNotificationsRead } from "../api/plans";
import createPlanStompClient, {
  subscribePlanOnline,
  subscribePlanColor,
  sendPlanColorChange,
} from "../socket/planSocket";

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
  const stompRef = useRef(null);
  const initialSyncedRef = useRef(false);
  // 멤버별 최초 입장 시각(또는 순번)을 보관
  const joinTsRef = useRef(new Map());   // key: memberId(string) -> number
  const joinSeqRef = useRef(0);          // joinedAt이 없을 때 순번 대체
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
        onColorSaved?.({ memberId: me.memberId ?? me.id, color: c ?? null });
      } catch (e) {
        const sc = e?.response?.status;
        if (sc === 404) console.warn(`Plan ${planId} not found/inaccessible.`);
        else console.warn("getPlan/getMyColorViaPlan failed:", sc || e?.message);
      }

      // 로컬 presence에 내 정보 반영
      const pic = normalizeGooglePhoto(me.picture);
      if (!store[me.id]) {
        store[me.id] = { id: me.id, name: me.name, picture: pic, color: c ?? null, ts: now };
      } else {
        store[me.id] = {
          ...store[me.id],
          name: me.name,
          picture: pic,
          color: c ?? store[me.id].color ?? null,
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
  }, [roomKey, me, planId, onColorSaved]); // serverMyColor는 의존성 제외(가드 존재)

  /* ==== STOMP 온라인 목록 & 색상 변경 구독 ==== */
  useEffect(() => {
    if (!planId || !me) return;

    const token = localStorage.getItem("accessToken") || null;
    const client = createPlanStompClient({
      token,
      onDisconnect: () => (stompReadyRef.current = false),
      onStompError: () => (stompReadyRef.current = false),
    });

    stompRef.current = client;

    let subOnline;
    let subColor;

    const byJoinStable = (a, b) => {
      const ta = a?.ts ?? 0;
      const tb = b?.ts ?? 0;
      if (ta !== tb) return ta - tb;
      const ida = String(a?.memberId ?? a?.id ?? "");
      const idb = String(b?.memberId ?? b?.id ?? "");
      return ida < idb ? -1 : ida > idb ? 1 : 0;
    };

    const handleOnlineListMsg = (msg) => {
      try {
        const list = JSON.parse(msg.body || "[]");
        if (!Array.isArray(list)) return;

        const prev = membersRef.current;
        const prevById = new Map(prev.map((p) => [String(p.id), p]));
        const prevIds = memberIdsRef.current;

        // ⬇️ 기존 presence 먼저 가져와서 저장된 ts(=join order)를 우선 고려
        const store = getPresence(roomKey);

        let next = list.map((m) => {
          const idStr = String(m.memberId ?? m.id);
          const prevItem = prevById.get(idStr);
          const rawPic = m.profileImage || m.picture || m.profileImageUrl || m.photoUrl || "";
          const picture = normalizeGooglePhoto(rawPic || prevItem?.picture || "");

          // ✅ ts(=join order) 확정 규칙:
          //  (1) 이미 localStorage에 저장된 ts가 있으면 그걸 최우선 사용
          //  (2) 아니면 서버가 준 joinedAt 사용
          //  (3) 둘 다 없으면 증가하는 순번으로 고정
          if (!joinTsRef.current.has(idStr)) {
            const storedTs = store?.[idStr]?.ts;
            const fixed = Number.isFinite(storedTs)
              ? storedTs
              : (Number.isFinite(m?.joinedAt) ? m.joinedAt : (++joinSeqRef.current));
            joinTsRef.current.set(idStr, fixed);
          }
          const ts = joinTsRef.current.get(idStr);

          return {
            id: idStr,
            memberId: m.memberId ?? m.id ?? null,
            name: m.nickname || m.name || prevItem?.name || "User",
            nickname: m.nickname || m.name || prevItem?.nickname || "User",
            picture,
            color: m.color ?? colorsByMember?.get?.(idStr) ?? prevItem?.color ?? null,
            ts,
          };
        });

        // presence 반영

        next.forEach((m) => {
          const prevEntry = store[m.id] || {};
          store[m.id] = {
            ...prevEntry,
            id: m.id,
            name: m.name,
            picture: m.picture,
            color: m.color ?? colorsByMember?.get?.(String(m.id)) ?? prevEntry.color ?? null,

            // ✅ ts는 위에서 확정한 값으로 항상 저장(새로고침 후에도 유지됨)
            ts: joinTsRef.current.get(String(m.id)),
          };
        });
        setPresence(roomKey, store);

        next.sort(byJoinStable);
        setMembers(next);

        // 새로 들어온 사람 판단하여 알림음
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

    const handleColorMsg = (msg) => {
      try {
        const raw = JSON.parse(msg.body || "null");
        if (raw && typeof raw === "object" && "memberId" in raw && "color" in raw) {
          const memberId = String(raw.memberId);
          const color = String(raw.color);
          const store = getPresence(roomKey);
          if (!store[memberId]) store[memberId] = { id: memberId, ts: Date.now() };
          store[memberId].color = color;
          setPresence(roomKey, store);
          setMembers((prev) => {
            const idx = prev.findIndex((m) => String(m.memberId ?? m.id) === memberId);
            if (idx >= 0) {
              // 기존 멤버 색만 교체(순서 보존)
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], color };
              return copy;
            }
            // ✅ 멤버가 아직 없다면 presence 정보로 "임시 멤버" 추가
            const p = store[memberId] || {};
            // ts 확정: 기존 joinTsRef 값 → store.ts → 최후 수단 joinSeq 증가
            if (!joinTsRef.current.has(memberId)) {
              const fixed = Number.isFinite(p.ts) ? p.ts : (++joinSeqRef.current);
              joinTsRef.current.set(memberId, fixed);
            }
            const newcomer = {
              id: memberId,
              memberId: memberId,
              name: p.name || p.nickname || "User",
              nickname: p.nickname || p.name || "User",
              picture: p.picture || "",
              color,
              ts: joinTsRef.current.get(memberId),
            };
            const arr = prev.concat(newcomer);
            // 처음 들어온 순서대로 안정 정렬
            arr.sort(byJoinStable);
            return arr;
          });
        }
      } catch { }
    };

    client.onConnect = () => {
      stompReadyRef.current = true;
      subOnline = subscribePlanOnline(client, planId, handleOnlineListMsg);
      subColor = subscribePlanColor(client, planId, handleColorMsg);
    };

    client.activate();

    return () => {
      try { subOnline?.unsubscribe(); } catch { }
      try { subColor?.unsubscribe(); } catch { }
      try { client.deactivate(); } catch { }
      stompRef.current = null;
      stompReadyRef.current = false;
    };
  }, [planId, me, roomKey]);

  const byJoinStable = (a, b) => {
    const ta = a?.ts ?? 0;
    const tb = b?.ts ?? 0;
    if (ta !== tb) return ta - tb;
    const ida = String(a?.memberId ?? a?.id ?? "");
    const idb = String(b?.memberId ?? b?.id ?? "");
    return ida < idb ? -1 : ida > idb ? 1 : 0;
  };

  const sortedMembers = useMemo(() => {
    return members.slice().sort(byJoinStable);
  }, [members]);

  /* ==== UI ==== */
  const hasMembers = roomKey && members.length > 0;
  const openPickerForMe = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    setPickerPos({ x: rect.left, y: rect.top });
    setPickerOpen((v) => !v);
  };

  const usedColors = useMemo(() => {
    const s = new Set();
    members.forEach((m) => {
      if (!m) return;
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

    const store = getPresence(roomKey);
    if (store[me.id]) store[me.id].color = hex;
    setPresence(roomKey, store);

    setMembers((prev) => prev.map((m) => (m.id === me.id ? { ...m, color: hex } : m)));

    try {
      if (stompRef.current && stompReadyRef.current) {
        sendPlanColorChange(stompRef.current, planId, me.memberId ?? me.id, hex);
      }
      setServerMyColor(hex);
      onColorSaved?.({ memberId: me.memberId ?? me.id, color: hex });
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
        sortedMembers.map((m) => {
          const isMe = me && m.id === me.id;
          const pic = normalizeGooglePhoto(m.picture);
          const initial = m.name || "User";
          const ringColor = (() => {
            if (m.color) return m.color;
            const srv = colorsByMember?.get?.(String(m.memberId ?? m.id));
            if (srv) return srv;
            return isMe ? "#8a2be2" : "#ccc";
          })();

          return (
            <AvatarRing
              key={String(m.memberId ?? m.id)}
              picture={pic}
              fallbackInitial={initial}
              borderColor={ringColor}
              size={40}
              onClick={isMe ? openPickerForMe : undefined}
              blocked={!isMe}
            />
          );
        })}

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
