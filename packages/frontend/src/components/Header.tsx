import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { User, UserRole } from '@nit-scs-v2/shared/types';
import { useDirection } from '@/contexts/DirectionProvider';
import { NotificationCenter } from '@/components/NotificationCenter';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';

interface HeaderProps {
  toggleSidebar: () => void;
  user: User;
  role: UserRole;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar, user, role }) => {
  const { i18n, t } = useTranslation();
  const { toggleDirection, isRtl } = useDirection();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  void role; // role available for future use

  // Close settings dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

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
            onClick={toggleDirection}
            className="relative hidden sm:flex items-center h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-xs font-semibold overflow-hidden"
            aria-label={isRtl ? 'Switch to English' : 'التبديل إلى العربية'}
            title={isRtl ? 'English' : 'العربية'}
          >
            <span
              className={`px-2.5 py-1 rounded-full transition-all ${!isRtl ? 'bg-nesma-primary text-white' : 'text-gray-400'}`}
            >
              EN
            </span>
            <span
              className={`px-2.5 py-1 rounded-full transition-all ${isRtl ? 'bg-nesma-primary text-white' : 'text-gray-400'}`}
            >
              عر
            </span>
          </button>

          <div className="relative hidden sm:block" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="relative cursor-pointer p-2 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
              aria-label="Settings"
              aria-expanded={settingsOpen}
            >
              <Settings size={20} />
            </button>

            {settingsOpen && (
              <div className="absolute end-0 top-full mt-2 w-64 bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-50 p-3 animate-fade-in">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">
                  Quick Settings
                </p>
                <PushNotificationToggle />
              </div>
            )}
          </div>
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
