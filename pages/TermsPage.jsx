import React from "react";
import { useContext } from 'react';
import './TermsPage.css';
import { LanguageContext } from '../context/LanguageContext';

const TermsContent = ({ language }) => {
  if (language === 'ja') {
    return (
      <>
        <h1>[Michiki] サービス利用規約</h1>
        <p className="notice">※ 本利用規約はポートフォリオ目的で作成された架空の文書であり、いかなる法的効力も持ちません。</p>
        <h2>第1条 (目的)</h2>
        <p>本規約は[プロジェクト名](以下「サービス」)の利用に関して、サービスと会員間の権利、義務および責任事項、その他必要な事項を規定することを目的とします。</p>
        {/* ... (이하 일본어 약관 내용 생략) ... */}
      </>
    );
  }
  return (
    <>
      <h1>[Michiki] <br/> 서비스 이용약관</h1>
      <p className="notice">※ 본 이용약관은 포트폴리오 목적으로 작성된 가상의 문서이며, 어떠한 법적 효력을 갖지 않습니다.</p>
      <h2>제1조 (목적)</h2>
      <p>본 약관은 [프로젝트 이름](이하 '서비스')의 이용과 관련하여 서비스와 <br /> 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
      {/* ... (이하 한국어 약관 내용 생략) ... */}
      <hr />
      <p><strong>부칙</strong></p>
      <p>본 약관은 2025년 07월 10일부터 시행됩니다.</p>
    </>
  );
};

function TermsPage() {
  const { language } = useContext(LanguageContext);
  return (
    <div className="terms-container">
      <TermsContent language={language} />
    </div>
  );
}

export default TermsPage;
