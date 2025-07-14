import './PrivacyPage.css'; // 스타일 임포트
import { useOutletContext } from 'react-router-dom';

function PrivacyPage () {
    const { texts } = useOutletContext();

    return (
        <div className="privacy-container">
           { texts.privacyContent() }
        </div>
    );
}

export default PrivacyPage;