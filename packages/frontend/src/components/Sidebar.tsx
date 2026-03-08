import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavSection } from '@nit-scs-v2/shared/types';
import { UserRole } from '@nit-scs-v2/shared/types';
import { SECTION_NAVIGATION } from '@/config/navigation';
import { useNavigation } from '@/domains/system/hooks/useNavigation';
import { NesmaLogo } from '@/components/NesmaLogo';
import {
  LogOut,
  Search,
  type LucideIcon,
  LayoutDashboard,
  Clock,
  FileText,
  PackageCheck,
  Send,
  CornerDownLeft,
  ClipboardList,
  Repeat,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  Wrench,
  DoorOpen,
  Truck,
  Hammer,
  Zap,
  Box,
  Layers,
  Database,
  Recycle,
  AlertCircle,
  Ship,
  Globe,
  Map,
  BarChart2,
  DollarSign,
  Shield,
  ClipboardCheck,
  Users,
  GitMerge,
  Settings,
  Smartphone,
  TrendingUp,
  ListTodo,
  PlusCircle,
  Briefcase,
  Package,
  RefreshCw,
} from 'lucide-react';

// ── Icon Registry ────────────────────────────────────────────────────────
// Maps string icon names from navigation config to Lucide components

const ICON_REGISTRY: Record<string, LucideIcon> = {
  LayoutDashboard,
  Clock,
  FileText,
  PackageCheck,
  Send,
  CornerDownLeft,
  ClipboardList,
  Repeat,
  GitBranch,
  CheckCircle,
  AlertTriangle,
  Wrench,
  DoorOpen,
  Truck,
  Hammer,
  Zap,
  Box,
  Layers,
  Database,
  Recycle,
  AlertCircle,
  Ship,
  Globe,
  Map,
  BarChart2,
  DollarSign,
  Shield,
  ClipboardCheck,
  Users,
  GitMerge,
  Settings,
  Smartphone,
  TrendingUp,
  ListTodo,
  PlusCircle,
  Briefcase,
  Package,
  RefreshCw,
};

function getIcon(name?: string): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_REGISTRY[name];
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

// ── Nav Item Component ───────────────────────────────────────────────────

const SidebarNavItem: React.FC<{
  item: NavItem;
  isActive: (path?: string) => boolean;
  isOpen: boolean;
}> = ({ item, isActive, isOpen }) => {
  const Icon = getIcon(item.icon);
  const active = isActive(item.path);

  return (
    <Link
      to={item.path || '#'}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 group relative
        ${
          active
            ? 'bg-nesma-primary/30 text-nesma-secondary font-medium border-l-[3px] border-nesma-secondary pl-[9px]'
            : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent pl-[9px]'
        }
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
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
};

// ── Section Component ────────────────────────────────────────────────────

const SidebarSection: React.FC<{
  section: NavSection;
  isActive: (path?: string) => boolean;
  isOpen: boolean;
}> = ({ section, isActive, isOpen }) => (
  <div className="mb-1">
    {isOpen && (
      <div className="px-3 pt-4 pb-1.5">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">{section.section}</span>
      </div>
    )}
    <div className="space-y-0.5">
      {(section.items ?? []).map((item, idx) => (
        <SidebarNavItem key={idx} item={item} isActive={isActive} isOpen={isOpen} />
      ))}
    </div>
  </div>
);

// ── Main Sidebar ─────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ role, isOpen, setRole, onLogout, userName }) => {
  const isActive = useActiveCheck();

  // Use dynamic nav from backend if available, fall back to static config
  const { data: dynamicNav } = useNavigation();
  // Only use dynamic nav if it matches NavSection[] shape (has 'section' and 'items' keys)
  const isValidSectionNav =
    Array.isArray(dynamicNav) && dynamicNav.length > 0 && 'section' in dynamicNav[0] && 'items' in dynamicNav[0];
  const sections: NavSection[] =
    (isValidSectionNav ? (dynamicNav as unknown as NavSection[]) : null) || SECTION_NAVIGATION[role] || [];

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
      className={`${isOpen ? 'w-72' : 'w-20 hidden lg:flex'} transition-all duration-500 ease-in-out flex flex-col z-50 h-full border-r border-white/5 bg-nesma-dark/95 backdrop-blur-xl shadow-2xl`}
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
              <div className="text-[10px] text-gray-500 tracking-wide">Supply Chain V2</div>
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
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-500 text-[13px] cursor-pointer hover:bg-white/8 hover:border-white/15 transition-all">
            <Search size={14} />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500">&#8984;K</kbd>
          </div>
        </div>
      )}

      {/* ── Navigation Sections ── */}
      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-4 custom-scrollbar">
        {sections.map((section, idx) => (
          <SidebarSection key={idx} section={section} isActive={isActive} isOpen={isOpen} />
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
              <div className="text-[10px] text-gray-500 capitalize truncate">{roleLabel}</div>
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
