import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Dir = 'ltr' | 'rtl';

interface DirectionContextValue {
  dir: Dir;
  toggleDirection: () => void;
}

const DirectionContext = createContext<DirectionContextValue>({
  dir: 'ltr',
  toggleDirection: () => {},
});

export const useDirection = () => useContext(DirectionContext);

const STORAGE_KEY = 'nit-scs-dir';

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dir, setDir] = useState<Dir>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'rtl' ? 'rtl' : 'ltr';
  });

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('dir', dir);
    html.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
    localStorage.setItem(STORAGE_KEY, dir);
  }, [dir]);

  const toggleDirection = useCallback(() => {
    setDir(prev => (prev === 'ltr' ? 'rtl' : 'ltr'));
  }, []);

  return <DirectionContext.Provider value={{ dir, toggleDirection }}>{children}</DirectionContext.Provider>;
};
