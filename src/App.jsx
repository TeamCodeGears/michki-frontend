import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "./App.css";
import LogoSection from "./components/LogoSection";
import LanguageButton from "./components/LanguageButton";
import Footer from "./components/Footer";
import AvatarDock from "./components/AvatarDock";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

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
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const location = useLocation();
  const hideOnSchedule = location.pathname.startsWith("/schedule");
  const hideLogoOnDashboard = location.pathname.startsWith("/dashboard");

  // 부트스트랩 전엔 렌더 막기 (깜빡임 방지)
  if (!bootstrapped) return null;

  return (
    <div className="app-layout">
      {!hideLogoOnDashboard && <LogoSection />}
      <LanguageButton />

      <main className="main-outlet">
        {/* 🔑 모든 자식에서 useOutletContext()로 user/isLoggedIn 사용 */}
        <Outlet context={{ isLoggedIn, setIsLoggedIn, user, setUser, bootstrapped }} />
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
