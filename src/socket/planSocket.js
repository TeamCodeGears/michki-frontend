// src/socket/planSocket.js
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

// 서버 WebSocketConfig 에서 addEndpoint("/ws").withSockJS() 설정과 맞춤
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

export const WS_ENDPOINT = `${API_BASE.replace(/\/$/, "")}/ws`;

/**
 * STOMP 클라이언트 생성
 */
export function createPlanStompClient({
  token,
  onConnect,
  onDisconnect,
  onStompError,
} = {}) {
  const client = new Client({
    webSocketFactory: () => new SockJS(WS_ENDPOINT),
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    debug: () => {},          // 필요 시 console.log
    reconnectDelay: 3000,     // 재연결 딜레이(ms)
    onConnect,
    onStompError: onStompError || ((frame) => {
      console.error("STOMP error", frame?.headers, frame?.body);
    }),
    onWebSocketClose: () => {
      onDisconnect?.();
    },
  });
  return client;
}

/** 마우스 좌표 구독 */
export function subscribePlanMouse(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/mouse`, onMessage);
}

/** 채팅 메시지 구독 */
export function subscribePlanChat(client, planId, onMessage) {
  return client.subscribe(`/topic/plan/${planId}/message`, onMessage);
}

/** 마우스 좌표 전송 */
export function sendPlanMouse(client, planId, payload) {
  client.publish({
    destination: `/app/plan/${planId}/mouse`,
    body: JSON.stringify(payload),
  });
}

/** 채팅 메시지 전송 */
export function sendPlanChat(client, planId, payload) {
  client.publish({
    destination: `/app/plan/${planId}/chat`,
    body: JSON.stringify(payload),
  });
}

export default createPlanStompClient;
