import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem } from '@nit-scs/shared/types';
import { UserRole } from '@nit-scs/shared/types';
import { NAVIGATION_LINKS } from '@/config/navigation';
import {
  LogOut,
  ChevronDown,
  type LucideIcon,
  LayoutDashboard,
  Warehouse,
  PackageCheck,
  Send,
  ShieldCheck,
  Truck,
  Database,
  Settings,
  Package,
  RotateCcw,
  ClipboardList,
  Users,
  PlusCircle,
  FileText,
  Briefcase,
  CheckSquare,
  ListTodo,
  Ship,
  DoorOpen,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { NesmaLogo } from '@/components/NesmaLogo';

// Map nav item labels to lucide icons (icons can't live in shared config since they're React components)
const ICON_MAP: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  'Inventory & Warehouses': Warehouse,
  'Receiving & Inbound': PackageCheck,
  'Issuing & Outbound': Send,
  'Returns & Quality': ShieldCheck,
  'Logistics & Jobs': Truck,
  'Master Data': Database,
  'Admin & Settings': Settings,
  'Receive (MRRV)': PackageCheck,
  'Issue (MIRV)': Send,
  Inventory: Package,
  Return: RotateCcw,
  'Job Orders': ClipboardList,
  Fleet: Truck,
  Suppliers: Users,
  'New Request': PlusCircle,
  'My Requests': FileText,
  'My Project': Briefcase,
  'Approval Queue': CheckSquare,
  Documents: FileText,
  Projects: Briefcase,
  Tasks: ListTodo,
  Inspections: Search,
  'OSD Reports': AlertTriangle,
  Incoming: PackageCheck,
  Shipments: Ship,
  'Gate Passes': DoorOpen,
  Receiving: PackageCheck,
  'Site Inventory': Package,
};

// Extend NavItem with icon for frontend use (shared type omits it since icons are React components)
interface NavItemWithIcon extends NavItem {
  icon?: LucideIcon;
  children?: NavItemWithIcon[];
}

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  setRole: (role: UserRole) => void;
  isMobile?: boolean;
  onLogout?: () => void;
}

