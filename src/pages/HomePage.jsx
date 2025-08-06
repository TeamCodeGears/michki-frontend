import React from 'react';
import { useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import LoginButton from '../components/LoginButton';
import mainPhoto from '../assets/MainPhoto.webp';
import { LanguageContext } from '../context/LanguageContext';

function HomePage() {
  const { texts } = useContext(LanguageContext);
  const { setIsLoggedIn, setUser } = useOutletContext();

  return (
    <>
      <div className='main-text'>
        {texts.catchphrase} <br />
        {texts.startNow}
      </div>
      <img src={mainPhoto} alt="메인 이미지" className="main-photo" />
      <LoginButton setIsLoggedIn={setIsLoggedIn} setUser={setUser} />
    </>
  );
}

export default HomePage;
