import { useEffect, useState } from "react";
import createPlanStompClient from "../socket/planSocket";
import { getNotifications, markNotificationsRead } from "../api/plans";
import "./Notifications.css";

export default function Notifications({ memberId, token }) {
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // 초기 알림 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const noti = await getNotifications();
        if (!mounted) return;
        setNotifications(Array.isArray(noti) ? noti : []);
      } catch (e) {
        console.error("Alram call failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 웹소켓 구독 (memberId, token을 props로 받음)
  useEffect(() => {
    if (!memberId) return;
    try {
      const client = createPlanStompClient({ token });
      let sub;

      client.onConnect = () => {
        try {
          sub = client.subscribe(`/sub/member/${memberId}/notifications`, (msg) => {
            try {
              const ev = JSON.parse(msg.body || "null");
              if (!ev) return;
              setNotifications((prev) => {
                const id = ev.id ?? ev.notificationId ?? ev.planId + "-" + (ev.type ?? "");
                if (prev.some((p) => String(p.id) === String(id))) return prev;
                const normalized = {
                  id: ev.id ?? ev.notificationId ?? id,
                  title: ev.title ?? ev.planTitle ?? ev.type ?? "알림",
                  body: ev.body ?? ev.message ?? ev.text ?? "",
                  raw: ev,
                };
                return [normalized, ...prev];
              });
            } catch (err) {
              console.warn("failed parse notification msg", err);
            }
          });
        } catch (err) {
          console.warn("subscribe notifications failed", err);
        }
      };

      client.activate();

      return () => {
        try {
          sub?.unsubscribe();
        } catch (err) {
          console.warn("unsubscribe failed", err);
        }
        try {
          client.deactivate();
        } catch (err) {
          console.warn("stomp deactivate failed", err);
        }
      };
    } catch (err) {
      console.warn("notifications subscription setup failed", err);
    }
  }, [memberId, token]);

  return (
    <div className="notifications-root">
      <button
        aria-label="알림"
        title="알림"
        onClick={async () => {
          setNotifOpen((v) => !v);
          if (!notifOpen && notifications && notifications.length) {
            try {
              await markNotificationsRead();
              setNotifications([]);
            } catch (e) {
              console.error("plans fetch failed", e);
            }
          }
        }}
        className="notifications-button"
      >
        🔔
        {notifications && notifications.length > 0 && (
          <span className="notifications-count">{notifications.length}</span>
        )}
      </button>

      {notifOpen && (
        <div className="notifications-dropdown">
          {(!notifications || notifications.length === 0) ? (
            <div className="notifications-empty">알림이 없습니다.</div>
          ) : (
            notifications.map((n, idx) => (
              <div key={n.id ?? idx} className="notification-item">
                <div className="notification-title">{n.title ?? n.message ?? "알림"}</div>
                <div className="notification-body">{n.body ?? n.text ?? n.message ?? ""}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
