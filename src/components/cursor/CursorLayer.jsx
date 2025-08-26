// src/components/cursor/CursorLayer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import createPlanStompClient, {
  subscribePlanMouse,
  subscribePlanChat,
  sendPlanMouse,
  sendPlanChat,
} from "../../socket/planSocket";
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
function setPresence(roomKey, presence){
  try { localStorage.setItem(`presence:${roomKey}`, JSON.stringify(presence || {})); } catch {}
}
function getColorFromPresence(roomKey, memberId){
  const p = getPresence(roomKey); return p?.[String(memberId)]?.color;
}
function getAvatarFromPresence(roomKey, memberId){
  const p = getPresence(roomKey); return p?.[String(memberId)]?.picture || "";
}
function getNameFromPresence(roomKey, memberId){
  const p = getPresence(roomKey); return p?.[String(memberId)]?.name || p?.[String(memberId)]?.nickname || "";
}
function sanitizeChatText(t){
  if (!t) return "";
  let s = String(t).replace(/[\u0000-\u001F\u007F]/g,"");
  if (s.length > 500) s = s.slice(0,500);
  return s.trim();
}
function isTypingInInput() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const editable = el.getAttribute?.("contenteditable");
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    editable === "" ||
    editable === "true"
  );
}

/* ========================= component ========================= */
export default function CursorLayer({ planId, currentUser, isLoggedIn, roomKey, map }) {
  const token = useMemo(() => { try{ return localStorage.getItem("accessToken") || undefined; }catch{ return undefined; } }, []);
  const myMemberId = currentUser?.memberId ?? currentUser?.id ?? null;
  const myNickname = currentUser?.nickname || currentUser?.name || "Me";
  const myAvatar = currentUser?.picture || "";

  const [connected, setConnected] = useState(false);
  const stompRef = useRef(null);

  const [cursors, setCursors] = useState({});
  const myCursorRef = useRef({ x: 0.5, y: 0.5 });

  const mapReady = !!map;

  /* ----- 내 presence 보강 ----- */
  useEffect(() => {
    if (!roomKey || !myMemberId) return;
    const p = getPresence(roomKey);
    const cur = p[String(myMemberId)] || {};
    const next = {
      ...cur,
      name: myNickname || cur.name || cur.nickname || `User ${myMemberId}`,
      picture: myAvatar || cur.picture || "",
      color: cur.color || hashColor(myMemberId),
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
          try{
            const { memberId, x, y, color, nickname, ts } = JSON.parse(msg.body);
            if (memberId==null) return;

            setCursors((prev) => {
              const prevCur = prev[memberId];
              const presenceColor = getColorFromPresence(roomKey, memberId);
              const presenceName  = getNameFromPresence(roomKey, memberId);

              const nextCur = {
                x: clamp01(x), y: clamp01(y),
                color: color || presenceColor || prevCur?.color || hashColor(memberId),
                nickname: nickname || presenceName || prevCur?.nickname || `User ${memberId}`,
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

        // 채팅 수신
        subscribePlanChat(client, planId, (msg) => {
          try{
            const cm = JSON.parse(msg.body);
            const { memberId, nickname, avatar, ts } = cm;
            if (memberId==null) return;

            const safeText = sanitizeChatText(cm.message ?? cm.text ?? cm.msg ?? "");
            const pic = avatar || getAvatarFromPresence(roomKey, memberId) || "";
            const presenceName = getNameFromPresence(roomKey, memberId);

            const until = Date.now() + BUBBLE_MS;
            setCursors((prev) => {
              const cur = prev[memberId] || {};
              return {
                ...prev,
                [memberId]: {
                  ...cur,
                  nickname: nickname || presenceName || cur.nickname || `User ${memberId}`,
                  color: cur.color || getColorFromPresence(roomKey, memberId) || hashColor(memberId),
                  avatar: cur.avatar || pic,
                  bubble: { text: safeText, until, ts: ts || Date.now() },
                },
              };
            });
          }catch(e){ console.error("parse chat", e); }
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
  }, [planId, token, roomKey]);

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

        try{
          sendPlanMouse(stompRef.current, planId, {
            x, y,
            memberId: myMemberId || undefined,
            nickname: myNickname,
            color: getColorFromPresence(roomKey, myMemberId) || undefined,
            ts: Date.now(),
          });
        }catch{}
        ticking = false;
      });
    };

    window.addEventListener("mousemove", onMoveAndPublish, { passive: true });
    return () => window.removeEventListener("mousemove", onMoveAndPublish);
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
          color: cur.color || getColorFromPresence(roomKey, myMemberId) || hashColor(myMemberId),
          avatar: cur.avatar || getAvatarFromPresence(roomKey, myMemberId) || "",
          bubble: { text: safe, until, ts: Date.now() },
        },
      };
    });

    // (2) 서버 발행 — ✅ 항상 `message` 키
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
      console.log("[VERIFY:CALL:sendPlanChat] payload.message =", payload.message);
      try{
        sendPlanChat(stompRef.current, planId, payload, { receipt: `rcpt-${Date.now()}` });
      }catch(e){
        console.error("[CHAT:PUBLISH:ERROR]", e);
      }
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
