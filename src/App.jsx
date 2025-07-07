import { useState } from 'react'; // 1. useState 불러오기
import './App.css'
import LoginButton from './components/LoginButton';
import mainPhoto from './assets/foreigner-photo.png'; 
import LogoSection from './components/LogoSection';
import LanguageButton from './components/LanguageButton';
import Footer from './components/Footer';
import { texts } from './data/translations'; // 2. 번역 텍스트 불러오기

function App() {
  // 3. 언어 상태를 관리합니다. (기본값: 'ko')
  const [language, setLanguage] = useState('ko');

  // 4. 현재 언어에 맞는 텍스트 객체를 가져옵니다.
  const currentTexts = texts[language];

  return (
    <div>
      <LogoSection />
      {/* 5. 언어를 바꿀 수 있는 함수(setLanguage)와 텍스트를 props로 전달합니다. */}
      <LanguageButton setLanguage={setLanguage} texts={currentTexts} />
      
      <div className='main-text'>
        {/* 6. 현재 언어에 맞는 캐치프레이즈를 보여줍니다. */}
        {currentTexts.catchphrase}<br />
        {currentTexts.startNow}
      </div>
      
      <img src={mainPhoto} alt="메인 이미지" className="main-photo" />
      {/* 7. 로그인 버튼에도 맞는 텍스트를 전달합니다. */}
      <LoginButton texts={currentTexts} />
      
      <Footer />
    </div>
  )
}

export default App