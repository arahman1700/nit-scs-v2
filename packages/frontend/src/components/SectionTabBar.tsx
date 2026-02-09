import React, { useRef, useEffect } from 'react';

export interface TabDef {
  key: string;
  label: string;
  badge?: number;
}

interface SectionTabBarProps {
  tabs: TabDef[];
  activeTab: string;
  onChange: (key: string) => void;
}

export const SectionTabBar: React.FC<SectionTabBarProps> = ({ tabs, activeTab, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to keep active tab visible on mobile
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const btn = activeRef.current;
      const offset = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto scrollbar-none"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 flex-shrink-0
              ${isActive
                ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none
                ${isActive ? 'bg-white/20 text-white' : 'bg-nesma-secondary/20 text-nesma-secondary'}
              `}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
