import { Outlet, useLocation } from 'react-router-dom';
import './App.css';
import LogoSection from './components/LogoSection';
import LanguageButton from './components/LanguageButton';
import Footer from './components/Footer';
import { useState } from 'react';
import React from "react";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); // 구글 프로필 정보

  const location = useLocation();
  // Schedule 페이지에서만 Footer 숨기기
  const hideFooter = location.pathname === "/schedule";

  return (
    <div className="app-layout">
      <LogoSection />
      <LanguageButton />
      <main className="main-outlet">
        <Outlet context={{ isLoggedIn, setIsLoggedIn, user, setUser }} />
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default App;
