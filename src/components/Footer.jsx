import './Footer.css';

function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-links">
        {/* 지금은 href="#"로 임시 링크를 걸어둡니다. */}
        <a href="#">이용약관</a>
        <span>|</span>
        <a href="#">개인정보 처리방침</a>
      </div>
      <div className="footer-copyright">
        &copy; {new Date().getFullYear()} Michiki. All Rights Reserved.
      </div>
    </footer>
  );
}

export default Footer;