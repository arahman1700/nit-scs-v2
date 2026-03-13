import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavSection, NavSubGroup } from '@nit-scs-v2/shared/types';
import { UserRole } from '@nit-scs-v2/shared/types';
import { SECTION_NAVIGATION } from '@/config/navigation';
import { useNavigation } from '@/domains/system/hooks/useNavigation';
import { LogOut, Search, ChevronRight } from 'lucide-react';
import { getIcon } from '@/config/iconRegistry';
import { useDirection } from '@/contexts/DirectionContext';

// ── LocalStorage helpers ─────────────────────────────────────────────────

const STORAGE_KEY = 'sidebar-expanded';

function loadExpandedSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveExpandedSections(expanded: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
  } catch {
    // Ignore storage errors
  }
}

// ── Props ────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  setRole: (role: UserRole) => void;
  isMobile?: boolean;
  onLogout?: () => void;
  userName?: string;
}

// ── Active Link Detection ────────────────────────────────────────────────

const BASE_PATHS = ['/admin', '/warehouse', '/transport', '/logistics', '/manager', '/qc', '/site-engineer'];

function useActiveCheck() {
  const location = useLocation();

  return (path?: string) => {
    if (!path) return false;
    const [pathPart, queryPart] = path.split('?');
    // Exact match including query
    if (queryPart && location.pathname === pathPart && location.search === `?${queryPart}`) return true;
    // Path-only exact match
    if (!queryPart && location.pathname === pathPart) return true;
    // Prefix match for non-root paths
    if (!queryPart && !BASE_PATHS.includes(pathPart) && location.pathname.startsWith(pathPart)) return true;
    return false;
  };
}

// ── Utility: check if any item in a section is active ────────────────────

function sectionHasActiveItem(section: NavSection, isActive: (path?: string) => boolean): boolean {
  for (const item of section.items) {
    if (isActive(item.path)) return true;
  }
  if (section.children) {
    for (const group of section.children) {
      for (const item of group.items) {
        if (isActive(item.path)) return true;
      }
    }
  }
  return false;
}

// ── Count total items in a section ───────────────────────────────────────

function getSectionItemCount(section: NavSection): number {
  let count = section.items.length;
  if (section.children) {
    for (const group of section.children) {
      count += group.items.length;
    }
  }
  return count;
}

// ── Nav Item Component ───────────────────────────────────────────────────

const SidebarNavItem: React.FC<{
  item: NavItem;
  isActive: (path?: string) => boolean;
  isOpen: boolean;
  indent?: boolean;
}> = ({ item, isActive, isOpen, indent = false }) => {
  const Icon = getIcon(item.icon);
  const active = isActive(item.path);
  const { isRTL } = useDirection();

  // Active indicator border flips side in RTL
  const activeClass = isRTL
    ? 'bg-nesma-primary/30 text-nesma-secondary font-medium border-r-[3px] border-nesma-secondary pr-[9px] pl-3'
    : 'bg-nesma-primary/30 text-nesma-secondary font-medium border-l-[3px] border-nesma-secondary pl-[9px]';
  const inactiveClass = isRTL
    ? 'text-gray-400 hover:text-white hover:bg-white/5 border-r-[3px] border-transparent pr-[9px] pl-3'
    : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent pl-[9px]';
  const indentClass = indent && isOpen ? (isRTL ? 'mr-2' : 'ml-2') : '';

  return (
    <Link
      to={item.path || '#'}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 group relative
        ${indentClass}
        ${active ? activeClass : inactiveClass}
      `}
    >
      {Icon && (
        <Icon
          size={17}
          className={`flex-shrink-0 transition-all duration-200 ${active ? 'text-nesma-secondary' : 'opacity-60 group-hover:opacity-100'}`}
        />
      )}
      {isOpen && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="ms-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
};

// ── Sub-Group Component ──────────────────────────────────────────────────

const SidebarSubGroup: React.FC<{
  group: NavSubGroup;
  isActive: (path?: string) => boolean;
  isOpen: boolean;
}> = ({ group, isActive, isOpen }) => (
  <div className="mt-1">
    {isOpen && (
      <div className="ps-6 pt-2 pb-1">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{group.label}</span>
      </div>
    )}
    <div className="space-y-0.5">
      {group.items.map((item, idx) => (
        <SidebarNavItem key={idx} item={item} isActive={isActive} isOpen={isOpen} indent />
      ))}
    </div>
  </div>
);

// ── Section Component (Collapsible) ──────────────────────────────────────

const SidebarSection: React.FC<{
  section: NavSection;
  isActive: (path?: string) => boolean;
  isOpen: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ section, isActive, isOpen, isExpanded, onToggle }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAlwaysExpanded = section.alwaysExpanded === true;
  const shouldExpand = isAlwaysExpanded || isExpanded;
  const itemCount = getSectionItemCount(section);
  const { isRTL } = useDirection();

  return (
    <div className="mb-1">
      {/* Section Header */}
      {isOpen && (
        <button
          onClick={isAlwaysExpanded ? undefined : onToggle}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all duration-200
            ${isAlwaysExpanded ? 'cursor-default' : 'cursor-pointer hover:bg-white/5'}
          `}
          aria-expanded={shouldExpand}
          aria-label={`${shouldExpand ? 'Collapse' : 'Expand'} ${section.section} section`}
          type="button"
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{section.section}</span>
          <div className="flex items-center gap-1.5">
            {/* Item count badge when collapsed */}
            {!shouldExpand && itemCount > 0 && (
              <span className="text-[9px] font-semibold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {itemCount}
              </span>
            )}
            {/* Chevron (hidden for always-expanded sections) */}
            {!isAlwaysExpanded && (
              <ChevronRight
                size={14}
                className={`text-gray-400 transition-transform duration-300
                  ${isRTL ? (shouldExpand ? '-rotate-90' : 'rotate-180') : shouldExpand ? 'rotate-90' : ''}`}
              />
            )}
          </div>
        </button>
      )}

      {/* Collapsible Content */}
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          shouldExpand || !isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {/* Direct items */}
        {section.items.length > 0 && (
          <div className="space-y-0.5">
            {section.items.map((item, idx) => (
              <SidebarNavItem key={idx} item={item} isActive={isActive} isOpen={isOpen} />
            ))}
          </div>
        )}

        {/* Sub-groups (children) */}
        {section.children?.map((group, idx) => (
          <SidebarSubGroup key={idx} group={group} isActive={isActive} isOpen={isOpen} />
        ))}
      </div>
    </div>
  );
};

