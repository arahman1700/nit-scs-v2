import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings } from 'lucide-react';
import type { User, UserRole } from '@nit-scs-v2/shared/types';
import { NotificationCenter } from '@/components/NotificationCenter';
import { PushNotificationToggle } from '@/components/PushNotificationToggle';
import { GlobalSearchDropdown } from '@/components/GlobalSearchDropdown';
import { useGlobalSearch } from '@/api/hooks/useSearch';
import { useClickOutside } from '@/hooks/useClickOutside';

interface HeaderProps {
  toggleSidebar: () => void;
  user: User;
  role: UserRole;
}

export const Header: React.FC<HeaderProps> = ({ toggleSidebar: _toggleSidebar, user, role: _role }) => {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults = [], isLoading: searchLoading } = useGlobalSearch(debouncedQuery);

  useClickOutside(settingsRef, () => setSettingsOpen(false), settingsOpen);
  useClickOutside(searchRef, () => setSearchOpen(false), searchOpen);

  const handleSearchSelect = (type: string, id: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(`/admin/forms/${type}/${id}`);
  };

  return (
    <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 z-30 border-b border-white/10 bg-nesma-dark/80 backdrop-blur-md sticky top-0 shadow-lg">
      <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
        <span className="lg:hidden font-bold text-lg text-white tracking-wider">NIT</span>

        {/* Desktop Search */}
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 w-64 lg:w-96 focus-within:bg-white/10 focus-within:border-nesma-secondary/50 transition-all focus-within:w-full focus-within:max-w-md group">
            <Search size={18} className="text-gray-400 group-focus-within:text-nesma-secondary transition-colors" />
            <input
              type="text"
              placeholder="Search assets, orders..."
              aria-label="Global search"
              className="bg-transparent border-none outline-none text-sm w-full px-3 placeholder-gray-500 text-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
            />
          </div>
          {searchOpen && (
            <GlobalSearchDropdown
              results={searchResults}
              isLoading={searchLoading}
              query={debouncedQuery}
              onClose={() => setSearchOpen(false)}
              onSelect={handleSearchSelect}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 pl-2">
        {/* Mobile Search Icon */}
        <button className="md:hidden p-2 text-gray-300 hover:text-white" aria-label="Search">
          <Search size={20} />
        </button>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Notifications */}
          <NotificationCenter />

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
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0a1628]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-50 p-3 animate-fade-in">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">
                  Quick Settings
                </p>
                <PushNotificationToggle />
              </div>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 mx-1 md:mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3 pl-2 sm:pl-0 border-l border-white/10 sm:border-0">
          <div className="text-right hidden lg:block">
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
