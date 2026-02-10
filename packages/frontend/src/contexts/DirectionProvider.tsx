import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Dir = 'ltr' | 'rtl';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

interface DirectionContextValue {
  dir: Dir;
  isRtl: boolean;
  toggleDirection: () => void;
}

const DirectionContext = createContext<DirectionContextValue>({
  dir: 'ltr',
  isRtl: false,
  toggleDirection: () => {},
});

export const useDirection = () => useContext(DirectionContext);

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();

  const dir: Dir = RTL_LANGUAGES.includes(i18n.language) ? 'rtl' : 'ltr';

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('dir', dir);
    html.setAttribute('lang', i18n.language);
  }, [dir, i18n.language]);

  const toggleDirection = useCallback(() => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  }, [i18n]);

  return (
    <DirectionContext.Provider value={{ dir, isRtl: dir === 'rtl', toggleDirection }}>
      {children}
    </DirectionContext.Provider>
  );
};
