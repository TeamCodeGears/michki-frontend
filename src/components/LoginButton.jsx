// src/components/LoginButton.jsx
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginButton.css";
import googleIcon from "../assets/google-icon.webp";
import { useGoogleLogin } from "@react-oauth/google";
import { LanguageContext } from "../context/LanguageContext";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "http://localhost:8080";

async function googleLoginApi(code) {
  const url = `${API_BASE}/member/google/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`구글 로그인 실패: ${res.status} ${text}`);
  }
  const data = await res.json();
  console.log("@@백엔드 응답:", data);
  return data;
}

async function fetchGoogleUserinfo(accessToken) {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("userinfo 호출 실패");
  return r.json(); // { name, picture, ... }
}

function LoginButton({ isLoggedIn, setIsLoggedIn, setUser }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const redirectUri =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GOOGLE_REDIRECT_URI) ||
    window.location.origin;

  // ---- userinfo 보강: 먼저 "조용히" 시도, 실패 시 인터랙티브 팝업으로 대체 ----
  const loginForProfileSilent = useGoogleLogin({
    flow: "implicit",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    prompt: "none", // 가능한 경우 로그인창 없이 토큰 발급
    onSuccess: async ({ access_token }) => {
      try {
        const u = await fetchGoogleUserinfo(access_token);
        const saved = JSON.parse(localStorage.getItem("user") || "{}");
        const nextUser = {
          id: saved?.id ?? null,
          name: u?.name || saved?.name || "",
          picture: u?.picture || saved?.picture || "",
        };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch (e) {
        console.error("userinfo 보강 실패(silent onSuccess):", e);
      }
    },
    onError: () => {
      // silent 실패(쿠키/세션 이슈 등)면, 인터랙티브 팝업으로 한 번 더 시도
      loginForProfileInteractive();
    },
  });

  const loginForProfileInteractive = useGoogleLogin({
    flow: "implicit",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    prompt: "consent", // 필요시 팝업 표시
    onSuccess: async ({ access_token }) => {
      try {
        const u = await fetchGoogleUserinfo(access_token);
        const saved = JSON.parse(localStorage.getItem("user") || "{}");
        const nextUser = {
          id: saved?.id ?? null,
          name: u?.name || saved?.name || "",
          picture: u?.picture || saved?.picture || "",
        };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch (e) {
        console.error("userinfo 보강 실패(interactive onSuccess):", e);
      }
    },
    onError: (e) => {
      console.error("implicit 로그인 실패(interactive):", e);
    },
  });

  // ---- 1단계: auth-code → 백엔드 로그인 ----
  const loginWithCode = useGoogleLogin({
    flow: "auth-code",
    redirect_uri: redirectUri,
    scope: "openid profile email",
    onSuccess: async ({ code }) => {
      setErrMsg("");
      setLoading(true);
      try {
        const backendLogin = await googleLoginApi(code);

        // 가능한 키에서 name/picture/id 추출
        const name =
          backendLogin?.name ??
          backendLogin?.user?.name ??
          backendLogin?.profile?.name ??
          backendLogin?.member?.name ??
          backendLogin?.data?.name ??
          "";
        const picture =
          backendLogin?.picture ??
          backendLogin?.user?.picture ??
          backendLogin?.profileImageUrl ??
          backendLogin?.avatarUrl ??
          backendLogin?.photoUrl ??
          backendLogin?.image ??
          backendLogin?.member?.profileImageUrl ??
          backendLogin?.member?.picture ??
          backendLogin?.data?.picture ??
          "";
        const savedId =
          backendLogin?.id ??
          backendLogin?.user?.id ??
          backendLogin?.member?.id ??
          backendLogin?.data?.id ??
          null;

        // 토큰 저장(동기)
        if (backendLogin?.accessToken) {
          localStorage.setItem("accessToken", backendLogin.accessToken);
        }
        if (backendLogin?.refreshToken) {
          localStorage.setItem("refreshToken", backendLogin.refreshToken);
        }

        // ✅ 핵심: 먼저 partial user를 '항상' 저장 → 이후 네비게이트해도 값 보존
        if (savedId !== null) {
          const partialUser = { id: savedId, name, picture };
          setUser(partialUser); // 렌더 큐
          localStorage.setItem("user", JSON.stringify(partialUser)); // 동기 저장
        }

        // 로그인 상태 선반영
        setIsLoggedIn(true);

        // name/picture가 비면 백그라운드 보강(우선 silent)
        if (!name || !picture) {
          loginForProfileSilent();
        }

        // 그리고 페이지 전환
        navigate("/dashboard");
      } catch (err) {
        console.error("로그인 실패:", err);
        setIsLoggedIn(false);
        setErrMsg(err?.message || "로그인 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      console.error("구글 로그인 중 오류 발생:", err);
      setErrMsg("구글 로그인 중 오류가 발생했습니다.");
    },
  });

  const handleStartClick = () => navigate("/dashboard");

  if (isLoggedIn) {
    return (
      <button
        className="start-button"
        onClick={handleStartClick}
        aria-label="시작하기"
      >
        {texts.start}
      </button>
    );
  }

  return (
    <div className="login-button-container">
      <button
        className="login-button"
        onClick={() => loginWithCode()}
        disabled={loading}
        aria-busy={loading}
      >
        <img
          src={googleIcon}
          alt="구글 로그인 아이콘"
          className="google-icon"
        />
        <span>{loading ? "로그인 중..." : texts.login}</span>
      </button>

      {errMsg ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#c00",
            wordBreak: "break-all",
          }}
        >
          {errMsg}
        </div>
      ) : null}
    </div>
  );
}

export default LoginButton;
