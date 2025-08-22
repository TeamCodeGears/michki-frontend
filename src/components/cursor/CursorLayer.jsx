// src/components/cursor/CursorLayer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPlanStompClient } from "../../socket/planSocket";
import "./CursorLayer.css";

const COLORS = ["#ff4d4f","#fa8c16","#fadb14","#52c41a","#1677ff","#722ed1","#eb2f96","#13c2c2","#2f54eb"];
const BUBBLE_MS = 4000;

/* ========================= utils ========================= */
function hashColor(memberId){
  if (!memberId && memberId !== 0) return COLORS[0];
  const n = Math.abs(String(memberId).split("").reduce((a,ch)=> (a*33 + ch.charCodeAt(0))|0,5381));
  return COLORS[n % COLORS.length];
}
function clamp01(v){ return v<0?0 : v>1?1 : v; }
function formatRelative(ts){
  const sec = Math.max(1, Math.floor((Date.now()-ts)/1000));
  if (sec<60) return `${sec}초 전`;
  const m = Math.floor(sec/60);
  if (m<60) return `${m}분 전`;
  const h = Math.floor(m/60);
  return `${h}시간 전`;
}
function getPresence(roomKey){ try{ return JSON.parse(localStorage.getItem(`presence:${roomKey}`)||"{}"); }catch{ return {}; } }
function getColorFromPresence(roomKey, memberId){
  const p = getPresence(roomKey); return p?.[String(memberId)]?.color;
}
function getAvatarFromPresence(roomKey, memberId){
  const p = getPresence(roomKey); return p?.[String(memberId)]?.picture || "";
}
function sanitizeChatText(t){
  if (!t) return "";
  let s = String(t).replace(/[\u0000-\u001F\u007F]/g,""); // 제어문자 제거
  if (s.length > 500) s = s.slice(0,500);
  return s.trim();
}

