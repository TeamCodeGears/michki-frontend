import React from 'react';
import { Link } from 'react-router-dom';
import './LogoSection.css';
import logoImage from '../assets/michiki-logo.webp'; // 실제 로고 이미지

function LogoSection() {
  return (
    <Link to="/" className="logo-section-link">
      <div className="logo-section">
        <div className="logo-frame">
          <img src={logoImage} alt="Michiki 로고" className="logo" />
          <div className="logo-text-group">
            <span className="logo-title-kanji">道記</span>
            <span className="logo-title-en">Michiki</span>
          </div>
        </div>
        {/* 필요시 배경 또는 다른 장식 추가 */}
      </div>
    </Link>
  );
}

export default LogoSection;
