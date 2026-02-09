import React, { useState } from 'react';
import {
  Package,
  Truck,
  Clock,
  DollarSign,
  Star,
  Warehouse,
  FileBarChart,
  FolderOpen,
  Activity,
} from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { toast } from '@/components/Toaster';
import { useDashboardStats, useInventorySummary, useSLACompliance, useDocumentCounts } from '@/api/hooks';

// ── Report Categories ─────────────────────────────────────────────────────

interface ReportCategory {
  title: string;
  description: string;
  icon: React.ElementType;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: 'Inventory Reports',
    description: 'Stock levels, movement history, valuation analysis',
    icon: Package,
  },
  {
    title: 'Job Order Reports',
    description: 'JO status, completion rates, type distribution',
    icon: Truck,
  },
  {
    title: 'SLA Reports',
    description: 'Compliance tracking, overdue analysis',
    icon: Clock,
  },
  {
    title: 'Financial Reports',
    description: 'Material values, cost analysis',
    icon: DollarSign,
  },
  {
    title: 'Supplier Performance',
    description: 'Delivery metrics, quality scores',
    icon: Star,
  },
  {
    title: 'Warehouse Activity',
    description: 'Receiving/issuing volumes, throughput',
    icon: Warehouse,
  },
];

// ── Report Card Component ─────────────────────────────────────────────────

const ReportCard: React.FC<ReportCategory> = ({ title, description, icon: Icon }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGenerate = () => {
    toast.info('Report generation coming soon');
  };

  return (
    <div className="glass-card p-6 rounded-xl hover:border-nesma-secondary/30 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-3 bg-gradient-to-br from-nesma-primary to-nesma-dark text-white rounded-xl shadow-lg border border-white/10">
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 text-sm mb-4 leading-relaxed">{description}</p>

      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-nesma-secondary/50"
          placeholder="Start"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-nesma-secondary/50"
          placeholder="End"
        />
      </div>

      <button
        onClick={handleGenerate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm font-medium hover:bg-nesma-accent transition-colors shadow-lg shadow-nesma-primary/20"
      >
        <FileBarChart size={14} />
        Generate Report
      </button>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────

export const ReportsHubPage: React.FC = () => {
  const statsQuery = useDashboardStats();
  const inventoryQuery = useInventorySummary();
  const slaQuery = useSLACompliance();
  const docCountsQuery = useDocumentCounts();

  const stats = statsQuery.data?.data;
  const invSummary = inventoryQuery.data?.data;
  const sla = slaQuery.data?.data;
  const docCounts = docCountsQuery.data?.data;

  const totalDocs =
    (docCounts?.mrrv.total ?? 0) +
    (docCounts?.mirv.total ?? 0) +
    (docCounts?.jo.total ?? 0) +
    (docCounts?.shipments.total ?? 0);

  const isLoading = statsQuery.isLoading || inventoryQuery.isLoading || slaQuery.isLoading || docCountsQuery.isLoading;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white glow-text">Reports Hub</h1>
        <p className="text-gray-400 text-sm mt-1">Generate, view, and export operational reports</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          title="Total Documents"
          value={totalDocs}
          icon={FolderOpen}
          color="bg-nesma-primary"
          sublabel="All Types"
          loading={isLoading}
        />
        <KpiCard
          title="Active Projects"
          value={stats?.activeJobs ?? 0}
          icon={Activity}
          color="bg-emerald-500"
          sublabel="Current Period"
          loading={isLoading}
        />
        <KpiCard
          title="Total Value"
          value={invSummary?.totalValue ? `${(invSummary.totalValue / 1000).toFixed(0)}K` : '0'}
          icon={DollarSign}
          color="bg-amber-500"
          sublabel="SAR"
          loading={isLoading}
        />
        <KpiCard
          title="SLA Compliance"
          value={`${sla?.compliancePct ?? 0}%`}
          icon={Clock}
          color="bg-blue-500"
          sublabel={`${sla?.overdue ?? 0} overdue`}
          loading={isLoading}
        />
      </div>

      {/* Report Category Cards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Report Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REPORT_CATEGORIES.map(cat => (
            <ReportCard key={cat.title} {...cat} />
          ))}
        </div>
      </div>
    </div>
  );
};
