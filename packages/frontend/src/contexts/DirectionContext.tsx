import React, { createContext, useContext, useEffect, useState } from 'react';

type Dir = 'ltr' | 'rtl';

interface DirectionContextValue {
  dir: Dir;
  isRTL: boolean;
  toggleDirection: () => void;
  setDirection: (dir: Dir) => void;
}

const STORAGE_KEY = 'nit-scs-direction';

const DirectionContext = createContext<DirectionContextValue>({
  dir: 'ltr',
  isRTL: false,
  toggleDirection: () => {},
  setDirection: () => {},
});

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dir, setDir] = useState<Dir>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'rtl' || stored === 'ltr') return stored;
    } catch {
      // Ignore storage errors
    }
    return 'ltr';
  });

  // Sync to <html> element on every change
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('dir', dir);
    html.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
    try {
      localStorage.setItem(STORAGE_KEY, dir);
    } catch {
      // Ignore storage errors
    }
  }, [dir]);

  const toggleDirection = () => setDir(prev => (prev === 'ltr' ? 'rtl' : 'ltr'));
  const setDirection = (next: Dir) => setDir(next);

  return (
    <DirectionContext.Provider value={{ dir, isRTL: dir === 'rtl', toggleDirection, setDirection }}>
      {children}
    </DirectionContext.Provider>
  );
};

export const useDirection = () => useContext(DirectionContext);
