// src/components/cursor/CursorLayer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import createPlanStompClient, {
  subscribePlanMouse,
  subscribePlanChat,
  sendPlanMouse,
  sendPlanChat,
} from "../../socket/planSocket";
import "./CursorLayer.css";

const BUBBLE_MS = 4000;

/* ========================= utils ========================= */
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function formatRelative(ts) {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}초 전`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return `${h}시간 전`;
}
function getPresence(roomKey) {
  try { return JSON.parse(localStorage.getItem(`presence:${roomKey}`) || "{}"); }
  catch { return {}; }
}
function setPresence(roomKey, presence) {
  try { localStorage.setItem(`presence:${roomKey}`, JSON.stringify(presence || {})); } catch {}
}
function getAvatarFromPresence(roomKey, memberId) {
  const p = getPresence(roomKey); return p?.[String(memberId)]?.picture || "";
}
function getNameFromPresence(roomKey, memberId) {
  const p = getPresence(roomKey); return p?.[String(memberId)]?.name || p?.[String(memberId)]?.nickname || "";
}
function sanitizeChatText(t) {
  if (!t) return "";
  let s = String(t).replace(/[\u0000-\u001F\u007F]/g, "");
  if (s.length > 500) s = s.slice(0, 500);
  return s.trim();
}
function isTypingInInput() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const editable = el.getAttribute?.("contenteditable");
  return (tag === "input" || tag === "textarea" || tag === "select" || editable === "" || editable === "true");
}

/* ========================= component ========================= */
export default function CursorLayer({
  planId,
  currentUser,
  isLoggedIn,
  roomKey,
  map,
  /** Map<string(memberId), string(hexColor)> — 서버가 내려준 색만 담긴 맵 */
  colorsByMember,
}) {
  const token = useMemo(() => { try { return localStorage.getItem("accessToken") || undefined; } catch { return undefined; } }, []);
  const myMemberId = currentUser?.memberId ?? currentUser?.id ?? null;
  const myNickname = currentUser?.nickname || currentUser?.name || "Me";
  const myAvatar = currentUser?.picture || "";

  const [connected, setConnected] = useState(false);
  const stompRef = useRef(null);

  const [cursors, setCursors] = useState({});
  const myCursorRef = useRef({ x: 0.5, y: 0.5 });

  const mapReady = !!map;

  // 서버색 조회 helper
  const getServerColor = useCallback((memberId) => {
    if (memberId == null) return null;
    const id = String(memberId);
    return colorsByMember?.get?.(id) ?? null;
  }, [colorsByMember]);

  /* ----- 내 presence 보강(이름/사진만) ----- */
  useEffect(() => {
    if (!roomKey || !myMemberId) return;
    const p = getPresence(roomKey);
    const cur = p[String(myMemberId)] || {};
    const next = {
      ...cur,
      name: myNickname || cur.name || cur.nickname || `User ${myMemberId}`,
      picture: myAvatar || cur.picture || "",
      // ❌ 색은 저장하지 않음(서버만 신뢰)
    };
    p[String(myMemberId)] = next;
    setPresence(roomKey, p);
    try { window.dispatchEvent(new StorageEvent("storage", { key: `presence:${roomKey}` })); } catch {}
  }, [roomKey, myMemberId, myNickname, myAvatar]);

  /* ----- STOMP 연결 ----- */
  useEffect(() => {
    if (!planId) return;
    const client = createPlanStompClient({
      token,
      onConnect: () => {
        setConnected(true);

        // 커서 수신
        subscribePlanMouse(client, planId, (msg) => {
          try {
            const { memberId, x, y, /* color */ nickname, ts } = JSON.parse(msg.body);
            if (memberId == null) return;

            setCursors((prev) => {
              const prevCur = prev[memberId];
              const presenceName = getNameFromPresence(roomKey, memberId);
              const serverColor = getServerColor(memberId);

              const nextCur = {
                x: clamp01(x), y: clamp01(y),
                color: serverColor ?? prevCur?.color ?? null,
                nickname: nickname || presenceName || prevCur?.nickname || `User ${memberId}`,
                ts: ts || Date.now(),
                bubble: prevCur?.bubble,
                avatar: prevCur?.avatar,
              };
              if (
                !prevCur ||
                prevCur.x !== nextCur.x || prevCur.y !== nextCur.y ||
                prevCur.color !== nextCur.color || prevCur.nickname !== nextCur.nickname ||
                prevCur.ts !== nextCur.ts
              ) {
                return { ...prev, [memberId]: nextCur };
              }
              return prev;
            });
          } catch (e) { console.error("parse mouse", e); }
        });

        // 채팅 수신
        subscribePlanChat(client, planId, (msg) => {
          try {
            const cm = JSON.parse(msg.body);
            const { memberId, nickname, avatar, ts } = cm;
            if (memberId == null) return;

            const safeText = sanitizeChatText(cm.message ?? cm.text ?? cm.msg ?? "");
            const pic = avatar || getAvatarFromPresence(roomKey, memberId) || "";
            const presenceName = getNameFromPresence(roomKey, memberId);
            const serverColor = getServerColor(memberId);

            const until = Date.now() + BUBBLE_MS;
            setCursors((prev) => {
              const cur = prev[memberId] || {};
              return {
                ...prev,
                [memberId]: {
                  ...cur,
                  nickname: nickname || presenceName || cur.nickname || `User ${memberId}`,
                  color: serverColor ?? cur.color ?? null,
                  avatar: cur.avatar || pic,
                  bubble: { text: safeText, until, ts: ts || Date.now() },
                },
              };
            });
          } catch (e) { console.error("parse chat", e); }
        });
      },
      onDisconnect: () => setConnected(false),
    });

    stompRef.current = client;
    client.activate();

    return () => {
      try { client.deactivate(); } catch {}
      stompRef.current = null;
      setConnected(false);
    };
  }, [planId, token, roomKey, getServerColor]);

  /* ----- 전역 마우스 좌표 추적 ----- */
  useEffect(() => {
    const onMoveOnlyTrack = (e) => {
      myCursorRef.current = {
        x: clamp01(e.clientX / window.innerWidth),
        y: clamp01(e.clientY / window.innerHeight),
      };
    };
    window.addEventListener("mousemove", onMoveOnlyTrack, { passive: true });
    return () => window.removeEventListener("mousemove", onMoveOnlyTrack);
  }, []);

  /* ----- 커서 좌표 전송 ----- */
  useEffect(() => {
    if (!isLoggedIn || !stompRef.current) return;

    let ticking = false;
    const onMoveAndPublish = (e) => {
      if (!connected) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const x = clamp01(e.clientX / window.innerWidth);
        const y = clamp01(e.clientY / window.innerHeight);
        myCursorRef.current = { x, y };

        try {
          // ❌ color는 보내지 않음(서버색만 신뢰)
          sendPlanMouse(stompRef.current, planId, {
            x, y,
            memberId: myMemberId || undefined,
            nickname: myNickname,
            ts: Date.now(),
          });
        } catch { }
        ticking = false;
      });
    };

    window.addEventListener("mousemove", onMoveAndPublish, { passive: true });
    return () => window.removeEventListener("mousemove", onMoveAndPublish);
  }, [connected, isLoggedIn, planId, myMemberId, myNickname]);

  /* ----- 버블 수명 관리 ----- */
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false; const next = { ...prev };
        Object.keys(next).forEach((mid) => {
          const cur = next[mid];
          if (cur?.bubble?.until && cur.bubble.until <= now) {
            next[mid] = { ...cur, bubble: undefined }; changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  /* ----- 로컬 presence의 색 반영 로직 제거 (서버만 사용) ----- */
  // (의도적으로 없음)

  /* ----- 채팅 입력 상태 ----- */
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const composingRef = useRef(false);

  /* ----- 전역 Enter로 입력창 열기 ----- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Enter") return;
      if (chatOpen) return;
      if (!isLoggedIn) return;
      if (isTypingInInput()) return;
      e.preventDefault();
      setChatOpen(true);
      setChatText("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, isLoggedIn]);

  /* ----- 채팅 전송 ----- */
  const sendChat = useCallback(() => {
    const safe = sanitizeChatText(chatText);
    if (!safe) { setChatOpen(false); setChatText(""); return; }

    // (1) 로컬 버블
    const until = Date.now() + BUBBLE_MS;
    setCursors((prev) => {
      const cur = prev[myMemberId] || myCursorRef.current || {};
      return {
        ...prev,
        [myMemberId]: {
          ...cur,
          x: cur.x ?? myCursorRef.current.x ?? 0.5,
          y: cur.y ?? myCursorRef.current.y ?? 0.5,
          nickname: myNickname,
          // 서버색만 사용
          color: getServerColor(myMemberId) ?? cur.color ?? null,
          avatar: cur.avatar || getAvatarFromPresence(roomKey, myMemberId) || "",
          bubble: { text: safe, until, ts: Date.now() },
        },
      };
    });

    // (2) 서버 발행 — 항상 `message` 키
    if (connected && stompRef.current && planId) {
      const payload = {
        id: `${myMemberId || "me"}-${Date.now()}`,
        message: safe,
        memberId: myMemberId ?? null,
        planId: planId ?? null,
        nickname: myNickname,
        avatar: getAvatarFromPresence(roomKey, myMemberId) || undefined,
        ts: Date.now(),
      };
      try {
        sendPlanChat(stompRef.current, planId, payload, { receipt: `rcpt-${Date.now()}` });
      } catch (e) {
        console.error("[CHAT:PUBLISH:ERROR]", e);
      }
    }

    setChatText("");
    setChatOpen(false);
  }, [chatText, connected, myMemberId, myNickname, planId, roomKey, getServerColor]);

  if (!mapReady) return null;
  const myPos = myCursorRef.current;

  return (
    <>
      {/* === 커서 & 말풍선 === */}
      <div className="cursor-layer" aria-live="polite" aria-atomic="false">
        {Object.entries(cursors).map(([memberId, cur]) => {
          const left = `${(cur.x ?? 0.5) * 100}vw`;
          const top  = `${(cur.y ?? 0.5) * 100}vh`;
          // 서버색 없을 때만 임시 색(최소한의 가독성)
          const color = cur.color || "#1677ff";
          return (
            <div key={memberId} className="cursor-item" style={{ left, top }}>
              <svg className="cursor-icon" width="22" height="22" viewBox="0 0 24 24" style={{ stroke: color, fill: "white" }} xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M22 2 15 22 11 13 2 9 22 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="cursor-name" style={{ background: color }}>
                {cur.nickname || `User ${memberId}`}
              </div>
              {cur.bubble?.text ? (
                <div className="cursor-bubble" title={formatRelative(cur.bubble.ts)}>
                  {cur.bubble.text}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* === 채팅 입력창 === */}
      {isLoggedIn && chatOpen && (
        <div className="cursor-chat-input" style={{ left: `${myPos.x * 100}vw`, top: `${myPos.y * 100}vh` }}>
          <input
            autoFocus
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.isComposing || composingRef.current) return;
                e.preventDefault();
                sendChat();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setChatOpen(false);
              }
            }}
            placeholder="메시지 입력 후 Enter"
            aria-label="채팅 메시지 입력"
          />
        </div>
      )}
    </>
  );
}