// ── Main Sidebar ─────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ role, isOpen, setRole, onLogout, userName }) => {
  const isActive = useActiveCheck();
  const { isRTL } = useDirection();

  // Use dynamic nav from backend if available, fall back to static config
  const { data: dynamicNav } = useNavigation();
  // Only use dynamic nav if it matches NavSection[] shape (has 'section' and 'items' keys)
  const isValidSectionNav =
    Array.isArray(dynamicNav) && dynamicNav.length > 0 && 'section' in dynamicNav[0] && 'items' in dynamicNav[0];
  const sections: NavSection[] =
    (isValidSectionNav ? (dynamicNav as unknown as NavSection[]) : null) || SECTION_NAVIGATION[role] || [];

  // ── Expanded state management ──
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const stored = loadExpandedSections();
    // Initialize: auto-expand sections that contain the active route
    const initial: Record<string, boolean> = { ...stored };
    return initial;
  });

  // Auto-expand the section containing the active item on mount and route changes
  const location = useLocation();
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      let changed = false;
      for (const section of sections) {
        if (!section.alwaysExpanded && sectionHasActiveItem(section, isActive)) {
          if (!next[section.section]) {
            next[section.section] = true;
            changed = true;
          }
        }
      }
      if (changed) {
        saveExpandedSections(next);
        return next;
      }
      return prev;
    });
  }, [location.pathname, location.search, sections, isActive]);

  const toggleSection = useCallback((sectionName: string) => {
    setExpanded(prev => {
      const next = { ...prev, [sectionName]: !prev[sectionName] };
      saveExpandedSections(next);
      return next;
    });
  }, []);

  // Role display name
  const roleLabel = role.replace(/_/g, ' ');
  const initials = userName
    ? userName
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : roleLabel.slice(0, 2).toUpperCase();

  return (
    <aside
      className={`${isOpen ? 'w-72' : 'w-20 hidden lg:flex'} transition-all duration-500 ease-in-out flex flex-col z-50 h-full bg-nesma-dark/95 backdrop-blur-xl shadow-2xl
        ${isRTL ? 'border-l border-white/5' : 'border-r border-white/5'}`}
    >
      {/* ── Logo Area (compact) ── */}
      <div className="h-16 flex items-center px-4 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-nesma-primary/15 blur-[50px] rounded-full pointer-events-none"></div>

        {isOpen ? (
          <div className="z-10 flex items-center gap-3 w-full">
            <div className="w-8 h-8 bg-gradient-to-br from-nesma-primary to-nesma-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">NIT SCS</div>
              <div className="text-[10px] text-gray-400 tracking-wide">Supply Chain V2</div>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 mx-auto bg-gradient-to-br from-nesma-primary to-nesma-secondary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
        )}
      </div>

      {/* ── Search Bar ── */}
      {isOpen && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-[13px] cursor-pointer hover:bg-white/8 hover:border-white/15 transition-all">
            <Search size={14} />
            <span>Search...</span>
            <kbd className="ms-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">&#8984;K</kbd>
          </div>
        </div>
      )}

      {/* ── Navigation Sections ── */}
      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-4 custom-scrollbar">
        {sections.map((section, idx) => (
          <SidebarSection
            key={idx}
            section={section}
            isActive={isActive}
            isOpen={isOpen}
            isExpanded={expanded[section.section] ?? false}
            onToggle={() => toggleSection(section.section)}
          />
        ))}
      </nav>

      {/* ── User Footer ── */}
      <div className="p-3 border-t border-white/5 bg-black/20">
        {isOpen ? (
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-nesma-primary to-nesma-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white truncate">{userName || 'User'}</div>
              <div className="text-[10px] text-gray-400 capitalize truncate">{roleLabel}</div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-nesma-primary to-nesma-secondary flex items-center justify-center text-xs font-bold text-white"
              title={roleLabel}
            >
              {initials}
            </div>
          </div>
        )}

        {/* Dev-only: Role Switcher (hidden in production) */}
        {process.env.NODE_ENV === 'development' && isOpen && (
          <select
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            className="w-full mb-2 bg-white/5 text-gray-400 text-[11px] rounded-lg p-2 border border-white/10 outline-none cursor-pointer hover:bg-white/8 transition-colors"
            aria-label="Switch role (dev only)"
          >
            {Object.values(UserRole).map(r => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onLogout}
          className={`flex items-center ${isOpen ? 'justify-start gap-3 px-3' : 'justify-center'} text-gray-400 hover:text-white w-full py-2.5 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all group`}
          aria-label="Sign Out"
        >
          <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
          {isOpen && <span className="text-[13px] font-medium group-hover:text-red-400">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
