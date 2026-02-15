import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem } from '@nit-scs-v2/shared/types';
import {
  LayoutDashboard,
  Warehouse,
  Truck,
  Ship,
  Recycle,
  Package,
  FileText,
  Briefcase,
  Search,
  Users,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

const TAB_ICON_MAP: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  'Warehouses & Stores': Warehouse,
  'Equipment & Transport': Truck,
  'Scrap & Surplus': Recycle,
  'Shipping & Customs': Ship,
  'Inventory & Warehouses': Warehouse,
  'Material Management': Warehouse,
  'Logistics & Fleet': Truck,
  'Asset Lifecycle': Recycle,
  Operations: Briefcase,
  Workflow: Briefcase,
  Oversight: Users,
  Requests: FileText,
  Logistics: Truck,
  Shipping: Ship,
  Documents: FileText,
  'Master Data': Package,
  Inspections: Search,
  Return: Package,
  Inventory: Package,
};

// Short labels for the tab bar (full labels are too long)
const TAB_SHORT_LABELS: Record<string, string> = {
  Dashboard: 'Home',
  'Warehouses & Stores': 'Warehouse',
  'Equipment & Transport': 'Transport',
  'Scrap & Surplus': 'Scrap',
  'Shipping & Customs': 'Shipping',
  'Inventory & Warehouses': 'Warehouse',
  'Material Management': 'Material',
  'Logistics & Fleet': 'Logistics',
  'Asset Lifecycle': 'Assets',
  'Master Data': 'Data',
  'Employees & Org': 'People',
  Exceptions: 'Alerts',
};

interface MobileTabBarProps {
  navLinks: NavItem[];
  onMoreClick: () => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ navLinks, onMoreClick }) => {
  const location = useLocation();

  // Take first 4 nav items that have a path (skip dividers etc.)
  const tabs = navLinks.filter(item => item.path).slice(0, 4);

  const isActive = (path?: string) => {
    if (!path) return false;
    const [pathPart] = path.split('?');
    if (location.pathname === pathPart) return true;
    // Prefix match for section paths
    if (pathPart !== '/' && location.pathname.startsWith(pathPart)) return true;
    return false;
  };

  // Check if "More" is active (current path doesn't match any visible tab)
  const moreActive = !tabs.some(tab => isActive(tab.path));

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 lg:hidden glass-panel border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around h-16">
        {tabs.map((tab, idx) => {
          const Icon = TAB_ICON_MAP[tab.label] || LayoutDashboard;
          const active = isActive(tab.path);
          const shortLabel = TAB_SHORT_LABELS[tab.label] || tab.label;

          return (
            <Link
              key={idx}
              to={tab.path || '#'}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 relative transition-colors duration-200 ${
                active ? 'text-nesma-secondary' : 'text-gray-500'
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-nesma-secondary shadow-[0_0_8px_#80D1E9]" />
              )}
              <Icon size={22} className={active ? 'text-nesma-secondary' : ''} />
              <span className={`text-[10px] mt-1 truncate max-w-full px-1 ${active ? 'font-semibold' : 'font-medium'}`}>
                {shortLabel}
              </span>
            </Link>
          );
        })}

        {/* More tab */}
        <button
          onClick={onMoreClick}
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 relative transition-colors duration-200 ${
            moreActive ? 'text-nesma-secondary' : 'text-gray-500'
          }`}
          aria-label="More navigation options"
        >
          {moreActive && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-nesma-secondary shadow-[0_0_8px_#80D1E9]" />
          )}
          <MoreHorizontal size={22} />
          <span className="text-[10px] mt-1 font-medium">More</span>
        </button>
      </div>
    </nav>
  );
};
