import './TermsPage.css'; // 페이지 스타일 임포트
import { useOutletContext } from 'react-router-dom';

function TermsPage () {
    const { texts } = useOutletContext();

    return (
        <div className = "terms-container">
           { texts.termsContent() }
        </div>
    );
}

export default TermsPage;