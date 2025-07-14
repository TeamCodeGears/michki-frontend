import './Footer.css';
import { Link } from 'react-router-dom' // Link 불러오기

function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-links">
        {/* 지금은 href="#"로 임시 링크를 걸어둡니다. */}
        <Link to = "/terms"> 이용약관 </Link> {/* 이용약관 불러올 곳 */}
        <span>|</span>
        <Link to = "/privacy"> 개인정보 처리방침 </Link> {/*개인정보 처리방침 불러올 곳*/}
      </div>
      <div className="footer-copyright">
        &copy; {new Date().getFullYear()} Michiki. All Rights Reserved.
      </div>
    </footer>
  );
}

export default Footer;