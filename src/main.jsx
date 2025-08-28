import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
  Link,
} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "./index.css";
import App from "./App.jsx";
import HomePage from "./pages/HomePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import Schedule from "./pages/Schedule.jsx";
import { LanguageProvider } from "./context/LanguageContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 에러 화면
function AppError() {
  const err = useRouteError();
  console.error(err);
  return (
    <div style={{ padding: 24 }}>
      <h2>문제가 발생했어요 😥</h2>
      <p>요청하신 페이지를 찾을 수 없거나 내부 오류가 발생했습니다.</p>
      <Link to="/">메인으로 가기</Link>
    </div>
  );
}

// 404 전용
function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h2>페이지를 찾을 수 없어요 (404)</h2>
      <Link to="/">메인으로 가기</Link>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <AppError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "privacy", element: <PrivacyPage /> },

      // 일정 페이지 (일반/플랜ID)
      { path: "schedule", element: <Schedule /> },
      { path: "schedule/:planId", element: <Schedule /> },

      // 🔗 공유 보기 (shareURI)
      { path: "share/:shareURI", element: <Schedule /> },

      // 최종 404 캐치
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
