// src/components/AvatarDock.jsx
import React, { useContext, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LanguageContext } from "../context/LanguageContext";
import { getAvatarBorderColor } from "../utils/avatarColor";

export default function AvatarDock({ user, isLoggedIn, setIsLoggedIn, setUser }) {
  if (!isLoggedIn) return null;

  const navigate = useNavigate();
  const { planId } = useParams();
  const { texts } = useContext(LanguageContext);

  const name = user?.name || "";
  const picture = user?.picture || "";
  const borderColor = getAvatarBorderColor(planId) || "#e9e9e9";

  // 이미지 실패 시 이니셜로 폴백
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = picture && !imgFailed;
  const initial = (name?.[0] || "U").toUpperCase();

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
        borderRadius: 12,
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
          borderRadius: "50%",
          overflow: "hidden",
          background: "#eee",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          border: `3px solid ${borderColor}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          position: "relative",
        }}
      >
        {showImage ? (
          <img
            src={picture}
            alt={name || "user"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            referrerPolicy="no-referrer"   // ← 구글 프로필 이미지 로딩 안정화
            decoding="async"
            loading="lazy"
            onError={() => setImgFailed(true)} // ← 실패 시 이니셜 폴백
          />
        ) : (
          <span style={{ color: "#666" }}>{initial}</span>
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
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
        title={texts.logout}
        aria-label={texts.logout}
      >
        {texts.logout}
      </button>
    </div>
  );
}
