import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

export const WS_ENDPOINT = `${API_BASE.replace(/\/$/, "")}/ws`;

export function createPlanStompClient({
  token,
  onConnect,
  onDisconnect,
  onStompError,
} = {}) {
  const client = new Client({
    // 쿠키/세션을 쓰는 경우 xhr-* 전송에도 withCredentials 적용
    webSocketFactory: () =>
      new SockJS(WS_ENDPOINT, null, {
        transports: ["websocket", "xhr-streaming", "xhr-polling"],
        transportOptions: {
          "xhr-streaming": { withCredentials: true },
          "xhr-polling": { withCredentials: true },
        },
      }),
    // 토큰 인증도 병행 가능 (세션/쿠키 없이도 OK)
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    debug: (str) => console.log(`[STOMP] ${str}`),
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
  return client;
}

export function subscribePlanMouse(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/mouse`, onMessage);
}
export function subscribePlanChat(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/message`, onMessage);
}

export function sendPlanMouse(client, planId, payload) {
  client.publish({
    destination: `/app/plan/${planId}/mouse`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function sendPlanChat(client, planId, payload) {
  client.publish({
    destination: `/app/plan/${planId}/chat`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export default createPlanStompClient;
