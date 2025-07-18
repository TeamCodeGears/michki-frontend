import { useContext } from 'react';
import './PrivacyPage.css';
import { LanguageContext } from '../context/LanguageContext';

const PrivacyContent = ({ language }) => {
  if (language === 'ja') {
    return (
      <>
        <h1>MICHIKI 個人情報保護方針</h1>
        <p className="notice">※ 本個人情報保護方針はポートフォリオ目的で作成された架空の文書であり、実際のユーザーの個人情報を収集または第三者に提供せず、いかなる法的効力も持ちません。</p>
        <h2>第1条 (収集する個人情報の項目)</h2>
        <p>本サービスは会員登録および円滑な顧客相談、各種サービスの提供のために以下の最小限の個人情報を収集しています。</p>
        {/* ... (이하 일본어 개인정보처리방침 내용 생략) ... */}
      </>
    );
  }
  return (
    <>
      <h1>MICHIKI <br/> 개인정보 처리방침</h1>
      <p className="notice">※ 본 개인정보 처리방침은 포트폴리오 목적으로 작성된 가상의 문서이며, 실제 사용자의 개인정보를 수집하거나 제3자에게 제공하지 않으며, 어떠한 법적 효력도 갖지 않습니다.</p>
      <h2>제1조 (수집하는 개인정보의 항목)</h2>
      <p>본 서비스는 회원가입 및 원활한 고객 상담, 각종 서비스의 제공을 위해 아래와 같은 최소한의 개인정보를 수집하고 있습니다.</p>
      {/* ... (이하 한국어 개인정보처리방침 내용 생략) ... */}
      <hr />
      <p><strong>부칙</strong></p>
      <p>본 개인정보 처리방침은 2025년 7월 10일 부터 시행됩니다.</p>
    </>
  );
};

function PrivacyPage() {
  const { language } = useContext(LanguageContext);
  return (
    <div className="privacy-container">
      <PrivacyContent language={language} />
    </div>
  );
}

export default PrivacyPage;
