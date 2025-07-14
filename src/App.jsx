import {Outlet} from 'react-router-dom';
import './App.css'
import LogoSection from './components/LogoSection';
import LanguageButton from './components/LanguageButton';
import Footer from './components/Footer';
import { useState } from 'react';
import { texts } from './data/translations.jsx'; // 번역 관련

function App() {
  const [language, setLanguage] = useState('ko');
  const currentTexts = texts[language];{/* 상황별 텍스트 상태 하는 공간*/}

  return (
    <div>
      <LogoSection />
      <LanguageButton setLanguage={setLanguage} texts={currentTexts} />
      
      <Outlet context = {{ texts : currentTexts }} />
      <Footer />
    </div>
  )
}

export default App