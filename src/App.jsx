// src/App.jsx
import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "./App.css";
import LogoSection from "./components/LogoSection";
import LanguageButton from "./components/LanguageButton";
import Footer from "./components/Footer";
import AvatarDock from "./components/AvatarDock";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // 앱 시작 시 로그인 상태 복구
  useEffect(() => {
    try {
      const access = localStorage.getItem("accessToken");
      const u = localStorage.getItem("user");
      if (access && u) {
        setIsLoggedIn(true);
        setUser(JSON.parse(u));
      }
    } catch (e) {
      console.error("restore failed", e);
    }
  }, []);

  const location = useLocation();
  // /schedule 및 하위 경로에서 Footer/AvatarDock 숨김
  const hideOnSchedule = location.pathname.startsWith("/schedule");

  return (
    <div className="app-layout">
      <LogoSection />
      <LanguageButton />

      <main className="main-outlet">
        <Outlet context={{ isLoggedIn, setIsLoggedIn, user, setUser }} />
      </main>

      {!hideOnSchedule && <Footer />}

      {!hideOnSchedule && (
        <AvatarDock
          user={user}
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
          setUser={setUser}
        />
      )}
    </div>
  );
}

export default App;
