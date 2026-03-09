import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart,
  Plus,
  Search,
  Package,
  ClipboardList,
  DollarSign,
  Truck,
  ShieldCheck,
  Wrench,
  Clock,
  Star,
  ArrowRight,
  BarChart3,
  TrendingUp,
  X,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ReportCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
  reportCount: number;
  route: string;
}

interface RecentReport {
  id: string;
  name: string;
  category: string;
  accessedAt: string;
  route: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    description: 'Stock levels, bin cards, ABC analysis, expiry alerts',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    reportCount: 12,
    route: '/admin/settings?tab=reports&category=inventory',
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: ClipboardList,
    description: 'GRN, MI, MRN, transfers, document analytics',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    reportCount: 8,
    route: '/admin/settings?tab=reports&category=operations',
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: DollarSign,
    description: 'Cost allocation, valuation, budget tracking',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    reportCount: 6,
    route: '/admin/settings?tab=reports&category=financial',
  },
  {
    id: 'logistics',
    label: 'Logistics',
    icon: Truck,
    description: 'Shipments, customs, transport, SLA tracking',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    reportCount: 5,
    route: '/admin/settings?tab=reports&category=logistics',
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: ShieldCheck,
    description: 'QCI results, compliance audits, supplier scores',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    reportCount: 4,
    route: '/admin/settings?tab=reports&category=quality',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    icon: Wrench,
    description: 'Tools, vehicles, generators, AMC status',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    reportCount: 3,
    route: '/admin/settings?tab=reports&category=equipment',
  },
];

