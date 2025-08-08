// src/components/AvatarDock.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function AvatarDock({ user, isLoggedIn, setIsLoggedIn, setUser }) {
  if (!isLoggedIn) return null;

  const navigate = useNavigate();
  const name = user?.name || "";
  const picture = user?.picture || "";

  const handleLogout = () => {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch {}
    setIsLoggedIn?.(false);
    setUser?.(null);
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.95)",
        borderRadius: 12,                           // ← 여기만 줄이면 사각형 느낌
        boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
        border: "1px solid rgba(0,0,0,0.06)",
        backdropFilter: "blur(6px)",
      }}
      title={name}
      aria-label={name ? `현재 로그인: ${name}` : "로그인됨"}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",                      // 아바타는 동그랗게 유지
          overflow: "hidden",
          background: "#eee",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
        }}
      >
        {picture ? (
          <img
            src={picture}
            alt={name || "user"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "#666" }}>{name ? name[0].toUpperCase() : "U"}</span>
        )}
      </div>

      <div style={{ width: 1, height: 22, background: "rgba(0,0,0,0.08)" }} />

      <button
        onClick={handleLogout}
        style={{
          height: 28,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 700,
          color: "#333",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 8,                           // ← 버튼도 덜 둥글게
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
        title="로그아웃"
        aria-label="로그아웃"
      >
        로그아웃
      </button>
    </div>
  );
}
