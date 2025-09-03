import React from 'react';
import { useState, useEffect, useRef, useContext } from 'react';
import './LanguageButton.css';
import langIcon from '../assets/language-icon.webp';
import { LanguageContext } from '../context/LanguageContext';

function LanguageButton() {
  const { setLanguage, texts } = useContext(LanguageContext);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const timerRef = useRef(null);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen(!isOpen);

  // 1. startTimer와 stopTimer 함수를 useEffect 밖으로 이동시켰습니다.
  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(closeMenu, 2000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    if (isOpen) {
      startTimer(); // 이제 여기서도 접근 가능
      document.addEventListener('mousedown', handleClickOutside);
      
      menuRef.current?.addEventListener('mouseenter', stopTimer);
      menuRef.current?.addEventListener('mouseleave', startTimer);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      menuRef.current?.removeEventListener('mouseenter', stopTimer);
      menuRef.current?.removeEventListener('mouseleave', startTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  // 2. 이제 return 문의 onMouseEnter와 onMouseLeave가 정상적으로 함수를 찾을 수 있습니다.
  return (
    <div 
      className="lang-button-container" 
      ref={menuRef}
    >
      <div 
        className="button-content" 
        onClick={toggleMenu} 
        onMouseEnter={stopTimer} 
        onMouseLeave={startTimer}
      >
        <img src={langIcon} alt="언어 변경 아이콘" className="lang-icon" />
        <span className="lang-text">{texts.language}</span>
      </div>
      
      <ul className={`dropdown-menu ${isOpen ? 'open' : ''}`}>
        <li onClick={() => { setLanguage('ko'); closeMenu(); }}>{texts.korean}</li>
        <li onClick={() => { setLanguage('ja'); closeMenu(); }}>{texts.japanese}</li>
      </ul>
    </div>
  );
}

export default LanguageButton;