const RECENT_REPORTS_KEY = 'nit-scs-recent-reports';
const FAVORITE_REPORTS_KEY = 'nit-scs-favorite-reports';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRecentReports(): RecentReport[] {
  try {
    const stored = localStorage.getItem(RECENT_REPORTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getFavoriteIds(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITE_REPORTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function toggleFavorite(reportId: string): string[] {
  const favorites = getFavoriteIds();
  const idx = favorites.indexOf(reportId);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(reportId);
  }
  localStorage.setItem(FAVORITE_REPORTS_KEY, JSON.stringify(favorites));
  return [...favorites];
}

// ── Sub-components ──────────────────────────────────────────────────────────

const CategoryCard: React.FC<{
  category: ReportCategory;
  onClick: () => void;
}> = ({ category, onClick }) => {
  const Icon = category.icon;
  return (
    <button
      onClick={onClick}
      className="glass-card rounded-2xl p-6 border border-white/10 text-left
        hover:scale-[1.02] hover:border-white/20 transition-all duration-300 group
        focus-visible:ring-2 focus-visible:ring-nesma-secondary focus-visible:outline-none"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${category.bgColor}`}>
          <Icon size={24} className={category.color} />
        </div>
        <ArrowRight
          size={16}
          className="text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-300"
        />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-nesma-secondary transition-colors">
        {category.label}
      </h3>
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{category.description}</p>
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">{category.reportCount} reports</span>
      </div>
    </button>
  );
};

const RecentReportCard: React.FC<{
  report: RecentReport;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}> = ({ report, isFavorite, onToggleFavorite, onClick }) => {
  const category = REPORT_CATEGORIES.find(c => c.id === report.category);
  const Icon = category?.icon ?? FileBarChart;
  const color = category?.color ?? 'text-gray-400';

  return (
    <div
      className="glass-card rounded-xl p-4 border border-white/10 min-w-[220px] max-w-[260px]
        hover:border-white/20 transition-all duration-300 group flex-shrink-0 cursor-pointer"
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
      <div className="flex items-start justify-between mb-3">
        <Icon size={18} className={color} />
        <button
          onClick={e => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={14}
            className={isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-400 hover:text-gray-400'}
          />
        </button>
      </div>
      <h4 className="text-sm font-medium text-white truncate group-hover:text-nesma-secondary transition-colors">
        {report.name}
      </h4>
      <div className="flex items-center gap-1.5 mt-2">
        <Clock size={12} className="text-gray-400" />
        <span className="text-[11px] text-gray-400">{new Date(report.accessedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

// ── Quick Stats Bar ─────────────────────────────────────────────────────────

const QuickStats: React.FC = () => {
  const stats = [
    { label: 'Total Reports', value: '38', icon: FileBarChart, color: 'text-nesma-secondary' },
    { label: 'Categories', value: '6', icon: BarChart3, color: 'text-emerald-400' },
    { label: 'This Month', value: '12', icon: TrendingUp, color: 'text-amber-400' },
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

export const ReportsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentReports(getRecentReports());
    setFavoriteIds(getFavoriteIds());
  }, []);

  const handleToggleFavorite = useCallback((reportId: string) => {
    const updated = toggleFavorite(reportId);
    setFavoriteIds(updated);
  }, []);

  const handleCategoryClick = useCallback(
    (category: ReportCategory) => {
      navigate(category.route);
    },
    [navigate],
  );

  const handleRecentClick = useCallback(
    (report: RecentReport) => {
      navigate(report.route);
    },
    [navigate],
  );

  const handleNewReport = useCallback(() => {
    navigate('/admin/settings?tab=report-builder');
  }, [navigate]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return REPORT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return REPORT_CATEGORIES.filter(c => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [searchQuery]);

  const favoriteReports = useMemo(
    () => recentReports.filter(r => favoriteIds.includes(r.id)),
    [recentReports, favoriteIds],
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-nesma-primary/20">
              <FileBarChart size={24} className="text-nesma-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
              <p className="text-sm text-gray-400">Insights and analytics across all operations</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleNewReport}
          className="flex items-center gap-2 px-5 py-2.5 bg-nesma-primary hover:bg-nesma-primary/80
            text-white text-sm font-medium rounded-lg transition-all duration-300
            shadow-lg shadow-nesma-primary/20"
        >
          <Plus size={16} />
          New Report
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search reports by name or category..."
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
      <QuickStats />

      {/* Recent Reports & Favorites */}
      {(recentReports.length > 0 || favoriteReports.length > 0) && (
        <div className="space-y-4">
          {/* Favorites */}
          {favoriteReports.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Favorites</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {favoriteReports.map(report => (
                  <RecentReportCard
                    key={`fav-${report.id}`}
                    report={report}
                    isFavorite={true}
                    onToggleFavorite={() => handleToggleFavorite(report.id)}
                    onClick={() => handleRecentClick(report)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent */}
          {recentReports.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-gray-400" />
                <h2 className="text-lg font-semibold text-white">Recent Reports</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {recentReports.slice(0, 5).map(report => (
                  <RecentReportCard
                    key={`recent-${report.id}`}
                    report={report}
                    isFavorite={favoriteIds.includes(report.id)}
                    onToggleFavorite={() => handleToggleFavorite(report.id)}
                    onClick={() => handleRecentClick(report)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Categories */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-nesma-secondary" />
          <h2 className="text-lg font-semibold text-white">Report Categories</h2>
        </div>
        {filteredCategories.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
            <Search size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-400">No categories match your search</p>
            <button onClick={() => setSearchQuery('')} className="mt-3 text-sm text-nesma-secondary hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredCategories.map(category => (
              <CategoryCard key={category.id} category={category} onClick={() => handleCategoryClick(category)} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/admin/settings?tab=report-builder')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <Plus size={14} />
            Report Builder
          </button>
          <button
            onClick={() => navigate('/admin/settings?tab=reports')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <FileBarChart size={14} />
            All Reports
          </button>
          <button
            onClick={() => navigate('/admin/dashboards-hub')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg
              text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-300"
          >
            <BarChart3 size={14} />
            Dashboards Hub
          </button>
        </div>
      </div>
    </div>
  );
};