const NavItemComponent: React.FC<{ item: NavItemWithIcon; isOpen: boolean; isActive: (path?: string) => boolean }> = ({
  item,
  isOpen,
  isActive,
}) => {
  const Icon = item.icon;
  const active = item.path ? isActive(item.path) : false;
  const hasChildren = item.children && item.children.length > 0;
  // Auto-expand when a child is active
  const anyChildActive = hasChildren && item.children!.some(c => c.path && isActive(c.path));
  const [isExpanded, setIsExpanded] = useState(anyChildActive);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <li className="mb-2">
      <div className={`flex flex-col transition-all duration-200`}>
        <Link
          to={item.path || '#'}
          onClick={handleClick}
          className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl w-full transition-all duration-300 relative overflow-hidden group
            ${
              active
                ? 'bg-gradient-to-r from-nesma-primary/90 to-nesma-primary/40 text-white shadow-[0_0_20px_rgba(46,49,146,0.5)] border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }
          `}
        >
          {active && (
            <div className="absolute start-0 top-0 bottom-0 w-1 bg-nesma-secondary shadow-[0_0_10px_#80D1E9]"></div>
          )}

          {Icon && (
            <Icon
              size={22}
              className={`min-w-[22px] z-10 transition-transform duration-300 ${active ? 'text-nesma-secondary scale-110' : 'group-hover:scale-110'}`}
            />
          )}

          <div
            className={`flex-1 flex justify-between items-center overflow-hidden z-10 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}
          >
            <span className={`font-medium whitespace-nowrap text-sm tracking-wide ${active ? 'text-white' : ''}`}>
              {item.label}
            </span>
            {hasChildren && (
              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} className={active ? 'text-white' : 'text-gray-500'} />
              </div>
            )}
          </div>
        </Link>

        {/* Children */}
        {isOpen && hasChildren && isExpanded && (
          <div className="mt-2 ms-4 ps-4 border-s border-white/10 space-y-1 animate-fade-in">
            {(item.children as NavItemWithIcon[])!.map((child, idx) => (
              <Link
                key={idx}
                to={child.path || '#'}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200
                  ${
                    isActive(child.path)
                      ? 'text-nesma-secondary bg-white/10 font-medium ltr:translate-x-1 rtl:-translate-x-1'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-white/5 ltr:hover:translate-x-1 rtl:hover:-translate-x-1'
                  }
                `}
              >
                {child.type === 'divider' ? (
                  <div className="h-px w-full bg-white/10 my-1"></div>
                ) : (
                  <>
                    <div
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive(child.path) ? 'bg-nesma-secondary shadow-[0_0_5px_#80D1E9]' : 'bg-gray-600'}`}
                    ></div>
                    <span className="truncate">{child.label}</span>
                  </>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ role, isOpen, setRole, onLogout }) => {
  const location = useLocation();
  const rawLinks = (NAVIGATION_LINKS as Record<string, NavItemWithIcon[]>)[role] || [];
  const links = rawLinks.map(link => ({ ...link, icon: link.icon || ICON_MAP[link.label] }));

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRole(e.target.value as UserRole);
  };

  const isLinkActive = (path?: string) => {
    if (!path) return false;
    // Handle paths with query params (e.g. /admin/inventory?tab=stock-levels)
    const [pathPart, queryPart] = path.split('?');
    const currentSearch = location.search;
    // Exact match including query
    if (queryPart && location.pathname === pathPart && currentSearch === `?${queryPart}`) return true;
    // Path-only match (for parent items and simple paths)
    if (!queryPart && location.pathname === pathPart) return true;
    // Prefix match for non-root paths (e.g. /admin/inventory matches /admin/inventory?tab=xxx)
    if (
      !queryPart &&
      pathPart !== '/' &&
      !['/admin', '/warehouse', '/transport', '/engineer'].includes(pathPart) &&
      location.pathname.startsWith(pathPart)
    )
      return true;
    return false;
  };

  return (
    <aside
      className={`${isOpen ? 'w-80' : 'w-24 hidden lg:flex'} glass-panel transition-all duration-500 ease-in-out flex flex-col z-50 h-full border-e border-white/5 bg-[#051020]/95 backdrop-blur-xl shadow-2xl`}
    >
      {/* Logo Area */}
      <div className="h-24 flex items-center justify-center p-6 relative overflow-hidden group border-b border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-nesma-primary/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-nesma-secondary/10 transition-all duration-700"></div>

        {isOpen ? (
          <div className="z-10 flex flex-col items-center animate-fade-in transform hover:scale-105 transition-transform duration-300 w-full">
            <NesmaLogo className="h-8 w-full mb-1 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            <div className="flex items-center gap-2 mt-1">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-nesma-secondary/50"></div>
              <span className="text-[9px] tracking-[0.2em] text-nesma-secondary font-bold uppercase whitespace-nowrap">
                Supply Chain
              </span>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-nesma-secondary/50"></div>
            </div>
          </div>
        ) : (
          <div className="font-black text-3xl text-transparent bg-clip-text bg-gradient-to-br from-white to-nesma-secondary tracking-widest z-10">
            N
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-hidden flex flex-col px-3 pt-4">
        <p
          className={`text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 transition-opacity duration-300 px-2 ${!isOpen && 'text-center opacity-0 lg:hidden'}`}
        >
          Main Menu
        </p>
        <nav className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-6">
          <ul className="space-y-1">
            {links.map((link, idx) => (
              <NavItemComponent key={idx} item={link} isOpen={isOpen} isActive={isLinkActive} />
            ))}
          </ul>
        </nav>
      </div>

      {/* Footer / User Controls */}
      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
        {isOpen ? (
          <div className="mb-3 bg-[#0E2841] p-3 rounded-xl border border-white/5 shadow-inner">
            <label className="text-[10px] text-gray-400 block mb-1.5 font-bold uppercase tracking-wide">
              Current Persona
            </label>
            <select
              value={role}
              onChange={handleRoleChange}
              className="w-full bg-black/40 text-white text-xs rounded-lg p-2.5 border border-white/10 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none cursor-pointer hover:bg-black/60 transition-colors appearance-none"
            >
              {Object.values(UserRole).map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-nesma-secondary border border-white/10"
              title={role}
            >
              {role.charAt(0)}
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className={`flex items-center ${isOpen ? 'justify-start gap-3 px-4' : 'justify-center'} text-gray-400 hover:text-white w-full py-3 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all group`}
          aria-label="Sign Out"
        >
          <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
          {isOpen && <span className="text-sm font-medium group-hover:text-red-400">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
