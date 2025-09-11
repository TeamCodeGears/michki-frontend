import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const RAW_BASE =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "";

const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/$/, "") : "";
export const WS_ENDPOINT = `${API_BASE}/ws`;

/** STOMP 클라이언트 생성 */
export function createPlanStompClient({
  token,
  onConnect,
  onDisconnect,
  onStompError,
} = {}) {
  const client = new Client({
    webSocketFactory: () =>
      new SockJS(WS_ENDPOINT, null, {
        transports: ["websocket", "xhr-streaming", "xhr-polling"],
        transportOptions: {
          "xhr-streaming": { withCredentials: true },
          "xhr-polling": { withCredentials: true },
        },
      }),
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    //debug: (str) => console.log(`[STOMP] ${str}`),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: (frame) => {
      console.info("[STOMP] connected", frame?.headers);
      onConnect?.(frame);
    },
    onStompError:
      onStompError ||
      ((frame) => {
        console.error("STOMP error", frame?.headers, frame?.body);
      }),
    onWebSocketClose: () => {
      onDisconnect?.();
    },
    onUnhandledMessage: (m) => {
      console.warn("Unhandled message:", m?.headers?.destination, m?.body);
    },
  });

  // 발송 내용 확인(디버그)
  const origPublish = client.publish.bind(client);
  client.publish = (args) => {
    try {
      //console.log("[PUB:DEST]", args?.destination);
      if (args?.body) {
        try {
          const obj = JSON.parse(args.body);
          //console.log("[PUB:BODY.keys]", Object.keys(obj));
          //console.log("[PUB:BODY.message]", obj.message);
        } catch {
          console.log("[PUB:BODY(raw)]", String(args.body).slice(0, 200));
        }
      }
    } catch { }
    return origPublish(args);
  };

  return client;
}

/* ====== Subscribe helpers ====== */
export function subscribePlanMouse(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/mouse`, onMessage);
}
export function subscribePlanChat(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/message`, onMessage);
}
/** ✅ 장소 변경 브로드캐스트 구독 (백엔드: /sub/plans/{planId}/place-changed) */
export function subscribePlanPlaces(client, planId, onMessage) {
  return client.subscribe(`/sub/plans/${planId}/place-changed`, onMessage);
}

/* ====== Publish helpers ====== */
export function sendPlanMouse(client, planId, payload) {
  client.publish({
    destination: `/app/plan/${planId}/mouse`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** ✅ 채팅은 항상 message 키 사용 + 목적지는 /app/plan/{planId}/message */
export function sendPlanChat(client, planId, payload, opts = {}) {
  const { receipt, onReceipt } = opts;

  const normalized = {
    ...payload,
    message:
      payload?.message ??
      payload?.text ??
      payload?.msg ??
      payload?.content ??
      "",
  };
  delete normalized.text;
  delete normalized.msg;
  delete normalized.content;

  if (receipt && typeof client.watchForReceipt === "function") {
    client.watchForReceipt(receipt, () => onReceipt?.(receipt));
  }

  client.publish({
    destination: `/app/plan/${planId}/message`,
    headers: {
      "content-type": "application/json",
      ...(receipt ? { receipt } : {}),
    },
    body: JSON.stringify(normalized),
  });

  console.log("[VERIFY:SEND:RAW]", JSON.stringify(normalized));
  console.log("[VERIFY:SEND:KEYS]", Object.keys(normalized));


}

/* ====== Subscribe helpers ====== */

// 👇 온라인 멤버 목록 브로드캐스트 구독
export function subscribePlanOnline(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/online`, onMessage);
}

// 👇 색상 변경 브로드캐스트 구독
export function subscribePlanColor(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/color`, onMessage);
}

/* ====== Publish helpers ====== */

// 👇 색상 변경 요청 (백엔드 @MessageMapping("/colorChange"))
export function sendPlanColorChange(client, planId, memberId, color) {
  client.publish({
    destination: `/app/colorChange`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId, memberId, color }),
  });
}


export default createPlanStompClient;