import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createPlanStompClient,
  subscribePlanMouse,
  subscribePlanChat,
  sendPlanMouse,
  sendPlanChat,
} from "../../socket/planSocket";
import "./CursorLayer.css";

const COLORS = ["#ff4d4f","#fa8c16","#fadb14","#52c41a","#1677ff","#722ed1","#eb2f96","#13c2c2","#2f54eb"];
const hashColor = (memberId) => {
  if (!memberId && memberId !== 0) return COLORS[0];
  const n = Math.abs(
    String(memberId).split("").reduce((acc,ch)=>(acc*33+ch.charCodeAt(0))|0,5381)
  );
  return COLORS[n % COLORS.length];
};

export default function CursorLayer({ planId, currentUser, isLoggedIn }) {
  const token = useMemo(() => localStorage.getItem("accessToken") || undefined, []);
  const myMemberId = currentUser?.memberId ?? currentUser?.id ?? null;
  const myNickname = currentUser?.nickname || currentUser?.name || "Me";

  const [connected,setConnected] = useState(false);
  const stompRef = useRef(null);
  const [cursors,setCursors] = useState({});
  const myCursorRef = useRef({ x:0.5, y:0.5 });

  // 연결
  useEffect(()=>{
    if (!planId) return;
    const client = createPlanStompClient({
      token,
      onConnect: () => {
        setConnected(true);

        subscribePlanMouse(client, planId, (msg)=>{
          try {
            const mp = JSON.parse(msg.body);
            const { memberId,x,y,color,nickname,ts } = mp;
            if (!memberId && memberId !== 0) return;
            setCursors(prev=>{
              const next={...prev};
              const cur=next[memberId]||{};
              next[memberId] = {
                ...cur,
                x: clamp01(x), y: clamp01(y),
                color: color || cur.color || hashColor(memberId),
                nickname: nickname || cur.nickname || `User ${memberId}`,
                ts: ts || Date.now(),
              };
              return next;
            });
          } catch(e){ console.error("parse mouse",e); }
        });

        subscribePlanChat(client, planId, (msg)=>{
          try {
            const cm = JSON.parse(msg.body);
            const { memberId,nickname,text,ts } = cm;
            if (!memberId && memberId !== 0) return;
            const until = Date.now()+4000;
            setCursors(prev=>{
              const next={...prev};
              const cur=next[memberId]||{};
              next[memberId]={...cur,nickname:nickname||cur.nickname||`User ${memberId}`,bubble:{text,until}};
              return next;
            });
          } catch(e){ console.error("parse chat",e); }
        });
      },
      onDisconnect: ()=>setConnected(false),
    });
    stompRef.current=client;
    client.activate();

    return ()=>{ try{client.deactivate();}catch{} stompRef.current=null; setConnected(false); };
  },[planId,token]);

  // 마우스 전송
  useEffect(()=>{
    if (!connected || !isLoggedIn || !stompRef.current) return;
    let lastSent=0;
    const onMove=(e)=>{
      const now=performance.now();
      if (now-lastSent<30) return;
      lastSent=now;
      const x=clamp01(e.clientX/window.innerWidth);
      const y=clamp01(e.clientY/window.innerHeight);
      myCursorRef.current={x,y};
      sendPlanMouse(stompRef.current,planId,{
        x,y,memberId:myMemberId||undefined,nickname:myNickname,ts:Date.now(),
      });
    };
    window.addEventListener("mousemove",onMove,{passive:true});
    return ()=>window.removeEventListener("mousemove",onMove);
  },[connected,isLoggedIn,planId,myMemberId,myNickname]);

  // 말풍선 수명 관리
  useEffect(()=>{
    const id=setInterval(()=>{
      const now=Date.now(); let changed=false;
      setCursors(prev=>{
        const next={...prev};
        Object.keys(next).forEach(mid=>{
          const cur=next[mid];
          if (cur?.bubble?.until && cur.bubble.until<=now){
            next[mid]={...cur,bubble:undefined}; changed=true;
          }
        });
        return changed?next:prev;
      });
    },250);
    return ()=>clearInterval(id);
  },[]);

  // 채팅 입력
  const [chatOpen,setChatOpen]=useState(false);
  const [chatText,setChatText]=useState("");
  useEffect(()=>{
    const onKey=(e)=>{ if(e.key.toLowerCase()==="t"){ if(!isLoggedIn) return; setChatOpen(true);} };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[isLoggedIn]);

  const sendChat=()=>{
    if(!connected||!stompRef.current||!chatText.trim()){ setChatOpen(false);setChatText("");return;}
    sendPlanChat(stompRef.current,planId,{
      text:chatText.trim(),memberId:myMemberId||undefined,nickname:myNickname,ts:Date.now(),
    });
    setChatText(""); setChatOpen(false);
  };

  const myPos=myCursorRef.current;

  return (
    <>
      <div className="cursor-layer">
        {Object.entries(cursors).map(([memberId,cur])=>{
          const left=`${(cur.x??0.5)*100}vw`;
          const top=`${(cur.y??0.5)*100}vh`;
          const color=cur.color||hashColor(memberId);
          return(
            <div key={memberId} className="cursor-item" style={{left,top}}>
              <div className="cursor-dot" style={{borderColor:color}}/>
              <div className="cursor-name" style={{background:color}}>
                {cur.nickname||`User ${memberId}`}
              </div>
              {cur.bubble?.text?<div className="cursor-bubble">{cur.bubble.text}</div>:null}
            </div>
          );
        })}
      </div>

      {isLoggedIn && chatOpen && (
        <div className="cursor-chat-input" style={{left:`${myPos.x*100}vw`,top:`${myPos.y*100}vh`}}>
          <input
            autoFocus
            value={chatText}
            onChange={(e)=>setChatText(e.target.value)}
            onBlur={()=>setChatOpen(false)}
            onKeyDown={(e)=>{ if(e.key==="Enter") sendChat(); if(e.key==="Escape") setChatOpen(false); }}
            placeholder="메시지 입력 후 Enter"
          />
        </div>
      )}
    </>
  );
}

const clamp01=(v)=>v<0?0:v>1?1:v;
