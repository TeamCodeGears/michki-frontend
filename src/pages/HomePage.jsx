import React, { useContext, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import LoginButton from '../components/LoginButton';
import homeImage from '../assets/tokyo.jpg'; 
import { LanguageContext } from '../context/LanguageContext';
import './HomePage.css';

function HomePage() {
  const { texts } = useContext(LanguageContext);
  const { isLoggedIn, setIsLoggedIn, setUser } = useOutletContext();

  // 홈에서만 스크롤 제거 (다른 페이지 영향 없음)
  useEffect(() => {
    document.body.classList.add('home-no-scroll');
    return () => document.body.classList.remove('home-no-scroll');
  }, []);

  return (
    <div className="home-viewport">
      {/*  tokyo.png 배경 레이어 */}
      <img
        className="home-bg-image"
        src={homeImage}
        alt="배경 이미지"
        aria-hidden="true"
      />

      {/* 가운데 큰 문구 */}
      <div className="hero-center">
        <h1 className="hero-title">
          {texts.catchphrase}<br />{texts.startNow}
        </h1>
      </div>

      {/* 하단 중앙 CTA (푸터 위에 뜨도록) */}
      <div className="home-cta">
        <LoginButton
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
          setUser={setUser}
        />
      </div>
    </div>
  );
}

export default HomePage;
