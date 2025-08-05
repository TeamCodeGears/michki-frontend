import { createContext, useState, useMemo, useContext } from 'react';
import { texts } from '../data/translations.js';

// 1. 컨텍스트 생성 (기본값은 Provider가 없을 때를 위한 비상용)
export const LanguageContext = createContext({
  language: 'ko',
  setLanguage: () => console.warn('LanguageProvider not found'),
  texts: texts.ko,
});

// 2. 컨텍스트 제공자 컴포넌트 정의
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('ko');

  const currentTexts = useMemo(() => texts[language], [language]);

  const value = {
    language,
    setLanguage,
    texts: currentTexts,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