/* ========================= component ========================= */
export default function CursorLayer({ planId, currentUser, isLoggedIn, roomKey, map }) {
  const token = useMemo(() => { try{ return localStorage.getItem("accessToken") || undefined; }catch{ return undefined; } }, []);
  const myMemberId = currentUser?.memberId ?? currentUser?.id ?? null;
  const myNickname = currentUser?.nickname || currentUser?.name || "Me";

  const [connected, setConnected] = useState(false);
  const stompRef = useRef(null);

  // { [memberId]: {x,y,color,nickname,ts, bubble?, avatar?} }
  const [cursors, setCursors] = useState({});

  // 내 최신 비율좌표
  const myCursorRef = useRef({ x: 0.5, y: 0.5 });

  const mapReady = !!map; // 커서만 쓰지만 prop 유지

  /* ----- STOMP 연결 ----- */
  useEffect(() => {
    if (!planId) return;
    const client = createPlanStompClient({
      token,
      onConnect: () => {
        setConnected(true);

        // 커서 수신
        client.subscribe(`/topic/plan/${planId}/mouse`, (msg) => {
          try{
            const { memberId, x, y, color, nickname, ts } = JSON.parse(msg.body);
            if (memberId==null) return;

            setCursors((prev) => {
              const prevCur = prev[memberId];
              const presenceColor = getColorFromPresence(roomKey, memberId);
              const nextCur = {
                x: clamp01(x), y: clamp01(y),
                color: color || presenceColor || prevCur?.color || hashColor(memberId),
                nickname: nickname || prevCur?.nickname || `User ${memberId}`,
                ts: ts || Date.now(),
                bubble: prevCur?.bubble,
                avatar: prevCur?.avatar,
              };
              if (
                !prevCur ||
                prevCur.x!==nextCur.x || prevCur.y!==nextCur.y ||
                prevCur.color!==nextCur.color || prevCur.nickname!==nextCur.nickname ||
                prevCur.ts!==nextCur.ts
              ) {
                return { ...prev, [memberId]: nextCur };
              }
              return prev;
            });
          }catch(e){ console.error("parse mouse", e); }
        });

        // 채팅 수신 → 커서에 버블 표시 (서버가 message 토픽 사용)
        const onChat = (msg) => {
          try{
            const cm = JSON.parse(msg.body);
            const { memberId, nickname, text, avatar, ts } = cm;
            if (memberId==null) return;

            const pic = avatar || getAvatarFromPresence(roomKey, memberId) || "";
            const safeText = sanitizeChatText(text ?? cm.message ?? "");

            const until = Date.now() + BUBBLE_MS;
            setCursors((prev) => {
              const cur = prev[memberId] || {};
              return {
                ...prev,
                [memberId]: {
                  ...cur,
                  nickname: nickname || cur.nickname || `User ${memberId}`,
                  color: cur.color || getColorFromPresence(roomKey, memberId) || hashColor(memberId),
                  avatar: cur.avatar || pic,
                  bubble: { text: safeText, until, ts: ts || Date.now() },
                },
              };
            });
          }catch(e){ console.error("parse chat", e); }
        };

        // 안전하게 양쪽 구독(서버가 message만 쓰면 이게 유효)
        client.subscribe(`/topic/plan/${planId}/message`, onChat);
        // client.subscribe(`/topic/plan/${planId}/chat`, onChat); // 필요시 유지
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
  }, [planId, token, roomKey]);

  /* ----- 커서 좌표 전송 (rAF throttle) ----- */
  useEffect(() => {
    if (!connected || !isLoggedIn || !stompRef.current) return;

    let ticking = false;
    const onMove = (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const x = clamp01(e.clientX / window.innerWidth);
        const y = clamp01(e.clientY / window.innerHeight);
        myCursorRef.current = { x, y };

        try{
          stompRef.current.publish({
            destination: `/app/plan/${planId}/mouse`,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              x, y,
              memberId: myMemberId || undefined,
              nickname: myNickname,
              color: getColorFromPresence(roomKey, myMemberId) || undefined,
              ts: Date.now(),
            }),
          });
        }catch{}
        ticking = false;
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [connected, isLoggedIn, planId, myMemberId, myNickname, roomKey]);

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

  /* ----- presence 색상 반영 ----- */
  useEffect(() => {
    if (!roomKey) return;
    const tick = () => {
      setCursors((prev) => {
        const p = getPresence(roomKey);
        let changed = false; const next = { ...prev };
        for (const [mid, cur] of Object.entries(next)) {
          const pc = p?.[String(mid)]?.color;
          if (pc && pc !== cur.color) { next[mid] = { ...cur, color: pc }; changed = true; }
        }
        return changed ? next : prev;
      });
    };
    const onStorage = (e) => { if (e.key === `presence:${roomKey}`) tick(); };
    window.addEventListener("storage", onStorage);
    const i = setInterval(tick, 1000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(i); };
  }, [roomKey]);

  /* ----- 채팅 모드 & 입력 ----- */
  const [chatMode, setChatMode] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const composingRef = useRef(false);

  useEffect(() => {
    if (chatMode) document.body.classList.add("chat-cursor");
    else document.body.classList.remove("chat-cursor");
    return () => document.body.classList.remove("chat-cursor");
  }, [chatMode]);

  // 맵 클릭 → 입력창 오픈 (현재 커서 위치 기준)
  useEffect(() => {
    if (!mapReady || !window.google?.maps) return;
    let clickL = null;
    if (chatMode) {
      clickL = map.addListener("click", (e) => {
        const domEvt = e?.domEvent;
        if (domEvt && typeof domEvt.clientX === "number") {
          myCursorRef.current = {
            x: clamp01(domEvt.clientX / window.innerWidth),
            y: clamp01(domEvt.clientY / window.innerHeight),
          };
        }
        setChatOpen(true);
        setChatMode(false);
      });
    }
    return () => clickL && window.google.maps.event.removeListener(clickL);
  }, [chatMode, mapReady, map]);

  /* ----- 채팅 전송 ----- */
  const sendChat = useCallback(() => {
    const safe = sanitizeChatText(chatText);
    if (!safe) { setChatOpen(false); setChatText(""); return; }

    // (1) 로컬 즉시 버블(연결과 무관)
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
          color: cur.color || getColorFromPresence(roomKey, myMemberId) || hashColor(myMemberId),
          avatar: cur.avatar || getAvatarFromPresence(roomKey, myMemberId) || "",
          bubble: { text: safe, until, ts: Date.now() },
        },
      };
    });

    // (2) 서버 발행은 연결된 경우에만
    if (connected && stompRef.current && planId) {
      const id = `${myMemberId || "me"}-${Date.now()}`;
      const payload = {
        id,
        text: safe,
        memberId: myMemberId || undefined,
        nickname: myNickname,
        avatar: getAvatarFromPresence(roomKey, myMemberId) || undefined,
        ts: Date.now(),
      };
      try{
        stompRef.current.publish({
          destination: `/app/plan/${planId}/message`, // ✅ 서버와 맞춤
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }catch{}
    }

    setChatText("");
    setChatOpen(false);
  }, [chatText, connected, myMemberId, myNickname, planId, roomKey]);

  if (!mapReady) return null;
  const myPos = myCursorRef.current;

  return (
    <>
      {/* === 커서 & 말풍선 === */}
      <div className="cursor-layer" aria-live="polite" aria-atomic="false">
        {Object.entries(cursors).map(([memberId, cur]) => {
          const left = `${(cur.x ?? 0.5) * 100}vw`;
          const top  = `${(cur.y ?? 0.5) * 100}vh`;
          const color = cur.color || hashColor(memberId);
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

      {/* === 채팅 입력창 (내 현재 커서 위치에 뜸) === */}
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

      {/* === 우하단 FAB === */}
      {isLoggedIn && (
        <div className="chat-fab-wrap">
          <button
            type="button"
            className={`chat-fab ${chatMode ? "chat-fab--active" : ""}`}
            title={chatMode ? "채팅 모드: 맵을 클릭하세요" : "채팅 남기기"}
            aria-pressed={chatMode}
            aria-label={chatMode ? "채팅 모드 해제" : "채팅 모드 활성화"}
            onClick={() => setChatMode((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d="M21 15a4 4 0 0 1-4 4H9l-4 3v-3H5a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
