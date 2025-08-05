import { Link } from 'react-router-dom';
import './LogoSection.css';
import logoImage from '../assets/michiki-logo.png'; // 실제 로고 이미지 파일명으로 변경

function LogoSection() {
  return (
    <Link to = "/" className="logo-section-link">
    <div className="logo-section">
      <div className="logo-frame">
        <img src={logoImage} alt="Michiki 로고" className="logo" />
        <div className="logo-text-group">
          <span className="logo-title-kanji">道記</span>
          <span className="logo-title-en">Michiki</span>
        </div>
      </div>
      <div className="frame-image">
        {/* Figma의 image 41과 동일한 배경 */}
      </div>
    </div>
    </Link>
  );
}

export default LogoSection;