import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Search,
  Activity,
  TrendingUp,
  DollarSign,
  Warehouse,
  Settings,
  Clock,
  Star,
  ArrowRight,
  BarChart3,
  Shield,
  Truck,
  Zap,
  X,
  Eye,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface DashboardCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
  gradientFrom: string;
  gradientTo: string;
  dashboardCount: number;
}

interface DashboardPreview {
  id: string;
  name: string;
  description: string;
  category: string;
  route: string;
  lastUpdated: string;
  isPinned?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const DASHBOARD_CATEGORIES: DashboardCategory[] = [
  {
    id: 'operations',
    label: 'Operations',
    icon: Activity,
    description: 'Real-time operations monitoring, document flow, and activity tracking',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    gradientFrom: 'from-blue-500/20',
    gradientTo: 'to-blue-600/5',
    dashboardCount: 4,
  },
  {
    id: 'kpis',
    label: 'KPIs',
    icon: TrendingUp,
    description: 'Key performance indicators, targets, and trend analysis',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    gradientFrom: 'from-emerald-500/20',
    gradientTo: 'to-emerald-600/5',
    dashboardCount: 3,
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: DollarSign,
    description: 'Cost allocation, depreciation, budget tracking, and forecasts',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    gradientFrom: 'from-amber-500/20',
    gradientTo: 'to-amber-600/5',
    dashboardCount: 3,
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    icon: Warehouse,
    description: 'Inventory levels, yard management, cross-dock operations',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    gradientFrom: 'from-purple-500/20',
    gradientTo: 'to-purple-600/5',
    dashboardCount: 5,
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: Settings,
    description: 'User-created dashboards with drag-and-drop widget builder',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    gradientFrom: 'from-cyan-500/20',
    gradientTo: 'to-cyan-600/5',
    dashboardCount: 0,
  },
];

const PRESET_DASHBOARDS: DashboardPreview[] = [
  {
    id: 'ops-main',
    name: 'Operations Overview',
    description: 'Live document flow, pending approvals, and activity feed',
    category: 'operations',
    route: '/admin',
    lastUpdated: '2026-03-09',
  },
  {
    id: 'kpi-main',
    name: 'KPI Dashboard',
    description: 'Performance metrics, targets, and trend charts',
    category: 'kpis',
    route: '/admin/dashboards/kpis',
    lastUpdated: '2026-03-09',
  },
  {
    id: 'security',
    name: 'Security Dashboard',
    description: 'Access logs, anomaly detection, and security alerts',
    category: 'operations',
    route: '/admin/dashboards/security',
    lastUpdated: '2026-03-08',
  },
  {
    id: 'cost-alloc',
    name: 'Cost Allocation',
    description: 'Project cost breakdown, budget utilization, and variance',
    category: 'financial',
    route: '/admin/dashboards/cost-allocation',
    lastUpdated: '2026-03-08',
  },
  {
    id: 'assets',
    name: 'Asset Dashboard',
    description: 'Equipment status, depreciation, and maintenance schedules',
    category: 'financial',
    route: '/admin/dashboards/assets',
    lastUpdated: '2026-03-07',
  },
  {
    id: 'labor',
    name: 'Labor Dashboard',
    description: 'Workforce allocation, productivity, and labor costs',
    category: 'kpis',
    route: '/admin/dashboards/labor',
    lastUpdated: '2026-03-07',
  },
  {
    id: 'inventory-dash',
    name: 'Inventory Dashboard',
    description: 'Stock levels, reorder points, and movement analytics',
    category: 'warehouse',
    route: '/admin/inventory',
    lastUpdated: '2026-03-09',
  },
  {
    id: 'exception',
    name: 'Exception Dashboard',
    description: 'Alerts, anomalies, and exception handling queue',
    category: 'operations',
    route: '/admin/dashboards/security',
    lastUpdated: '2026-03-06',
  },
  {
    id: 'forecast',
    name: 'Forecast Dashboard',
    description: 'Demand forecasting, trend predictions, and projections',
    category: 'kpis',
    route: '/admin/dashboards/kpis',
    lastUpdated: '2026-03-05',
  },
  {
    id: 'depreciation',
    name: 'Depreciation Dashboard',
    description: 'Asset depreciation tracking and book value analysis',
    category: 'financial',
    route: '/admin/dashboards/assets',
    lastUpdated: '2026-03-04',
  },
  {
    id: 'yard',
    name: 'Yard Dashboard',
    description: 'Gate management, dock scheduling, and vehicle tracking',
    category: 'warehouse',
    route: '/admin/warehouses?tab=warehouse-ops',
    lastUpdated: '2026-03-05',
  },
  {
    id: 'cross-dock',
    name: 'Cross-Dock Dashboard',
    description: 'Cross-docking operations and staging area utilization',
    category: 'warehouse',
    route: '/admin/warehouses?tab=warehouse-ops',
    lastUpdated: '2026-03-04',
  },
];

const PINNED_DASHBOARDS_KEY = 'nit-scs-pinned-dashboards';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPinnedIds(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_DASHBOARDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function togglePinned(dashboardId: string): string[] {
  const pinned = getPinnedIds();
  const idx = pinned.indexOf(dashboardId);
  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    pinned.push(dashboardId);
  }
  localStorage.setItem(PINNED_DASHBOARDS_KEY, JSON.stringify(pinned));
  return [...pinned];
}

// ── Mini Chart Placeholder ──────────────────────────────────────────────────

const MiniChartPreview: React.FC<{ gradientFrom: string; gradientTo: string }> = ({ gradientFrom, gradientTo }) => (
  <div className={`h-20 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} overflow-hidden relative`}>
    <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="none" className="opacity-40">
      <polyline
        points="0,60 25,45 50,55 75,30 100,40 125,20 150,35 175,15 200,25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/60"
      />
      <polyline
        points="0,70 25,60 50,65 75,50 100,55 125,40 150,50 175,35 200,40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white/30"
      />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <Eye size={16} className="text-white/20" />
    </div>
  </div>
);

// ── Sub-components ──────────────────────────────────────────────────────────

const DashboardCard: React.FC<{
  dashboard: DashboardPreview;
  isPinned: boolean;
  onTogglePin: () => void;
  onClick: () => void;
  gradientFrom: string;
  gradientTo: string;
}> = ({ dashboard, isPinned, onTogglePin, onClick, gradientFrom, gradientTo }) => {
  const category = DASHBOARD_CATEGORIES.find(c => c.id === dashboard.category);
  const Icon = category?.icon ?? LayoutDashboard;
  const color = category?.color ?? 'text-gray-400';

  return (
    <div
      className="glass-card rounded-2xl border border-white/10 overflow-hidden
        hover:scale-[1.02] hover:border-white/20 transition-all duration-300 group cursor-pointer
        focus-visible:ring-2 focus-visible:ring-nesma-secondary focus-visible:outline-none"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Mini preview gradient */}
      <MiniChartPreview gradientFrom={gradientFrom} gradientTo={gradientTo} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon size={16} className={color} />
            <h3 className="text-sm font-semibold text-white group-hover:text-nesma-secondary transition-colors truncate">
              {dashboard.name}
            </h3>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="p-1 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label={isPinned ? 'Unpin dashboard' : 'Pin dashboard'}
          >
            <Star
              size={14}
              className={isPinned ? 'text-amber-400 fill-amber-400' : 'text-gray-400 hover:text-gray-400'}
            />
          </button>
        </div>
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{dashboard.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{dashboard.lastUpdated}</span>
          </div>
          <ArrowRight
            size={14}
            className="text-gray-400 group-hover:text-nesma-secondary group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </div>
  );
};

const CategoryFilterChip: React.FC<{
  category: DashboardCategory;
  isActive: boolean;
  onClick: () => void;
}> = ({ category, isActive, onClick }) => {
  const Icon = category.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
        transition-all duration-300 border ${
          isActive
            ? 'bg-nesma-primary text-white border-nesma-primary/50 shadow-lg shadow-nesma-primary/20'
            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
        }`}
    >
      <Icon size={14} />
      {category.label}
      <span className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{category.dashboardCount}</span>
    </button>
  );
};

// ── Quick Stats ─────────────────────────────────────────────────────────────

const DashboardStats: React.FC<{ pinnedCount: number }> = ({ pinnedCount }) => {
  const stats = [
    {
      label: 'Dashboards',
      value: String(PRESET_DASHBOARDS.length),
      icon: LayoutDashboard,
      color: 'text-nesma-secondary',
    },
    { label: 'Categories', value: String(DASHBOARD_CATEGORIES.length), icon: BarChart3, color: 'text-emerald-400' },
    { label: 'Pinned', value: String(pinnedCount), icon: Star, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="glass-card rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5">
                <Icon size={18} className={stat.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

export const DashboardsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  const handleTogglePin = useCallback((dashboardId: string) => {
    const updated = togglePinned(dashboardId);
    setPinnedIds(updated);
  }, []);

  const handleDashboardClick = useCallback(
    (dashboard: DashboardPreview) => {
      navigate(dashboard.route);
    },
    [navigate],
  );

  const handleCreateDashboard = useCallback(() => {
    navigate('/admin/settings?tab=dashboard-builder');
  }, [navigate]);

  const handleCategoryFilter = useCallback((categoryId: string) => {
    setActiveCategory(prev => (prev === categoryId ? null : categoryId));
  }, []);

  const filteredDashboards = useMemo(() => {
    let dashboards = PRESET_DASHBOARDS;
    if (activeCategory) {
      dashboards = dashboards.filter(d => d.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      dashboards = dashboards.filter(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    return dashboards;
  }, [activeCategory, searchQuery]);

  const pinnedDashboards = useMemo(() => PRESET_DASHBOARDS.filter(d => pinnedIds.includes(d.id)), [pinnedIds]);

  const getCategoryGradient = (categoryId: string) => {
    const cat = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    return {
      gradientFrom: cat?.gradientFrom ?? 'from-gray-500/20',
      gradientTo: cat?.gradientTo ?? 'to-gray-600/5',
    };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-nesma-primary/20">
              <LayoutDashboard size={24} className="text-nesma-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboards</h1>
              <p className="text-sm text-gray-400">Monitor operations with real-time visual dashboards</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleCreateDashboard}
          className="flex items-center gap-2 px-5 py-2.5 bg-nesma-primary hover:bg-nesma-primary/80
            text-white text-sm font-medium rounded-lg transition-all duration-300
            shadow-lg shadow-nesma-primary/20"
        >
          <Plus size={16} />
          Create Dashboard
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search dashboards..."
          className="w-full pl-11 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl
            text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-nesma-secondary/50
            transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 text-gray-400"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <DashboardStats pinnedCount={pinnedIds.length} />

      {/* Pinned Dashboards */}
      {pinnedDashboards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Pinned Dashboards</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedDashboards.map(dashboard => {
              const { gradientFrom, gradientTo } = getCategoryGradient(dashboard.category);
              return (
                <DashboardCard
                  key={`pinned-${dashboard.id}`}
                  dashboard={dashboard}
                  isPinned={true}
                  onTogglePin={() => handleTogglePin(dashboard.id)}
                  onClick={() => handleDashboardClick(dashboard)}
                  gradientFrom={gradientFrom}
                  gradientTo={gradientTo}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Chips */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-nesma-secondary" />
          <h2 className="text-lg font-semibold text-white">All Dashboards</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
              transition-all duration-300 border ${
                !activeCategory
                  ? 'bg-nesma-primary text-white border-nesma-primary/50 shadow-lg shadow-nesma-primary/20'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
          >
            <Zap size={14} />
            All
          </button>
          {DASHBOARD_CATEGORIES.map(cat => (
            <CategoryFilterChip
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.id}
              onClick={() => handleCategoryFilter(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Dashboard Grid */}
      {filteredDashboards.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
          <Search size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400 mb-2">No dashboards match your criteria</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory(null);
            }}
            className="text-sm text-nesma-secondary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {filteredDashboards.map(dashboard => {
            const { gradientFrom, gradientTo } = getCategoryGradient(dashboard.category);
            return (
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                isPinned={pinnedIds.includes(dashboard.id)}
                onTogglePin={() => handleTogglePin(dashboard.id)}
                onClick={() => handleDashboardClick(dashboard)}
                gradientFrom={gradientFrom}
                gradientTo={gradientTo}
              />
            );
          })}
        </div>
      )}

      {/* Quick Links */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreateDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <Plus size={14} />
            Dashboard Builder
          </button>
          <button
            onClick={() => navigate('/admin/reports-hub')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <Shield size={14} />
            Reports Hub
          </button>
          <button
            onClick={() => navigate('/admin/map')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <Truck size={14} />
            Map View
          </button>
        </div>
      </div>
    </div>
  );
};
