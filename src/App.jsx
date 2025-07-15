import {Outlet} from 'react-router-dom';
import './App.css'
import LogoSection from './components/LogoSection';
import LanguageButton from './components/LanguageButton';
import Footer from './components/Footer';
import { useState } from 'react';
import { texts } from './data/translations.jsx';

function App() {
  const [language, setLanguage] = useState('ko');
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 로그인 상태 기억, 기본 상태는 false로 둠 (*로그아웃 상태)
  const currentTexts = texts[language]; // 상황별 텍스트 상태를 기억하는 공간

  return (
    <div>
      <LogoSection />
      <LanguageButton setLanguage={setLanguage} texts={currentTexts} />
      <main className = "main-outlet">
      <Outlet context={{texts: currentTexts, setIsLoggedIn: setIsLoggedIn }} />
      </main>
      <Footer />
    </div>
  )
}

export default App