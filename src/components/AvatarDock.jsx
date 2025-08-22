// src/components/AvatarDock.jsx
import React, { useContext, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LanguageContext } from "../context/LanguageContext";
import { getAvatarBorderColor } from "../utils/avatarColor";

// 환경변수 + 로컬 fallback
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

// 공통: Authorization 헤더 생성
function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 백엔드 로그아웃 연동 (선택사항, 있으면 호출)
async function backendLogout() {
  try {
    const res = await fetch(`${API_BASE}/member/logout`, {
      method: "POST",
      headers: { ...authHeader() },
    });
    // 백엔드에서 200이 아닐 수도 있으니 콘솔만 남기고 흐름은 계속
    if (!res.ok) {
      console.warn("로그아웃 API 응답 코드:", res.status);
    }
  } catch (e) {
    console.warn("로그아웃 API 호출 실패:", e);
  }
}

// 회원 탈퇴 연동
async function withdrawAccount() {
  const res = await fetch(`${API_BASE}/member/withdraw`, {
    method: "POST",
    headers: { ...authHeader() },
  });
  // 200: 성공, 401/404 등은 에러로 처리하여 상위에서 안내
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`회원 탈퇴 실패: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

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

  const clearClientState = () => {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    } catch {}
    setIsLoggedIn?.(false);
    setUser?.(null);
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    try {
      await backendLogout(); // 선택적: 백엔드 세션/토큰 무효화
    } finally {
      clearClientState();
    }
  };

  const handleWithdraw = async () => {
    // 이중 확인(실수 방지)
    const confirm1 = window.confirm(
      "정말 회원 탈퇴하시겠어요?\n탈퇴 시 계정과 관련 데이터가 삭제되며 복구할 수 없습니다."
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      "한 번 더 확인합니다. 회원 탈퇴를 진행할까요?"
    );
    if (!confirm2) return;

    try {
      await withdrawAccount(); // 200이면 성공
      alert("회원 탈퇴가 완료되었습니다.");
    } catch (e) {
      // 상태코드별 간단 안내
      if (e?.status === 401) {
        alert("인증이 만료되었거나 유효하지 않습니다. 다시 로그인 후 시도해주세요.");
      } else if (e?.status === 404) {
        alert("회원 정보를 찾을 수 없습니다. 이미 탈퇴된 계정일 수 있습니다.");
      } else {
        alert("회원 탈퇴 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      console.error(e);
    } finally {
      // 성공/실패와 무관하게 로컬 상태는 정리
      clearClientState();
    }
  };

  // i18n 키가 없을 수 있으니 안전한 fallback
  const labelLogout = texts?.logout || "로그아웃";
  const labelWithdraw = texts?.withdraw || texts?.deleteAccount || texts?.membershipWithdrawal;

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
            referrerPolicy="no-referrer" // 구글 프로필 이미지 로딩 안정화
            decoding="async"
            loading="lazy"
            onError={() => setImgFailed(true)} // 실패 시 이니셜 폴백
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
        title={labelLogout}
        aria-label={labelLogout}
      >
        {labelLogout}
      </button>

      <button
        onClick={handleWithdraw}
        style={{
          height: 28,
          padding: "0 10px",
          fontSize: 12,
          fontWeight: 800,
          color: "#b02626",
          background: "#fff",
          border: "1px solid rgba(176,38,38,0.25)",
          borderRadius: 8,
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(176,38,38,0.08)",
        }}
        title={labelWithdraw}
        aria-label={labelWithdraw}
      >
        {labelWithdraw}
      </button>
    </div>
  );
}
