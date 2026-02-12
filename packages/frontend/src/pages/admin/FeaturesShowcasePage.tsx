import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Star,
  Grid3X3,
  PackageCheck,
  PackageOpen,
  Undo2,
  FileText,
  ArrowLeftRight,
  Building2,
  Database,
  LayoutGrid,
  AlertTriangle,
  Layers,
  Globe,
  Hash,
  Briefcase,
  DoorOpen,
  Truck,
  FileSignature,
  Zap,
  Fuel,
  Wrench,
  Hammer,
  ClipboardList,
  Route,
  Trash2,
  Gavel,
  PackagePlus,
  Ship,
  Shield,
  Timer,
  Bell,
  HandMetal,
  Waves,
  ArrowDownToLine,
  RefreshCw,
  BarChart3,
  Merge,
  Smartphone,
  ScanLine,
  QrCode,
  Thermometer,
  ParkingCircle,
  Barcode,
  TrendingUp,
  Map,
  ClipboardCheck,
  AlertOctagon,
  Calculator,
  ListChecks,
  LayoutDashboard,
  FileSpreadsheet,
  FileDown,
  PieChart,
  Users,
  Activity,
  MapPin,
  DatabaseZap,
  GitBranch,
  GitPullRequest,
  Store,
  Link,
  CheckCheck,
  Mail,
  BellRing,
  Clock,
  FilePlus2,
  Settings2,
  Copy,
  Upload,
  UserPlus,
  MessageSquare,
  Sparkles,
  Brain,
  ShieldAlert,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { FEATURES_CATALOG, FEATURE_CATEGORIES, CATEGORY_COLORS, type FeatureCategory } from '@/data/features-catalog';

// ── Icon Registry ──────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  PackageCheck,
  PackageOpen,
  Undo2,
  FileText,
  ArrowLeftRight,
  Building2,
  Database,
  LayoutGrid,
  AlertTriangle,
  Layers,
  Globe,
  Hash,
  Briefcase,
  DoorOpen,
  Truck,
  FileSignature,
  Zap,
  Fuel,
  Wrench,
  Hammer,
  ClipboardList,
  Route,
  Trash2,
  Gavel,
  PackagePlus,
  Ship,
  Shield,
  Timer,
  Bell,
  HandMetal,
  Waves,
  ArrowDownToLine,
  RefreshCw,
  BarChart3,
  Merge,
  Smartphone,
  ScanLine,
  QrCode,
  Thermometer,
  ParkingCircle,
  Barcode,
  TrendingUp,
  Map,
  ClipboardCheck,
  AlertOctagon,
  Calculator,
  ListChecks,
  LayoutDashboard,
  FileSpreadsheet,
  FileDown,
  PieChart,
  Users,
  Activity,
  MapPin,
  DatabaseZap,
  GitBranch,
  GitPullRequest,
  Store,
  Link,
  CheckCheck,
  Mail,
  BellRing,
  Clock,
  FilePlus2,
  Settings2,
  Copy,
  Upload,
  UserPlus,
  MessageSquare,
  Sparkles,
  Brain,
  ShieldAlert,
  LineChart,
};

// ── Component ──────────────────────────────────────────────────────────

export const FeaturesShowcasePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | 'all'>('all');

  const filtered = useMemo(() => {
    let list = FEATURES_CATALOG;
    if (selectedCategory !== 'all') {
      list = list.filter(f => f.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        f =>
          f.title.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const active = FEATURES_CATALOG.filter(f => f.status === 'active').length;
    return { total: FEATURES_CATALOG.length, active, categories: FEATURE_CATEGORIES.length };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Package className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Features Catalog</h1>
            <p className="text-sm text-gray-400">Explore all capabilities of NIT Supply Chain V2</p>
          </div>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-white/10 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-1">Total Features</div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/10 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Star className="w-4 h-4 text-emerald-400" />
            <span className="text-2xl font-bold text-white">{stats.active}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">Active</div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/10 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Grid3X3 className="w-4 h-4 text-nesma-secondary" />
            <span className="text-2xl font-bold text-white">{stats.categories}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">Categories</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search features..."
            className="input-field w-full pl-10"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategory === 'all' ? 'bg-nesma-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            All ({FEATURES_CATALOG.length})
          </button>
          {FEATURE_CATEGORIES.map(cat => {
            const count = FEATURES_CATALOG.filter(f => f.category === cat).length;
            const colors = CATEGORY_COLORS[cat];
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.text} border ${colors.border}`
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filtered.length} of {FEATURES_CATALOG.length} features
      </div>

      {/* Features Grid */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
          <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No features match your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(feature => {
            const Icon = ICON_MAP[feature.iconName] ?? Package;
            const catColors = CATEGORY_COLORS[feature.category];
            const isComingSoon = feature.status === 'coming-soon';

            return (
              <div
                key={feature.id}
                className={`glass-card rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] ${
                  isComingSoon ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${catColors.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${catColors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-white truncate">{feature.title}</h3>
                      {isComingSoon && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{feature.description}</p>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${catColors.bg} ${catColors.text}`}
                    >
                      {feature.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
