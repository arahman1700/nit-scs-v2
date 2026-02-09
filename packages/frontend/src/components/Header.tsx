import React from 'react';
import { Menu, Search, Settings, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { User, UserRole } from '@nit-scs-v2/shared/types';
import { useDirection } from '@/contexts/DirectionProvider';
import { NotificationCenter } from '@/components/NotificationCenter';

interface HeaderProps {
  toggleSidebar: () => void;
  user: User;
  role: UserRole;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar, user, role }) => {
  const { i18n, t } = useTranslation();
  const { toggleDirection } = useDirection();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    toggleDirection();
  };

  void role; // role available for future use

  return (
    <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 z-30 border-b border-white/10 bg-nesma-dark/80 backdrop-blur-md sticky top-0 shadow-lg">
      <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors border border-transparent hover:border-white/10 active:scale-95 transform transition-transform lg:hidden"
          aria-label="Toggle sidebar menu"
        >
          <Menu size={24} />
        </button>

        <span className="lg:hidden font-bold text-lg text-white tracking-wider">NESMA</span>

        {/* Desktop Search */}
        <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 w-64 lg:w-96 focus-within:bg-white/10 focus-within:border-nesma-secondary/50 transition-all focus-within:w-full focus-within:max-w-md group">
          <Search size={18} className="text-gray-400 group-focus-within:text-nesma-secondary transition-colors" />
          <input
            type="text"
            placeholder={t('common.searchPlaceholder')}
            className="bg-transparent border-none outline-none text-sm w-full px-3 placeholder-gray-500 text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 ps-2">
        {/* Mobile Search Icon */}
        <button className="md:hidden p-2 text-gray-300 hover:text-white" aria-label="Search">
          <Search size={20} />
        </button>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Notifications */}
          <NotificationCenter />

          <button
            onClick={toggleLanguage}
            className="relative p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white hidden sm:flex items-center gap-1.5"
            aria-label={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            title={i18n.language === 'ar' ? 'English' : 'العربية'}
          >
            <Languages size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wide">{i18n.language === 'ar' ? 'EN' : 'ع'}</span>
          </button>

          <button
            className="relative cursor-pointer p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white hidden sm:block"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="h-8 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3 ps-2 sm:ps-0 border-s border-white/10 sm:border-0">
          <div className="text-end hidden lg:block">
            <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
            <p className="text-[10px] text-nesma-secondary font-medium tracking-wide uppercase mt-0.5">{user.role}</p>
          </div>
          <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-nesma-primary to-nesma-secondary p-[2px] cursor-pointer shadow-lg hover:shadow-nesma-secondary/20 transition-all hover:scale-105">
            <div className="h-full w-full rounded-full border-2 border-nesma-dark overflow-hidden bg-nesma-dark flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt="User" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-nesma-secondary">
                  {user.name
                    .split(' ')
                    .map(w => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
