import React, { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavItem, NavSection } from '@nit-scs-v2/shared/types';
import { LayoutDashboard, Package, Warehouse, BarChart3, Menu, X, type LucideIcon } from 'lucide-react';
import { getIcon } from '@/config/iconRegistry';

// ── Fixed Tab Definitions ────────────────────────────────────────────────

interface FixedTab {
  label: string;
  icon: LucideIcon;
  /** Match function: returns true if this tab is active for the current route */
  matchPath: (pathname: string) => boolean;
  /** Path to navigate to when tapped */
  path?: string;
  /** If true, this tab opens the "More" bottom sheet instead of navigating */
  isMore?: boolean;
}

function buildFixedTabs(basePath: string): FixedTab[] {
  return [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      matchPath: p => p === basePath || p === `${basePath}/`,
      path: basePath,
    },
    {
      label: 'Operations',
      icon: Package,
      matchPath: p =>
        p.includes('/warehouses') ||
        p.includes('/receive') ||
        p.includes('/issue') ||
        p.includes('/return') ||
        p.includes('/equipment') ||
        p.includes('/qc') ||
        p.includes('/inspections'),
      path: undefined, // Will use first operations path
    },
    {
      label: 'Inventory',
      icon: Warehouse,
      matchPath: p =>
        p.includes('/inventory') || p.includes('/bin-cards') || p.includes('/scrap') || p.includes('/expiry'),
      path: undefined,
    },
    {
      label: 'Reports',
      icon: BarChart3,
      matchPath: p =>
        p.includes('/dashboards') || p.includes('/kpis') || p.includes('/reports') || p.includes('/compliance'),
      path: undefined,
    },
    {
      label: 'More',
      icon: Menu,
      matchPath: () => false,
      isMore: true,
    },
  ];
}

// ── Resolve tab paths from navigation sections ───────────────────────────

function resolveTabPaths(tabs: FixedTab[], sections: NavSection[]): FixedTab[] {
  return tabs.map(tab => {
    if (tab.path || tab.isMore) return tab;

    // Find the first matching section/item path for this tab category
    for (const section of sections) {
      const sectionLower = section.section.toLowerCase();

      // Match tab label to section
      const tabLower = tab.label.toLowerCase();
      const matches =
        sectionLower.includes(tabLower) ||
        (tabLower === 'operations' &&
          (sectionLower.includes('operation') ||
            sectionLower.includes('receiving') ||
            sectionLower.includes('issuing'))) ||
        (tabLower === 'inventory' && sectionLower.includes('inventory')) ||
        (tabLower === 'reports' && (sectionLower.includes('analytics') || sectionLower.includes('report')));

      if (matches) {
        // Get first item path
        if (section.items.length > 0) {
          return { ...tab, path: section.items[0].path };
        }
        if (section.children && section.children.length > 0 && section.children[0].items.length > 0) {
          return { ...tab, path: section.children[0].items[0].path };
        }
      }
    }

    return tab;
  });
}

// ── Bottom Sheet for "More" ──────────────────────────────────────────────

const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  sections: NavSection[];
}> = ({ isOpen, onClose, sections }) => {
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    if (isOpen) onClose();
  }, [location.pathname, isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[70] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="glass-panel rounded-t-2xl border-t border-white/10 max-h-[70vh] flex flex-col">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">All Sections</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Scrollable content */}
          <div
            className="overflow-y-auto flex-1 px-4 py-3 custom-scrollbar"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="mb-4">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] px-1 mb-2">
                  {section.section}
                </div>

                {/* Direct items */}
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map((item, iIdx) => {
                    const Icon = getIcon(item.icon);
                    const active = location.pathname + location.search === (item.path || '');
                    return (
                      <Link
                        key={iIdx}
                        to={item.path || '#'}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                          active
                            ? 'bg-nesma-primary/30 text-nesma-secondary'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {Icon && <Icon size={20} />}
                        <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>

                {/* Sub-groups */}
                {section.children?.map((group, gIdx) => (
                  <div key={gIdx} className="mt-2">
                    <div className="text-[10px] font-semibold text-gray-500 px-1 mb-1.5">{group.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {group.items.map((item, iIdx) => {
                        const Icon = getIcon(item.icon);
                        const active = location.pathname + location.search === (item.path || '');
                        return (
                          <Link
                            key={iIdx}
                            to={item.path || '#'}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                              active
                                ? 'bg-nesma-primary/30 text-nesma-secondary'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {Icon && <Icon size={20} />}
                            <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Main MobileTabBar ────────────────────────────────────────────────────

interface MobileTabBarProps {
  navLinks: NavItem[];
  onMoreClick: () => void;
  /** Navigation sections for the bottom sheet */
  sections?: NavSection[];
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ navLinks, onMoreClick, sections }) => {
  const location = useLocation();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Determine base path from current location
  const basePath = '/' + (location.pathname.split('/')[1] || 'admin');

  // Build fixed tabs
  const rawTabs = buildFixedTabs(basePath);
  const tabs = sections ? resolveTabPaths(rawTabs, sections) : rawTabs;

  // Resolve paths from navLinks for tabs that still don't have paths
  const finalTabs = tabs.map(tab => {
    if (tab.path || tab.isMore) return tab;

    // Try to find a matching path from navLinks
    for (const link of navLinks) {
      if (link.path) return { ...tab, path: link.path };
      if (link.children) {
        for (const child of link.children) {
          if (child.path) return { ...tab, path: child.path };
        }
      }
    }
    return tab;
  });

  // Check which tab is active based on current path
  const activeTabIndex = finalTabs.findIndex((tab, _idx) => !tab.isMore && tab.matchPath(location.pathname));

  // If no fixed tab matches, "More" is implicitly active
  const moreActive = activeTabIndex === -1;

  const handleMoreClick = useCallback(() => {
    if (sections) {
      setIsBottomSheetOpen(true);
    } else {
      onMoreClick();
    }
  }, [sections, onMoreClick]);

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden glass-panel border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around h-16">
          {finalTabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isMore = tab.isMore;
            const active = isMore ? moreActive : idx === activeTabIndex;

            if (isMore) {
              return (
                <button
                  key={idx}
                  onClick={handleMoreClick}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 relative transition-colors duration-200 ${
                    active ? 'text-nesma-secondary' : 'text-gray-500'
                  }`}
                  aria-label="More navigation options"
                >
                  {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-nesma-secondary shadow-[0_0_8px_#80D1E9]" />
                  )}
                  <Icon size={22} className={active ? 'text-nesma-secondary' : ''} />
                  <span
                    className={`text-[10px] mt-1 truncate max-w-full px-1 ${active ? 'font-semibold' : 'font-medium'}`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={idx}
                to={tab.path || basePath}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 relative transition-colors duration-200 ${
                  active ? 'text-nesma-secondary' : 'text-gray-500'
                }`}
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-nesma-secondary shadow-[0_0_8px_#80D1E9]" />
                )}
                <Icon size={22} className={active ? 'text-nesma-secondary' : ''} />
                <span
                  className={`text-[10px] mt-1 truncate max-w-full px-1 ${active ? 'font-semibold' : 'font-medium'}`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Sheet for "More" */}
      {sections && (
        <BottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} sections={sections} />
      )}
    </>
  );
};
