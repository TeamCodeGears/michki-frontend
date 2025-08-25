// src/components/InlineLoginFab.jsx
import { useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
// ❌ import { ensureMembership } from "../api/plans";
import { getPlan } from "../api/plans"; // ✔ 필요 시 접근성 확인용

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

// --- 백엔드에 코드 전달 (구글 OAuth code → 우리 서버 토큰/유저) ---
async function googleLoginApi(code) {
  const res = await fetch(`${API_BASE}/member/google/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`구글 로그인 실패: ${res.status} ${text}`);
  }
  // 기대 응답: { accessToken, refreshToken, user?: { id, name, picture, email } }
  return res.json();
}

// --- 구글 userinfo로 name/picture 보강용 ---
async function fetchGoogleUserinfo(accessToken) {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("userinfo 호출 실패");
  return r.json(); // { sub, name, picture, email, ... }
}

export default function InlineLoginFab({ onLoggedIn, planId }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const redirectUri =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GOOGLE_REDIRECT_URI) ||
    window.location.origin;

  // ----- (1) silent implicit 보강을 "필요한 때만" 시도하기 위한 프라미스 래퍼 -----
  const silentResolveRef = useRef(null);
  const silentRejectRef = useRef(null);

  const startSilentImplicit = useGoogleLogin({
    flow: "implicit",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    prompt: "none",
    onSuccess: ({ access_token }) => {
      silentResolveRef.current?.(access_token);
    },
    onError: (e) => {
      silentRejectRef.current?.(e);
    },
  });

  function getUserinfoSilentOnce() {
    return new Promise((resolve, reject) => {
      silentResolveRef.current = resolve;
      silentRejectRef.current = reject;
      startSilentImplicit();
    });
  }

  // ----- (2) 메인: 백엔드용 auth-code (팝업 1회) -----
  const loginWithCode = useGoogleLogin({
    flow: "auth-code",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    onSuccess: async ({ code }) => {
      setLoading(true);
      setErr("");
      try {
        // 2-1) 코드 교환 → 우리 백엔드 토큰/유저
        const data = await googleLoginApi(code);

        if (data?.accessToken) localStorage.setItem("accessToken", data.accessToken);
        if (data?.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);

        // 백엔드가 내려준 유저 우선 반영
        let user = {
          id: data?.user?.id ?? null,
          name: data?.user?.name ?? "",
          picture: data?.user?.picture ?? "",
          email: data?.user?.email ?? "",
        };

        // 2-2) name/picture 누락 시에만 "조용히" 보강 시도 (팝업 X)
        if (!user.name || !user.picture) {
          try {
            const accessToken = await getUserinfoSilentOnce();
            const uinfo = await fetchGoogleUserinfo(accessToken);
            user = {
              id: user.id ?? uinfo?.sub ?? uinfo?.email ?? null,
              name: user.name || uinfo?.name || "",
              picture: user.picture || uinfo?.picture || "",
              email: user.email || uinfo?.email || "",
            };
          } catch {
            // 보강 실패해도 로그인 자체는 성공 처리
          }
        }

        // 2-3) 최종 저장
        localStorage.setItem("user", JSON.stringify(user));

        // 2-4) (선택) 플랜 접근 가능 여부만 확인 — 조인 자동 호출 제거
        if (planId) {
          try {
            await getPlan(planId); // 실패해도 로그인은 유지
          } catch (e) {
            console.warn("getPlan failed after login:", e?.response?.status || e?.message);
          }
        }

        // 2-5) 콜백
        onLoggedIn?.(user);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "로그인 실패");
      } finally {
        setLoading(false);
      }
    },
    onError: (e) => {
      console.error("구글 로그인 에러:", e);
      setErr("구글 로그인 중 오류");
    },
  });

  return (
    <button
      onClick={() => loginWithCode()}
      disabled={loading}
      title="로그인하고 편집 기능 사용"
      aria-label="로그인"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1200,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
        boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.8 : 1,
      }}
    >
      {loading ? "로그인 중..." : "로그인"}
      {err && (
        <span style={{ display: "block", marginTop: 6, color: "#c00", fontSize: 11 }}>
          {err}
        </span>
      )}
    </button>
  );
}
